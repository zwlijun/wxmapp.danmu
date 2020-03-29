/**
 * 弹幕Worker线程
 * @author carlli
 */

/**********************************************************
 * IOMessage 消息对象                                      *
 **********************************************************/
function IOMessage(type, body) {
    this.type = type;
    this.body = body || {};
}

IOMessage.TYPES = {
    INIT: "init",
    MESSAGE: "message",
    UPDATE: "update",
    DELETE: "delete",
    SHOT: "shot",
    RECEIVED: "received",
    RENDER: "render",
    OPEN: "open",
    CLOSE: "close",
    CLOSED: "closed",
    ENABLED: "enabled"
};

/**********************************************************
 * 弹幕对象                                                *
 **********************************************************/
function Danmu(text, offsetTopRatio, offsetBottomRatio, fontSize, duration, ratio) {
    duration = duration || [];
    fontSize = fontSize || [];

    this.text = text;
    this.color = this.getRandomColor();
    this.fontSize = this.random(fontSize[0] || 24, fontSize[1] || 40);
    this.offsetTopRatio = offsetTopRatio;
    this.offsetBottomRatio = offsetBottomRatio;
    this.uuid = this.UUID(32);
    this.duration = this.random(duration[0] || 60, duration[1] || 200);
    this.ratio = ratio || 1;
    this.rect = {};
    //-------------------------
    const pos = this.getRandomPosition();
    this.x = pos.x;
    this.y = pos.y;
    //-------------------------
    this.style = this.css();
};

Danmu.prototype = {
    UUID: function(len, radix) {
        const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');
        let uuid = [],
            i;

        radix = radix || 16;

        if (len) {
            for (i = 0; i < len; i++) {
                uuid[i] = chars[0 | Math.random() * radix];
            }
        } else {
            // rfc4122, version 4 form
            let r;

            // rfc4122 requires these characters
            uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';
            uuid[14] = '4';

            // Fill in random data. At i==19 set the high bits of clock sequence as
            // per rfc4122, sec. 4.1.5
            for (i = 0; i < 36; i++) {
                if (!uuid[i]) {
                    r = 0 | Math.random() * 16;
                    uuid[i] = chars[(i == 19) ? (r & 0x3) | 0x8 : r];
                }
            }
        }

        return uuid.join('');
    },
    getRandomColor: function() {
        let rgb = []

        for (let i = 0; i < 3; ++i) {
            let color = this.random(0, 256).toString(16)
            color = color.length == 1 ? '0' + color : color
            rgb.push(color)
        }
        return '#' + rgb.join('')
    },
    random: function(minValue, maxValue) {
        const rnd = (Math.random() * (maxValue - minValue)) + minValue;

        return Math.floor(rnd);
    },
    getRandomPosition: function() {
        const offsetTop = this.offsetTopRatio * Danmu.height;
        const offsetBottom = this.offsetBottomRatio * Danmu.height;

        const pos = {
            x: Danmu.width,
            y: this.random(offsetTop, Danmu.height - offsetBottom)
        }

        return pos;
    },
    css: function() {
        const buf = [];

        // buf.push(`left: ${this.x}rpx`);
        buf.push(`top: ${this.y}px`);
        buf.push(`transform: translate(${this.x}px, 0px) translateZ(0)`);
        buf.push(`font-size: ${this.fontSize}rpx`);
        buf.push(`color: ${this.color}`);
        buf.push(`transition: transform linear ${this.duration}ms`);

        return buf.join("; ");
    },
    shot: function() {
        const __dm = this;
        const rect = __dm.rect || {
            width: 150
        };
        const nw = -(rect.width || 150);

        // console.log("rect.width", rect.width, nw)
        
        __dm.x = nw;
        __dm.style = __dm.css();

        worker.postMessage(new IOMessage(IOMessage.TYPES.UPDATE, __dm));

        setTimeout(() => {
            worker.postMessage(new IOMessage(IOMessage.TYPES.DELETE, __dm));
        }, __dm.duration);
    }
};

Danmu.enabled = false;
Danmu.width = 375;
Danmu.height = 221;
Danmu.entries = {};
Danmu.list = [];
Danmu.putDanmu = function(dm) {
    Danmu.entries[dm.uuid].rect = dm.rect;
    Danmu.list.push(dm);
    Danmu.polling();
};

Danmu.polling = function() {
    const dm = Danmu.list.shift();

    if (!dm) {
        return;
    }

    const ins = Danmu.entries[dm.uuid];
    ins.shot();
    delete Danmu.entries[dm.uuid];

    Danmu.polling();
};

/**********************************************************
 * Worker处理                                              *
 **********************************************************/
const WorkerMessage = {
    worker: 0,
    init: function(message) {
        const body = message.body;

        Danmu.width = body.width;
        Danmu.height = body.height;

        console.log(Danmu.width, Danmu.height)
    },
    message: function(message) {
        if (Danmu.enabled) {
            const body = message.body;
            const dm = new Danmu(
                body.text,
                body.offsetTopRatio,
                body.offsetBottomRatio,
                body.fontSize,
                body.duration,
                body.ratio
            );
            Danmu.entries[dm.uuid] = dm;
            worker.postMessage(new IOMessage(IOMessage.TYPES.RECEIVED, dm));
        }
    },
    render: function(message) {
        const body = message.body;
        // console.log("render", body)
        Danmu.putDanmu(body);
    },
    open: function(message) {
        Danmu.enabled = true;

        worker.postMessage(new IOMessage(IOMessage.TYPES.ENABLED, {}));
    },
    close: function(message) {
        Danmu.list.length = 0;
        Danmu.list = [];

        Danmu.enabled = false;

        worker.postMessage(new IOMessage(IOMessage.TYPES.CLOSED, {}));
    }
};

if (WorkerMessage.worker === 0) {
    worker.onMessage((message) => {
        const type = message.type;

        if (type && (type in WorkerMessage)) {
            // console.log("child", type)
            WorkerMessage[type](message);
        }
    })
}
WorkerMessage.worker++;

console.log("WorkerMessage.worker", WorkerMessage.worker);