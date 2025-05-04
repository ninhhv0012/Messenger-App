using Messenger_App.Models;
using Messenger_App;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Messenger_App.Hubs;
using Npgsql.EntityFrameworkCore.PostgreSQL;
using Microsoft.EntityFrameworkCore.Design;
using Messenger_App.Services;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddTransient<ChatService>();

/* ---------- DI & DbContext ---------- */
builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseNpgsql(builder.Configuration.GetConnectionString("Default")));

/* ---------- Auth ---------- */
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(opt =>
    {
        opt.LoginPath = "/Account/Login";
        opt.LogoutPath = "/Account/Logout";
    });
builder.Services.AddAuthorization();
builder.Services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();

/* ---------- MVC ---------- */
builder.Services.AddControllersWithViews();
builder.Services.AddSignalR();





var app = builder.Build();

/* ---------- Seed Roles (mẫu) ---------- */
using (var scope = app.Services.CreateScope())
{
    var ctx = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    if (!ctx.Roles.Any())
    {
        ctx.Roles.AddRange(new Role { RoleName = "Admin" },
                           new Role { RoleName = "User" });
        ctx.SaveChanges();
    }
}

/* ---------- Middleware ---------- */
if (!app.Environment.IsDevelopment()) app.UseExceptionHandler("/Home/Error");

app.UseStaticFiles();
app.UseRouting();

app.UseAuthentication();
app.UseAuthorization();

/* ---------- End‑point ---------- */
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");
// Map SignalR hub
app.MapHub<ChatHub>("/chathub");

app.Run();
