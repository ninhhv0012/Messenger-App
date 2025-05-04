
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Messenger_App.Models
{
    public class MessageReadStatus
    {
        public int MessageId { get; set; }
        public int UserId { get; set; }
        public DateTime? ReadAt { get; set; }

        public Message Message { get; set; } = default!;
        public User User { get; set; } = default!;
    }
}
