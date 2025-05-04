using System.Reflection.Emit;
using System;
using Messenger_App.Models;
using Microsoft.EntityFrameworkCore;

namespace Messenger_App
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> opt) : base(opt) { }

        public DbSet<User> Users => Set<User>();
        public DbSet<Role> Roles => Set<Role>();
        public DbSet<UserRole> UserRoles => Set<UserRole>();

        public DbSet<Friendship> Friendships => Set<Friendship>();

        public DbSet<Chat> Chats { get; set; } = default!;
        public DbSet<ChatParticipant> ChatParticipants { get; set; } = default!;
        public DbSet<Message> Messages { get; set; } = default!;
        public DbSet<MessageReadStatus> MessageReadStatus { get; set; } = default!;
        public DbSet<Document> Documents { get; set; } = default!;
        public DbSet<Notification> Notifications { get; set; } = default!;
        public DbSet<Reminder> Reminders { get; set; } = default!;


        protected override void OnModelCreating(ModelBuilder b)
        {
            base.OnModelCreating(b);

            b.Entity<User>().ToTable("users").HasKey(u => u.UserId);
            b.Entity<User>().Property(u => u.UserId).HasColumnName("user_id");
            b.Entity<User>().Property(u => u.PasswordHash).HasColumnName("password_hash");
            b.Entity<User>().Property(u => u.Username).HasColumnName("username");
            b.Entity<User>().Property(u => u.Phone).HasColumnName("phone");
            b.Entity<User>().Property(u => u.ProfilePicture).HasColumnName("profile_picture");
            b.Entity<User>().Property(u => u.Email).HasColumnName("email");
            b.Entity<User>().Property(u => u.StatusMessage).HasColumnName("status_message");
            b.Entity<User>().Property(u => u.CreatedAt).HasColumnName("created_at");
            b.Entity<User>().Property(u => u.UpdatedAt).HasColumnName("updated_at");
            b.Entity<User>().Property(u => u.LastActive).HasColumnName("last_active");

            b.Entity<Role>().ToTable("roles").HasKey(r => r.RoleId);
            b.Entity<Role>().Property(r => r.RoleId).HasColumnName("role_id");
            b.Entity<Role>().Property(r => r.RoleName).HasColumnName("role_name");

            b.Entity<UserRole>().ToTable("user_roles");
            b.Entity<UserRole>().HasKey(ur => new { ur.UserId, ur.RoleId });
            b.Entity<UserRole>().Property(ur => ur.UserId)
                      .HasColumnName("user_id");

            b.Entity<UserRole>().Property(ur => ur.RoleId)
                                 .HasColumnName("role_id");
            b.Entity<UserRole>().HasOne(ur => ur.User)
                .WithMany(u => u.UserRoles)
                .HasForeignKey(ur => ur.UserId)
                .OnDelete(DeleteBehavior.Cascade);
            b.Entity<UserRole>().HasOne(ur => ur.Role)
                .WithMany(r => r.UserRoles)
                .HasForeignKey(ur => ur.RoleId)
                .OnDelete(DeleteBehavior.Cascade);

            b.Entity<Friendship>().ToTable("friendships");

            b.Entity<Friendship>().HasKey(f => new { f.UserId, f.FriendUserId });
            b.Entity<Friendship>().Property(f => f.UserId)
                .HasColumnName("user_id");
            b.Entity<Friendship>().Property(f => f.FriendUserId)
                .HasColumnName("friend_user_id");
            b.Entity<Friendship>().Property(f => f.Status)
                .HasColumnName("status");
            b.Entity<Friendship>().Property(f => f.CreatedAt)
                .HasColumnName("created_at");

            b.Entity<Friendship>()
                .HasOne(f => f.User)                // navigation property
                .WithMany(u => u.Friendships)      // bạn cần thêm ICollection<Friendship> Friendships trong User
                .HasForeignKey(f => f.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            b.Entity<Friendship>()
                .HasOne(f => f.FriendUser)          // nav prop thứ 2
                .WithMany(u => u.FriendOf)          // thêm ICollection<Friendship> FriendOf trong User
                .HasForeignKey(f => f.FriendUserId)
                .OnDelete(DeleteBehavior.Cascade);

            b.Entity<Friendship>().HasIndex(f => new { f.UserId, f.FriendUserId }).IsUnique();

            b.Entity<Chat>(e =>
            {
                e.ToTable("chats");
                e.HasKey(c => c.ChatId);
                e.Property(c => c.ChatId).HasColumnName("chat_id");
                e.Property(c => c.ChatType).HasColumnName("chat_type");
                e.Property(c => c.GroupName).HasColumnName("group_name");
                e.Property(c => c.OwnerId).HasColumnName("owner_id");
                e.Property(c => c.CreatedAt).HasColumnName("created_at");
                e.Property(c => c.UpdatedAt).HasColumnName("updated_at");

            });

            // ---- ChatParticipants ----
            b.Entity<ChatParticipant>(e =>
            {
                e.ToTable("chat_participants");
                e.HasKey(cp => new { cp.ChatId, cp.UserId });
                e.Property(cp => cp.ChatId).HasColumnName("chat_id");
                e.Property(cp => cp.UserId).HasColumnName("user_id");
                e.Property(cp => cp.JoinedAt).HasColumnName("joined_at");
                e.Property(cp => cp.RoleInChat).HasColumnName("role_in_chat");

                e.HasOne(cp => cp.Chat)
                 .WithMany(c => c.ChatParticipants)
                 .HasForeignKey(cp => cp.ChatId);

                e.HasOne(cp => cp.User)
                 .WithMany(u => u.ChatParticipations)
                 .HasForeignKey(cp => cp.UserId);
            });



            b.Entity<ChatParticipant>().ToTable("chat_participants").HasKey(cp => new { cp.ChatId, cp.UserId });


            // Messages
            b.Entity<Message>(e => {
                e.ToTable("messages");
                e.HasKey(m => m.MessageId);
                e.Property(m => m.MessageId).HasColumnName("message_id");
                e.Property(m => m.ChatId).HasColumnName("chat_id");
                e.Property(m => m.SenderId).HasColumnName("sender_id");
                e.Property(m => m.Content).HasColumnName("content");
                e.Property(m => m.MessageType).HasColumnName("message_type");
                e.Property(m => m.Timestamp).HasColumnName("timestamp");
                e.Property(m => m.ReplyToMessageId).HasColumnName("reply_to_message_id");
                e.Property(m => m.IsDeleted).HasColumnName("is_deleted");

                e.HasOne(m => m.Chat)
                 .WithMany(c => c.Messages)
                 .HasForeignKey(m => m.ChatId);

                e.HasOne(m => m.Sender)
                 .WithMany(u => u.MessagesSent)
                 .HasForeignKey(m => m.SenderId)
                 .OnDelete(DeleteBehavior.SetNull);
            });



            b.Entity<MessageReadStatus>().ToTable("message_read_status").HasKey(rs => new { rs.MessageId, rs.UserId });
            b.Entity<Document>().ToTable("files").HasKey(f => f.FileId);
            b.Entity<Notification>().ToTable("notifications").HasKey(n => n.NotificationId);
            b.Entity<Reminder>().ToTable("reminders").HasKey(r => r.ReminderId);
           
            b.Entity<Message>()
            .HasOne(m => m.Sender)
            .WithMany(u => u.MessagesSent)
            .HasForeignKey(m => m.SenderId)
            .OnDelete(DeleteBehavior.SetNull);

            b.Entity<ChatParticipant>()
                .HasOne(cp => cp.Chat)
                .WithMany(c => c.ChatParticipants)
                .HasForeignKey(cp => cp.ChatId);

            b.Entity<ChatParticipant>()
                .HasOne(cp => cp.User)
                .WithMany(u => u.ChatParticipations)
                .HasForeignKey(cp => cp.UserId);

            b.Entity<MessageReadStatus>()
                .HasOne(rs => rs.Message)
                .WithMany(m => m.MessageReadStatuses)
                .HasForeignKey(rs => rs.MessageId);

            b.Entity<MessageReadStatus>()
                .HasOne(rs => rs.User)
                .WithMany(u => u.MessageReadStatuses)
                .HasForeignKey(rs => rs.UserId);


        }
    }
}
