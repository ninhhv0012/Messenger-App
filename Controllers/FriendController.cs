using Messenger_App.Models;
using Messenger_App.ViewModels;
using Messenger_App;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Messenger_App.Filters;

[Authorize]
public class FriendController : Controller
{
    private readonly AppDbContext _db;
    private int CurrentUserId => int.Parse(User.FindFirst("http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier")!.Value);



    [UpdateLastActive]
    public abstract class BaseController : Controller
    {
    }
    public FriendController(AppDbContext db) { _db = db; }

    // ---------- Trang tổng ----------
    public IActionResult Index() => View();

    // ---------- API: Danh sách bạn bè ----------
    [HttpGet]
    public async Task<IActionResult> List()
    {
        var friendList = await _db.Friendships
    .Where(f =>
        (f.UserId == CurrentUserId || f.FriendUserId == CurrentUserId) &&
        f.Status == (int)FriendshipStatus.Accepted)
    .Include(f => f.User)
    .Include(f => f.FriendUser)
    .ToListAsync();
        var friends = friendList
            .Select(f =>
                f.UserId == CurrentUserId
                    ? new FriendItemVM(f.FriendUserId, f.FriendUser.Username, f.FriendUser.LastActive)
                    : new FriendItemVM( f.UserId, f.User.Username, f.User.LastActive))
            .OrderByDescending(f => f.LastActive)
            .ToList();

        return PartialView("_FriendList", friends);
    }

    // ---------- API: Lời mời đến ----------
    [HttpGet]
    public async Task<IActionResult> Requests()
    {
        var req = await _db.Friendships
            .Where(f => f.FriendUserId == CurrentUserId && f.Status == (int)FriendshipStatus.Pending)
            .Include(f => f.User)                       // người gửi
            .Select(f => new FriendItemVM(
                                          f.UserId,
                                          f.User.Username,
                                          f.User.LastActive))
            .ToListAsync();

        return PartialView("_RequestList", req);
    }

    // ---------- API: Chấp nhận / Xoá lời mời ----------
    [HttpPost]
    public async Task<IActionResult> Accept(int userId)
    {
        var f = await _db.Friendships.FindAsync(userId, CurrentUserId);
        if (f == null || f.Status != (int)FriendshipStatus.Pending)
            return NotFound();

        f.Status = (int)FriendshipStatus.Accepted;
        await _db.SaveChangesAsync();
        return Ok();
    }

    [HttpPost]
    public async Task<IActionResult> Decline(int userId)
    {
        var f = await _db.Friendships.FindAsync(userId, CurrentUserId);
        if (f == null || f.Status != (int)FriendshipStatus.Pending)
            return NotFound();

        _db.Friendships.Remove(f);
        await _db.SaveChangesAsync();
        return Ok();
    }

    // ---------- API: Xoá bạn ----------
    [HttpPost]
    public async Task<IActionResult> Remove(int friendUserId)
    {
        // tìm kiếm tình bạn giữa 2 người
        var f = await _db.Friendships
            .FirstOrDefaultAsync(f =>
                (f.UserId == CurrentUserId && f.FriendUserId == friendUserId) ||
                (f.UserId == friendUserId && f.FriendUserId == CurrentUserId));

        if (f == null || f.Status != (int)FriendshipStatus.Accepted)
            return NotFound();

        _db.Friendships.Remove(f);
        await _db.SaveChangesAsync();
        return Ok();
    }

    // ---------- API: Tìm kiếm user ----------
    [HttpGet]
    public async Task<IActionResult> Search(string term)
    {
        if (string.IsNullOrWhiteSpace(term))
            return Json(Array.Empty<object>());

        var alreadyFriends = await _db.Friendships
            .Where(f => f.UserId == CurrentUserId)
            .Select(f => f.FriendUserId)
            .ToListAsync();

        var users = await _db.Users
            .Where(u => u.Username.Contains(term) &&
                        u.UserId != CurrentUserId &&
                        !alreadyFriends.Contains(u.UserId))
            .Select(u => new { u.UserId, u.Username })
            .Take(10)
            .ToListAsync();

        return Json(users);
    }

    // ---------- API: Gửi lời mời ----------
    [HttpPost]
    public async Task<IActionResult> Invite(int id)
    {
        if (id == CurrentUserId) return BadRequest("Không thể gửi lời mời cho chính mình.");

        var exists = await _db.Friendships.AnyAsync(f =>
            (f.UserId == CurrentUserId && f.FriendUserId == id) ||
            (f.UserId == id && f.FriendUserId == CurrentUserId));

        if (exists) return BadRequest("Đã tồn tại lời mời hoặc đã là bạn.");

        _db.Friendships.Add(new Friendship
        {
            UserId = CurrentUserId,
            FriendUserId = id,
            Status = (int)FriendshipStatus.Pending
        });

        await _db.SaveChangesAsync();
        return Ok();
    }
}
