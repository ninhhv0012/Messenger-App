using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Messenger_App.Models;
using Messenger_App.ViewModels.Admin;
using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using System.Linq;
using Microsoft.VisualStudio.Web.CodeGenerators.Mvc.Templates.BlazorIdentity.Pages;

namespace Messenger_App.Controllers
{
    [Authorize(Roles = "Admin")]
    public class AdminController : Controller
    {
        private readonly AppDbContext _db;
        private readonly IPasswordHasher<User> _hasher;

        public AdminController(AppDbContext db, IPasswordHasher<User> hasher)
        {
            _db = db;
            _hasher = hasher;
        }

        private int CurrentUserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        // Hiển thị danh sách người dùng
        public async Task<IActionResult> Users(string searchTerm = "", int page = 1, int pageSize = 10)
        {
            var query = _db.Users.AsQueryable();

            // Tìm kiếm theo tên đăng nhập hoặc email nếu có
            if (!string.IsNullOrWhiteSpace(searchTerm))
            {
                query = query.Where(u =>
                    u.Username.Contains(searchTerm) ||
                    u.Email.Contains(searchTerm));
            }

            // Tính tổng số lượng người dùng sau khi tìm kiếm
            var totalUsers = await query.CountAsync();
            var totalPages = (int)Math.Ceiling(totalUsers / (double)pageSize);

            // Đảm bảo page không vượt quá tổng số trang
            page = Math.Min(Math.Max(1, page), Math.Max(1, totalPages));

            // Lấy danh sách người dùng có phân trang, sắp xếp theo thời gian tạo giảm dần
            var users = await query
                .OrderByDescending(u => u.CreatedAt)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .Select(u => new UserListItemVM
                {
                    UserId = u.UserId,
                    Username = u.Username,
                    Email = u.Email,
                    CreatedAt = u.CreatedAt,
                    LastActive = u.LastActive
                })
                .ToListAsync();

            var model = new UserListVM
            {
                Users = users,
                SearchTerm = searchTerm,
                CurrentPage = page,
                TotalPages = totalPages,
                PageSize = pageSize
            };

            return View(model);
        }

        // Hiển thị chi tiết và cập nhật người dùng
        [HttpGet]
        public async Task<IActionResult> UserDetail(int id)
        {
            var user = await _db.Users
                .Include(u => u.UserRoles)
                .ThenInclude(ur => ur.Role)
                .FirstOrDefaultAsync(u => u.UserId == id);

            if (user == null)
                return NotFound();

            // Lấy tất cả các vai trò hiện có
            var allRoles = await _db.Roles.ToListAsync();

            var model = new UserDetailVM
            {
                UserId = user.UserId,
                Username = user.Username,
                Email = user.Email,
                Phone = user.Phone,
                StatusMessage = user.StatusMessage,
                CreatedAt = user.CreatedAt,
                UpdatedAt = user.UpdatedAt,
                LastActive = user.LastActive,
                CurrentRoles = user.UserRoles.Select(ur => ur.Role.RoleName).ToList(),
                AllRoles = allRoles.Select(r => new RoleVM
                {
                    RoleId = r.RoleId,
                    RoleName = r.RoleName,
                    IsAssigned = user.UserRoles.Any(ur => ur.RoleId == r.RoleId)
                }).ToList()
            };

            return View(model);
        }

        [HttpPost]
        public async Task<IActionResult> UserDetail(UserDetailVM model)
        {
            if (!ModelState.IsValid)
                return View(model);

            var user = await _db.Users
                .Include(u => u.UserRoles)
                .FirstOrDefaultAsync(u => u.UserId == model.UserId);

            if (user == null)
                return NotFound();

            // Cập nhật thông tin cơ bản
            user.Email = model.Email;
            user.Phone = model.Phone;
            user.StatusMessage = model.StatusMessage;
            user.UpdatedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();

            TempData["SuccessMessage"] = "Cập nhật thông tin người dùng thành công";
            return RedirectToAction(nameof(UserDetail), new { id = user.UserId });
        }

        // Cập nhật vai trò cho người dùng
        [HttpPost]
        public async Task<IActionResult> UpdateRoles(int userId, int[] selectedRoles)
        {
            var user = await _db.Users
                .Include(u => u.UserRoles)
                .FirstOrDefaultAsync(u => u.UserId == userId);

            if (user == null)
                return NotFound();

            // Kiểm tra nếu là admin cuối cùng thì không cho phép bỏ quyền admin
            if (!selectedRoles.Contains(1)) // Giả sử 1 là roleId của Admin
            {
                var adminRoleId = await _db.Roles
                    .Where(r => r.RoleName == "Admin")
                    .Select(r => r.RoleId)
                    .FirstOrDefaultAsync();

                // Kiểm tra có phải admin cuối cùng không
                var isLastAdmin = await _db.UserRoles
                    .CountAsync(ur => ur.RoleId == adminRoleId) <= 1 &&
                    user.UserRoles.Any(ur => ur.RoleId == adminRoleId);

                if (isLastAdmin)
                {
                    TempData["ErrorMessage"] = "Không thể bỏ quyền Admin của người dùng này vì đây là Admin cuối cùng.";
                    return RedirectToAction(nameof(UserDetail), new { id = userId });
                }
            }

            // Xóa tất cả các vai trò hiện tại
            _db.UserRoles.RemoveRange(user.UserRoles);

            // Thêm lại các vai trò được chọn
            if (selectedRoles != null)
            {
                foreach (var roleId in selectedRoles)
                {
                    _db.UserRoles.Add(new UserRole
                    {
                        UserId = userId,
                        RoleId = roleId
                    });
                }
            }

            await _db.SaveChangesAsync();

            TempData["SuccessMessage"] = "Cập nhật vai trò thành công";
            return RedirectToAction(nameof(UserDetail), new { id = userId });
        }

        // Khóa/Mở khóa tài khoản
        [HttpPost]
        public async Task<IActionResult> ToggleUserStatus(int userId)
        {
            var user = await _db.Users.FindAsync(userId);
            if (user == null)
                return NotFound();

            // Kiểm tra nếu là admin cuối cùng thì không cho phép khóa
            var adminRoleId = await _db.Roles
                .Where(r => r.RoleName == "Admin")
                .Select(r => r.RoleId)
                .FirstOrDefaultAsync();

            var isAdmin = await _db.UserRoles
                .AnyAsync(ur => ur.UserId == userId && ur.RoleId == adminRoleId);

            if (isAdmin)
            {
                var adminCount = await _db.UserRoles
                    .CountAsync(ur => ur.RoleId == adminRoleId);

                if (adminCount <= 1)
                {
                    TempData["ErrorMessage"] = "Không thể khóa tài khoản admin cuối cùng.";
                    return RedirectToAction(nameof(UserDetail), new { id = userId });
                }
            }

            // Đặt cờ khóa tài khoản (giả sử có trường IsLocked trong bảng Users)
            // Nếu chưa có trường này thì cần thêm vào database
            // user.IsLocked = !user.IsLocked;

            // Tạm thời dùng StatusMessage để đánh dấu tài khoản bị khóa
            if (user.StatusMessage?.Contains("[LOCKED]") == true)
            {
                user.StatusMessage = user.StatusMessage.Replace("[LOCKED]", "").Trim();
            }
            else
            {
                user.StatusMessage = "[LOCKED] " + (user.StatusMessage ?? "");
            }

            await _db.SaveChangesAsync();

            TempData["SuccessMessage"] = user.StatusMessage?.Contains("[LOCKED]") == true
                ? "Đã khóa tài khoản người dùng."
                : "Đã mở khóa tài khoản người dùng.";

            return RedirectToAction(nameof(UserDetail), new { id = userId });
        }

        // Đặt lại mật khẩu
        [HttpGet]
        public async Task<IActionResult> ResetPassword(int id)
        {
            var user = await _db.Users.FindAsync(id);
            if (user == null)
                return NotFound();

            var model = new ResetPasswordVM
            {
                UserId = id,
                Username = user.Username
            };
            return View(model);
        }

        [HttpPost]
        public async Task<IActionResult> ResetPassword(ResetPasswordVM model)
        {
            if (!ModelState.IsValid)
                return View(model);

            var user = await _db.Users.FindAsync(model.UserId);
            if (user == null)
                return NotFound();

            user.PasswordHash = _hasher.HashPassword(user, model.NewPassword);
            user.UpdatedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();

            TempData["SuccessMessage"] = "Đặt lại mật khẩu thành công";
            return RedirectToAction(nameof(UserDetail), new { id = user.UserId });
        }

        // Dashboard
        public async Task<IActionResult> Index()
        {
            var dashboardVM = new DashboardVM
            {
                TotalUsers = await _db.Users.CountAsync(),
                NewUsersToday = await _db.Users.CountAsync(u => u.CreatedAt.Date == DateTime.UtcNow.Date),
                ActiveUsersToday = await _db.Users.CountAsync(u => u.LastActive.HasValue && u.LastActive.Value.Date == DateTime.UtcNow.Date),
                TotalChats = await _db.Chats.CountAsync(),
                TotalMessages = await _db.Messages.CountAsync(),
                TotalFriendships = await _db.Friendships.CountAsync(f => f.Status == (int)FriendshipStatus.Accepted)
            };

            return View(dashboardVM);
        }
    }
}