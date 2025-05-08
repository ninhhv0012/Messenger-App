"use strict";

// Singleton để quản lý kết nối SignalR
var SignalRConnection = (function () {
    var instance;
    var callbacks = {};

    function createInstance() {
        console.log("Creating SignalR connection instance");

        // Tạo kết nối
        var connection = new signalR.HubConnectionBuilder()
            .withUrl("/chathub")
            .withAutomaticReconnect([0, 2000, 5000, 10000, 20000]) // Thử kết nối lại với thời gian chờ tăng dần
            .configureLogging(signalR.LogLevel.Information)
            .build();

        // Xử lý sự kiện reconnect
        connection.onreconnecting(error => {
            console.log("SignalR reconnecting...", error);
            if (callbacks.onReconnecting) callbacks.onReconnecting(error);
        });

        connection.onreconnected(connectionId => {
            console.log("SignalR reconnected. Connection ID:", connectionId);
            if (callbacks.onReconnected) callbacks.onReconnected(connectionId);
        });

        connection.onclose(error => {
            console.log("SignalR connection closed", error);
            if (callbacks.onClose) callbacks.onClose(error);

            // Thử kết nối lại sau 5 giây
            setTimeout(() => {
                instance = null; // Reset instance
                SignalRConnection.start(); // Khởi động lại connection
            }, 5000);
        });

        // Xử lý sự kiện nhận tin nhắn
        connection.on("ReceiveMessage", function (message) {
            console.log("Received message via SignalR:", message);
            if (callbacks.onReceiveMessage) callbacks.onReceiveMessage(message);
        });

        // Xử lý sự kiện tham gia nhóm
        connection.on("JoinedGroup", function (data) {
            console.log("Joined group:", data);
            if (callbacks.onJoinedGroup) callbacks.onJoinedGroup(data);
        });

        return {
            connection: connection,

            // Khởi động kết nối
            start: function () {
                console.log("Starting SignalR connection...");
                return connection.start()
                    .then(() => {
                        console.log("SignalR connection established. Connection ID:", connection.connectionId);
                        if (callbacks.onConnected) callbacks.onConnected(connection.connectionId);
                        return connection;
                    })
                    .catch(err => {
                        console.error("SignalR connection error:", err);
                        if (callbacks.onError) callbacks.onError(err);

                        // Thử kết nối lại sau 5 giây
                        setTimeout(() => this.start(), 5000);
                        return Promise.reject(err);
                    });
            },

            // Tham gia nhóm chat
            joinChatGroup: function (chatId) {
                console.log("Joining chat group:", chatId);
                if (connection.state === signalR.HubConnectionState.Connected) {
                    return connection.invoke("JoinGroup", "chat_" + chatId)
                        .then(() => {
                            console.log("Successfully joined chat group:", chatId);
                            return true;
                        })
                        .catch(err => {
                            console.error("Error joining chat group:", err);
                            return false;
                        });
                } else {
                    console.warn("Connection not established yet. Will join group after connection");
                    callbacks.pendingGroup = "chat_" + chatId;
                    return Promise.resolve(false);
                }
            },

            // Gửi tin nhắn qua SignalR trực tiếp
            sendMessage: function (chatId, message) {
                if (connection.state === signalR.HubConnectionState.Connected) {
                    return connection.invoke("SendMessage",
                        chatId,
                        message.SenderId,
                        message.SenderUsername,
                        message.Content)
                        .then(() => {
                            console.log("Message sent via SignalR directly");
                            return true;
                        })
                        .catch(err => {
                            console.error("Error sending message via SignalR:", err);
                            return false;
                        });
                } else {
                    console.error("Cannot send message: SignalR connection not established");
                    return Promise.resolve(false);
                }
            },

            // Đăng ký callbacks
            registerCallbacks: function (newCallbacks) {
                callbacks = { ...callbacks, ...newCallbacks };
            },

            // Kiểm tra trạng thái kết nối
            isConnected: function () {
                return connection.state === signalR.HubConnectionState.Connected;
            }
        };
    }

    return {
        // Lấy instance
        getInstance: function () {
            if (!instance) {
                instance = createInstance();
            }
            return instance;
        },

        // Khởi động kết nối
        start: function () {
            var inst = this.getInstance();
            return inst.start();
        },

        // Đăng ký callbacks
        registerCallbacks: function (callbacks) {
            this.getInstance().registerCallbacks(callbacks);
        },

        // Tham gia nhóm chat
        joinChatGroup: function (chatId) {
            return this.getInstance().joinChatGroup(chatId);
        },

        // Gửi tin nhắn
        sendMessage: function (chatId, message) {
            return this.getInstance().sendMessage(chatId, message);
        },

        // Kiểm tra trạng thái kết nối
        isConnected: function () {
            if (!instance) return false;
            return this.getInstance().isConnected();
        }
    };
})();