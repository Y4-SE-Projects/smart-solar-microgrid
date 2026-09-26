/* File: Program.cs
 * Purpose: Configures MongoDB, JWT bearer authentication, CORS, Swagger, request logging, and maps all
 *          controllers/minimal-API endpoints for the Smart Solar Microgrid API.
 * Author: All 4 Members
 */

using API.Settings;
using API.Data;
using API.Models;
using API.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Security.Claims;
using System.Text;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

// MongoDB configuration
builder.Services.Configure<MongoDbSettings>(builder.Configuration.GetSection("MongoDbSettings"));
builder.Services.AddSingleton<MongoDbContext>();

// JWT configuration
builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection("JwtSettings"));
builder.Services.AddSingleton<JwtTokenService>();

// Seed-admin configuration. 
// The credentials used to create the first Backoffice account on startup if one doesn't already exist.
builder.Services.Configure<SeedAdminSettings>(builder.Configuration.GetSection("SeedAdminSettings"));

// QR-VERIFICATION: settings + startup guard. The signing secret must never be empty or short.
builder.Services.Configure<QrSettings>(builder.Configuration.GetSection("QrSettings"));
var qrSettings = builder.Configuration.GetSection("QrSettings").Get<QrSettings>();
if (qrSettings == null || string.IsNullOrWhiteSpace(qrSettings.SigningSecret) || qrSettings.SigningSecret.Length < 32)
{
    throw new InvalidOperationException(
        "QrSettings:SigningSecret is missing or shorter than 32 characters. Set it in appsettings.json, user-secrets, or the QrSettings__SigningSecret environment variable.");
}
builder.Services.AddSingleton<QrService>();

// Application services
builder.Services.AddScoped<UserService>();
builder.Services.AddScoped<StationService>();
builder.Services.AddScoped<SlotService>();
builder.Services.AddScoped<ReservationOperationsService>();
builder.Services.AddScoped<QrReservationService>(); // QR-VERIFICATION

// QR-VERIFICATION: rate limit for verify-qr, per authenticated operator ( IP as a fallback )
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("qr-verify", httpContext =>
        RateLimitPartition.GetSlidingWindowLimiter(
            httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? httpContext.Connection.RemoteIpAddress?.ToString()
                ?? "anonymous",
            _ => new SlidingWindowRateLimiterOptions
            {
                PermitLimit = qrSettings.VerifyRequestsPerMinute,
                Window = TimeSpan.FromMinutes(1),
                SegmentsPerWindow = 6,
                QueueLimit = 0
            }));
    options.OnRejected = async (context, token) =>
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        await context.HttpContext.Response.WriteAsJsonAsync(
            new { success = false, code = "RATE_LIMITED", message = "Too many verification attempts. Please slow down." },
            token);
    };
});

// Controllers
builder.Services.AddControllers();

// Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Paste just your raw JWT token here — Swagger adds the \"Bearer \" prefix automatically."
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

// CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
        policy.AllowAnyOrigin()
            .AllowAnyMethod()
            .AllowAnyHeader());
});

// JWT Bearer authentication — validates the token on every protected request.
var jwtSettings = builder.Configuration.GetSection("JwtSettings").Get<JwtSettings>()!;
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtSettings.Issuer,
            ValidAudience = jwtSettings.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings.SigningKey))
        };
    });
builder.Services.AddAuthorization();

var app = builder.Build();

// Verify MongoDB connections startup
try
{
    var mongoContext = app.Services.GetRequiredService<MongoDbContext>();
    mongoContext.GetCollection<object>(MongoCollectionNames.Users).Database
        .RunCommand<MongoDB.Bson.BsonDocument>(new MongoDB.Bson.BsonDocument("ping", 1));
    Console.WriteLine("MongoDB connections successful!");
}
catch (Exception ex)
{
    Console.WriteLine($"MongoDB connection FAILED: {ex.Message}");
}

// Seed the first Backoffice account if none exists yet.
// Register now refuses to create Backoffice/GridOperator accounts unless the caller is already an authenticated Backoffice user. 
// So without this seed there would be no way to create the very first one. 
// ( Runs once per startup and is a no-op on every run after the first Backoffice account exists. Therefore, it's safe to leave in place permanently rather than removing it after first use. )
using (var scope = app.Services.CreateScope())
{
    try
    {
        var userService = scope.ServiceProvider.GetRequiredService<UserService>();
        var seedSettings = scope.ServiceProvider
            .GetRequiredService<Microsoft.Extensions.Options.IOptions<SeedAdminSettings>>().Value;

        var anyBackofficeExists = await userService.AnyBackofficeExistsAsync();
        if (!anyBackofficeExists)
        {
            if (string.IsNullOrWhiteSpace(seedSettings.Username) || string.IsNullOrWhiteSpace(seedSettings.Password))
            {
                Console.WriteLine("No Backoffice account exists and SeedAdminSettings is not configured — skipping seed. Add a SeedAdminSettings section to appsettings.json.");
            }
            else
            {
                var seedUser = new User
                {
                    Username = seedSettings.Username,
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword(seedSettings.Password),
                    Role = Roles.Backoffice,
                    FullName = seedSettings.FullName,
                    Email = seedSettings.Email,
                    Phone = seedSettings.Phone,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                };

                await userService.CreateUserAsync(seedUser);
                Console.WriteLine($"Seeded initial Backoffice account: \"{seedSettings.Username}\". Log in and change this password, or create your real admin accounts and stop using this one.");
            }
        }
    }
    catch (Exception ex)
    {
        // Never let a seeding failure prevent the API from starting. 
        // ( The rest of the system (login, all other endpoints) works regardless )
        Console.WriteLine($"Backoffice seed check FAILED: {ex.Message}");
    }
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowAll");

app.Use(async (context, next) =>
{
    var source = context.Request.Headers["X-Client-Type"].FirstOrDefault() ?? "UNKNOWN";
    Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] [{source}] {context.Request.Method} {context.Request.Path}");
    await next();
});

// Order matters: Authentication before Authorization, both before endpoints are mapped.
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter(); // QR-VERIFICATION

app.MapControllers();

app.MapGet("/api/health/mongo", (MongoDbContext context) =>
{
    try
    {
        context.GetCollection<object>(MongoCollectionNames.Users).Database
            .RunCommand<MongoDB.Bson.BsonDocument>(new MongoDB.Bson.BsonDocument("ping", 1));
        return Results.Ok(new { success = true, message = "MongoDB connected." });
    }
    catch (Exception ex)
    {
       return Results.Problem($"MongoDB connection failed: {ex.Message}");
    }
});

app.Run();