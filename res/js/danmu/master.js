import IOMessage from "./iomessage.js";

/**
 * 弹幕主线程
 * @author carlli
 */
const DanmuMaster = {
    master: null,
    context: null,
    enabled: false,
    testTimer: null,
    init: function(context, selector) {
        if (!context || !selector) {
            throw new Error("Illegal `context` or `selector` arguments!")
        }
        DanmuMaster.context = context;
        //-------------------------------
        if (!DanmuMaster.master) {
            DanmuMaster.master = wx.createWorker("res/workers/danmu.js");
            DanmuMaster.listen();
        }

        const query = wx.createSelectorQuery();
        const nf = query.select(selector);

        if (nf) {
            nf.boundingClientRect((rect) => {
                if (!rect || !rect.width || !rect.height) {
                    throw new Error("Not found the DANMU BOX");
                }
                DanmuMaster.master.postMessage(new IOMessage(IOMessage.TYPES.INIT, rect))
            }).exec();
        }
    },
    random: function(minValue, maxValue) {
        const rnd = (Math.random() * (maxValue - minValue)) + minValue;

        return Math.floor(rnd);
    },
    listen: function() {
        DanmuMaster.master.onMessage((message) => {
            const type = message.type;
            const body = message.body;
            const context = DanmuMaster.context;

            // console.log("master", type)

            const $dm = context.data.$dm || {};

            if (type === IOMessage.TYPES.UPDATE) {
                // console.log(body.style)
                $dm[body.uuid] = body;
                context.setData({
                    $dm: $dm
                })
            } else if (type === IOMessage.TYPES.DELETE) {
                delete $dm[body.uuid];
                context.setData({
                    $dm: $dm
                })
            } else if (type === IOMessage.TYPES.RECEIVED) {
                $dm[body.uuid] = body;
                context.setData({
                    $dm: $dm
                })

                const query = wx.createSelectorQuery();
                const nf = query.select(`#dm_${body.uuid}`);

                if (nf) {
                    nf.boundingClientRect((rect) => {
                        rect = rect || {};
                        rect.width = rect.width || 150;
                        body.rect = rect;

                        DanmuMaster.master.postMessage(new IOMessage(IOMessage.TYPES.RENDER, body))
                    }).exec()
                }
            } else if (type === IOMessage.TYPES.CLOSED) {
                context.setData({
                    $dm: {},
                    enabledDanmu: false,
                });
            } else if (type === IOMessage.TYPES.ENABLED) {
                context.setData({
                    enabledDanmu: true,
                })
            }
        });
    },
    sendDanmu: function(text, options) {
        options = options || {};

        if (DanmuMaster.enabled && DanmuMaster.master) {
            DanmuMaster.master.postMessage(new IOMessage(IOMessage.TYPES.MESSAGE, {
                text: text,
                offsetTopRatio: options.offsetTopRatio || 0.1,
                offsetBottomRatio: options.offsetTopRatio || 0.2,
                fontSize: options.fontSize || [24, 40],
                duration: options.duration || [3000, 8000],
                ratio: options.ratio || 1
            }))
        }
    },
    open: function() {
        if (DanmuMaster.master) {
            DanmuMaster.enabled = true;
            DanmuMaster.master.postMessage(new IOMessage(IOMessage.TYPES.OPEN, {}));
        }
    },
    close: function() {
        if (DanmuMaster.master) {
            DanmuMaster.enabled = false;
            DanmuMaster.master.postMessage(new IOMessage(IOMessage.TYPES.CLOSE, {}));
        }
    },
    clear: function() {
        if (DanmuMaster.context) {
            DanmuMaster.context.setData({
                $dm: {}
            })
        }
    },
    terminate: function() {
        if (DanmuMaster.master) {
            DanmuMaster.master.terminate();
        }
    },
    test: function() {
        DanmuMaster.open();

        if (DanmuMaster.testTimer) {
            clearTimeout(DanmuMaster.testTimer);
            DanmuMaster.testTimer = null;
        }

        var _test = function() {
            DanmuMaster.sendDanmu("carlli: 这是一条弹幕...");

            DanmuMaster.testTimer = setTimeout(() => {
                _test()
            }, DanmuMaster.random(30, 800));
        }

        _test();
    }
};

export default DanmuMaster;