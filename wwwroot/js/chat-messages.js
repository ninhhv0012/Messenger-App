"use strict";

// Module xử lý tin nhắn văn bản
window.ChatMessages = (function () {
    // Private variables
    let chatId;
    let currentUserId;
    let currentUsername;
    let chatType;

    // Khởi tạo module
    function init(id, userId, username, type) {
        console.log("ChatMessages module initialized");
        chatId = id;
        currentUserId = userId;
        currentUsername = username;
        chatType = type;

        // Đảm bảo không thiết lập handler nhiều lần
        $('#btnSend').off('click.chatMessages').on('click.chatMessages', function () {
            const content = $('#txtMessage').val().trim();

            // Nếu có file được chọn, thì ChatFile module sẽ xử lý
            if (window.ChatFile && window.ChatFile.hasFileSelected()) {
                console.log("File selected, ChatFile module will handle this");
                return;
            }

            // Nếu không có file và không có nội dung, không làm gì cả
            if (!content) return;

            console.log("Sending text message:", content);
            sendTextMessage(content);
        });

        console.log("ChatMessages module initialized");
    }

    // Gửi tin nhắn văn bản
    function sendTextMessage(content) {
        console.log("Sending text message:", content);

        // Tạo timestamp cho tin nhắn
        const timestamp = new Date().toISOString();

        // Tạo messageKey duy nhất
        const messageKey = `${currentUserId}_${content}_${timestamp}`;

        // Hiển thị tin nhắn của mình ngay lập tức
        const align = 'justify-content-end';
        const bubble = $('<div>')
            .addClass(`d-flex ${align} mb-2 msg-item`)
            .attr('data-message-id', messageKey);

        const inner = $('<div>')
            .addClass('p-2 rounded bg-primary text-white')
            .css('max-width', '70%');

        // Nội dung tin nhắn
        inner.append($('<div>').text(content));

        bubble.append(inner);
        $('#messageList').append(bubble);

        // Cuộn xuống
        $('#detailContainer').scrollTop($('#detailContainer')[0].scrollHeight);

        // Xóa nội dung tin nhắn
        $('#txtMessage').val('').trigger('input');

        // Gửi tin nhắn qua API
        $.post('/Chat/SendMessage', {
            chatId: chatId,
            content: content
        })
            .done(function (response) {
                console.log("Message sent successfully:", response);
            })
            .fail(function (error) {
                console.error("Send error:", error);
                alert("Không thể gửi tin nhắn. Vui lòng thử lại sau.");
            });
    }

    // Public API
    return {
        init: init,
        sendTextMessage: sendTextMessage
    };
})();