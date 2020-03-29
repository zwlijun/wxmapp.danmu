/**
 * 消息结构
 * @author carlli
 */
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

export default IOMessage;