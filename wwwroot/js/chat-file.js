"use strict";

// Module xử lý file trong chat
window.ChatFile = (function () {
    // Private variables
    let chatId;
    let currentUserId;
    let currentUsername;
    let selectedFile = null;

    // Khởi tạo module
    function init(id, userId, username) {
        console.log("ChatFile module initialized");
        chatId = id;
        currentUserId = userId;
        currentUsername = username;

        // Tránh đăng ký sự kiện nhiều lần
        // Thiết lập handler cho sự kiện thay đổi file input
        $('#fileInput').off('change').on('change', function (e) {
            const file = e.target.files[0];
            console.log("File selected:", file);

            if (!file) {
                resetFileInput();
                return;
            }

            // Kiểm tra kích thước file (25MB = 25 * 1024 * 1024 bytes)
            if (file.size > 25 * 1024 * 1024) {
                alert('Kích thước file không được vượt quá 25MB');
                resetFileInput();
                return;
            }

            // Lưu file đã chọn
            selectedFile = file;

            // Hiển thị thông tin file đã chọn
            $('#selectedFileName').text(file.name);
            $('#fileType').text(file.type || 'Không xác định');
            $('#fileSize').text(window.ChatUtils.formatFileSize(file.size));

            // Kiểm tra xem file có phải là ảnh để hiển thị preview
            if (file.type.startsWith('image/')) {
                $('#imagePreview').show();
                $('#fileInfo').hide();

                // Đọc file và hiển thị preview
                const reader = new FileReader();
                reader.onload = function (e) {
                    $('#previewImg').attr('src', e.target.result);
                };
                reader.readAsDataURL(file);
            } else {
                $('#imagePreview').hide();
                $('#fileInfo').show();
            }

            // Hiển thị khu vực preview
            $('#filePreviewArea').show();

            // Cập nhật trạng thái nút gửi
            if (window.ChatCore) {
                window.ChatCore.updateSendButtonState();
            }
        });

        // Xử lý nút xóa file đã chọn
        $('#removeFile').off('click').on('click', function () {
            console.log("Remove file button clicked");
            resetFileInput();
        });

        // Thêm handler cho nút gửi chỉ cho file
        $('#btnSend').off('click.chatFile').on('click.chatFile', function () {
            if (selectedFile) {
                console.log("Send button clicked with file selected");
                const content = $('#txtMessage').val().trim();
                uploadFile(content);
                // Return false để ngăn handler khác xử lý nếu sự kiện là cho file
                return false;
            }
            // Nếu không có file, để handler khác xử lý (không trả về gì)
        });

        console.log("ChatFile module initialized");
    }

    // Hàm upload file
    function uploadFile(textContent) {
        if (!selectedFile) {
            console.error("No file selected for upload");
            return;
        }

        console.log("Uploading file:", selectedFile.name);

        // Tạo form data để gửi file
        const formData = new FormData();
        formData.append('chatId', chatId);
        formData.append('file', selectedFile);

        // Thêm text content nếu có
        if (textContent) {
            console.log("Adding text content to upload:", textContent);
            formData.append('content', textContent);
        }

        // Hiển thị trạng thái đang gửi
        $('#btnSend').prop('disabled', true).text('Đang gửi...');

        // Debug: log formData contents
        for (let pair of formData.entries()) {
            console.log(pair[0] + ': ' + (pair[1] instanceof File ? pair[1].name : pair[1]));
        }

        // Gửi file lên server
        $.ajax({
            url: '/Chat/UploadFile',
            type: 'POST',
            data: formData,
            processData: false,  // Quan trọng cho việc upload file
            contentType: false,  // Quan trọng cho việc upload file
            success: function (response) {
                console.log("File uploaded successfully:", response);

                // Thêm tin nhắn vào giao diện (nếu là file của mình)
                const messageKey = `${currentUserId}_${response.content}_${response.timestamp}`;
                const bubble = $('<div>')
                    .addClass('d-flex justify-content-end mb-2 msg-item')
                    .attr('data-message-id', messageKey)
                    .attr('data-timestamp', response.timestamp);

                const inner = $('<div>')
                    .addClass('p-2 rounded bg-primary text-white')
                    .css('max-width', '70%');

                // Xử lý nội dung dựa trên loại file
                if (response.messageType === 'Image') {
                    inner.append($('<img>').attr('src', response.content).addClass('img-fluid'));
                } else {
                    // Kiểm tra xem response.content có tồn tại không
                    const fileName = response.content && typeof response.content === 'string'
                        ? response.content.split('/').pop()
                        : 'file';
                    inner.append(
                        $('<a>')
                            .attr('href', response.content || '#')
                            .attr('download', '')
                            .css('color', 'white')
                            .html(`<i class="fas fa-file-download me-1"></i>${fileName}`)
                    );
                }

                bubble.append(inner);
                $('#messageList').append(bubble);

                // Cuộn xuống
                $('#detailContainer').scrollTop($('#detailContainer')[0].scrollHeight);

                // Reset giao diện
                resetUI();
            },
            error: function (xhr, status, error) {
                console.error("Error uploading file:", xhr.responseText);
                console.error("Status:", status);
                console.error("Error:", error);
                alert("Không thể gửi file. Vui lòng thử lại sau. Lỗi: " + (xhr.responseJSON ? xhr.responseJSON.message : error));
                $('#btnSend').prop('disabled', false).text('Gửi');
            }
        });
    }

    // Reset input file
    function resetFileInput() {
        console.log("Resetting file input");
        $('#fileInput').val('');
        selectedFile = null;
        $('#filePreviewArea').hide();
        $('#imagePreview').hide();
        $('#fileInfo').hide();
        if (window.ChatCore) {
            window.ChatCore.updateSendButtonState();
        }
    }

    // Reset UI sau khi gửi
    function resetUI() {
        console.log("Resetting UI after upload");
        $('#txtMessage').val('').trigger('input');
        resetFileInput();
        $('#btnSend').prop('disabled', false).text('Gửi');
    }

    // Public API
    return {
        init: init,
        uploadFile: uploadFile,
        hasFileSelected: function () { return selectedFile !== null; },
        resetFileInput: resetFileInput
    };
})();