"use strict";

// Module xử lý nhắc nhở trong chat
window.ChatReminder = (function () {
    // Private variables
    let chatId;
    let currentUserId;
    let currentUsername;
    let isLoadingReminders = false;

    // Khởi tạo module
    function init(id, userId, username) {
        console.log("ChatReminder module initialized with:", { id, userId, username });

        // Store chat information
        chatId = id;
        currentUserId = userId;
        currentUsername = username;

        // Ensure jQuery and Bootstrap are available
        if (typeof $ === 'undefined') {
            console.error("jQuery is not loaded! ChatReminder module requires jQuery.");
            return;
        }

        if (typeof bootstrap === 'undefined') {
            console.error("Bootstrap JS is not loaded! ChatReminder module requires Bootstrap.");
            return;
        }

        // Wait for document to be ready
        $(document).ready(function () {
            console.log("Document ready, adding reminder buttons");

            // Đảm bảo chỉ thêm các elements một lần
            if ($('#btnReminder').length === 0) {
                // Thêm nút tạo reminder
                addReminderButtons();
            }

            // Thiết lập handlers cho modal
            setupModalHandlers();

            console.log("ChatReminder initialization complete");
        });
    }

    // Thêm nút tạo reminder
    function addReminderButtons() {
        console.log("Adding reminder buttons to DOM");

        // Thêm nút bên cạnh nút gửi
        const reminderBtn = $('<button>')
            .attr('id', 'btnReminder')
            .addClass('btn btn-outline-info ms-2')
            .html('<i class="fas fa-bell"></i> Tạo nhắc nhở')
            .click(showReminderModal);

        $('#btnSend').after(reminderBtn);

        // Thêm modal tạo reminder
        if ($('#reminderModal').length === 0) {
            const modalHtml = `
            <div class="modal fade" id="reminderModal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Tạo nhắc nhở</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <form id="reminderForm">
                                <div class="mb-3">
                                    <label for="reminderTitle" class="form-label">Tiêu đề</label>
                                    <input type="text" class="form-control" id="reminderTitle" required>
                                </div>
                                <div class="mb-3">
                                    <label for="reminderDesc" class="form-label">Mô tả (tùy chọn)</label>
                                    <textarea class="form-control" id="reminderDesc" rows="3"></textarea>
                                </div>
                                <div class="mb-3">
                                    <label for="reminderDate" class="form-label">Ngày</label>
                                    <input type="date" class="form-control" id="reminderDate" required>
                                </div>
                                <div class="mb-3">
                                    <label for="reminderTime" class="form-label">Giờ</label>
                                    <input type="time" class="form-control" id="reminderTime" required>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Đóng</button>
                            <button type="button" class="btn btn-primary" id="btnSaveReminder">Lưu</button>
                        </div>
                    </div>
                </div>
            </div>`;

            $('body').append(modalHtml);
        }

        // Thêm modal xem danh sách reminder
        if ($('#viewRemindersModal').length === 0) {
            const viewModalHtml = `
            <div class="modal fade" id="viewRemindersModal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Danh sách nhắc nhở</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div id="reminderLoadingIndicator" class="text-center mb-3">
          
                                <p class="mt-2">Đang tải danh sách nhắc nhở...</p>
                            </div>
                            <div id="remindersList" style="max-height: 400px; overflow-y: auto;">
                                <!-- Nội dung sẽ được thêm vào đây -->
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Đóng</button>
                        </div>
                    </div>
                </div>
            </div>`;

            $('body').append(viewModalHtml);
        }

        // Thêm nút xem danh sách reminder
        const viewRemindersBtn = $('<button>')
            .attr('id', 'btnViewReminders')
            .addClass('btn btn-outline-secondary ms-2')
            .html('<i class="fas fa-list"></i> Xem nhắc nhở');

        $('#btnReminder').after(viewRemindersBtn);

        // Add click handler separately to ensure it's bound properly
        $('#btnViewReminders').off('click').on('click', function (e) {
            e.preventDefault();
            console.log("View reminders button clicked!");
            showViewRemindersModal();
        });

        console.log("Reminder buttons added successfully");
    }

    // Thiết lập handlers cho modal
    function setupModalHandlers() {
        // Lắng nghe sự kiện lưu reminder
        $(document).off('click', '#btnSaveReminder').on('click', '#btnSaveReminder', saveReminder);

        // Debug - kiểm tra xem nút xem nhắc nhở có sự kiện click không
        console.log("View reminders button has click event: " + ($._data && $('#btnViewReminders').length > 0 ? "Yes" : "No"));
    }

    // Hiển thị modal tạo reminder
    function showReminderModal() {
        console.log("Showing create reminder modal");

        // Lấy thời gian hiện tại theo UTC
        const now = new Date();

        // Chuyển sang GMT+7
        const gmtPlus7 = new Date(now.getTime() + (7 * 60 * 60 * 1000));

        // Format theo yêu cầu của input date và time
        const year = gmtPlus7.getUTCFullYear();
        const month = String(gmtPlus7.getUTCMonth() + 1).padStart(2, '0');
        const day = String(gmtPlus7.getUTCDate()).padStart(2, '0');

        const hours = String(gmtPlus7.getUTCHours()).padStart(2, '0');
        const minutes = String(gmtPlus7.getUTCMinutes()).padStart(2, '0');

        // Đặt giá trị cho input
        $('#reminderDate').val(`${year}-${month}-${day}`);
        $('#reminderTime').val(`${hours}:${minutes}`);

        // Hiển thị modal
        try {
            const reminderModalEl = document.getElementById('reminderModal');
            if (!reminderModalEl) {
                console.error("Cannot find reminderModal element");
                return;
            }

            const reminderModal = new bootstrap.Modal(reminderModalEl);
            reminderModal.show();
            console.log("Reminder modal shown successfully");
        } catch (error) {
            console.error("Error showing reminder modal:", error);
        }
    }

    // Hiển thị modal xem danh sách reminder
    function showViewRemindersModal() {
        console.log("Showing view reminders modal");

        try {
            // Kiểm tra xem modal element có tồn tại không
            const viewRemindersModalEl = document.getElementById('viewRemindersModal');
            if (!viewRemindersModalEl) {
                console.error("Cannot find viewRemindersModal element");
                return;
            }

            // Reset trạng thái và hiển thị loading
            isLoadingReminders = false;
            $('#remindersList').empty(); // Xóa nội dung cũ
            $('#reminderLoadingIndicator').show(); // Hiển thị indicator loading

            // Hiển thị modal
            const modal = new bootstrap.Modal(viewRemindersModalEl);
            modal.show();
            console.log("View reminders modal shown, now loading data");

            // Tải danh sách reminder
            loadAllReminders();
        } catch (error) {
            console.error("Error in showViewRemindersModal:", error);
            $('#reminderLoadingIndicator').hide();
            $('#remindersList').html('<div class="alert alert-danger">Có lỗi khi hiển thị modal. Vui lòng thử lại.</div>');
        }
    }

    // Lưu reminder
    function saveReminder() {
        const title = $('#reminderTitle').val().trim();
        const description = $('#reminderDesc').val().trim();
        const date = $('#reminderDate').val();
        const time = $('#reminderTime').val();

        if (!title || !date || !time) {
            alert('Vui lòng nhập đầy đủ thông tin bắt buộc!');
            return;
        }

        try {
            // Tạo đối tượng Date từ date và time (người dùng nhập GMT+7)
            const localDateTime = new Date(`${date}T${time}`);

            // Chuyển từ GMT+7 sang UTC bằng cách trừ 7 giờ
            const utcDateTime = new Date(localDateTime.getTime());

            // Gửi request tạo reminder với UTC
            $.post('/Reminder/Create', {
                chatId: chatId,
                title: title,
                description: description || null,
                reminderTime: utcDateTime.toISOString()
            })
                .done(function (response) {
                    console.log("Reminder created:", response);

                    // Đóng modal
                    const reminderModalEl = document.getElementById('reminderModal');
                    if (reminderModalEl) {
                        const reminderModal = bootstrap.Modal.getInstance(reminderModalEl);
                        if (reminderModal) {
                            reminderModal.hide();
                        }
                    }

                    // Reset form
                    $('#reminderForm')[0].reset();

                    // Hiển thị thông báo (với thời gian hiển thị theo GMT+7)
                    const formattedTime = window.ChatUtils.formatDateTime(utcDateTime.toISOString());
                    window.ChatCore.showInChatNotification(`Bạn đã tạo nhắc nhở "${title}" vào lúc ${formattedTime}`);
                })
                .fail(function (error) {
                    console.error("Error creating reminder:", error);
                    alert("Không thể tạo nhắc nhở. Vui lòng thử lại sau.");
                });
        } catch (e) {
            console.error("Error handling date:", e);
            alert("Lỗi xử lý thời gian. Vui lòng kiểm tra lại định dạng ngày giờ.");
        }
    }

    // Tải tất cả reminder
    function loadAllReminders() {
        if (isLoadingReminders) {
            console.log("Already loading reminders, skipping request");
            return;
        }

        const currentChatId = chatId || $('#chatId').val(); // Đảm bảo luôn có chatId
        console.log("Loading all reminders for chat:", currentChatId);

        isLoadingReminders = true;

        $.ajax({
            url: `/Reminder/GetChatReminders?chatId=${currentChatId}`,
            type: "GET",
            success: function (data) {
                console.log("Reminders loaded successfully:", data);

                // Luôn ẩn loading indicator khi đã load xong
                $('#reminderLoadingIndicator').hide();
                isLoadingReminders = false;

                if (!data || data.length === 0) {
                    // Không có reminder nào
                    $('#remindersList').html('<p class="text-center text-muted">Không có nhắc nhở nào</p>');
                } else {
                    // Hiển thị danh sách nhắc nhở
                    renderReminders(data);
                }
            },
            error: function (xhr, status, error) {
                console.error("Error loading reminders. Status:", status);
                console.error("Error details:", error);
                console.error("Response:", xhr.responseText);

                // Luôn ẩn loading indicator khi có lỗi
                $('#reminderLoadingIndicator').hide();
                isLoadingReminders = false;

                // Hiển thị thông báo lỗi
                $('#remindersList').html(`
                    <div class="alert alert-danger">
                        <p class="mb-0">Không thể tải danh sách nhắc nhở. Vui lòng thử lại sau.</p>
                        <small>${error}</small>
                    </div>
                `);
            }
        });
    }

    // Hàm render danh sách nhắc nhở
    function renderReminders(reminders) {
        console.log("Rendering reminders:", reminders);

        if (!reminders || reminders.length === 0) {
            $('#remindersList').html('<p class="text-center text-muted">Không có nhắc nhở nào</p>');
            return;
        }

        try {
            // Sắp xếp nhắc nhở theo thời gian giảm dần (mới nhất lên đầu)
            reminders.sort((a, b) => new Date(b.ReminderTime) - new Date(a.ReminderTime));

            let html = '';

            reminders.forEach(function (reminder) {
                if (!reminder) {
                    console.error("Found null/undefined reminder in data");
                    return; // Skip this iteration
                }

                // Đảm bảo các trường cần thiết tồn tại
                const title = reminder.Title || "Không có tiêu đề";
                const reminderId = reminder.ReminderId || 0;
                const description = reminder.Description || "";
                const isCompleted = reminder.IsCompleted || false;

                // Xử lý an toàn cho thời gian
                let localTimeStr = "Không xác định";
                try {
                    if (reminder.ReminderTime) {
                        const reminderTime = new Date(reminder.ReminderTime);
                        if (!isNaN(reminderTime.getTime())) { // Kiểm tra xem thời gian có hợp lệ không
                            localTimeStr = reminderTime.toLocaleString('vi-VN', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                            });
                        }
                    }
                } catch (error) {
                    console.error("Error formatting date for reminder:", reminder.reminderId, error);
                }

                // Xử lý an toàn cho username
                let username = "Không rõ";
                try {
                    if (reminder.User && reminder.User.Username) {
                        username = reminder.User.Username;
                    } else if (reminder.userName) {
                        username = reminder.userName;
                    }
                } catch (error) {
                    console.error("Error extracting username for reminder:", reminder.ReminderId, error);
                }

                // Định dạng trạng thái nhắc nhở
                const now = new Date();
                let reminderTime = null;
                try {
                    reminderTime = new Date(reminder.ReminderTime);
                } catch (e) {
                    console.error("Invalid date:", reminder.ReminderTime);
                }

                const statusClass = isCompleted
                    ? 'bg-success'
                    : (reminderTime && now > reminderTime ? 'bg-danger' : 'bg-warning');
                const statusText = isCompleted
                    ? 'Đã hoàn thành'
                    : (reminderTime && now > reminderTime ? 'Đã qua' : 'Sắp tới');

                html += `
                <div class="card mb-3 reminder-item" data-id="${reminderId}">
                    <div class="card-header d-flex justify-content-between align-items-center">
                        <span class="fw-bold">${title}</span>
                        <span class="badge ${statusClass}">${statusText}</span>
                    </div>
                    <div class="card-body">
                        ${description ? `<p class="card-text">${description}</p>` : ''}
                        <p class="card-text text-muted mb-1">
                            <small>Thời gian: ${localTimeStr}</small>
                        </p>
                        <p class="card-text text-muted mb-0">
                            <small>Người tạo: ${username}</small>
                        </p>
                    </div>
                    ${!isCompleted ? `
                    <div class="card-footer text-end">
                        <button class="btn btn-sm btn-success js-complete-reminder" data-id="${reminderId}">
                            <i class="fas fa-check me-1"></i> Đánh dấu hoàn thành
                        </button>
                    </div>` : ''}
                </div>
                `;
            });

            // Hiển thị danh sách
            $('#remindersList').html(html);

            // Thêm event listener cho nút đánh dấu hoàn thành
            $('.js-complete-reminder').on('click', function () {
                const reminderId = $(this).data('id');
                markReminderCompleted(reminderId);
            });
        } catch (error) {
            console.error("Error rendering reminders:", error);
            $('#remindersList').html(`
                <div class="alert alert-danger">
                    <p class="mb-0">Có lỗi khi hiển thị danh sách nhắc nhở.</p>
                    <small>${error.message}</small>
                </div>
            `);
        }
    }

    // Đánh dấu reminder đã hoàn thành
    function markReminderCompleted(reminderId) {
        console.log("Marking reminder as completed:", reminderId);

        $.post('/Reminder/MarkCompleted', { reminderId: reminderId })
            .done(function () {
                console.log("Reminder marked as completed successfully");
                // Reload danh sách để cập nhật UI
                loadAllReminders();
            })
            .fail(function (error) {
                console.error("Error marking reminder as completed:", error);
                alert("Không thể đánh dấu nhắc nhở đã hoàn thành. Vui lòng thử lại sau.");
            });
    }

    // Xử lý thông báo nhắc nhở
    function processNotification(data) {
        console.log("Processing notification:", data);

        if (data.type === "reminder_created") {
            // Không làm gì cả - thông báo hệ thống sẽ được gửi qua ReceiveMessage
            console.log("Reminder created notification received, system message will be displayed separately");
        }
        else if (data.type === "reminder_due") {
            console.log("Showing reminder popup for:", data.title);
            // Hiển thị popup nhắc nhở
            showReminderPopup(data);
        }
    }

    // Hiển thị popup nhắc nhở ở giữa màn hình
    function showReminderPopup(data) {
        console.log("Showing reminder popup:", data);

        // Kiểm tra xem popup đã tồn tại chưa
        if ($(`#reminderModal-${data.reminderId}`).length > 0) {
            console.log("Reminder popup already exists");
            return;
        }

        // Format thời gian theo GMT+7
        let formattedTime = "Không xác định";
        try {
            if (data.reminderTime) {
                formattedTime = window.ChatUtils.formatDateTime(data.reminderTime);
            }
        } catch (e) {
            console.error("Error formatting reminder time:", e);
        }

        // Tạo modal thông báo
        const modalHtml = `
<div class="modal fade" id="reminderModal-${data.reminderId}" data-bs-backdrop="static" data-bs-keyboard="false" tabindex="-1" aria-labelledby="reminderModalLabel-${data.reminderId}" aria-hidden="true">
    <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
            <div class="modal-header bg-warning text-dark">
                <h5 class="modal-title" id="reminderModalLabel-${data.reminderId}">⏰ Nhắc nhở</h5>
            </div>
            <div class="modal-body">
                <div class="text-center mb-3">
                    <h4>${data.title || 'Không có tiêu đề'}</h4>
                    ${data.description ? `<p>${data.description}</p>` : ''}
                    <p class="text-muted">Thời gian: ${formattedTime}</p>
                    <p class="mb-0">Nhóm chat: ${data.chatName || 'Không xác định'}</p>
                    <p>Người tạo: ${data.username || 'Không xác định'}</p>
                </div>
            </div>
            <div class="modal-footer justify-content-center">
                <button type="button" class="btn btn-secondary js-dismiss-reminder" data-id="${data.reminderId}">Bỏ qua</button>
                <button type="button" class="btn btn-primary js-view-reminder" data-id="${data.reminderId}" data-chat-id="${data.chatId}">Xem chi tiết</button>
            </div>
        </div>
    </div>
</div>
`;

        // Thêm modal vào body nếu chưa tồn tại
        if ($(`#reminderModal-${data.reminderId}`).length === 0) {
            $('body').append(modalHtml);
        }

        // Hiển thị modal
        const reminderModal = new bootstrap.Modal(document.getElementById(`reminderModal-${data.reminderId}`));
        reminderModal.show();

        // Lắng nghe sự kiện bỏ qua
        $(`.js-dismiss-reminder[data-id="${data.reminderId}"]`).click(function () {
            const reminderId = $(this).data('id');

            // Đánh dấu nhắc nhở đã hoàn thành
            $.post('/Reminder/MarkCompleted', { reminderId: reminderId })
                .done(function () {
                    console.log("Reminder marked as completed");
                    // Đóng modal
                    reminderModal.hide();
                    // Xóa modal khỏi DOM sau khi ẩn
                    $(`#reminderModal-${reminderId}`).on('hidden.bs.modal', function () {
                        $(this).remove();
                    });
                })
                .fail(function (error) {
                    console.error("Error marking reminder as completed:", error);
                    alert("Lỗi khi đánh dấu đã xem nhắc nhở. Vui lòng thử lại.");
                });
        });

        // Lắng nghe sự kiện xem chi tiết
        $(`.js-view-reminder[data-id="${data.reminderId}"]`).click(function () {
            const reminderId = $(this).data('id');
            const chatId = $(this).data('chat-id');

            // Đánh dấu nhắc nhở đã hoàn thành
            $.post('/Reminder/MarkCompleted', { reminderId: reminderId })
                .done(function () {
                    console.log("Reminder marked as completed");

                    // Đóng modal
                    reminderModal.hide();

                    // Xóa modal khỏi DOM sau khi ẩn
                    $(`#reminderModal-${reminderId}`).on('hidden.bs.modal', function () {
                        $(this).remove();
                    });

                    // Chuyển đến trang chat
                    window.location.href = `/Chat/Detail?id=${chatId}`;
                })
                .fail(function (error) {
                    console.error("Error marking reminder as completed:", error);
                    alert("Lỗi khi đánh dấu đã xem nhắc nhở. Vui lòng thử lại.");
                });
        });

        // Phát âm thanh thông báo nếu có hàm hỗ trợ
        if (window.ChatUtils && typeof window.ChatUtils.playNotificationSound === 'function') {
            window.ChatUtils.playNotificationSound();
        }
    }

    // Public API
    return {
        init: init,
        loadAllReminders: loadAllReminders,
        processNotification: processNotification,
        showViewRemindersModal: showViewRemindersModal
    };
})();