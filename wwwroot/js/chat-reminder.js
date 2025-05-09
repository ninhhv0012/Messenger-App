"use strict";

// Module xử lý nhắc nhở trong chat
window.ChatReminder = (function () {
    // Private variables
    let chatId;
    let currentUserId;
    let currentUsername;
    let isLoadingReminders = false;
    let noMoreReminders = false;
    let lastReminderTime = null;

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
                            <div id="remindersList" style="max-height: 400px; overflow-y: auto;">
                                <p class="text-center"><i class="fas fa-spinner fa-spin"></i> Đang tải...</p>
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

    // Thiết lập sự kiện cuộn để tải thêm reminder
    function setupReminderScroll() {
        // Xóa sự kiện cuộn cũ nếu có
        $('#remindersList').off('scroll');

        // Thêm sự kiện cuộn mới
        $('#remindersList').on('scroll', function () {
            const scrollTop = $(this).scrollTop();
            const scrollHeight = $(this)[0].scrollHeight;
            const clientHeight = $(this).outerHeight();

            // Nếu đã cuộn đến gần cuối (còn cách cuối 50px)
            if (scrollTop + clientHeight >= scrollHeight - 50) {
                // Tải thêm reminder
                loadMoreReminders();
            }
        });
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

                // Nếu không có, thử tạo lại
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
                                    <div id="remindersList" style="max-height: 400px; overflow-y: auto;">
                                        <p class="text-center"><i class="fas fa-spinner fa-spin"></i> Đang tải...</p>
                                    </div>
                                </div>
                                <div class="modal-footer">
                                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Đóng</button>
                                </div>
                            </div>
                        </div>
                    </div>`;

                    $('body').append(viewModalHtml);
                    console.log("View reminders modal dynamically created");
                }
            }

            // Reset trạng thái
            isLoadingReminders = false;
            noMoreReminders = false;
            lastReminderTime = null;

            // Xóa dữ liệu cũ và hiển thị trạng thái loading
            $('#remindersList').html('<p class="text-center"><i class="fas fa-spinner fa-spin"></i> Đang tải...</p>');

            // Kiểm tra xem API endpoint có tồn tại không trước khi tải reminders
            console.log("Checking if reminder endpoint exists before loading");

            // Hiển thị modal trước để người dùng thấy spinner loading
            try {
                const modal = new bootstrap.Modal(document.getElementById('viewRemindersModal'));
                modal.show();
                console.log("View reminders modal shown, now loading data");
            } catch (modalError) {
                console.error("Error showing view reminders modal:", modalError);
            }

            // Tải danh sách reminder
            loadReminders(function () {
                console.log("Reminders loaded successfully, setting up scroll");
                // Thiết lập sự kiện cuộn
                setupReminderScroll();
            });
        } catch (error) {
            console.error("Error in showViewRemindersModal:", error);
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

    // Tải danh sách reminder
    function loadReminders(callback) {
        console.log("Loading reminders for chat:", chatId);

        // Reset trạng thái
        isLoadingReminders = false; // Set to false first so loadMoreReminders will execute
        noMoreReminders = false;
        lastReminderTime = null;

        // Gọi hàm tải trang đầu tiên (chỉ thị với tham số true là load lần đầu)
        loadMoreReminders(callback, true);
    }

    // Tải thêm reminder
    function loadMoreReminders(callback, isInitialLoad) {
        // Skip only if we're not doing the initial load and already loading or no more reminders
        if (!isInitialLoad && (isLoadingReminders || noMoreReminders)) {
            console.log("Skipping loadMoreReminders due to already loading or no more reminders");
            return;
        }

        console.log("Actually loading reminders, isInitialLoad:", isInitialLoad);
        isLoadingReminders = true;
        console.log("Loading more reminders, last time:", lastReminderTime);

        // Thêm chỉ báo đang tải nếu chưa có
        if (!$('#reminderLoadingIndicator').length) {
            $('#remindersList').append('<div id="reminderLoadingIndicator" class="text-center my-2"><i class="fas fa-spinner fa-spin"></i> Đang tải...</div>');
        }

        // Tạo URL với tham số after nếu có
        let url = `/Reminder/GetChatRemindersPaginated?chatId=${chatId}`;
        if (lastReminderTime) {
            // Ensure the timestamp is in ISO format with 'Z' to indicate UTC
            // The server expects a proper ISO 8601 UTC timestamp
            try {
                // Try to parse the timestamp if it's not already a Date object
                let reminderDate = lastReminderTime;
                if (!(lastReminderTime instanceof Date)) {
                    reminderDate = new Date(lastReminderTime);
                }
                // Ensure it's a valid date
                if (!isNaN(reminderDate.getTime())) {
                    // Convert to ISO string which will be in UTC format with Z suffix
                    url += `&after=${encodeURIComponent(reminderDate.toISOString())}`;
                    console.log("Formatted after parameter as UTC ISO string:", reminderDate.toISOString());
                } else {
                    console.error("Invalid timestamp for after parameter:", lastReminderTime);
                    // Fall back to original value if parsing fails
                    url += `&after=${encodeURIComponent(lastReminderTime)}`;
                }
            } catch (err) {
                console.error("Error formatting timestamp:", err);
                // Fall back to original value if parsing fails
                url += `&after=${encodeURIComponent(lastReminderTime)}`;
            }
        }

        // Debug: show the full URL being used
        console.log("Full AJAX request URL:", url);

        $.ajax({
            url: url,
            type: 'GET',
            dataType: 'json',
            beforeSend: function () {
                console.log("AJAX request starting for reminders");
            },
            success: function (reminders) {
                console.log("Reminders loaded successfully:", reminders);

                // Xóa chỉ báo đang tải
                $('#reminderLoadingIndicator').remove();

                if (!reminders || reminders.length === 0) {
                    // Không còn reminder nào
                    noMoreReminders = true;

                    if (!lastReminderTime) {
                        // Nếu là lần tải đầu tiên và không có reminder nào
                        $('#remindersList').html('<p class="text-muted text-center">Không có nhắc nhở nào.</p>');
                    } else {
                        // Nếu đã tải một số reminder trước đó
                        $('#remindersList').append('<p class="text-center text-muted my-2">Không còn nhắc nhở nào.</p>');
                    }
                } else {
                    // Nếu là lần tải đầu tiên, khởi tạo bảng
                    if (!lastReminderTime) {
                        let tableHtml = '<div class="table-responsive"><table class="table table-hover">';
                        tableHtml += '<thead><tr><th>Tiêu đề</th><th>Mô tả</th><th>Thời gian</th><th>Người tạo</th><th>Trạng thái</th></tr></thead>';
                        tableHtml += '<tbody id="reminderTableBody"></tbody></table></div>';
                        $('#remindersList').html(tableHtml);
                    }

                    // Thêm các reminder mới vào bảng
                    let tableBody = '';

                    reminders.forEach(function (reminder) {
                        // Lưu thời gian của reminder cuối cùng để dùng cho lần tải kế tiếp
                        // Convert to proper Date object instead of storing the string representation
                        if (reminder.ReminderTime) {
                            try {
                                // Convert to Date object to ensure proper ISO string formatting later
                                lastReminderTime = new Date(reminder.ReminderTime);
                                console.log("Stored lastReminderTime as Date object:", lastReminderTime);
                            } catch (error) {
                                console.error("Error parsing ReminderTime as Date:", error);
                                // Keep the string representation as fallback
                                lastReminderTime = reminder.ReminderTime;
                                console.log("Stored lastReminderTime as string:", lastReminderTime);
                            }
                        }

                        // Xử lý trạng thái
                        const isCompleted = reminder.IsCompleted;
                        const isPast = new Date(reminder.ReminderTime) < new Date();
                        const status = isCompleted ? 'Đã hoàn thành' : (isPast ? 'Đã qua' : 'Sắp tới');
                        const statusClass = isCompleted ? 'success' : (isPast ? 'secondary' : 'warning');

                        // Xử lý hiển thị thời gian
                        const timeFormatted = window.ChatUtils.formatDateTime(reminder.ReminderTime);

                        // Xử lý username
                        const username = reminder.User && reminder.User.Username
                            ? reminder.User.Username
                            : `User ID: ${reminder.UserId}`;

                        tableBody += `<tr>
                            <td>${reminder.Title || ''}</td>
                            <td>${reminder.Description || ''}</td>
                            <td>${timeFormatted}</td>
                            <td>${username}</td>
                            <td><span class="badge bg-${statusClass}">${status}</span></td>
                        </tr>`;
                    });

                    $('#reminderTableBody').append(tableBody);
                }

                if (callback && typeof callback === 'function') {
                    console.log("Executing callback after loading reminders");
                    callback();
                }
            },
            error: function (xhr, status, error) {
                console.error("Error loading reminders. Status:", status);
                console.error("Error details:", error);
                console.error("Response:", xhr.responseText);
                $('#reminderLoadingIndicator').remove();

                if (!lastReminderTime) {
                    // Nếu là lần tải đầu tiên
                    $('#remindersList').html('<p class="text-danger text-center">Lỗi khi tải danh sách nhắc nhở.</p>');
                } else {
                    // Nếu đã tải một số reminder trước đó
                    $('#remindersList').append('<p class="text-center text-danger my-2">Lỗi khi tải thêm nhắc nhở.</p>');
                }

                if (callback && typeof callback === 'function') {
                    console.log("Executing callback after reminder loading error");
                    callback();
                }
            },
            complete: function () {
                console.log("AJAX request completed (success or error)");
                isLoadingReminders = false;
            }
        });
    }

    // Xử lý thông báo nhắc nhở
    function processNotification(data) {
        if (data.type === "reminder_created") {
            // Hiển thị thông báo nhỏ trong chat
            window.ChatCore.showInChatNotification(`${data.username} đã tạo nhắc nhở "${data.title}" vào lúc ${window.ChatUtils.formatDateTime(data.reminderTime)}`);
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
        loadReminders: loadReminders,
        processNotification: processNotification,
        // Thêm hàm để debug
        showViewRemindersModal: showViewRemindersModal
    };
})();