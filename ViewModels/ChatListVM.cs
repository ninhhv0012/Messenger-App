namespace Messenger_App.ViewModels;
public class ChatListVM
{
    public int ChatId { get; set; }
    public string ChatType { get; set; } = string.Empty;
    public string ChatName { get; set; } = string.Empty;
    public string? LastMessage { get; set; }
    public DateTime? LastMessageAt { get; set; }
    public int UnreadCount { get; set; }
}