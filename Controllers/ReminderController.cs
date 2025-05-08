using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Messenger_App.Models;
using Messenger_App.Services;
using Messenger_App.Hubs;
using System.Security.Claims;
using System.Threading.Tasks;
using System;


namespace Messenger_App.Controllers;

[Authorize]
public class ReminderController : Controller
{
    private readonly ReminderService _reminderService;
    private readonly IHubContext<ChatHub> _hubContext;
    private readonly ChatService _chatService;


    public ReminderController(ReminderService reminderService, IHubContext<ChatHub> hubContext, ChatService chatService)
    {
        _reminderService = reminderService;
        _hubContext = hubContext;
        _chatService = chatService;

    }

    private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    // API lấy danh sách reminder trong chat
    [HttpGet]
    public async Task<IActionResult> GetChatReminders(int chatId)
    {
        try
        {
            var reminders = await _reminderService.GetRemindersByChatAsync(chatId);
            return Json(reminders);
        }
        catch (Exception ex)
        {
            return StatusCode(500, ex.Message);
        }
    }

    // Thêm vào ReminderController.cs - phương thức Create
    [HttpPost]
    public async Task<IActionResult> Create(int chatId, string title, string? description, DateTime reminderTime)
    {
        try
        {
            // Đảm bảo reminderTime được lưu dưới dạng UTC
            if (reminderTime.Kind != DateTimeKind.Utc)
            {
                reminderTime = DateTime.SpecifyKind(reminderTime, DateTimeKind.Utc);
            }

            var reminder = new Reminder
            {
                UserId = CurrentUserId,
                ChatId = chatId,
                Title = title,
                Description = description,
                ReminderTime = reminderTime,
                IsCompleted = false
            };

            var reminderId = await _reminderService.CreateReminderAsync(reminder);
            reminder.ReminderId = reminderId;

            // Tạo thông báo với thời gian UTC
            var notification = new
            {
                type = "reminder_created",
                reminderId = reminderId,
                chatId = chatId,
                userId = CurrentUserId,
                username = User.Identity?.Name ?? "Người dùng",
                title = title,
                description = description,
                reminderTime = reminderTime.ToString("o") // Định dạng ISO 8601 với UTC
            };

            // Gửi thông báo qua SignalR
            await _hubContext.Clients.Group($"chat_{chatId}").SendAsync("ReminderNotification", notification);

            // Chuyển UTC thành GMT+7 để hiển thị trong tin nhắn
            DateTime vietnamTime = reminderTime.AddHours(7);

            // Tạo nội dung tin nhắn thông báo
            string messageContent = $"📅 Đã tạo nhắc nhở: \"{title}\"\n" +
                                   $"⏰ Thời gian: {vietnamTime.ToString("HH:mm dd/MM/yyyy")}\n" +
                                   (string.IsNullOrEmpty(description) ? "" : $"📝 Mô tả: {description}");

            // Gửi tin nhắn hệ thống tới database và các client
            await _chatService.SendMessageAsync(chatId, CurrentUserId, messageContent, "System");
            Console.WriteLine("System message sent successfully");
            // Cần gửi trực tiếp qua SignalR để đảm bảo người dùng nhìn thấy ngay lập tức
            var systemMsg = new
            {
                ChatId = chatId,
                SenderId = CurrentUserId,
                SenderUsername = User.Identity?.Name,
                Content = messageContent,
                MessageType = "System",
                Timestamp = DateTime.UtcNow.ToString("o")
            };

            await _hubContext.Clients.Group($"chat_{chatId}").SendAsync("ReceiveMessage", systemMsg);

            return Json(new { success = true, reminderId, message = "Tạo nhắc nhở thành công" });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error creating reminder: {ex.Message}");
            Console.WriteLine($"Stack trace: {ex.StackTrace}");
            return StatusCode(500, ex.Message);
        }
    }

    // API lấy danh sách reminder theo trang
    [HttpGet]
    public async Task<IActionResult> GetChatRemindersPaginated(int chatId, string? after = null)
    {
        try
        {
            DateTime? afterTime = null;
            if (!string.IsNullOrEmpty(after))
            {
                afterTime = DateTime.Parse(after);
            }

            var reminders = await _reminderService.GetRemindersByChatPaginatedAsync(chatId, 10, afterTime);
            return Json(reminders);
        }
        catch (Exception ex)
        {
            return StatusCode(500, ex.Message);
        }
    }

    // API đánh dấu reminder đã hoàn thành
    [HttpPost]
    public async Task<IActionResult> MarkCompleted(int reminderId)
    {
        try
        {
            await _reminderService.MarkReminderCompletedAsync(reminderId);
            return Json(new { success = true });
        }
        catch (Exception ex)
        {
            return StatusCode(500, ex.Message);
        }
    }

    // API xóa reminder
    [HttpPost]
    public async Task<IActionResult> Delete(int reminderId)
    {
        try
        {
            await _reminderService.DeleteReminderAsync(reminderId, CurrentUserId);
            return Json(new { success = true });
        }
        catch (Exception ex)
        {
            return StatusCode(500, ex.Message);
        }
    }

    // API lấy reminder đang chờ (cho background service)
    [HttpGet]
    [Route("api/reminders/upcoming")]
    public async Task<IActionResult> GetUpcomingReminders()
    {
        try
        {
            var reminders = await _reminderService.GetUpcomingRemindersAsync();
            return Json(reminders);
        }
        catch (Exception ex)
        {
            return StatusCode(500, ex.Message);
        }
    }
}