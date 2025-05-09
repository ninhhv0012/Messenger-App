// Biến để theo dõi trạng thái tải tin nhắn
let isLoadingMessages = false;
let hasMoreMessages = true;

// Function để load thêm tin nhắn cũ
function loadOlderMessages() {
    if (isLoadingMessages || !hasMoreMessages) return;

    // Lấy timestamp của tin nhắn cũ nhất hiện tại
    const oldestMessage = $(".msg-item").first();
    if (oldestMessage.length === 0) return;

    const oldestTimestamp = oldestMessage.data("timestamp");
    const chatId = $("#chatId").val();

    // Hiển thị indicator loading
    isLoadingMessages = true;
    $("#loadingMessages").show();

    // Lưu lại vị trí cuộn hiện tại và chiều cao nội dung
    const container = $("#detailContainer");
    const scrollHeight = container[0].scrollHeight;

    // Gọi API để tải thêm tin nhắn cũ
    $.get(`/Chat/LoadMoreMessages?chatId=${chatId}&before=${encodeURIComponent(oldestTimestamp)}`)
        .done(function (html) {
            // Nếu không có tin nhắn trả về
            if (!html || html.trim() === '') {
                hasMoreMessages = false;
                console.log("Không còn tin nhắn cũ để tải");
                return;
            }

            // Thêm tin nhắn vào đầu danh sách
            $("#messageList").prepend(html);

            // Giữ nguyên vị trí cuộn tương đối bằng cách tính toán sự khác biệt chiều cao
            const newScrollHeight = container[0].scrollHeight;
            const heightDiff = newScrollHeight - scrollHeight;
            container.scrollTop(container.scrollTop() + heightDiff);
        })
        .fail(function (error) {
            console.error("Lỗi khi tải tin nhắn cũ:", error);
        })
        .always(function () {
            // Ẩn indicator loading và cập nhật trạng thái
            $("#loadingMessages").hide();
            isLoadingMessages = false;
        });
}

// Xử lý sự kiện cuộn để tải thêm tin nhắn khi người dùng cuộn lên trên
function setupScrollListener() {
    const container = $("#detailContainer");

    container.on('scroll', function () {
        // Nếu người dùng cuộn gần đến đỉnh của container (khoảng 100px)
        if (container.scrollTop() < 100 && !isLoadingMessages && hasMoreMessages) {
            loadOlderMessages();
        }
    });
}

// Cuộn xuống dưới cùng khi trang được tải
function scrollToBottom() {
    const container = $("#detailContainer");
    container.scrollTop(container[0].scrollHeight);
}

// Thêm tin nhắn vào giao diện
function appendMessage(message) {
    const currentUserId = $("#currentUserId").val();
    const chatType = $("#chatType").val();
    let html = '';

    if (message.messageType === "System") {
        // Tin nhắn hệ thống
        html = `
        <div class="d-flex justify-content-center my-3 msg-item" data-timestamp="${message.timestamp}" data-sender-id="${message.senderId}">
            <div class="system-message p-3 rounded" style="max-width: 80%; border-left: 3px solid #007bff; background-color: #f8f9fa; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: left;">
                ${message.content.replace(/\n/g, '<br>')}
            </div>
        </div>
        `;
    } else {
        // Tin nhắn thông thường
        const align = message.senderId == currentUserId ? "justify-content-end" : "justify-content-start";
        const bgClass = message.senderId == currentUserId ? "bg-primary text-white" : "bg-light";
        const textClass = message.senderId == currentUserId ? "text-white" : "";

        let senderInfo = '';
        if (chatType === 'Group' && message.senderId != currentUserId) {
            senderInfo = `<div><small><strong>${message.senderUsername}</strong></small></div>`;
        }

        let content = '';
        if (message.messageType === 'Image' && message.content) {
            content = `<img src="${message.content}" alt="Image" class="img-fluid" style="max-width: 100%;" />`;
        } else if (message.messageType === 'File' && message.content) {
            const fileName = message.fileName || message.content.split('/').pop();
            content = `<a href="${message.content}" download class="${textClass}">
                <i class="fas fa-file-download me-1"></i>${fileName}
            </a>`;
        } else {
            content = `<div>${message.content}</div>`;
        }

        html = `
        <div class="d-flex ${align} mb-2 msg-item" data-timestamp="${message.timestamp}" data-sender-id="${message.senderId}">
            <div class="p-2 rounded ${bgClass}" style="max-width:70%;">
                ${senderInfo}
                ${content}
            </div>
        </div>
        `;
    }

    $("#messageList").append(html);
    scrollToBottom();
}

// Khởi tạo khi trang được tải
$(document).ready(function () {
    setupScrollListener();
    scrollToBottom();
});