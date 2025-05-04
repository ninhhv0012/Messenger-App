
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Messenger_App.Models
{
    public class Message
    {
        public int MessageId { get; set; }
        public int ChatId { get; set; }
        public Chat Chat { get; set; } = default!;

        public int? SenderId { get; set; }
        public User? Sender { get; set; }

        public string? Content { get; set; }
        public string MessageType { get; set; } = default!; // "Text","Image","File",...
        public DateTime Timestamp { get; set; }

        public int? ReplyToMessageId { get; set; }
        public Message? ReplyToMessage { get; set; }

        public bool IsDeleted { get; set; }

        public ICollection<MessageReadStatus> MessageReadStatuses { get; set; } = new List<MessageReadStatus>();
        public ICollection<Document> Documents { get; set; } = new List<Document>();
    }
}
