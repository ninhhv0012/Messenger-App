using System.Data;
using Npgsql;
using Messenger_App.Models;

namespace Messenger_App.Services;

public class ReminderService
{
    private readonly string _cs;
    public ReminderService(IConfiguration cfg) => _cs = cfg.GetConnectionString("Default")!;
    private NpgsqlConnection Conn() => new(_cs);

    // Tạo reminder mới
    public async Task<int> CreateReminderAsync(Reminder reminder)
    {
        const string sql = @"
            INSERT INTO reminders(user_id, chat_id, title, description, reminder_time, created_at)
            VALUES(@userId, @chatId, @title, @desc, @reminderTime, now())
            RETURNING reminder_id;
        ";

        await using var conn = Conn();
        await conn.OpenAsync();

        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("userId", reminder.UserId);
        cmd.Parameters.AddWithValue("chatId", reminder.ChatId);
        cmd.Parameters.AddWithValue("title", reminder.Title);
        cmd.Parameters.AddWithValue("desc", reminder.Description ?? (object)DBNull.Value);
        cmd.Parameters.AddWithValue("reminderTime", reminder.ReminderTime);

        var reminderId = Convert.ToInt32(await cmd.ExecuteScalarAsync()!);
        return reminderId;
    }

    // Lấy tất cả reminder của một chat
    public async Task<List<Reminder>> GetRemindersByChatAsync(int chatId)
    {
        const string sql = @"
        SELECT
            r.reminder_id,
            r.user_id,
            r.chat_id,
            r.title,
            r.description,
            r.reminder_time,
            r.is_completed,
            r.created_at,
            u.username
        FROM reminders r
        JOIN users u ON r.user_id = u.user_id
        WHERE r.chat_id = @chatId
        ORDER BY r.reminder_time desc;
    ";

        await using var conn = Conn();
        await conn.OpenAsync();

        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("chatId", chatId);

        var reminders = new List<Reminder>();
        await using var reader = await cmd.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            var reminder = new Reminder
            {
                ReminderId = reader.GetInt32(0),
                UserId = reader.GetInt32(1),
                ChatId = reader.GetInt32(2),
                Title = reader.GetString(3),
                Description = reader.IsDBNull(4) ? null : reader.GetString(4),
                ReminderTime = reader.GetDateTime(5),
                IsCompleted = reader.GetBoolean(6),
                CreatedAt = reader.GetDateTime(7)
            };

            // Tạo đối tượng User
            reminder.User = new User
            {
                UserId = reminder.UserId,
                Username = reader.GetString(8)
            };

            reminders.Add(reminder);
        }

        return reminders;
    }

    // Lấy tất cả reminder sắp đến
    public async Task<List<Reminder>> GetUpcomingRemindersAsync(int minutesAhead = 5)
    {
        const string sql = @"
            SELECT
                r.reminder_id,
                r.user_id,
                r.chat_id,
                r.title,
                r.description,
                r.reminder_time,
                r.is_completed,
                r.created_at,
                u.username,
                c.chat_type,
                CASE 
                    WHEN c.chat_type = 'Group' THEN c.group_name
                    ELSE (
                        SELECT u2.username FROM users u2
                        JOIN chat_participants cp ON u2.user_id = cp.user_id
                        WHERE cp.chat_id = c.chat_id AND u2.user_id <> r.user_id
                        LIMIT 1
                    )
                END AS chat_name
            FROM reminders r
            JOIN users u ON r.user_id = u.user_id
            JOIN chats c ON r.chat_id = c.chat_id
            WHERE r.is_completed = false
              AND r.reminder_time > now()
              AND r.reminder_time <= now() + interval '@minutesAhead minutes'
            ORDER BY r.reminder_time desc;
        ";

        await using var conn = Conn();
        await conn.OpenAsync();

        await using var cmd = new NpgsqlCommand(sql.Replace("@minutesAhead", minutesAhead.ToString()), conn);

        var reminders = new List<Reminder>();
        await using var reader = await cmd.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            var reminder = new Reminder
            {
                ReminderId = reader.GetInt32(0),
                UserId = reader.GetInt32(1),
                ChatId = reader.GetInt32(2),
                Title = reader.GetString(3),
                Description = reader.IsDBNull(4) ? null : reader.GetString(4),
                ReminderTime = reader.GetDateTime(5),
                IsCompleted = reader.GetBoolean(6),
                CreatedAt = reader.GetDateTime(7),
                User = new User
                {
                    Username = reader.GetString(8)
                }
            };

            // Thêm thông tin chat
            var chatType = reader.GetString(9);
            var chatName = reader.IsDBNull(10) ? "Chat" : reader.GetString(10);

            reminder.ChatDetails = new
            {
                ChatType = chatType,
                ChatName = chatName
            };

            reminders.Add(reminder);
        }

        return reminders;
    }

    // Đánh dấu reminder đã hoàn thành
    public async Task MarkReminderCompletedAsync(int reminderId)
    {
        const string sql = @"
            UPDATE reminders
            SET is_completed = true
            WHERE reminder_id = @reminderId;
        ";

        await using var conn = Conn();
        await conn.OpenAsync();

        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("reminderId", reminderId);

        await cmd.ExecuteNonQueryAsync();
    }

    // Xóa reminder
    public async Task DeleteReminderAsync(int reminderId, int userId)
    {
        const string sql = @"
            DELETE FROM reminders
            WHERE reminder_id = @reminderId AND user_id = @userId;
        ";

        await using var conn = Conn();
        await conn.OpenAsync();

        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("reminderId", reminderId);
        cmd.Parameters.AddWithValue("userId", userId);

        await cmd.ExecuteNonQueryAsync();
    }

    // Lấy danh sách reminder của một chat với phân trang (sắp xếp theo thời gian tăng dần)
    public async Task<List<Reminder>> GetRemindersByChatPaginatedAsync(int chatId, int pageSize = 10, DateTime? after = null)
    {
        string sql = @"
        SELECT
            r.reminder_id,
            r.user_id,
            r.chat_id,
            r.title,
            r.description,
            r.reminder_time,
            r.is_completed,
            r.created_at,
            u.username
        FROM reminders r
        JOIN users u ON r.user_id = u.user_id
        WHERE r.chat_id = @chatId
        AND (@after IS NULL OR r.reminder_time > @after)
        ORDER BY r.reminder_time ASC
        LIMIT @pageSize;
    ";

        await using var conn = Conn();
        await conn.OpenAsync();

        await using var cmd = new NpgsqlCommand(sql, conn);
        cmd.Parameters.AddWithValue("chatId", chatId);
        cmd.Parameters.AddWithValue("pageSize", pageSize);
        var afterParam = cmd.Parameters.Add("after", NpgsqlTypes.NpgsqlDbType.TimestampTz);
        afterParam.Value = after.HasValue ? after.Value : (object)DBNull.Value;

        var reminders = new List<Reminder>();
        await using var reader = await cmd.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            var reminder = new Reminder
            {
                ReminderId = reader.GetInt32(0),
                UserId = reader.GetInt32(1),
                ChatId = reader.GetInt32(2),
                Title = reader.GetString(3),
                Description = reader.IsDBNull(4) ? null : reader.GetString(4),
                ReminderTime = reader.GetDateTime(5),
                IsCompleted = reader.GetBoolean(6),
                CreatedAt = reader.GetDateTime(7)
            };

            // Tạo đối tượng User
            reminder.User = new User
            {
                UserId = reminder.UserId,
                Username = reader.GetString(8)
            };

            reminders.Add(reminder);
        }

        return reminders;
    }
}