namespace Messenger_App.Models;
public class ChatDTO
{
    public int ChatId { get; set; }
    public string ChatType { get; set; } = "";
    public string ChatName { get; set; } = "";
    public string? LastMessage { get; set; }
    public DateTime? LastMessageAt { get; set; }
    public int UnreadCount { get; set; }
}
