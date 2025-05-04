using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MessengerApp.Controllers;

[Authorize]
public class FriendUIController : Controller
{
    /// <summary>
    /// Trả về partial chứa giao diện tìm kiếm bạn bè
    /// </summary>
    public IActionResult AddPartial()
    {
        return PartialView("_AddFriend");
    }

    // Tương lai bạn có thể bổ sung các giao diện nhỏ khác như:
    // public IActionResult SuggestPartial() => PartialView("_SuggestFriend");
}
