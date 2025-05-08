"use strict";

// Đảm bảo chỉ có một phiên bản của script này chạy
if (window.chatInitialized) {
    console.log("Chat already initialized, skipping");
} else {
    window.chatInitialized = true;

    $(document).ready(function () {
        // Biến toàn cục
        const chatId = $('#chatId').val();
        const currentUserId = parseInt($('#currentUserId').val());
        const currentUsername = $('#currentUsername').val();
        const chatType = $('#chatType').val();

        // Sử dụng Map để theo dõi tin nhắn đã xử lý với timestamp
        const processedMessages = new Map();

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
        $('#btnSend').prop('disabled', $('#txtMessage').val().trim() === '');
        $('#fileInput').prop('disabled', false);

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
        const connection = new signalR.HubConnectionBuilder()
            .withUrl("/chathub")
            .build();

        // Lưu tham chiếu connection toàn cục
        window.signalRConnection = connection;

        // QUAN TRỌNG: Xử lý nhận tin nhắn
        // Trong phần xử lý ReceiveMessage của chat.js
        connection.on("ReceiveMessage", function (data) {
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

            // Đánh dấu tin nhắn đã được xử lý với thời gian hiện tại
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

            // Chỉ xử lý tin nhắn từ người khác
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

                // Nội dung tin nhắn
                inner.append($('<div>').text(data.content));

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
        });


        // Biến toàn cục để theo dõi trạng thái tải nhắc nhở
        let isLoadingReminders = false;
        let noMoreReminders = false;
        let lastReminderTime = null;

        // Hàm tải danh sách reminder - phiên bản đầu tiên
        function loadReminders(callback) {
            // Reset trạng thái
            isLoadingReminders = true;
            noMoreReminders = false;
            lastReminderTime = null;

            // Xóa dữ liệu cũ
            $('#remindersList').html('<p class="text-center"><i class="fas fa-spinner fa-spin"></i> Đang tải...</p>');

            // Gọi hàm tải trang đầu tiên
            loadMoreReminders(callback);
        }

        // Hàm tải thêm reminder
        function loadMoreReminders(callback) {
            if (isLoadingReminders || noMoreReminders) return;

            isLoadingReminders = true;

            // Thêm chỉ báo đang tải
            if (!$('#reminderLoadingIndicator').length) {
                $('#remindersList').append('<div id="reminderLoadingIndicator" class="text-center my-2"><i class="fas fa-spinner fa-spin"></i> Đang tải...</div>');
            }

            // Tạo URL với tham số after nếu có
            let url = `/Reminder/GetChatRemindersPaginated?chatId=${chatId}`;
            if (lastReminderTime) {
                url += `&after=${encodeURIComponent(lastReminderTime)}`;
            }

            $.get(url)
                .done(function (reminders) {
                    console.log("Reminders loaded:", reminders);

                    // Xóa chỉ báo đang tải
                    $('#reminderLoadingIndicator').remove();

                    if (!reminders || reminders.length === 0) {
                        // Không còn reminder nào
                        noMoreReminders = true;

                        if (!lastReminderTime) {
                            // Nếu là lần tải đầu tiên và không có reminder nào
                            $('#remindersList').html('<p class="text-muted">Không có nhắc nhở nào.</p>');
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
                            lastReminderTime = reminder.ReminderTime;

                            // Xử lý trạng thái
                            const isCompleted = reminder.IsCompleted;
                            const isPast = new Date(reminder.ReminderTime) < new Date();
                            const status = isCompleted ? 'Đã hoàn thành' : (isPast ? 'Đã qua' : 'Sắp tới');
                            const statusClass = isCompleted ? 'success' : (isPast ? 'secondary' : 'warning');

                            // Xử lý hiển thị thời gian
                            const timeFormatted = formatDateTime(reminder.ReminderTime);

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

                    isLoadingReminders = false;

                    if (callback) callback();
                })
                .fail(function (error) {
                    console.error("Error loading reminders:", error);
                    $('#reminderLoadingIndicator').remove();

                    if (!lastReminderTime) {
                        // Nếu là lần tải đầu tiên
                        $('#remindersList').html('<p class="text-danger">Lỗi khi tải danh sách nhắc nhở.</p>');
                    } else {
                        // Nếu đã tải một số reminder trước đó
                        $('#remindersList').append('<p class="text-center text-danger my-2">Lỗi khi tải thêm nhắc nhở.</p>');
                    }

                    isLoadingReminders = false;

                    if (callback) callback();
                });
        }


        // Cập nhật phần xử lý khi mở modal xem danh sách reminder
        function showViewRemindersModal() {
            // Reset trạng thái
            isLoadingReminders = false;
            noMoreReminders = false;
            lastReminderTime = null;

            // Xóa dữ liệu cũ
            $('#remindersList').html('');

            // Tải danh sách reminder trang đầu tiên
            loadReminders(function () {
                // Sau khi tải xong, hiển thị modal
                const viewRemindersModal = new bootstrap.Modal(document.getElementById('viewRemindersModal'));
                viewRemindersModal.show();

                // Thiết lập sự kiện cuộn
                setupReminderScroll();
            });
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

        // Hàm hiển thị tin nhắn hệ thống
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

        // Hàm format nội dung tin nhắn hệ thống
        function formatSystemMessage(content) {
            // Chuyển đổi xuống dòng thành <br>
            return content.replace(/\n/g, '<br>');
        }
        // Xử lý thông báo reminder
        connection.on("ReminderNotification", function (data) {
            console.log("Reminder notification received:", data);

            if (data.type === "reminder_created") {
                // Hiển thị thông báo nhỏ trong chat
                showInChatNotification(`${data.username} đã tạo nhắc nhở "${data.title}" vào lúc ${formatDateTime(data.reminderTime)}`);
            }
            else if (data.type === "reminder_due") {
                console.log("Showing reminder popup for:", data.title);
                // Hiển thị popup nhắc nhở
                showReminderPopup(data);
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

                // Tải danh sách reminder hiện có
                loadReminders();
            })
            .catch(err => {
                console.error("Connection error:", err);
                $('#connection-status').removeClass('bg-secondary bg-success').addClass('bg-danger').text('Mất kết nối');
            });

        // Xử lý nút gửi tin nhắn
        $('#btnSend').click(function () {
            const content = $('#txtMessage').val().trim();
            if (!content) return;

            // Tạo timestamp cho tin nhắn
            const timestamp = new Date().toISOString();

            // Tạo messageKey duy nhất
            const messageKey = `${currentUserId}_${content}_${timestamp}`;

            // Đánh dấu tin nhắn là đã xử lý
            processedMessages.set(messageKey, Date.now());

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
        });

        // Xử lý phím Enter
        $('#txtMessage').on('keypress', function (e) {
            if (e.which === 13 && !e.shiftKey) {
                e.preventDefault();
                $('#btnSend').click();
            }
        });

        // Cập nhật trạng thái nút gửi
        $('#txtMessage').on('input', function () {
            $('#btnSend').prop('disabled', $(this).val().trim() === '');
        });

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

        // Thêm nút tạo reminder
        if (chatType === 'Group') {
            addReminderButton();
        }

        // Hàm thêm nút tạo reminder
        function addReminderButton() {
            // Thêm nút bên cạnh nút gửi
            const reminderBtn = $('<button>')
                .attr('id', 'btnReminder')
                .addClass('btn btn-outline-info mt-2 ms-2')
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
                </div>
                
               <div class="modal fade" id="viewRemindersModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-lg">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title">Danh sách nhắc nhở</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
                <!-- Thêm style để giới hạn chiều cao và cho phép cuộn -->
                <div id="remindersList" style="max-height: 400px; overflow-y: auto;">
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Đóng</button>
            </div>
        </div>
    </div>
</div>
                `;

                $('body').append(modalHtml);

                // Lắng nghe sự kiện lưu reminder
                $('#btnSaveReminder').click(saveReminder);

                // Thêm nút xem danh sách reminder
                const viewRemindersBtn = $('<button>')
                    .attr('id', 'btnViewReminders')
                    .addClass('btn btn-outline-secondary mt-2 ms-2')
                    .html('<i class="fas fa-list"></i> Xem nhắc nhở')
                    .click(showViewRemindersModal);

                $('#btnReminder').after(viewRemindersBtn);
            }
        }

        // Hàm hiển thị modal tạo reminder
        // Hàm hiển thị modal tạo reminder
        function showReminderModal() {
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
            const reminderModal = new bootstrap.Modal(document.getElementById('reminderModal'));
            reminderModal.show();
        }

        // Hàm lưu reminder
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
                        bootstrap.Modal.getInstance(document.getElementById('reminderModal')).hide();

                        // Reset form
                        $('#reminderForm')[0].reset();

                        // Hiển thị thông báo (với thời gian hiển thị theo GMT+7)
                        const gmtPlus7Time = new Date(utcDateTime.getTime() + (7 * 60 * 60 * 1000));
                        const formattedTime = formatDateTime(utcDateTime.toISOString());
                        showInChatNotification(`Bạn đã tạo nhắc nhở "${title}" vào lúc ${formattedTime}`);
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

  

        // Hàm tải danh sách reminder
        // Hàm tải danh sách reminder
        // Hàm tải danh sách reminder
        function loadReminders(callback) {
            $.get(`/Reminder/GetChatReminders?chatId=${chatId}`)
                .done(function (reminders) {
                    console.log("Reminders loaded:", reminders);

                    if (!reminders || reminders.length === 0) {
                        $('#remindersList').html('<p class="text-muted">Không có nhắc nhở nào.</p>');
                    } else {
                        let html = '<div class="table-responsive"><table class="table table-hover">';
                        html += '<thead><tr><th>Tiêu đề</th><th>Mô tả</th><th>Thời gian</th><th>Người tạo</th><th>Trạng thái</th></tr></thead>';
                        html += '<tbody>';

                        reminders.forEach(function (reminder) {
                            // Chú ý: Sử dụng đúng case của các thuộc tính từ JSON
                            const title = reminder.Title || 'Không có tiêu đề';
                            const description = reminder.Description || '';

                            // Xử lý thời gian (chuyển đổi UTC sang GMT+7)
                            let reminderTimeFormatted = 'Không xác định';
                            try {
                                if (reminder.ReminderTime) {
                                    reminderTimeFormatted = formatDateTime(reminder.ReminderTime);
                                }
                            } catch (e) {
                                console.error("Error formatting date:", e, reminder.ReminderTime);
                            }

                            // Xử lý username
                            const username = (reminder.User && reminder.User.Username)
                                ? reminder.User.Username
                                : `User ID: ${reminder.UserId || 'không xác định'}`;

                            // Xử lý trạng thái
                            let isPast = false;
                            try {
                                // Chuyển UTC sang GMT+7 để so sánh
                                const reminderTime = new Date(reminder.ReminderTime);
                                const gmtPlus7 = new Date(reminderTime.getTime() + (7 * 60 * 60 * 1000));
                                isPast = gmtPlus7 < new Date();
                            } catch (e) {
                                console.error("Error comparing dates:", e);
                            }

                            const isCompleted = reminder.IsCompleted || false;
                            const status = isCompleted ? 'Đã hoàn thành' : (isPast ? 'Đã qua' : 'Sắp tới');
                            const statusClass = isCompleted ? 'success' : (isPast ? 'secondary' : 'warning');

                            html += `<tr>
                    <td>${title}</td>
                    <td>${description}</td>
                    <td>${reminderTimeFormatted}</td>
                    <td>${username}</td>
                    <td><span class="badge bg-${statusClass}">${status}</span></td>
                </tr>`;
                        });

                        html += '</tbody></table></div>';
                        $('#remindersList').html(html);
                    }

                    if (callback) callback();
                })
                .fail(function (error) {
                    console.error("Error loading reminders:", error);
                    $('#remindersList').html('<p class="text-danger">Lỗi khi tải danh sách nhắc nhở.</p>');

                    if (callback) callback();
                });
        }

        // Hàm hiển thị thông báo trong chat
        function showInChatNotification(message) {
            const notification = $('<div>')
                .addClass('text-center my-2')
                .html(`<small class="text-muted">${message}</small>`);

            $('#messageList').append(notification);
            $('#detailContainer').scrollTop($('#detailContainer')[0].scrollHeight);
        }

        // Hàm hiển thị popup nhắc nhở
        // Hàm hiển thị popup nhắc nhở
        // Hàm hiển thị popup nhắc nhở ở giữa màn hình
        // Hàm hiển thị popup nhắc nhở ở giữa màn hình
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
                    const reminderTime = new Date(data.reminderTime);
                    const gmtPlus7 = new Date(reminderTime.getTime() + (7 * 60 * 60 * 1000));

                    // Format thời gian
                    const day = String(gmtPlus7.getUTCDate()).padStart(2, '0');
                    const month = String(gmtPlus7.getUTCMonth() + 1).padStart(2, '0');
                    const year = gmtPlus7.getUTCFullYear();

                    const hours = String(gmtPlus7.getUTCHours()).padStart(2, '0');
                    const minutes = String(gmtPlus7.getUTCMinutes()).padStart(2, '0');

                    formattedTime = `${hours}:${minutes} ${day}/${month}/${year}`;
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

            // Phát âm thanh thông báo
            playNotificationSound();
        }

        // Hàm format datetime
        // Hàm format datetime - Chuyển UTC sang GMT+7
        // Hàm format datetime - Chuyển UTC sang GMT+7
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

        // Hàm phát âm thanh thông báo
        function playNotificationSound() {
            // Tạo element âm thanh nếu chưa có
            if ($('#notificationSound').length === 0) {
                $('body').append('<audio id="notificationSound" src="/sounds/notification.mp3" preload="auto"></audio>');
            }

            // Phát âm thanh
            const sound = document.getElementById('notificationSound');
            sound.play().catch(e => console.log('Error playing sound:', e));
        }
    });
}