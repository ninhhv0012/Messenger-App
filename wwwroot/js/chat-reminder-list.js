// Script để hiển thị danh sách nhắc nhở của chat

$(document).ready(function () {
    // Bắt sự kiện click nút xem nhắc nhở
    $('#btnViewReminders').on('click', function () {
        showViewRemindersModal();
    });
});

// Hiển thị modal danh sách nhắc nhở
function showViewRemindersModal() {
    try {
        // Clear the list before loading
        $("#remindersList").empty();

        // Hiển thị loading indicator
        $("#reminderLoadingIndicator").show();

        // Ẩn nút "Xem thêm" vì chúng ta sẽ tải tất cả nhắc nhở
        $("#loadMoreRemindersBtn").hide();

        // Hiển thị modal
        $("#viewRemindersModal").modal("show");

        // Tải tất cả nhắc nhở
        loadAllReminders();
    } catch (error) {
        console.error("Error in showViewRemindersModal:", error);
        // Ẩn loading indicator nếu có lỗi
        $("#reminderLoadingIndicator").hide();
    }
}

// Hàm tải tất cả nhắc nhở của chat
function loadAllReminders() {
    const chatId = $("#chatId").val();

    console.log("Loading all reminders for chat ID:", chatId);

    $.ajax({
        url: `/Reminder/GetChatReminders?chatId=${chatId}`,
        type: "GET",
        success: function (data) {
            // Ẩn loading indicator
            console.log("Data loaded successfully:", data);
            if (data && data.length > 0) {
                // Hiển thị danh sách nhắc nhở
                renderReminders(data);
            } else {
                // Không có nhắc nhở nào
                $("#remindersList").html('<p class="text-muted">Không có nhắc nhở nào</p>');
            }
        },
        error: function (xhr, status, error) {
            // Ẩn loading indicator
            $("#reminderLoadingIndicator").hide();

            console.error("Error loading reminders. Status:", status);
            console.error("Error details:", error);
            console.error("Response:", xhr.responseText);

            // Hiển thị thông báo lỗi
            $("#remindersList").html(`
                <div class="alert alert-danger">
                    Có lỗi khi tải danh sách nhắc nhở. Vui lòng thử lại sau.
                </div>
            `);
        }
    });
}

// Hàm hiển thị danh sách nhắc nhở
function renderReminders(reminders) {
    console.log("Rendering reminders:", reminders);

    let html = '';

    // Sắp xếp nhắc nhở theo thời gian giảm dần (mới nhất lên đầu)
    reminders.sort((a, b) => new Date(b.reminderTime) - new Date(a.reminderTime));

    reminders.forEach(function (reminder) {
        // Chuyển đổi thời gian UTC sang thời gian địa phương để hiển thị
        const reminderTime = new Date(reminder.ReminderTime);
        const localTimeStr = reminderTime.toLocaleString('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Định dạng trạng thái nhắc nhở
        const statusClass = reminder.IsCompleted
            ? 'bg-success'
            : (new Date() > reminderTime ? 'bg-danger' : 'bg-warning');
        const statusText = reminder.IsCompleted
            ? 'Đã hoàn thành'
            : (new Date() > reminderTime ? 'Đã qua' : 'Sắp tới');

        html += `
        <div class="card mb-3 reminder-item" data-id="${reminder.ReminderId}">
            <div class="card-header d-flex justify-content-between align-items-center">
                <span class="fw-bold">${reminder.Title}</span>
                <span class="badge ${statusClass}">${statusText}</span>
            </div>
            <div class="card-body">
                ${reminder.description ? `<p class="card-text">${reminder.Description}</p>` : ''}
                <p class="card-text text-muted mb-1">
                    <small>Thời gian: ${localTimeStr}</small>
                </p>
                <p class="card-text text-muted mb-0">
                    <small>Người tạo: ${reminder.User?.Username || 'Không rõ'}</small>
                </p>
            </div>
        </div>
        `;
    });

    // Đặt HTML vào container
    $("#remindersList").html(html);
}   