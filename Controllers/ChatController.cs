using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;
using Messenger_App.Services;
using Messenger_App.ViewModels;
using Microsoft.AspNetCore.SignalR;
using Messenger_App.Models;
using Messenger_App.Hubs;

namespace Messenger_App.Controllers;

[Authorize]
public class ChatController : Controller
{
    private readonly ChatService _chat;
    private readonly IHubContext<ChatHub> _hub;
    public ChatController(ChatService chat, IHubContext<ChatHub> hub)
    {
        _chat = chat;
        _hub = hub;
    }
    private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

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
        var msgs = await _chat.GetMessagesAsync(id);

        return View(msgs);
    }

    [HttpPost]
    public async Task<IActionResult> SendMessage(int chatId, string content)
    {
        // Lưu vào DB
        await _chat.SendMessageAsync(chatId, CurrentUserId, content);
        // Gửi realtime qua SignalR
        var msgObj = new
        {
            ChatId = chatId,
            SenderId = CurrentUserId,
            SenderUsername = User.Identity!.Name,
            Content = content,
            MessageType = "Text",
            Timestamp = DateTime.Now.ToString("HH:mm")
        };
        await _hub.Clients.Group($"chat_{chatId}").SendAsync("ReceiveMessage", msgObj);
        return Ok();
    }

    [HttpPost]
    public async Task<IActionResult> UploadFile(int chatId, IFormFile file)
    {
        if (file == null || file.Length == 0) return BadRequest();
        // Lưu file và message vào DB
        var fileUrl = await _chat.UploadFileAsync(chatId, CurrentUserId, file);
        // Broadcast tới nhóm
        var msgObj = new
        {
            ChatId = chatId,
            SenderId = CurrentUserId,
            SenderUsername = User.Identity!.Name,
            Content = fileUrl,
            MessageType = file.ContentType.StartsWith("image/") ? "Image" : "File",
            Timestamp = DateTime.Now.ToString("HH:mm")
        };
        await _hub.Clients.Group($"chat_{chatId}").SendAsync("ReceiveMessage", msgObj);
        return Ok();
    }


    [HttpPost]
    public async Task<IActionResult> LoadMoreMessages(int chatId, DateTime before)
    {
        var msgs = await _chat.GetMessagesAsync(chatId, 10, before);
        ViewData["CurrentUserId"] = CurrentUserId;
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
