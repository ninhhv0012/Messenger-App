"use strict";

// Module chính để khởi tạo chat
window.ChatCore = (function () {
    // Private variables
    let chatId;
    let currentUserId;
    let currentUsername;
    let chatType;
    let connection;

    // Sử dụng Map để theo dõi tin nhắn đã xử lý với timestamp
    const processedMessages = new Map();

    // Khởi tạo module
    function init() {
        console.log("Initializing ChatCore module");

        if (window.chatInitialized) {
            console.log("Chat already initialized, skipping");
            return false;
        }

        window.chatInitialized = true;

        // Đọc thông tin cơ bản từ DOM
        chatId = $('#chatId').val();
        currentUserId = parseInt($('#currentUserId').val());
        currentUsername = $('#currentUsername').val();
        chatType = $('#chatType').val();

        console.log("Chat initialized with:", {
            chatId: chatId,
            currentUserId: currentUserId,
            currentUsername: currentUsername,
            chatType: chatType
        });

        // Hiển thị trạng thái kết nối
        $('#connection-status').removeClass('bg-secondary').addClass('bg-success').text('Đã kết nối');

        // Kích hoạt giao diện
        $('#txtMessage').prop('disabled', false);
        $('#btnSend').prop('disabled', true);
        $('#fileInput').prop('disabled', false);

        // Thiết lập kết nối SignalR
        setupSignalR();

        // Thiết lập các event handlers
        setupEventHandlers();

        // Dọn dẹp cache tin nhắn cũ sau mỗi phút
        setInterval(function () {
            const now = Date.now();
            processedMessages.forEach((timestamp, key) => {
                if (now - timestamp > 60000) { // 1 phút
                    processedMessages.delete(key);
                }
            });
        }, 60000);

        // Cuộn xuống dưới ban đầu
        setTimeout(function () {
            $('#detailContainer').scrollTop($('#detailContainer')[0].scrollHeight);
        }, 100);

        // Khởi tạo các chức năng phụ thuộc
        if (window.ChatMessages) {
            console.log("Initializing ChatMessages module");
            window.ChatMessages.init(chatId, currentUserId, currentUsername, chatType);
        } else {
            console.warn("ChatMessages module not found");
        }

        if (window.ChatFile) {
            console.log("Initializing ChatFile module");
            window.ChatFile.init(chatId, currentUserId, currentUsername);
        } else {
            console.warn("ChatFile module not found");
        }

        if (window.ChatReminder && chatType === 'Group') {
            console.log("Initializing ChatReminder module");
            window.ChatReminder.init(chatId, currentUserId, currentUsername);
        } else if (chatType === 'Group') {
            console.warn("ChatReminder module not found");
        }

        return true;
    }

    // Thiết lập kết nối SignalR
    function setupSignalR() {
        // Đóng kết nối cũ nếu có
        if (window.signalRConnection) {
            try {
                window.signalRConnection.stop();
                console.log("Closed existing SignalR connection");
            } catch (e) {
                console.error("Error closing existing connection:", e);
            }
        }

        // Khởi tạo kết nối SignalR mới
        connection = new signalR.HubConnectionBuilder()
            .withUrl("/chathub")
            .build();

        // Lưu tham chiếu connection toàn cục
        window.signalRConnection = connection;

        // Thiết lập handler cho sự kiện nhận tin nhắn
        connection.on("ReceiveMessage", processMessages);

        // Thiết lập handler cho sự kiện nhận thông báo nhắc nhở
        connection.on("ReminderNotification", function (data) {
            console.log("Reminder notification received:", data);

            if (window.ChatReminder) {
                window.ChatReminder.processNotification(data);
            } else {
                console.warn("ChatReminder module not found - can't process notification");
            }
        });

        // Bắt đầu kết nối
        connection.start()
            .then(() => {
                console.log("Connected to SignalR hub");
                // Tham gia nhóm chat
                return connection.invoke("JoinGroup", `chat_${chatId}`);
            })
            .then(() => {
                console.log("Joined chat group: chat_" + chatId);

                // Tải danh sách reminder hiện có nếu là group chat
                if (window.ChatReminder && chatType === 'Group') {
                    window.ChatReminder.loadReminders();
                }
            })
            .catch(err => {
                console.error("Connection error:", err);
                $('#connection-status').removeClass('bg-secondary bg-success').addClass('bg-danger').text('Mất kết nối');
            });
    }

    // Xử lý tin nhắn nhận được từ SignalR
    function processMessages(data) {
        console.log("SignalR message received:", data);

        // Tạo ID duy nhất cho tin nhắn
        const messageKey = `${data.senderId}_${data.content}_${data.timestamp}`;

        // Kiểm tra xem tin nhắn này đã được xử lý trước đó chưa
        const now = Date.now();
        const lastProcessed = processedMessages.get(messageKey);

        if (lastProcessed && (now - lastProcessed) < 10000) {
            console.log("Skipping duplicate message (processed within last 10 seconds):", messageKey);
            return;
        }

        // Đánh dấu tin nhắn là đã xử lý với thời gian hiện tại
        processedMessages.set(messageKey, now);

        // Lấy sender ID
        const senderId = typeof data.senderId === 'number' ? data.senderId : parseInt(data.senderId);

        // Kiểm tra loại tin nhắn
        const isSystemMessage = data.messageType === "System";

        // Nếu là tin nhắn hệ thống, hiển thị đặc biệt
        if (isSystemMessage) {
            displaySystemMessage(data.content, data.timestamp, data.senderId, data.senderUsername);
            return;
        }

        // Nếu là tin nhắn từ người khác
        if (senderId !== currentUserId) {
            console.log("Processing message from:", data.senderUsername);

            // Hiển thị tin nhắn từ người khác
            const align = 'justify-content-start';
            const bubble = $('<div>')
                .addClass(`d-flex ${align} mb-2 msg-item`)
                .attr('data-message-id', messageKey)
                .attr('data-timestamp', data.timestamp);

            const inner = $('<div>')
                .addClass('p-2 rounded bg-light')
                .css('max-width', '70%');

            // Hiển thị tên trong chat nhóm
            if (chatType === 'Group') {
                inner.append($('<div>').html(`<small><strong>${data.senderUsername}</strong></small>`));
            }

            // Xử lý nội dung dựa trên loại tin nhắn
            if (data.messageType === 'Image') {
                // Hiển thị hình ảnh
                inner.append($('<img>').attr('src', data.content).addClass('img-fluid'));
            } else if (data.messageType === 'File') {
                // Hiển thị link download
                const fileName = data.content.split('/').pop();
                inner.append(
                    $('<a>')
                        .attr('href', data.content)
                        .attr('download', '')
                        .html(`<i class="fas fa-file-download me-1"></i>${fileName}`)
                );
            } else {
                // Tin nhắn văn bản thông thường
                inner.append($('<div>').text(data.content));
            }

            bubble.append(inner);

            // Kiểm tra xem tin nhắn đã có trong DOM chưa
            if ($(`[data-message-id="${messageKey}"]`).length === 0) {
                $('#messageList').append(bubble);

                // Cuộn xuống
                $('#detailContainer').scrollTop($('#detailContainer')[0].scrollHeight);
            } else {
                console.log("Message already exists in DOM:", messageKey);
            }
        } else {
            console.log("Ignoring own message");
        }
    }

    // Hiển thị tin nhắn hệ thống
    function displaySystemMessage(content, timestamp, senderId, senderUsername) {
        // Tạo ID duy nhất cho tin nhắn
        const messageKey = `sys_${senderId}_${timestamp}`;

        // Kiểm tra xem tin nhắn đã hiển thị chưa
        if ($(`[data-message-id="${messageKey}"]`).length > 0) {
            console.log("System message already exists:", messageKey);
            return;
        }

        // Format nội dung tin nhắn (thay \n bằng <br>)
        const formattedContent = content.replace(/\n/g, '<br>');

        // Tạo phần tử tin nhắn hệ thống
        const systemMsg = $('<div>')
            .addClass('d-flex justify-content-center my-3 msg-item')
            .attr('data-message-id', messageKey)
            .attr('data-timestamp', timestamp);

        const inner = $('<div>')
            .addClass('system-message p-3 rounded')
            .css({
                'max-width': '80%',
                'border-left': '3px solid #007bff',
                'background-color': '#f8f9fa',
                'box-shadow': '0 1px 3px rgba(0,0,0,0.1)',
                'text-align': 'left'
            })
            .html(formattedContent);

        systemMsg.append(inner);

        // Thêm vào danh sách tin nhắn
        $('#messageList').append(systemMsg);

        // Cuộn xuống
        $('#detailContainer').scrollTop($('#detailContainer')[0].scrollHeight);
    }

    // Thiết lập các event handlers chung
    function setupEventHandlers() {
        // Xử lý phím Enter trong khung nhập tin nhắn
        $('#txtMessage').on('keypress', function (e) {
            if (e.which === 13 && !e.shiftKey) {
                e.preventDefault();
                $('#btnSend').click();
            }
        });

        // Cập nhật trạng thái nút gửi khi nhập nội dung
        $('#txtMessage').on('input', function () {
            updateSendButtonState();
        });
    }

    // Cập nhật trạng thái nút gửi
    function updateSendButtonState() {
        const hasText = $('#txtMessage').val().trim() !== '';
        const hasFile = window.ChatFile ? window.ChatFile.hasFileSelected() : false;
        $('#btnSend').prop('disabled', !hasText && !hasFile);
    }

    // Hiển thị thông báo trong chat
    function showInChatNotification(message) {
        console.log("Showing in-chat notification:", message);
        const notification = $('<div>')
            .addClass('text-center my-2')
            .html(`<small class="text-muted">${message}</small>`);

        $('#messageList').append(notification);
        $('#detailContainer').scrollTop($('#detailContainer')[0].scrollHeight);
    }

    // Public API
    return {
        init: init,
        updateSendButtonState: updateSendButtonState,
        getConnectionId: function () { return connection ? connection.connectionId : null; },
        getChatId: function () { return chatId; },
        getCurrentUserId: function () { return currentUserId; },
        getCurrentUsername: function () { return currentUsername; },
        getChatType: function () { return chatType; },
        showInChatNotification: showInChatNotification
    };
})();

// Khởi tạo chat khi document ready
$(document).ready(function () {
    console.log("Document ready, initializing chat");
    window.ChatCore.init();
});