using System.ComponentModel.DataAnnotations;

namespace Messenger_App.ViewModels.Account
{

        // <summary>
        /// Dữ liệu form đăng ký tài khoản mới.
        /// </summary>
     
            // <summary>
            /// Dữ liệu form đăng ký tài khoản mới.
            /// </summary>
            public record RegisterVM
        {
                [Required(ErrorMessage = "Vui lòng nhập tên đăng nhập")]
                [StringLength(50, MinimumLength = 3)]
                public string Username { get; init; } = default!;

                [Required]
                [EmailAddress(ErrorMessage = "Email không hợp lệ")]
                public string Email { get; init; } = default!;

                [Required]
                [DataType(DataType.Password)]
                [MinLength(6, ErrorMessage = "Mật khẩu ít nhất 6 ký tự")]
                public string Password { get; init; } = default!;

                [Required]
                [DataType(DataType.Password)]
                [Display(Name = "Xác nhận mật khẩu")]
                [Compare(nameof(Password), ErrorMessage = "Mật khẩu xác nhận không khớp")]
                public string ConfirmPassword { get; init; } = default!;
            }
        
    
}
