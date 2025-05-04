using System.ComponentModel.DataAnnotations;

namespace Messenger_App.ViewModels.Account
{

        public record ChangePasswordVM
    {
        [Required, DataType(DataType.Password)]
        [Display(Name = "Mật khẩu hiện tại")]
        public string CurrentPassword { get; init; } = default!;

        [Required, DataType(DataType.Password)]
        [Display(Name = "Mật khẩu mới"), MinLength(6)]
        public string NewPassword { get; init; } = default!;

        [Required, DataType(DataType.Password)]
        [Display(Name = "Xác nhận mật khẩu mới")]
        [Compare(nameof(NewPassword))]
        public string ConfirmNewPassword { get; init; } = default!;
    }
    
}
