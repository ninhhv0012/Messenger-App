
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Messenger_App.Models
{
    public class ChatParticipant
    {
        public int ChatId { get; set; }
        public int UserId { get; set; }
        public DateTime JoinedAt { get; set; }
        public string? RoleInChat { get; set; }

        public Chat Chat { get; set; } = default!;
        public User User { get; set; } = default!;
    }
}
