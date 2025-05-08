using Microsoft.AspNetCore.SignalR;

namespace Messenger_App.Hubs;

public class ChatHub : Hub
{
    // Gửi tin nhắn đến nhóm chat
    public async Task SendMessage(int chatId, int senderId, string senderUsername, string content)
    {
        Console.WriteLine($"[Hub] Sending message to chat_{chatId} from {senderUsername}");

        var msg = new
        {
            ChatId = chatId,
            SenderId = senderId,
            SenderUsername = senderUsername,
            Content = content,
            Timestamp = DateTime.UtcNow.ToString("o")
        };

        await Clients.Group($"chat_{chatId}").SendAsync("ReceiveMessage", msg);
    }

    // Gửi thông báo nhắc nhở
    public async Task SendReminderNotification(int chatId, object reminder)
    {
        await Clients.Group($"chat_{chatId}").SendAsync("ReminderNotification", reminder);
    }

    public override async Task OnConnectedAsync()
    {
        // Lấy chatId từ querystring nếu truyền qua URL, 
        // hoặc gửi từ client ngay sau start()
        var httpCtx = Context.GetHttpContext();
        var chatId = httpCtx.Request.Query["chatId"].FirstOrDefault();
        if (!string.IsNullOrEmpty(chatId))
            await Groups.AddToGroupAsync(Context.ConnectionId, $"chat_{chatId}");
        await base.OnConnectedAsync();
    }

    public Task JoinGroup(string groupName)
    {
        Console.WriteLine($"[Hub] {Context.ConnectionId} joining {groupName}");
        return Groups.AddToGroupAsync(Context.ConnectionId, groupName);
    }
}