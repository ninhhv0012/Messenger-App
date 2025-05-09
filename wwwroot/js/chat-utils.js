"use strict";

// Module chứa các hàm tiện ích dùng chung
window.ChatUtils = (function () {
    // Khởi tạo
    function init() {
        console.log("ChatUtils module initialized");
    }

    // Format datetime - Chuyển UTC sang GMT+7
    function formatDateTime(isoString) {
        if (!isoString) return 'Không xác định';

        try {
            // Tạo đối tượng Date từ chuỗi ISO (UTC)
            const date = new Date(isoString);

            if (isNaN(date.getTime())) {
                return 'Ngày không hợp lệ';
            }

            // Tính toán giờ GMT+7 bằng cách cộng thêm 7 giờ
            const gmtPlus7 = new Date(date.getTime() + (7 * 60 * 60 * 1000));

            // Format theo định dạng "HH:MM DD/MM/YYYY"
            const day = String(gmtPlus7.getUTCDate()).padStart(2, '0');
            const month = String(gmtPlus7.getUTCMonth() + 1).padStart(2, '0');
            const year = gmtPlus7.getUTCFullYear();

            const hours = String(gmtPlus7.getUTCHours()).padStart(2, '0');
            const minutes = String(gmtPlus7.getUTCMinutes()).padStart(2, '0');

            return `${hours}:${minutes} ${day}/${month}/${year}`;
        } catch (e) {
            console.error("Error formatting date:", e, isoString);
            return 'Lỗi định dạng ngày';
        }
    }

    // Format kích thước file
    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' bytes';
        else if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
        else return (bytes / 1048576).toFixed(2) + ' MB';
    }

    // Phát âm thanh thông báo
    function playNotificationSound() {
        // Tạo element âm thanh nếu chưa có
        if ($('#notificationSound').length === 0) {
            $('body').append('<audio id="notificationSound" src="/sounds/notification.mp3" preload="auto"></audio>');
        }

        // Phát âm thanh
        const sound = document.getElementById('notificationSound');
        if (sound) {
            sound.play().catch(e => console.log('Error playing sound:', e));
        } else {
            console.warn("Notification sound element not found");
        }
    }

    // Kiểm tra xem thư mục uploads đã tồn tại chưa
    function checkUploadDirectory() {
        $.get('/Chat/SystemCheck')
            .done(function (response) {
                console.log("Upload directory check:", response);
            })
            .fail(function (error) {
                console.warn("Could not check upload directory:", error);
            });
    }

    // Public API
    return {
        init: init,
        formatDateTime: formatDateTime,
        formatFileSize: formatFileSize,
        playNotificationSound: playNotificationSound,
        checkUploadDirectory: checkUploadDirectory
    };
})();

// Khởi tạo ngay khi file được load
window.ChatUtils.init();