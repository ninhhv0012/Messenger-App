$(document).ready(function () {
    const chatId = $("#chatId").val();
    const currentUserId = $("#currentUserId").val();
    const currentUsername = $("#currentUsername").val();

    // Khởi tạo ChatReminder nếu có
    if (window.ChatReminder) {
        console.log("Initializing ChatReminder module");
        window.ChatReminder.init(chatId, currentUserId, currentUsername);
    } else {
        console.warn("ChatReminder module not found!");
    }

    // Khởi tạo ChatUtils nếu cần
    if (!window.ChatUtils) {
        window.ChatUtils = {
            formatDateTime: function (isoString) {
                try {
                    const date = new Date(isoString);
                    // Định dạng theo múi giờ GMT+7 (tương đương với giờ Việt Nam)
                    const gmtPlus7 = new Date(date.getTime() + (7 * 60 * 60 * 1000));
                    return gmtPlus7.toLocaleString('vi-VN');
                } catch (e) {
                    console.error("Error formatting date:", e);
                    return isoString || "Không xác định";
                }
            },
            playNotificationSound: function () {
                // Thực hiện chức năng phát âm thanh nếu cần
                console.log("Notification sound would play here");
            }
        };
    }

    // Thêm chức năng hiển thị thông báo trong chat (sử dụng bởi ChatReminder)
    window.ChatCore = window.ChatCore || {};
    window.ChatCore.showInChatNotification = function (message) {
        // Hiển thị thông báo trong khung chat
        const systemMsg = {
            ChatId: chatId,
            SenderId: null,
            SenderUsername: "Hệ thống",
            Content: message,
            MessageType: "System",
            Timestamp: new Date().toISOString()
        };
        appendMessage(systemMsg);
    };

    // Kiểm tra và khởi tạo SignalR
    const connection = new signalR.HubConnectionBuilder()
        .withUrl("/chatHub")
        .withAutomaticReconnect()
        .build();

    // Xử lý nhận tin nhắn từ SignalR
    connection.on("ReceiveMessage", function (msg) {
        console.log("Received message:", msg);
        if (msg.chatId == chatId) {
            appendMessage(msg);
        }
    });

    // Xử lý nhận thông báo nhắc nhở
    connection.on("ReminderNotification", function (notification) {
        console.log("Received reminder notification:", notification);
        if (notification.chatId == chatId) {
            // Sử dụng ChatReminder để xử lý thông báo nếu có
            if (window.ChatReminder) {
                window.ChatReminder.processNotification(notification);
            } else {
                console.warn("ChatReminder not available to process notification");
            }
        }
    });

    // Bắt đầu kết nối SignalR
    connection.start()
        .then(function () {
            console.log("Connected to SignalR hub");
            $("#connection-status")
                .text("Đã kết nối")
                .removeClass("bg-secondary")
                .addClass("bg-success");

            // Tham gia nhóm chat
            return connection.invoke("JoinGroup", `chat_${chatId}`);
        })
        .then(function () {
            console.log(`Joined chat group: chat_${chatId}`);
            // Kích hoạt các phần tử UI
            $("#txtMessage").prop("disabled", false);
            $("#btnSend").prop("disabled", false);
            $("#fileInput").prop("disabled", false);
        })
        .catch(function (err) {
            console.error("Error connecting to SignalR hub:", err);
            $("#connection-status")
                .text("Lỗi kết nối")
                .removeClass("bg-secondary")
                .addClass("bg-danger");
        });

    // Xử lý gửi tin nhắn
    $("#btnSend").click(sendMessage);
    $("#txtMessage").keydown(function (e) {
        if (e.keyCode === 13 && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    function sendMessage() {
        const content = $("#txtMessage").val().trim();
        if (!content) return;

        $.post("/Chat/SendMessage", {
            chatId: chatId,
            content: content
        })
            .done(function (response) {
                console.log("Message sent successfully:", response);
                $("#txtMessage").val("").focus();
            })
            .fail(function (error) {
                console.error("Error sending message:", error);
                alert("Không thể gửi tin nhắn. Vui lòng thử lại.");
            });
    }

    // Khởi tạo xử lý file
    initFileHandling();
});