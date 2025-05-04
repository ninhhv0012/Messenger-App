namespace Messenger_App.ViewModels
{
    public record MessageVM(int MessageId, int SenderId, string SenderUsername, string Content, string Timestamp, bool IsRead);
    public class ChatDetailVM
    {
        public int ChatId { get; set; }
        public string ChatType { get; set; } = default!;
        public string Title { get; set; } = default!;
        public List<MessageVM> Messages { get; set; } = new();
    }
}
