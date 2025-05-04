namespace Messenger_App.Models
{
    public class Role
    {
        public int RoleId { get; set; }
        public string RoleName { get; set; } = default!;
        public ICollection<UserRole> UserRoles { get; set; } = [];
    }
}
