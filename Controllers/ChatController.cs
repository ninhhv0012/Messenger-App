using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Messenger_App.Services;
using Messenger_App.ViewModels;
using Microsoft.AspNetCore.SignalR;
using Messenger_App.Models;
using Messenger_App.Hubs;
using System.Data;
using Npgsql;

namespace Messenger_App.Controllers;

[Authorize]
public class ChatController : Controller
{
    private readonly ChatService _chat;
    private readonly IHubContext<ChatHub> _hub;
    private readonly string _connectionString;

    public ChatController(ChatService chat, IHubContext<ChatHub> hub, IConfiguration config)
    {
        _chat = chat;
        _hub = hub;
        _connectionString = config.GetConnectionString("Default")!;
    }

    private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    private string CurrentUsername => User.Identity?.Name ?? "Người dùng";

    public async Task<IActionResult> Index()
    {
        var dtos = await _chat.GetChatsAsync(CurrentUserId);
        var vms = dtos.Select(d => new ChatListVM
        {
            ChatId = d.ChatId,
            ChatType = d.ChatType,
            ChatName = d.ChatName,
            LastMessage = d.LastMessage,
            LastMessageAt = d.LastMessageAt,
            UnreadCount = d.UnreadCount
        }).ToList();
        return View(vms);
    }

    [HttpGet]
    public async Task<IActionResult> Detail(int id)
    {
        ViewData["ChatId"] = id;
        ViewData["CurrentUserId"] = CurrentUserId;
        ViewData["CurrentUsername"] = CurrentUsername;

        // Get chat type and name using raw SQL
        using var conn = new NpgsqlConnection(_connectionString);
        await conn.OpenAsync();

        // Query to get chat type
        string chatTypeQuery = @"
            SELECT chat_type, group_name, owner_id
            FROM chats
            WHERE chat_id = @chatId";

        using var cmdType = new NpgsqlCommand(chatTypeQuery, conn);
        cmdType.Parameters.AddWithValue("chatId", id);

        string chatType = "Personal";
        string chatName = "Chat cá nhân";

        using (var reader = await cmdType.ExecuteReaderAsync())
        {
            if (await reader.ReadAsync())
            {
                chatType = reader.GetString(0); // chat_type

                if (chatType == "Group" && !reader.IsDBNull(1))
                {
                    chatName = reader.GetString(1); // group_name for group chats
                }
            }
        }

        // For personal chats, get the other user's name
        if (chatType == "Personal")
        {
            string otherUserQuery = @"
                SELECT u.username
                FROM chat_participants cp
                JOIN users u ON cp.user_id = u.user_id
                WHERE cp.chat_id = @chatId
                AND cp.user_id != @currentUserId
                LIMIT 1";

            using var cmdUser = new NpgsqlCommand(otherUserQuery, conn);
            cmdUser.Parameters.AddWithValue("chatId", id);
            cmdUser.Parameters.AddWithValue("currentUserId", CurrentUserId);

            var otherUsername = await cmdUser.ExecuteScalarAsync();
            if (otherUsername != null)
            {
                chatName = otherUsername.ToString()!;
            }
        }

        ViewData["ChatType"] = chatType;
        ViewData["ChatName"] = chatName;

        var msgs = await _chat.GetMessagesAsync(id);
        return View(msgs);
    }

    [HttpPost]
    public async Task<IActionResult> SendMessage(int chatId, string content, string messageType = "Text")
    {
        try
        {
            // Lưu vào DB
            await _chat.SendMessageAsync(chatId, CurrentUserId, content, messageType);

            // Gửi qua SignalR
            var msgObj = new
            {
                ChatId = chatId,
                SenderId = CurrentUserId,
                SenderUsername = User.Identity?.Name,
                Content = content,
                MessageType = messageType,
                Timestamp = DateTime.UtcNow.ToString("o")
            };

            await _hub.Clients.Group($"chat_{chatId}").SendAsync("ReceiveMessage", msgObj);

            return Ok(msgObj);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error sending message: {ex.Message}");
            return StatusCode(500, ex.Message);
        }
    }


    [HttpPost]
    public async Task<IActionResult> UploadFile(int chatId, IFormFile file)
    {
        if (file == null || file.Length == 0) return BadRequest();
        try
        {
            // Lưu file và message vào DB
            var fileUrl = await _chat.UploadFileAsync(chatId, CurrentUserId, file);
            // Broadcast tới nhóm
            var msgObj = new
            {
                ChatId = chatId,
                SenderId = CurrentUserId,
                SenderUsername = CurrentUsername,
                Content = fileUrl,
                MessageType = file.ContentType.StartsWith("image/") ? "Image" : "File",
                Timestamp = DateTime.UtcNow.ToString("o")
            };
            await _hub.Clients.Group($"chat_{chatId}").SendAsync("ReceiveMessage", msgObj);
            return Ok(msgObj);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error uploading file: {ex.Message}");
            return StatusCode(500, "Lỗi khi tải lên tập tin");
        }
    }

    [HttpPost]
    public async Task<IActionResult> LoadMoreMessages(int chatId, DateTime before)
    {
        var msgs = await _chat.GetMessagesAsync(chatId, 10, before);
        ViewData["CurrentUserId"] = CurrentUserId;

        // Get chat type for the partial view using raw SQL
        using var conn = new NpgsqlConnection(_connectionString);
        await conn.OpenAsync();

        string chatTypeQuery = "SELECT chat_type FROM chats WHERE chat_id = @chatId";
        using var cmd = new NpgsqlCommand(chatTypeQuery, conn);
        cmd.Parameters.AddWithValue("chatId", chatId);

        var chatType = await cmd.ExecuteScalarAsync();
        if (chatType != null)
        {
            ViewData["ChatType"] = chatType.ToString();
        }

        return PartialView("_MessagePartial", msgs);
    }

    [HttpGet]
    public async Task<IActionResult> NewChat(int? otherUserId)
    {
        // Nếu click cá nhân
        if (otherUserId.HasValue)
        {
            var chatId = await _chat.GetOrCreatePersonalChatAsync(CurrentUserId, otherUserId.Value);
            return RedirectToAction("Detail", new { id = chatId });
        }
        // Hiển thị view tạo chat mới
        var friends = await _chat.GetFriendsAsync(CurrentUserId);
        var vm = new NewChatVM { Friends = friends };
        return View(vm);
    }

    [HttpPost]
    public async Task<IActionResult> NewChat(NewChatVM vm)
    {
        if (!ModelState.IsValid) return View(vm);
        int chatId = vm.IsGroup
            ? await _chat.CreateGroupChatAsync(CurrentUserId, vm.GroupName!, vm.MemberIds!)
            : await _chat.GetOrCreatePersonalChatAsync(CurrentUserId, vm.OtherUserId!.Value);
        return RedirectToAction("Detail", new { id = chatId });
    }
}