using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;

namespace Messenger_App.Filters
{
    public class UpdateLastActiveAttribute : TypeFilterAttribute
    {
        public UpdateLastActiveAttribute() : base(typeof(LastActiveActionFilter))
        {
        }
    }

    public class LastActiveActionFilter : IAsyncActionFilter
    {
        private readonly AppDbContext _db;

        public LastActiveActionFilter(AppDbContext db)
        {
            _db = db;
        }

        public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            // Kiểm tra user đã đăng nhập
            if (context.HttpContext.User.Identity?.IsAuthenticated ?? false)
            {
                // Lấy ID của user hiện tại
                if (int.TryParse(context.HttpContext.User.FindFirstValue(ClaimTypes.NameIdentifier), out int userId))
                {
                    // Cập nhật LastActive
                    await _db.Users
                        .Where(u => u.UserId == userId)
                        .ExecuteUpdateAsync(s => s.SetProperty(u => u.LastActive, DateTime.UtcNow));
                }
            }

            // Tiếp tục xử lý request
            await next();
        }
    }
}