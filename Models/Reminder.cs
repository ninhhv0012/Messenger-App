using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace Messenger_App.Models
{
    public class Reminder
    {
        public int ReminderId { get; set; }
        public int UserId { get; set; }
        public int ChatId { get; set; }  // Thêm trường liên kết với chat
        public string Title { get; set; } = default!;
        public string? Description { get; set; }
        public DateTime ReminderTime { get; set; }
        public bool IsCompleted { get; set; }
        public DateTime CreatedAt { get; set; }

        public User User { get; set; } = default!;

        public Chat Chat { get; set; } = default!;

        [NotMapped]
        [JsonIgnore]
        public dynamic? ChatDetails { get; set; }
    }
}