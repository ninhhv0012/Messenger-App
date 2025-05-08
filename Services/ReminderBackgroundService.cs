using Messenger_App.Services;
using Messenger_App.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace Messenger_App.Services;

public class ReminderBackgroundService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<ReminderBackgroundService> _logger;

    public ReminderBackgroundService(
        IServiceProvider serviceProvider,
        ILogger<ReminderBackgroundService> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Reminder Background Service is starting.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await CheckReminders();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error checking reminders");
            }

            // Kiểm tra mỗi 30 giây
            await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
        }
    }

    private async Task CheckReminders()
    {
        using var scope = _serviceProvider.CreateScope();
        var reminderService = scope.ServiceProvider.GetRequiredService<ReminderService>();
        var hubContext = scope.ServiceProvider.GetRequiredService<IHubContext<ChatHub>>();

        // Lấy các reminder chưa hoàn thành và sắp đến (hoặc đã đến)
        var upcomingReminders = await reminderService.GetUpcomingRemindersAsync(2);

        foreach (var reminder in upcomingReminders)
        {
            _logger.LogInformation("Processing reminder: {Title} at {Time}",
                reminder.Title, reminder.ReminderTime);

            try
            {
                // Gửi thông báo qua SignalR
                var notification = new
                {
                    type = "reminder_due",
                    reminderId = reminder.ReminderId,
                    chatId = reminder.ChatId,
                    userId = reminder.UserId,
                    username = reminder.User?.Username,
                    title = reminder.Title,
                    description = reminder.Description,
                    reminderTime = reminder.ReminderTime.ToString("o"),
                    chatName = reminder.ChatDetails?.ChatName,
                    chatType = reminder.ChatDetails?.ChatType
                };

                await hubContext.Clients.Group($"chat_{reminder.ChatId}")
                    .SendAsync("ReminderNotification", notification);

                // Đánh dấu reminder đã hoàn thành
                await reminderService.MarkReminderCompletedAsync(reminder.ReminderId);

                _logger.LogInformation("Reminder notification sent for {Title}", reminder.Title);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending reminder notification for reminder {Id}",
                    reminder.ReminderId);
            }
        }
    }
}