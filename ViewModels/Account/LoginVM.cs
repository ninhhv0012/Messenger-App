using System.ComponentModel.DataAnnotations;

namespace Messenger_App.ViewModels.Account
{

        public record LoginVM
        {
            [Required]
            public string Username { get; init; } = default!;

            [Required]
            [DataType(DataType.Password)]
            public string Password { get; init; } = default!;

            [Display(Name = "Ghi nhớ đăng nhập")]
            public bool RememberMe { get; init; }
        }
    
}
