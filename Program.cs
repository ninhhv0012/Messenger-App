using Messenger_App;
using Messenger_App.Hubs;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

// Thêm services vào container
builder.Services.AddControllersWithViews()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
        options.JsonSerializerOptions.PropertyNamingPolicy = null;
    });

// Kết nối DB
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Default")));

// Đăng ký dịch vụ xử lý mật khẩu
builder.Services.AddSingleton<IPasswordHasher<Messenger_App.Models.User>, PasswordHasher<Messenger_App.Models.User>>();

// Đăng ký service xử lý chat
builder.Services.AddScoped<Messenger_App.Services.ChatService>();

builder.Services.AddScoped<Messenger_App.Services.ReminderService>();
builder.Services.AddHostedService<Messenger_App.Services.ReminderBackgroundService>();


// Thêm CORS để cho phép kết nối từ các nguồn khác
builder.Services.AddCors(options =>
{
    options.AddPolicy("SignalRPolicy", builder =>
    {
        builder
            .AllowAnyOrigin()
            .AllowAnyMethod()
            .AllowAnyHeader();
        // Không sử dụng AllowCredentials() với AllowAnyOrigin()
    });
});


// Thêm SignalR với tùy chọn cấu hình chi tiết
builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = true;
    options.MaximumReceiveMessageSize = 128 * 1024; // 128 KB
    options.ClientTimeoutInterval = TimeSpan.FromSeconds(60);
    options.KeepAliveInterval = TimeSpan.FromSeconds(15);
});

// Cấu hình xác thực Cookie
builder.Services.AddAuthentication("Cookies")
    .AddCookie("Cookies", options =>
    {
        options.Cookie.Name = "Messenger.Auth";
        options.ExpireTimeSpan = TimeSpan.FromDays(7);
        options.LoginPath = "/Account/Login";
        options.LogoutPath = "/Account/Logout";
        options.Cookie.HttpOnly = true;
        options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
    });

var app = builder.Build();

// Cấu hình HTTP request pipeline
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();

app.UseRouting();

// Kích hoạt CORS trước xác thực và phân quyền
app.UseCors("SignalRPolicy");


app.UseAuthentication();
app.UseAuthorization();

// Cấu hình EndPoints
app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

// Cấu hình SignalR hub
app.MapHub<ChatHub>("/chathub");

app.Run();