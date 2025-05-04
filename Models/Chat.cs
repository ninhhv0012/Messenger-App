
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Messenger_App.Models
{
    public class Chat
    {
        public int ChatId { get; set; }
        public string ChatType { get; set; } = default!;   // "Personal" or "Group"
        public string? GroupName { get; set; }
        public int? OwnerId { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        public ICollection<ChatParticipant> ChatParticipants { get; set; } = new List<ChatParticipant>();
        public ICollection<Message> Messages { get; set; } = new List<Message>();

    }
}
