using System.ComponentModel.DataAnnotations;

namespace Messenger_App.ViewModels.Account
{

        public record ProfileVM
    {
        [Required, EmailAddress] public string Email { get; set; } = default!;
        [Phone] public string? Phone { get; set; }
        [Display(Name = "Thông điệp trạng thái"), StringLength(255)]
        public string? StatusMessage { get; set; }
    }
    
}
