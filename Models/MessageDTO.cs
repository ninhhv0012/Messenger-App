namespace Messenger_App.Models;
public class MessageDTO
{
    public int MessageId { get; set; }
    public int ChatId { get; set; }
    public int? SenderId { get; set; }
    public string SenderUsername { get; set; } = string.Empty;  // <-- thêm
    public string Content { get; set; } = string.Empty;
    public string MessageType { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; }

    public string? FilePath { get; set; }

}
