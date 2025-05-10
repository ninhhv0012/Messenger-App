using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Messenger_App.Filters
{
    public class CheckAccountLockedFilter : IAsyncAuthorizationFilter
    {
        private readonly AppDbContext _db;

        public CheckAccountLockedFilter(AppDbContext db)
        {
            _db = db;
        }

        public async Task OnAuthorizationAsync(AuthorizationFilterContext context)
        {
            if (!context.HttpContext.User.Identity!.IsAuthenticated)
            {
                // Người dùng chưa đăng nhập, không cần kiểm tra
                return;
            }

            var userId = int.Parse(context.HttpContext.User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var user = await _db.Users.FindAsync(userId);

            if (user == null)
            {
                // Không tìm thấy người dùng, đăng xuất
                context.Result = new RedirectToActionResult("Logout", "Account", null);
                return;
            }

            // Kiểm tra xem tài khoản có bị khóa không (theo StatusMessage)
            if (user.StatusMessage?.Contains("[LOCKED]") == true)
            {
                // Tài khoản bị khóa, đăng xuất và thông báo
                context.Result = new RedirectToActionResult("Logout", "Account", new { message = "Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên." });
            }
        }
    }
}