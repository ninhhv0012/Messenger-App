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
using Messenger_App.Filters;

namespace Messenger_App.Controllers;

[Authorize]
public class ChatController : Controller
{
    private readonly ChatService _chat;
    private readonly IHubContext<ChatHub> _hub;
    private readonly string _connectionString;
    private readonly ILogger<ChatController> _logger;

    public ChatController(ChatService chat, IHubContext<ChatHub> hub, IConfiguration config, ILogger<ChatController> logger)
    {
        _chat = chat;
        _hub = hub;
        _connectionString = config.GetConnectionString("Default")!;
        _logger = logger;
    }



    [UpdateLastActive]
    public abstract class BaseController : Controller
    {
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
            _logger.LogInformation("SendMessage: chatId={ChatId}, content length={ContentLength}", chatId, content?.Length ?? 0);

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
            _logger.LogError(ex, "Error sending message for chatId={ChatId}", chatId);
            return StatusCode(500, new { success = false, message = ex.Message });
        }
    }

    [HttpPost]
    public async Task<IActionResult> UploadFile(int chatId, IFormFile file, string? content = null)
    {
        _logger.LogInformation("UploadFile method called: chatId={ChatId}, file={FileName}, size={FileSize}, content length={ContentLength}",
            chatId, file?.FileName, file?.Length, content?.Length ?? 0);

        try
        {
            // Kiểm tra file
            if (file == null || file.Length == 0)
            {
                _logger.LogWarning("UploadFile: No file uploaded or file is empty for chatId={ChatId}", chatId);
                return BadRequest(new { success = false, message = "Không có file nào được upload" });
            }

            // Kiểm tra kích thước file (25MB = 25 * 1024 * 1024 bytes)
            if (file.Length > 25 * 1024 * 1024)
            {
                _logger.LogWarning("UploadFile: File too large ({FileSize} bytes) for chatId={ChatId}", file.Length, chatId);
                return BadRequest(new { success = false, message = "Kích thước file không được vượt quá 25MB" });
            }

            _logger.LogInformation("Processing file: {FileName}, size={FileSize}, type={ContentType}",
                file.FileName, file.Length, file.ContentType);

            // Tạo thư mục uploads nếu chưa tồn tại
            var uploadsPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads");
            if (!Directory.Exists(uploadsPath))
            {
                _logger.LogInformation("Creating uploads directory: {Path}", uploadsPath);
                Directory.CreateDirectory(uploadsPath);
            }

            // Tạo tên file duy nhất
            var fileNameOnly = Path.GetFileName(file.FileName);
            // Loại bỏ ký tự đặc biệt từ tên file
            var safeFileName = fileNameOnly.Replace(" ", "_")
                                         .Replace(",", "")
                                         .Replace("&", "")
                                         .Replace("#", "")
                                         .Replace("%", "")
                                         .Replace("@", "");
            // Đảm bảo tên file không dài quá 50 ký tự
            if (safeFileName.Length > 50)
            {
                var extension = Path.GetExtension(safeFileName);
                safeFileName = safeFileName.Substring(0, 46) + extension;
            }

            var uniqueFileName = $"{Guid.NewGuid()}_{safeFileName}";
            var filePath = Path.Combine(uploadsPath, uniqueFileName);

            _logger.LogInformation("Saving file to: {FilePath}", filePath);

            // Ghi file vào ổ đĩa
            using (var fileStream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(fileStream);
            }

            // URL tương đối để truy cập file
            string fileUrl = $"/uploads/{uniqueFileName}";

            // Kiểm tra xem file có thể truy cập được không
            var wwwrootPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
            var relativeFilePath = fileUrl.TrimStart('/');
            var absoluteFilePath = Path.Combine(wwwrootPath, relativeFilePath);

            if (!System.IO.File.Exists(absoluteFilePath))
            {
                _logger.LogWarning("File was saved but cannot be accessed at: {FilePath}", absoluteFilePath);
                return StatusCode(500, new { success = false, message = "Lỗi khi lưu file", error = "File đã được lưu nhưng không thể truy cập" });
            }

            _logger.LogInformation("File saved with URL: {FileUrl}", fileUrl);

            // Lưu vào database
            try
            {
                await _chat.CreateFileMessageAsync(chatId, CurrentUserId, fileUrl, file.FileName, file.ContentType, file.Length);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Database error when saving file message");
                return StatusCode(500, new { success = false, message = "Lỗi khi tải lên tập tin", error = ex.Message });
            }

            // Nếu có nội dung tin nhắn, lưu thêm tin nhắn văn bản
            if (!string.IsNullOrEmpty(content))
            {
                _logger.LogInformation("Saving additional text message: {Content}", content);
                await _chat.SendMessageAsync(chatId, CurrentUserId, content);

                // Broadcast tin nhắn văn bản
                var textMsg = new
                {
                    ChatId = chatId,
                    SenderId = CurrentUserId,
                    SenderUsername = CurrentUsername,
                    Content = content,
                    MessageType = "Text",
                    Timestamp = DateTime.UtcNow.ToString("o")
                };

                await _hub.Clients.Group($"chat_{chatId}").SendAsync("ReceiveMessage", textMsg);
            }

            // Broadcast thông tin file
            var msgObj = new
            {
                ChatId = chatId,
                SenderId = CurrentUserId,
                SenderUsername = CurrentUsername,
                Content = fileUrl,
                MessageType = file.ContentType.StartsWith("image/") ? "Image" : "File",
                Timestamp = DateTime.UtcNow.ToString("o"),
                FileName = fileNameOnly // Thêm tên file gốc
            };

            _logger.LogInformation("Broadcasting file message to chat_{ChatId}: {MessageType}, {FileUrl}",
                chatId, msgObj.MessageType, fileUrl);
            await _hub.Clients.Group($"chat_{chatId}").SendAsync("ReceiveMessage", msgObj);

            // Trả về kết quả thành công
            return Ok(msgObj);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error uploading file for chatId={ChatId}", chatId);
            return StatusCode(500, new { success = false, message = "Lỗi khi tải lên tập tin", error = ex.Message });
        }
    }

    [HttpGet]
    public IActionResult SystemCheck()
    {
        // Kiểm tra thư mục uploads
        var uploadsPath = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads");
        bool uploadsExists = Directory.Exists(uploadsPath);
        if (!uploadsExists)
        {
            try
            {
                Directory.CreateDirectory(uploadsPath);
                uploadsExists = true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating uploads directory");
            }
        }

        bool canWrite = false;
        if (uploadsExists)
        {
            try
            {
                var testFile = Path.Combine(uploadsPath, "test_write.txt");
                System.IO.File.WriteAllText(testFile, "Test");
                System.IO.File.Delete(testFile);
                canWrite = true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error testing write permission");
            }
        }

        return Json(new { uploadsExists, canWrite });
    }

  

    [HttpGet] // Thêm attribute này để chỉ định method hỗ trợ GET
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