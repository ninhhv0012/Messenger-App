using System.Data;
using Npgsql;
using Messenger_App.Models;
using Humanizer;
using System.Collections.Generic;

namespace Messenger_App.Services;
public class ChatService
{
    private readonly string _cs;
    public ChatService(IConfiguration cfg) => _cs = cfg.GetConnectionString("Default")!;
    private NpgsqlConnection Conn() => new(_cs);

    public async Task<List<ChatDTO>> GetChatsAsync(int userId)
    {
        const string sql = @"
SELECT c.chat_id, c.chat_type,
  CASE WHEN c.chat_type='Personal' THEN (
    SELECT u.username FROM users u
    JOIN chat_participants cp2 ON u.user_id=cp2.user_id
    WHERE cp2.chat_id=c.chat_id AND u.user_id<>@u
    LIMIT 1)
  ELSE c.group_name END AS chat_name,
  (SELECT m.content FROM messages m WHERE m.chat_id=c.chat_id ORDER BY m.timestamp DESC LIMIT 1) AS last_message,
  (SELECT m.timestamp FROM messages m WHERE m.chat_id=c.chat_id ORDER BY m.timestamp DESC LIMIT 1) AS last_message_at,
  COALESCE((SELECT COUNT(*) FROM messages m2
     LEFT JOIN message_read_status rs ON m2.message_id=rs.message_id AND rs.user_id=@u
     WHERE m2.chat_id=c.chat_id AND rs.read_at IS NULL),0) AS unread_count
FROM chat_participants cp
JOIN chats c ON cp.chat_id=c.chat_id
WHERE cp.user_id=@u
ORDER BY last_message_at DESC;";
        await using var conn = Conn(); await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("u", userId);
        var list = new List<ChatDTO>();
        await using var rdr = await cmd.ExecuteReaderAsync();
        while (await rdr.ReadAsync()) list.Add(new ChatDTO
        {
            ChatId = rdr.GetInt32(0),
            ChatType = rdr.GetString(1),
            ChatName = rdr.IsDBNull(2) ? "" : rdr.GetString(2),
            LastMessage = rdr.IsDBNull(3) ? null : rdr.GetString(3),
            LastMessageAt = rdr.IsDBNull(4) ? null : (DateTime?)rdr.GetDateTime(4),
            UnreadCount = rdr.GetInt32(5)
        });
        return list;
    }

    public async Task<List<MessageDTO>> GetMessagesAsync(int chatId, int limit = 10, DateTime? before = null)
    {
        const string sql = @"
SELECT 
    m.message_id,
    m.chat_id,
    m.sender_id,
    COALESCE(u.username,'')    AS sender_username,
    m.content,
    m.message_type,
    m.timestamp,
    f.file_path              -- lấy đường dẫn file nếu có
FROM messages m
LEFT JOIN users u   ON u.user_id = m.sender_id
LEFT JOIN files f   ON f.message_id = m.message_id
WHERE m.chat_id = @c
  AND (@b IS NULL OR m.timestamp < @b)
ORDER BY m.timestamp DESC
LIMIT @l;
";
        await using var conn = Conn();
        await conn.OpenAsync();

        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("c", chatId);
        cmd.Parameters.AddWithValue("l", limit);
        var p = cmd.Parameters.Add("b", NpgsqlTypes.NpgsqlDbType.TimestampTz);
        p.Value = before.HasValue ? before.Value : (object)DBNull.Value;

        var list = new List<MessageDTO>();
        await using var rdr = await cmd.ExecuteReaderAsync();
        while (await rdr.ReadAsync())
        {
            list.Add(new MessageDTO
            {
                MessageId = rdr.GetInt32(0),
                ChatId = rdr.GetInt32(1),
                SenderId = rdr.IsDBNull(2) ? null : rdr.GetInt32(2),
                SenderUsername = rdr.GetString(3),
                Content = rdr.GetString(4),
                MessageType = rdr.GetString(5),  // Lấy loại tin nhắn
                Timestamp = rdr.GetDateTime(6),
                FilePath = rdr.IsDBNull(7) ? null : rdr.GetString(7)
            });
        }

        list.Reverse();
        return list;
    }

    public async Task SendMessageAsync(int chatId, int userId, string content, string messageType = "Text")
    {
        Console.WriteLine($"ChatService.SendMessageAsync: chatId={chatId}, userId={userId}, messageType={messageType}");

        try
        {
            const string sql = @"
INSERT INTO messages(chat_id, sender_id, content, message_type, timestamp)
VALUES(@c, @u, @m, @t, now());";
            await using var conn = Conn(); await conn.OpenAsync();
            await using var cmd = new NpgsqlCommand(sql, conn);
            cmd.Parameters.AddWithValue("c", chatId);
            cmd.Parameters.AddWithValue("u", userId);
            cmd.Parameters.AddWithValue("m", content);
            cmd.Parameters.AddWithValue("t", messageType);

            var rowsAffected = await cmd.ExecuteNonQueryAsync();
            Console.WriteLine($"ChatService.SendMessageAsync: {rowsAffected} rows inserted");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error in ChatService.SendMessageAsync: {ex.Message}");
            Console.WriteLine($"Stack trace: {ex.StackTrace}");
            throw; // Rethrow để caller có thể xử lý
        }
    }

    public async Task<string> UploadFileAsync(int chatId, int senderId, IFormFile file)
    {
        Console.WriteLine($"UploadFileAsync called: chatId={chatId}, senderId={senderId}, file={file.FileName}, size={file.Length}");
        try
        {
            // Tạo thư mục uploads nếu chưa tồn tại
            var uploads = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "uploads");
            Console.WriteLine($"Upload directory: {uploads}");
            if (!Directory.Exists(uploads))
            {
                Console.WriteLine("Creating uploads directory");
                Directory.CreateDirectory(uploads);
            }

            // Tạo tên file duy nhất
            var fileNameOnly = Path.GetFileName(file.FileName);
            var safeFileName = fileNameOnly.Replace(" ", "_").Replace(",", "").Replace("&", "");
            var uniqueFileName = $"{Guid.NewGuid()}_{safeFileName}";
            var filePath = Path.Combine(uploads, uniqueFileName);

            Console.WriteLine($"Saving file to: {filePath}");

            // Ghi file vào ổ đĩa
            await using (var fileStream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(fileStream);
            }

            // Xác định loại tin nhắn dựa trên loại file
            string messageType = file.ContentType.StartsWith("image/") ? "Image" : "File";

            // URL tương đối để truy cập file
            string fileUrl = $"/uploads/{uniqueFileName}";
            Console.WriteLine($"File saved with URL: {fileUrl}");

            // Lưu thông tin vào cơ sở dữ liệu
            await using var conn = Conn();
            await conn.OpenAsync();
            await using var tx = await conn.BeginTransactionAsync();

            try
            {
                // Tạo tin nhắn mới
                int messageId;
                const string insertMessageSql = @"
                INSERT INTO messages(chat_id, sender_id, content, message_type, timestamp)
                VALUES(@chatId, @senderId, @content, @messageType, now())
                RETURNING message_id;";

                await using (var cmd = new NpgsqlCommand(insertMessageSql, conn, tx))
                {
                    cmd.Parameters.AddWithValue("chatId", chatId);
                    cmd.Parameters.AddWithValue("senderId", senderId);
                    cmd.Parameters.AddWithValue("content", fileUrl);
                    cmd.Parameters.AddWithValue("messageType", messageType);
                    messageId = Convert.ToInt32(await cmd.ExecuteScalarAsync());
                    Console.WriteLine($"Created message with ID: {messageId}");
                }

                // Lưu metadata của file
                const string insertFileSql = @"
                INSERT INTO files(message_id, file_name, file_path, file_type, file_size, uploaded_by, uploaded_at)
                VALUES(@messageId, @fileName, @filePath, @fileType, @fileSize, @uploadedBy, now());";

                await using (var cmd = new NpgsqlCommand(insertFileSql, conn, tx))
                {
                    cmd.Parameters.AddWithValue("messageId", messageId);
                    cmd.Parameters.AddWithValue("fileName", file.FileName);
                    cmd.Parameters.AddWithValue("filePath", fileUrl);
                    cmd.Parameters.AddWithValue("fileType", file.ContentType);
                    cmd.Parameters.AddWithValue("fileSize", file.Length);
                    cmd.Parameters.AddWithValue("uploadedBy", senderId);
                    await cmd.ExecuteNonQueryAsync();
                    Console.WriteLine($"Created file record for message ID: {messageId}");
                }

                // Commit transaction
                await tx.CommitAsync();
                Console.WriteLine("Transaction committed successfully");

                // Trả về URL
                return fileUrl;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Database error: {ex.Message}");
                await tx.RollbackAsync();
                throw;
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error in UploadFileAsync: {ex.Message}");
            Console.WriteLine($"Stack trace: {ex.StackTrace}");
            throw;
        }
    }
    public async Task<int> CreateGroupChatAsync(int ownerId, string groupName, List<int> members)
    {
        await using var conn = Conn();
        await conn.OpenAsync();
        int chatId;
        const string insChat = @"
                INSERT INTO chats(chat_type, group_name, owner_id, created_at, updated_at)
                VALUES('Group', @name, @owner, now(), now())
                RETURNING chat_id;
            ";
        await using (var cmd = new NpgsqlCommand(insChat, conn))
        {
            cmd.Parameters.AddWithValue("name", groupName);
            cmd.Parameters.AddWithValue("owner", ownerId);
            chatId = Convert.ToInt32(await cmd.ExecuteScalarAsync()!);
        }

        // Thêm participants
        const string insPart = @"
                INSERT INTO chat_participants(chat_id, user_id, joined_at)
                VALUES(@chatId, @userId, now());
            ";
        await using (var tx = await conn.BeginTransactionAsync())
        {
            // Chủ nhóm
            await using (var cmd = new NpgsqlCommand(insPart, conn, tx))
            {
                cmd.Parameters.AddWithValue("chatId", chatId);
                cmd.Parameters.AddWithValue("userId", ownerId);
                await cmd.ExecuteNonQueryAsync();
            }
            // Các thành viên khác
            foreach (var uid in members)
            {
                await using var cmd = new NpgsqlCommand(insPart, conn, tx);
                cmd.Parameters.AddWithValue("chatId", chatId);
                cmd.Parameters.AddWithValue("userId", uid);
                await cmd.ExecuteNonQueryAsync();
            }
            await tx.CommitAsync();
        }

        return chatId;
    }


    public async Task<int> GetOrCreatePersonalChatAsync(int u1, int u2)
    {
        const string find = "SELECT cp1.chat_id FROM chat_participants cp1 JOIN chat_participants cp2 ON cp1.chat_id = cp2.chat_id WHERE cp1.user_id = @u1 AND cp2.user_id = @u2 AND EXISTS(SELECT 1 FROM chats c WHERE c.chat_id = cp1.chat_id AND c.chat_type = 'Personal') LIMIT 1; ";
        await using var conn = Conn(); await conn.OpenAsync();
        await using (var cmd = new NpgsqlCommand(find, conn))
        {
            cmd.Parameters.AddWithValue("u1", u1); cmd.Parameters.AddWithValue("u2", u2);
            var obj = await cmd.ExecuteScalarAsync(); if (obj != null) return Convert.ToInt32(obj);
        }
        const string ins = "INSERT INTO chats(chat_type,created_at,updated_at) VALUES('Personal',now(),now()) RETURNING chat_id;";
        int chatId;
        await using (var cmd = new NpgsqlCommand(ins, Conn())) { await cmd.Connection.OpenAsync(); chatId = Convert.ToInt32(await cmd.ExecuteScalarAsync()!); }
        const string part = "INSERT INTO chat_participants(chat_id,user_id,joined_at) VALUES(@c,@u,now());";
        await using (var conn2 = Conn()) { await conn2.OpenAsync(); await using (var tx = await conn2.BeginTransactionAsync()) { foreach (var uid in new[] { u1, u2 }) { await using var cmd = new NpgsqlCommand(part, conn2, tx); cmd.Parameters.AddWithValue("c", chatId); cmd.Parameters.AddWithValue("u", uid); await cmd.ExecuteNonQueryAsync(); } await tx.CommitAsync(); } }
        return chatId;
    }

    public async Task<List<UserDTO>> GetFriendsAsync(int userId)
    {
        const string sql = @"
SELECT f.friend_user_id AS user_id, u.username
  FROM friendships AS f
  JOIN users AS u ON u.user_id = f.friend_user_id
 WHERE f.user_id = @userId AND f.status = 1
UNION
SELECT f2.user_id AS user_id, u2.username
  FROM friendships AS f2
  JOIN users AS u2 ON u2.user_id = f2.user_id
 WHERE f2.friend_user_id = @userId AND f2.status = 1;";
        await using var conn = Conn();
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("userId", userId);
        var list = new List<UserDTO>();
        await using var rdr = await cmd.ExecuteReaderAsync();
        while (await rdr.ReadAsync())
            list.Add(new UserDTO(
                rdr.GetInt32(rdr.GetOrdinal("user_id")),
                rdr.GetString(rdr.GetOrdinal("username"))
            ));
        return list;
    }

    public async Task<int> CreateFileMessageAsync(int chatId, int senderId, string fileUrl, string fileName, string contentType, long fileSize)
    {
        Console.WriteLine($"CreateFileMessageAsync: chatId={chatId}, senderId={senderId}, fileUrl={fileUrl}");

        await using var conn = Conn();
        await conn.OpenAsync();
        await using var tx = await conn.BeginTransactionAsync();

        try
        {
            // Xác định loại tin nhắn dựa trên loại file
            string messageType = contentType.StartsWith("image/") ? "Image" : "File";

            // Tạo tin nhắn mới
            int messageId;
            const string insertMessageSql = @"
            INSERT INTO messages(chat_id, sender_id, content, message_type, timestamp)
            VALUES(@chatId, @senderId, @content, @messageType, now())
            RETURNING message_id;";

            await using (var cmd = new NpgsqlCommand(insertMessageSql, conn, tx))
            {
                cmd.Parameters.AddWithValue("chatId", chatId);
                cmd.Parameters.AddWithValue("senderId", senderId);
                cmd.Parameters.AddWithValue("content", fileUrl);
                cmd.Parameters.AddWithValue("messageType", messageType);
                messageId = Convert.ToInt32(await cmd.ExecuteScalarAsync());
                Console.WriteLine($"Created message with ID: {messageId}");
            }

            // Giới hạn độ dài tên file nếu cần
            if (fileName.Length > 250)
            {
                var extension = Path.GetExtension(fileName);
                fileName = fileName.Substring(0, 240) + extension;
            }

            // Lưu metadata của file
            const string insertFileSql = @"
            INSERT INTO files(message_id, file_name, file_path, file_type, file_size, uploaded_by, uploaded_at)
            VALUES(@messageId, @fileName, @filePath, @fileType, @fileSize, @uploadedBy, now());";

            await using (var cmd = new NpgsqlCommand(insertFileSql, conn, tx))
            {
                cmd.Parameters.AddWithValue("messageId", messageId);
                cmd.Parameters.AddWithValue("fileName", fileName);
                cmd.Parameters.AddWithValue("filePath", fileUrl);
                cmd.Parameters.AddWithValue("fileType", contentType);
                cmd.Parameters.AddWithValue("fileSize", fileSize);
                cmd.Parameters.AddWithValue("uploadedBy", senderId);
                await cmd.ExecuteNonQueryAsync();
                Console.WriteLine($"Created file record for message ID: {messageId}");
            }

            // Commit transaction
            await tx.CommitAsync();
            Console.WriteLine("Transaction committed successfully");

            return messageId;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Database error in CreateFileMessageAsync: {ex.Message}");
            Console.WriteLine($"Stack trace: {ex.StackTrace}");
            await tx.RollbackAsync();
            throw;
        }
    }
}