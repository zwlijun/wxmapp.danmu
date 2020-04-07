import TIM from 'tim-wx-sdk';

function WebIM(logLevel) {
    this.tim = null;
    this.logLevel = logLevel || WebIM.LOGGER.NORMAL;

    this.SDKAppID = "";

    this.ready = false;
    this.receivedMessageList = [];

    this.myInfo = {};
    this.blackList = [];
    this.groupInfo = {};

    this.userID = "";
    this.userSig = "";
    this.groupID = "";
    this.conversationID = "";

    this.isLoggedIn = false;

    this.handlers = {};
}

WebIM.MESSAGE = {
    TEXT: "Text", // 文本消息
    CUSTOM: "Custom", // 自定义消息
    IMAGE: "Image", // 图片消息
    AUDIO: "Audio", // 音频消息
    VIDEO: "Video", // 视频消息
    FACE: "Face", // 表情消息
    FILE: "File" // 文件消息
};

WebIM.LOGGER = {
    NORMAL: 0, // 普通级别，日志量较多，接入时建议使用
    RELEASE: 1, // release级别，SDK 输出关键信息，生产环境时建议使用
    WARN: 2, // 告警级别，SDK 只输出告警和错误级别的日志
    ERROR: 3, // 错误级别，SDK 只输出错误级别的日志
    NONE: 4 // 无日志级别，SDK 将不打印任何日志
};

WebIM.EVENT = {
    SDK_READY: TIM.EVENT.SDK_READY,
    MESSAGE_RECEIVED: TIM.EVENT.MESSAGE_RECEIVED,
    MESSAGE_REVOKED: TIM.EVENT.MESSAGE_REVOKED,
    CONVERSATION_LIST_UPDATED: TIM.EVENT.CONVERSATION_LIST_UPDATED,
    GROUP_LIST_UPDATED: TIM.EVENT.GROUP_LIST_UPDATED,
    GROUP_SYSTEM_NOTICE_RECEIVED: TIM.EVENT.GROUP_SYSTEM_NOTICE_RECEIVED,
    PROFILE_UPDATED: TIM.EVENT.PROFILE_UPDATED,
    BLACKLIST_UPDATED: TIM.EVENT.BLACKLIST_UPDATED,
    ERROR: TIM.EVENT.ERROR,
    SDK_NOT_READY: TIM.EVENT.SDK_NOT_READY,
    KICKED_OUT: TIM.EVENT.KICKED_OUT,
    NET_STATE_CHANGE: TIM.EVENT.NET_STATE_CHANGE,
};

WebIM.prototype = {
    hasLogin() {
        return true === this.isLoggedIn;
    },
    isSDKReady() {
        return true === this.ready;
    },
    inExpected() {
        return this.isSDKReady() && this.hasLogin();
    },
    init(SDKAppID) {
        if (!SDKAppID) {
            throw new Error('SDKAppID is undefined');
        }
        this.SDKAppID = SDKAppID;
    },
    create() {
        return new Promise((resolve, reject) => {
            if (!this.SDKAppID) {
                console.error('SDKAppID is undefined');

                reject({
                    message: 'SDKAppID is undefined'
                });
            } else {
                if (this.tim) {
                    console.warn("TIM has been instantiated");
                    resolve({
                        newInstance: false
                    })
                } else {
                    this.tim = TIM.create({
                        SDKAppID: this.SDKAppID
                    });

                    this.tim.setLogLevel(this.logLevel);

                    resolve({
                        newInstance: true
                    });
                }
            }
        });
    },
    listen(isRemoveListener) {
        const tim = this.tim;

        if (tim) {
            const method = true === isRemoveListener ? 'off' : 'on';

            console.log("listen", method);

            // 监听事件，如：
            tim[method](TIM.EVENT.SDK_READY, this.onSDKReady, this);
            tim[method](TIM.EVENT.MESSAGE_RECEIVED, this.onSDKMessageReceived, this);
            tim[method](TIM.EVENT.MESSAGE_REVOKED, this.onSDKMessageRevoked, this);
            tim[method](TIM.EVENT.CONVERSATION_LIST_UPDATED, this.onSDKConversationListUpdated, this);
            tim[method](TIM.EVENT.GROUP_LIST_UPDATED, this.onSDKGroupListUpdated, this);
            tim[method](TIM.EVENT.GROUP_SYSTEM_NOTICE_RECEIVED, this.onSDKGroupSystemNoticeReceived, this);
            tim[method](TIM.EVENT.PROFILE_UPDATED, this.onSDKProfileUpdated, this);
            tim[method](TIM.EVENT.BLACKLIST_UPDATED, this.onSDKBlacklistUpdated, this);
            tim[method](TIM.EVENT.ERROR, this.onSDKError, this);
            tim[method](TIM.EVENT.SDK_NOT_READY, this.onSDKNotReady, this);
            tim[method](TIM.EVENT.KICKED_OUT, this.onSDKKickedOut, this);
            tim[method](TIM.EVENT.NET_STATE_CHANGE, this.onSDKNetStateChange, this);
        } else {
            console.warn('TIM is not instantiated');
        }
    },
    on() {
        this.listen(false);
    },
    off() {
        this.listen(true);
    },
    login(userID, userSig) {
        return new Promise((resolve, reject) => {
            if (this.tim) {
                if (this.myInfo && this.myInfo.userID && this.myInfo.userID === userID) {
                    console.warn('Use history session.');
                    this.isLoggedIn = true;
                    resolve(this.myInfo);
                } else {
                    this.tim.login({
                        userID,
                        userSig
                    }).then((resp) => {
                        const {
                            data
                        } = resp || {};

                        if (data && 　data.repeatLogin === true) {
                            this.isLoggedIn = false;

                            console.warn('User(' + userID + ') repeat login.')
                            this.logout().then(() => {
                                return this.login(userID, userSig);
                            }).catch((err) => {
                                reject(err);
                            })

                            return;
                        }

                        this.isLoggedIn = true;
                        console.warn('User login success.');
                        resolve(resp);
                    }).catch((err) => {
                        this.isLoggedIn = false;
                        console.error('User login failed.', err);
                        reject(err);
                    })
                }
            } else {
                console.warn('TIM is not instantiated');
                this.isLoggedIn = false;
                reject({
                    message: 'SDK未初始化'
                });
            }
        });
    },
    logout() {
        return new Promise((resolve, reject) => {
            if (this.tim) {
                if (this.inExpected()) {
                    const logoutPromise = this.tim.logout();

                    if (logoutPromise) {
                        logoutPromise.then((resp) => {
                            this.isLoggedIn = false;
                            this.reset();

                            console.warn('User logout success.');
                            resolve(resp);
                        }).catch((err) => {
                            console.error('User logout failed.', err);

                            if (this.inExpected()) {
                                reject(err);
                            } else {
                                console.warn('`TIM.logout().catch()` is not invoke as expected.');
                                resolve({
                                    notExpectedInvoke: true
                                })
                            }
                        })
                    } else {
                        console.warn('`TIM.logout()` function missing return value(`Promise`)');
                        resolve({
                            missing: true
                        });
                    }
                } else {
                    console.warn('`TIM.logout().init()` is not invoke as expected.');
                    resolve({
                        notExpectedInvoke: true
                    })
                }
            } else {
                console.warn('TIM is not instantiated');
                reject({
                    message: 'SDK未初始化'
                });
            }
        });
    },
    joinGroup(groupID, type) {
        return new Promise((resolve, reject) => {
            if (this.tim) {
                if (this.isSDKReady()) {
                    this.tim.joinGroup({
                        groupID,
                        type: type || TIM.TYPES.GRP_AVCHATROOM
                    }).then((resp) => {
                        if (!this.inExpected()) {
                            console.warn('`TIM.joinGroup().then()` is not invoke as expected.');
                            resolve({
                                notExpectedInvoke: true
                            })

                            return;
                        }

                        console.warn('`TIM.joinGroup()` status is ' + resp.data.status);
                        switch (resp.data.status) {
                            case TIM.TYPES.JOIN_STATUS_WAIT_APPROVAL: // 等待管理员同意
                                reject(resp);
                                break;
                            case TIM.TYPES.JOIN_STATUS_SUCCESS: // 加群成功
                                this.groupID = groupID;
                                this.groupInfo = resp.data.group; // 加入的群组资料
                                resolve(resp);
                                break;
                            case TIM.TYPES.JOIN_STATUS_ALREADY_IN_GROUP: // 已经在群中
                                this.groupID = groupID;
                                resolve(resp)
                                break;
                            default:
                                reject(resp);
                                break;
                        }
                    }).catch((err) => {
                        console.warn('Joined group failed.', err);
                        if (this.inExpected()) {
                            reject(err);
                        } else {
                            console.warn('`TIM.joinGroup().catch()` is not invoke as expected.');
                            resolve({
                                notExpectedInvoke: true
                            })
                        }
                    })
                } else {
                    console.warn('`TIM.joinGroup().init()` is not invoke as expected.');
                    resolve({
                        notExpectedInvoke: true
                    })
                }
            } else {
                console.warn('TIM is not instantiated');
                reject({
                    message: 'SDK未初始化'
                });
            }
        });
    },
    quitGroup() {
        return new Promise((resolve, reject) => {
            if (this.tim && this.groupID) {
                if (this.isSDKReady()) {
                    this.tim.quitGroup(this.groupID).then((resp) => {
                        // console.log(imResponse.data.groupID); // 退出成功的群 ID
                        if (!this.inExpected()) {
                            console.warn('`TIM.quitGroup().then()` is not invoke as expected.');
                            resolve({
                                notExpectedInvoke: true
                            })

                            return;
                        }

                        resolve(resp);
                    }).catch((err) => {
                        if (this.isSDKReady()) {
                            reject(err);
                        } else {
                            console.warn('`TIM.quitGroup().catch()` is not invoke as expected.');
                            resolve({
                                notExpectedInvoke: true
                            })
                        }
                    })
                } else {
                    console.warn('`TIM.quitGroup().init()` is not invoke as expected.');
                    resolve({
                        notExpectedInvoke: true
                    })
                }
            } else {
                console.warn('TIM is not instantiated or not yet join group.');
                resolve({
                    data: {
                        groupID: this.groupID || ""
                    }
                });
            }
        });
    },
    sendMessage(type, conversationID, payload, extra, messageExtendData) {
        return new Promise((resolve, reject) => {
            if (this.tim) {
                const creator = `create${type}Message`;

                if (creator in this.tim) {
                    this.conversationID = conversationID;
                    const options = {
                        to: conversationID,
                        conversationType: TIM.TYPES.CONV_GROUP,
                        payload,
                    };

                    if (extra) {
                        for (let key in extra) {
                            if (extra.hasOwnProperty(key)) {
                                options[key] = extra[key];
                            }
                        }
                    }
                    const message = this.tim[creator](options);

                    if (messageExtendData) {
                        for (let mkey in messageExtendData) {
                            if (messageExtendData.hasOwnProperty(mkey)) {
                                message[mkey] = messageExtendData[mkey];
                            }
                        }
                    }

                    this.tim.sendMessage(message).then((resp) => {
                        resp.imsg = message;
                        resolve(resp);
                    }).catch((err) => {
                        err.imsg = message;

                        reject(err);
                    })
                } else {
                    reject({
                        message: `未知的消息类型(${type})`
                    });
                }
            } else {
                console.warn('TIM is not instantiated');
                reject({
                    message: 'SDK未初始化'
                });
            }
        })
    },
    resendMessage(message) {
        return new Promise((resolve, reject) => {
            if (this.tim) {
                this.tim.resendMessage(message).then((resp) => {
                    resp.imsg = message;
                    resolve(resp);
                }).catch((err) => {
                    err.imsg = message;

                    reject(err);
                })
            } else {
                console.warn('TIM is not instantiated');
                reject({
                    message: 'SDK未初始化'
                });
            }
        });
    },
    reset() {
        this.myInfo = {};
        this.blackList = [];
        this.userID = "";
        this.userSig = "";
        this.groupInfo = {};
        this.groupID = "";
        this.conversationID = "";
    },
    emit(eventType, event) {
        console.log("emit", eventType, event, this.handlers[eventType]);
        if (eventType in this.handlers) {
            if (this.handlers[eventType]) {
                this.handlers[eventType](event);
            }
        }
    },
    register(eventType, callback) {
        this.handlers[eventType] = callback;
    },
    unregister(eventType) {
        if (!eventType) {
            for (let e in this.handlers) {
                if (this.handlers.hasOwnProperty(e)) {
                    this.unregister(e);
                }
            }
        } else {
            delete this.handlers[eventType];
        }
    },
    onSDKReady(event) {
        // 收到离线消息和会话列表同步完毕通知，接入侧可以调用 sendMessage 等需要鉴权的接口
        // event.name - TIM.EVENT.SDK_READY
        this.ready = true;

        this.tim.getMyProfile().then(res => {
            this.myInfo = res.data || {};
        });
        this.tim.getBlacklist().then(res => {
            this.blackList = res.data || [];
        });

        this.emit(event.name, event);
    },
    onSDKNotReady(event) {
        // 收到 SDK 进入 not ready 状态通知，此时 SDK 无法正常工作
        // event.name - TIM.EVENT.SDK_NOT_READY
        this.ready = false;
        this.reset();

        console.warn("Recived SDK not ready event.");
        this.emit(event.name, event);
    },
    onSDKKickedOut(event) {
        // 收到被踢下线通知
        // event.name - TIM.EVENT.KICKED_OUT
        // event.data.type - 被踢下线的原因，例如 :
        //   - TIM.TYPES.KICKED_OUT_MULT_ACCOUNT 多实例登录被踢
        //   - TIM.TYPES.KICKED_OUT_MULT_DEVICE 多终端登录被踢
        //   - TIM.TYPES.KICKED_OUT_USERSIG_EXPIRED 签名过期被踢（v2.4.0起支持）。
        if(event.data.type === TIM.TYPES.KICKED_OUT_USERSIG_EXPIRED || event.data.type === TIM.TYPES.KICKED_OUT_MULT_ACCOUNT){
            this.login();
        }else{
            wx.showModal({
                title: "下线通知",
                content: "在其他设备登录",
                showCancel: true,
                cancelText: "取消",
                cancelColor: "#333333",
                confirmText: "重新登录",
                confirmColor: "#FF6D00",
                success: (res) => {
                    var confirm = res.confirm;
                    var cancel = res.cancel;

                    if (confirm) {
                        //@todo
                        this.login();
                    } else if (cancel) {
                        //@todo
                        wx.navigateBack({
                            complete: (res) => {},
                        })
                    }
                }
            })
        }

        this.emit(event.name, event);
    },
    onSDKMessageReceived(event) {
        // 收到推送的单聊、群聊、群提示、群系统通知的新消息，可通过遍历 event.data 获取消息列表数据并渲染到页面
        // event.name - TIM.EVENT.MESSAGE_RECEIVED
        // event.data - 存储 Message 对象的数组 - [Message]

        this.emit(event.name, event);
    },
    onSDKMessageRevoked(event) {
        // 收到消息被撤回的通知。使用前需要将SDK版本升级至v2.4.0或以上。
        // event.name - TIM.EVENT.MESSAGE_REVOKED
        // event.data - 存储 Message 对象的数组 - [Message] - 每个 Message 对象的 isRevoked 属性值为 true

        this.emit(event.name, event);
    },
    onSDKConversationListUpdated(event) {
        // 收到会话列表更新通知，可通过遍历 event.data 获取会话列表数据并渲染到页面
        // event.name - TIM.EVENT.CONVERSATION_LIST_UPDATED
        // event.data - 存储 Conversation 对象的数组 - [Conversation]

        this.emit(event.name, event);
    },
    onSDKGroupListUpdated(event) {
        // 收到群组列表更新通知，可通过遍历 event.data 获取群组列表数据并渲染到页面
        // event.name - TIM.EVENT.GROUP_LIST_UPDATED
        // event.data - 存储 Group 对象的数组 - [Group]

        this.emit(event.name, event);
    },
    onSDKGroupSystemNoticeReceived(event) {
        // 收到新的群系统通知
        // event.name - TIM.EVENT.GROUP_SYSTEM_NOTICE_RECEIVED
        // event.data.type - 群系统通知的类型，详情请参见 GroupSystemNoticePayload 的 operationType 枚举值说明
        // event.data.message - Message 对象，可将 event.data.message.content 渲染到到页面
        // console.log(event.name, event.data);

        this.emit(event.name, event);
    },
    onSDKProfileUpdated(event) {
        // 收到自己或好友的资料变更通知
        // event.name - TIM.EVENT.PROFILE_UPDATED
        // event.data - 存储 Profile 对象的数组 - [Profile]

        this.emit(event.name, event);
    },
    onSDKBlacklistUpdated(event) {
        // 收到黑名单列表更新通知
        // event.name - TIM.EVENT.BLACKLIST_UPDATED
        // event.data - 存储 userID 的数组 - [userID]

        this.emit(event.name, event);
    },
    onSDKError(event) {
        // 收到 SDK 发生错误通知，可以获取错误码和错误信息
        // event.name - TIM.EVENT.ERROR
        // event.data.code - 错误码
        // event.data.message - 错误信息
        // 网络错误不弹toast && sdk未初始化完全报错
        if (event.data.message && event.data.code && event.data.code !== 2800 && event.data.code !== 2999) {
            wx.showToast({
                title: `[001]${event.data.message}`,
                duration: 2000
            })
        }

        this.emit(event.name, event);
    },
    onSDKNetStateChange(event) {
        // 网络状态发生改变（v2.5.0 起支持）。
        // event.name - TIM.EVENT.NET_STATE_CHANGE
        // event.data.state 当前网络状态，枚举值及说明如下：
        //   - TIM.TYPES.NET_STATE_CONNECTED - 已接入网络
        //   - TIM.TYPES.NET_STATE_CONNECTING - 连接中。很可能遇到网络抖动，SDK 在重试。接入侧可根据此状态提示“当前网络不稳定”或“连接中”
        //   - TIM.TYPES.NET_STATE_DISCONNECTED - 未接入网络。接入侧可根据此状态提示“当前网络不可用”。SDK 仍会继续重试，若用户网络恢复，SDK 会自动同步消息
        switch (event.data.state) {
            case TIM.TYPES.NET_STATE_CONNECTED:
                break;
            case TIM.TYPES.NET_STATE_CONNECTING:
                break;
            case TIM.TYPES.NET_STATE_DISCONNECTED:
                wx.showToast({
                    title: '当前网络弱或不可用',
                    icon: 'none',
                })
                break;
        }

        this.emit(event.name, event);
    },
};

export default WebIM;