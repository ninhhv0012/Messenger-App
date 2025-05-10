using System.ComponentModel.DataAnnotations;
using Messenger_App.Models;

namespace Messenger_App.ViewModels.Admin
{
    // ViewModel cho hiển thị danh sách người dùng
    public class UserListVM
    {
        public List<UserListItemVM> Users { get; set; } = [];
        public string SearchTerm { get; set; } = string.Empty;
        public int CurrentPage { get; set; } = 1;
        public int TotalPages { get; set; } = 1;
        public int PageSize { get; set; } = 10;
    }

    // ViewModel cho mỗi người dùng trong danh sách
    public class UserListItemVM
    {
        public int UserId { get; set; }
        public string Username { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime? LastActive { get; set; }
    }

    // ViewModel chi tiết người dùng
    public class UserDetailVM
    {
        public int UserId { get; set; }

        [Display(Name = "Tên đăng nhập")]
        public string Username { get; set; } = string.Empty;

        [Required(ErrorMessage = "Email không được để trống")]
        [EmailAddress(ErrorMessage = "Email không hợp lệ")]
        [Display(Name = "Email")]
        public string Email { get; set; } = string.Empty;

        [Phone(ErrorMessage = "Số điện thoại không hợp lệ")]
        [Display(Name = "Số điện thoại")]
        public string? Phone { get; set; }

        [Display(Name = "Thông điệp trạng thái")]
        public string? StatusMessage { get; set; }

        [Display(Name = "Ngày tạo tài khoản")]
        public DateTime CreatedAt { get; set; }

        [Display(Name = "Lần cập nhật cuối")]
        public DateTime UpdatedAt { get; set; }

        [Display(Name = "Lần hoạt động cuối")]
        public DateTime? LastActive { get; set; }

        // Vai trò hiện tại của người dùng
        public List<string> CurrentRoles { get; set; } = [];

        // Danh sách tất cả vai trò có thể gán
        public List<RoleVM> AllRoles { get; set; } = [];
    }

    // ViewModel cho vai trò
    public class RoleVM
    {
        public int RoleId { get; set; }
        public string RoleName { get; set; } = string.Empty;
        public bool IsAssigned { get; set; }
    }

    // ViewModel cho đặt lại mật khẩu
    public class ResetPasswordVM
    {
        public int UserId { get; set; }

        [Display(Name = "Tên đăng nhập")]
        public string Username { get; set; } = string.Empty;

        [Required(ErrorMessage = "Mật khẩu mới không được để trống")]
        [DataType(DataType.Password)]
        [MinLength(6, ErrorMessage = "Mật khẩu ít nhất 6 ký tự")]
        [Display(Name = "Mật khẩu mới")]
        public string NewPassword { get; set; } = string.Empty;

        [Required(ErrorMessage = "Xác nhận mật khẩu không được để trống")]
        [DataType(DataType.Password)]
        [Compare("NewPassword", ErrorMessage = "Mật khẩu xác nhận không khớp")]
        [Display(Name = "Xác nhận mật khẩu mới")]
        public string ConfirmPassword { get; set; } = string.Empty;
    }

    // ViewModel cho dashboard quản trị
    public class DashboardVM
    {
        public int TotalUsers { get; set; }
        public int NewUsersToday { get; set; }
        public int ActiveUsersToday { get; set; }
        public int TotalChats { get; set; }
        public int TotalMessages { get; set; }
        public int TotalFriendships { get; set; }
    }
}