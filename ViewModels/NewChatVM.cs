using System.ComponentModel.DataAnnotations;
using Messenger_App.Models;

namespace Messenger_App.ViewModels;
public class NewChatVM
{
    public bool IsGroup { get; set; }
    [Display(Name = "Chọn bạn")] public int? OtherUserId { get; set; }
    [Display(Name = "Tên nhóm")] public string? GroupName { get; set; }
    [Display(Name = "Chọn thành viên")] public List<int>? MemberIds { get; set; }
    public List<UserDTO> Friends { get; set; } = new();
}