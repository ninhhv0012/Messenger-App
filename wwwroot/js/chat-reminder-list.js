// Biến lưu trữ thời gian của reminder cuối cùng để phân trang
let lastReminderTime = null;

// Hiển thị modal xem nhắc nhở
$(document).ready(function () {
    // Bắt sự kiện click nút xem nhắc nhở
    $('#btnViewReminders').on('click', function () {
        const chatId = $('#chatId').val();

        // Reset dữ liệu phân trang
        lastReminderTime = null;

        // Hiển thị modal
        const reminderModal = new bootstrap.Modal(document.getElementById('reminderModal'));
        reminderModal.show();

        // Tải danh sách nhắc nhở
        loadReminders(chatId);
    });

    // Bắt sự kiện nút xem thêm
    $('#btnLoadMoreReminders').on('click', function () {
        const chatId = $('#chatId').val();
        loadReminders(chatId, lastReminderTime);
    });
});

// Hàm tải danh sách nhắc nhở
// Hàm tải danh sách nhắc nhở
// Hàm tải danh sách nhắc nhở
function loadReminders(chatId, after = null) {
    // Xây dựng URL request
    let url = `/Reminder/GetChatRemindersPaginated?chatId=${chatId}`;
    if (after) {
        url += `&after=${after}`;
    }

    // Hiển thị loading nếu là tải lần đầu
    if (!after) {
        $('#reminderList').html('<p class="text-center text-muted">Đang tải...</p>');
        $('#loadMoreReminders').addClass('d-none');
    }

    // Gửi request
    $.get(url)
        .done(function (reminders) {
            // Log để kiểm tra cấu trúc dữ liệu
            console.log('Reminders data received:', reminders);

            // Xoá loading nếu là tải lần đầu
            if (!after) {
                $('#reminderList').empty();
            }

            // Kiểm tra nếu không có dữ liệu
            if (reminders.length === 0) {
                if (!after) {
                    $('#reminderList').html('<p class="text-center text-muted">Chưa có nhắc nhở nào</p>');
                }
                $('#loadMoreReminders').addClass('d-none');
                return;
            }

            // Chuẩn hóa dữ liệu nhắc nhở
            const normalizedReminders = reminders.map(normalizeReminder);

            // Hiển thị danh sách nhắc nhở
            renderReminders(normalizedReminders, after);

            // Lưu lại thời gian của reminder cuối cùng để phân trang
            if (reminders.length > 0) {
                lastReminderTime = reminders[reminders.length - 1].reminderTime;
                $('#loadMoreReminders').removeClass('d-none');
            } else {
                $('#loadMoreReminders').addClass('d-none');
            }
        })
        .fail(function (error) {
            console.error('Lỗi khi tải danh sách nhắc nhở:', error);
            $('#reminderList').html('<p class="text-center text-danger">Lỗi khi tải dữ liệu</p>');
            $('#loadMoreReminders').addClass('d-none');
        });
}

// Hàm chuẩn hóa dữ liệu nhắc nhở
function normalizeReminder(reminder) {
    return reminder; // Trả về dữ liệu gốc mà không thực hiện bất kỳ thay đổi nào
}
// Hàm render danh sách nhắc nhở
// Hàm render danh sách nhắc nhở - đã điều chỉnh dựa trên cấu trúc dữ liệu thực tế
// Hàm render danh sách nhắc nhở - đã sửa để xử lý lỗi ngày tháng và user info
// Hàm render danh sách nhắc nhở - đã sửa để xử lý đúng tên thuộc tính
function renderReminders(reminders, isAppend = false) {
    const container = $('#reminderList');
    let html = '';

    reminders.forEach(function (reminder) {
        console.log('Rendering reminder:', reminder);

        // Title và description - kiểm tra cả chữ hoa và chữ thường
        const title = reminder.Title || reminder.title || 'Không có tiêu đề';
        const description = reminder.Description || reminder.description || '';

        // Trạng thái nhắc nhở
        const isCompleted = typeof reminder.IsCompleted === 'boolean' ? reminder.IsCompleted :
            (typeof reminder.isCompleted === 'boolean' ? reminder.isCompleted : false);
        const statusClass = isCompleted ? 'secondary' : 'primary';
        const statusText = isCompleted ? 'Đã hoàn thành' : 'Đang chờ';

        // Xử lý thông tin người dùng
        let username = "Không xác định";
        if (reminder.User && reminder.User.Username) {
            username = reminder.User.Username;
        } else if (reminder.User && reminder.User.username) {
            username = reminder.User.username;
        } else if (reminder.user && reminder.user.Username) {
            username = reminder.user.Username;
        } else if (reminder.user && reminder.user.username) {
            username = reminder.user.username;
        }

        // Xử lý thời gian - kiểm tra cả chữ hoa và chữ thường
        let formattedTime = "Không rõ thời gian";
        try {
            // Kiểm tra cả reminderTime và ReminderTime
            const reminderTimeValue = reminder.ReminderTime || reminder.reminderTime;

            // Kiểm tra xem reminderTime có phải là chuỗi hợp lệ không
            if (reminderTimeValue && typeof reminderTimeValue === 'string') {
                const reminderTime = new Date(reminderTimeValue);

                // Kiểm tra xem ngày có hợp lệ không
                if (!isNaN(reminderTime.getTime())) {
                    // Định dạng ngày tháng
                    const localTime = new Date(reminderTime.getTime() + (7 * 60 * 60 * 1000)); // GMT+7
                    formattedTime = `${localTime.getHours().toString().padStart(2, '0')}:${localTime.getMinutes().toString().padStart(2, '0')} ${localTime.getDate().toString().padStart(2, '0')}/${(localTime.getMonth() + 1).toString().padStart(2, '0')}/${localTime.getFullYear()}`;
                } else {
                    console.warn('Invalid date format:', reminderTimeValue);
                }
            } else {
                console.warn('reminderTime is missing or not a string:', reminderTimeValue);
            }
        } catch (error) {
            console.error('Error parsing date:', error);
        }

        html += `
            <div class="card mb-2">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center">
                        <h5 class="card-title">${title}</h5>
                        <span class="badge bg-${statusClass}">${statusText}</span>
                    </div>
                    <p class="card-text">
                        <small class="text-muted">Người tạo: ${username}</small><br>
                        <small class="text-muted">Thời gian: ${formattedTime}</small>
                    </p>
                    ${description ? `<p class="card-text">${description}</p>` : ''}
                </div>
            </div>
        `;
    });

    // Thêm hoặc ghi đè nội dung
    if (isAppend) {
        container.append(html);
    } else {
        container.html(html);
    }
}