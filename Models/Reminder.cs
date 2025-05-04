
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Messenger_App.Models
{
    public class Reminder
    {
        public int ReminderId { get; set; }
        public int UserId { get; set; }
        public string Title { get; set; } = default!;
        public string? Description { get; set; }
        public DateTime ReminderTime { get; set; }
        public bool IsCompleted { get; set; }
        public DateTime CreatedAt { get; set; }

        public User User { get; set; } = default!;
    }
}
