
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Messenger_App.Models
{
    public class Friendship
    {

        public int UserId { get; set; }
        public int FriendUserId { get; set; }
        public int Status { get; set; } = (int)FriendshipStatus.Pending;
        public DateTime CreatedAt { get; set; }

        public User User { get; set; } = default!;
        public User FriendUser { get; set; } = default!;
    }
}
