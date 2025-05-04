

namespace Messenger_App.Models

{
    public class User
    {

        public int UserId { get; set; }
        public string Username { get; set; } = default!;
        public string PasswordHash { get; set; } = default!;
        public string Email { get; set; } = default!;
        public string? Phone { get; set; }
        public string? ProfilePicture { get; set; }
        public string? StatusMessage { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }

        public DateTime? LastActive { get; set; }
        public ICollection<UserRole> UserRoles { get; set; } = [];

        public ICollection<ChatParticipant> ChatParticipations { get; set; } = new List<ChatParticipant>();

        public ICollection<Friendship> Friendships { get; set; } = [];
        public ICollection<Reminder> Reminders { get; set; } = [];
        public ICollection<Notification> Notifications { get; set; } = [];
        public ICollection<Message> Messages { get; set; } = [];
        public ICollection<Document> Documents { get; set; } = [];
        public ICollection<Chat> Chats { get; set; } = [];
        public ICollection<MessageReadStatus> MessageReadStatuses { get; set; } = [];
        public ICollection<Chat> ChatGroups { get; set; } = [];
        public ICollection<Chat> ChatOwners { get; set; } = [];
        public ICollection<Chat> ChatParticipants { get; set; } = [];
        public ICollection<Message> MessagesSent { get; set; } = [];

        public ICollection<Friendship> FriendOf { get; set; } = new List<Friendship>();

    }
}
