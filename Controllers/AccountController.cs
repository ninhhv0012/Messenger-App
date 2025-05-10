using Messenger_App.Models;
using Messenger_App.ViewModels.Account;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.VisualStudio.Web.CodeGenerators.Mvc.Templates.BlazorIdentity.Pages;
using Microsoft.VisualStudio.Web.CodeGenerators.Mvc.Templates.BlazorIdentity.Pages.Manage;
using Messenger_App.Filters;

namespace Messenger_App.Controllers
{
    public class AccountController : Controller
    {
        private readonly AppDbContext _db;
        private readonly IPasswordHasher<User> _hasher;

        public AccountController(AppDbContext db, IPasswordHasher<User> hasher)
        {
            _db = db; _hasher = hasher;
        }

        [UpdateLastActive]
        public abstract class BaseController : Controller
        {
        }

        /* ---------- ĐĂNG KÝ ---------- */
        [HttpGet]
        public IActionResult Register() => View();

        [HttpPost]
        public async Task<IActionResult> Register(RegisterVM vm)
        {
            if (!ModelState.IsValid) return View(vm);

            if (await _db.Users.AnyAsync(u => u.Username == vm.Username))
            {
                ModelState.AddModelError("", "Tên đăng nhập đã tồn tại");
                return View(vm);
            }

            await using var tx = await _db.Database.BeginTransactionAsync();

            var user = new User
            {
                Username = vm.Username,
                Email = vm.Email,
                PasswordHash = _hasher.HashPassword(null!, vm.Password),
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            _db.Users.Add(user);
            await _db.SaveChangesAsync();
            /* Gán role mặc định "User" (RoleId = 2) */
            var roleId = await _db.Roles
                                  .Where(r => r.RoleName == "User")
                                  .Select(r => r.RoleId)
                                  .FirstOrDefaultAsync();

            if (roleId == 0)
            {
                await tx.RollbackAsync();
                ModelState.AddModelError("", "Thiếu role mặc định 'User'.");
                return View(vm);
            }

            /* Thêm dòng vào bảng nối */
            _db.UserRoles.Add(new UserRole        // đúng tên entity
            {
                UserId = user.UserId,             // đã có giá trị > 0
                RoleId = roleId
            });
            await _db.SaveChangesAsync();         // LƯU LẦN 2

            await tx.CommitAsync();




            return RedirectToAction(nameof(Login));
        }
        [HttpGet]
        public IActionResult Login(string? returnUrl = null)
        {
            ViewData["ReturnUrl"] = returnUrl;
            return View();
        }

        [HttpPost]
        public async Task<IActionResult> Login(LoginVM vm, string? returnUrl = null)
        {
            if (!ModelState.IsValid) return View(vm);

            var user = await _db.Users.FirstOrDefaultAsync(u => u.Username == vm.Username);
            if (user == null ||
                _hasher.VerifyHashedPassword(user, user.PasswordHash, vm.Password)
                != PasswordVerificationResult.Success)
            {
                ModelState.AddModelError("", "Sai tên đăng nhập hoặc mật khẩu");
                return View(vm);
            }

            user.LastActive = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.UserId.ToString()),
            new(ClaimTypes.Name, user.Username)
        };

            var roles = await _db.UserRoles.Where(ur => ur.UserId == user.UserId)
                                           .Select(ur => ur.Role.RoleName)
                                           .ToListAsync();
            claims.AddRange(roles.Select(r => new Claim(ClaimTypes.Role, r)));

            var identity = new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme);
            await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme,
                new ClaimsPrincipal(identity),
                new AuthenticationProperties { IsPersistent = vm.RememberMe });

            return LocalRedirect(returnUrl ?? "/");
        }

        /* ---------- Logout ---------- */
        public async Task<IActionResult> Logout()
        {
            await HttpContext.SignOutAsync();
            return RedirectToAction(nameof(Login));
        }

        /* ---------- Profile ---------- */
        [Authorize]
        [HttpGet]
        public async Task<IActionResult> Profile()
        {
            var uid = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var user = await _db.Users.FindAsync(uid);
            if (user == null) return NotFound();

            var vm = new ProfileVM
            {
                Email = user.Email,
                Phone = user.Phone,
                StatusMessage = user.StatusMessage
            };
            return View(vm);
        }

        [Authorize, HttpPost]
        public async Task<IActionResult> Profile(ProfileVM vm)
        {
            if (!ModelState.IsValid) return View(vm);

            var uid = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var user = await _db.Users.FindAsync(uid);
            if (user == null) return NotFound();

            user.Email = vm.Email;
            user.Phone = vm.Phone;
            user.StatusMessage = vm.StatusMessage;
            user.UpdatedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync();
            ViewBag.Success = "Cập nhật thành công";
            return View(vm);
        }

        /* ---------- Change Password (optional) ---------- */
        [Authorize]
        [HttpGet] public IActionResult ChangePassword() => View();

        [Authorize]
        [HttpPost]
        public async Task<IActionResult> ChangePassword(ChangePasswordVM vm)
        {
            if (!ModelState.IsValid) return View(vm);

            var uid = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
            var user = await _db.Users.FindAsync(uid);
            if (user == null) return NotFound();

            if (_hasher.VerifyHashedPassword(user, user.PasswordHash, vm.CurrentPassword)
                != PasswordVerificationResult.Success)
            {
                ModelState.AddModelError("", "Mật khẩu hiện tại không đúng");
                return View(vm);
            }

            user.PasswordHash = _hasher.HashPassword(user, vm.NewPassword);
            await _db.SaveChangesAsync();
            TempData["PwdChanged"] = true;
            return RedirectToAction(nameof(Profile));
        }


    }
}
