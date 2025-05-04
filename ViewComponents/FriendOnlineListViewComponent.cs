using Messenger_App;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MessengerApp.ViewComponents;

public class FriendOnlineListViewComponent : ViewComponent
{
    private readonly AppDbContext _db;

    public FriendOnlineListViewComponent(AppDbContext db)
    {
        _db = db;
    }

    public async Task<IViewComponentResult> InvokeAsync()
    {
        if (!User.Identity?.IsAuthenticated ?? true)
            return View(new List<FriendDto>());

        var currentUserId = int.Parse(HttpContext.User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")!.Value);

        var friends = await _db.Friendships
            .Where(f => f.Status == 1 && f.UserId == currentUserId)
            .Include(f => f.FriendUser)
            .Select(f => new FriendDto
            {
                Username = f.FriendUser.Username,
                LastActive = f.FriendUser.LastActive
            })
            .OrderByDescending(f => f.LastActive)
            .ToListAsync();

        return View(friends);
    }

    public class FriendDto
    {
        public string Username { get; set; } = default!;
        public DateTime? LastActive { get; set; }
    }
}
