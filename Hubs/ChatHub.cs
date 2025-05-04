using Messenger_App;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Threading.Tasks;

namespace Messenger_App.Hubs;

public class ChatHub : Hub
{
    // Gửi tin nhắn đến nhóm chat
    public async Task SendMessage(int chatId, int senderId, string senderUsername, string content)
    {
        var msg = new
        {
            ChatId = chatId,
            SenderId = senderId,
            SenderUsername = senderUsername,
            Content = content,
            Timestamp = DateTime.UtcNow.ToString("HH:mm dd/MM/yyyy")
        };
        await Clients.Group($"chat_{chatId}").SendAsync("ReceiveMessage", msg);
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
