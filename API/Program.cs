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
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
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

    // ACCOUNTS: rate limit for every endpoint that checks a password (both logins, change password, and the two reactivation endpoints).
    // Stops a password being guessed by brute force. Counted per signed-in account when there is one ( change password ), otherwise per IP.
    options.AddPolicy("auth", httpContext =>
        RateLimitPartition.GetSlidingWindowLimiter(
            httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value is { } identifier
                ? $"user:{identifier}"
                : $"ip:{httpContext.Connection.RemoteIpAddress?.ToString() ?? "anonymous"}",
            _ => new SlidingWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                SegmentsPerWindow = 6,
                QueueLimit = 0
            }));

    // One rejection handler serves every policy, so the message is picked from the policy that refused the request.
    options.OnRejected = async (context, token) =>
    {
        var policy = context.HttpContext.GetEndpoint()?.Metadata.GetMetadata<EnableRateLimitingAttribute>()?.PolicyName;
        var message = policy == "auth"
            ? "Too many attempts. Please wait a minute and try again."
            : "Too many verification attempts. Please slow down.";

        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        await context.HttpContext.Response.WriteAsJsonAsync(
            new { success = false, code = "RATE_LIMITED", message },
            token);
    };
});

// Controllers
builder.Services.AddControllers()
    .ConfigureApiBehaviorOptions(options =>
    {
        // ASP.NET rejects some requests before any controller runs ( malformed JSON, an empty body, a value of the wrong type ).
        // Its default reply has no "message" field, so both clients could only show a generic error.
        // This keeps those replies in the { success, message } shape every endpoint uses. It changes only the reply, not what is accepted.
        options.InvalidModelStateResponseFactory = context =>
        {
            var failed = context.ModelState.Where(entry => entry.Value?.Errors.Count > 0).ToList();

            string message;
            if (failed.Any(entry => entry.Value!.Errors.Any(error => error.ErrorMessage.Contains("non-empty request body"))))
            {
                message = "The request body is empty.";
            }
            else if (failed.Any(entry => entry.Key.StartsWith('$')))
            {
                // Keys starting with "$" are JSON paths: the body couldn't be read, or a value had the wrong type.
                // The framework's own wording ( line and byte positions ) means nothing to a user, so it is replaced.
                message = "The request body isn't valid JSON, or one of its values has the wrong type.";
            }
            else
            {
                message = failed.SelectMany(entry => entry.Value!.Errors)
                                .Select(error => error.ErrorMessage)
                                .FirstOrDefault(text => !string.IsNullOrWhiteSpace(text))
                          ?? "The request is invalid.";
            }

            return new BadRequestObjectResult(new { success = false, message });
        };
    });

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

        // A valid signature only proves the token was genuine when it was issued. It says nothing about the account's current state. 
        // Tokens are stateless and carry no status claim. 
        // So without this check a deactivated account keeps full access for the rest of JwtSettings:ExpiryMinutes.
        // Re-reading the account on each authenticated request costs one lookup and makes deactivation take effect on the next request instead of whenever the token expires.
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = async context =>
            {
                var identifier = context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);

                // The role says whether the identifier is a NIC or a username, so the lookup never mixes the two.
                var role = context.Principal?.FindFirstValue(ClaimTypes.Role);

                // Resolved from the request scope, so this shares the scoped UserService and its MongoDB handle with the rest of the request rather than building another.
                var userService = context.HttpContext.RequestServices.GetRequiredService<UserService>();
                var account = await userService.FindActiveByIdentifierAsync(identifier, role);

                // One null covers three cases.
                // ( the account was deactivated, it was removed, or the token has no usable identifier or role. )
                // All three mean the same thing here; stop honouring this token.
                if (account == null)
                {
                    context.Fail("The account this token belongs to is no longer active.");
                }
            }
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

        var anyActiveBackoffice = await userService.AnyActiveBackofficeExistsAsync();
        if (!anyActiveBackoffice)
        {
            if (string.IsNullOrWhiteSpace(seedSettings.Username) || string.IsNullOrWhiteSpace(seedSettings.Password))
            {
                Console.WriteLine("No active Backoffice account exists and SeedAdminSettings is not configured — skipping seed. Add a SeedAdminSettings section to appsettings.json.");
            }
            else
            {
                // Register checks the username is free before inserting, and this path has to do the same.
                // Otherwise a username already held by a GridOperator would end up on two documents.
                // Login would authenticate against whichever one MongoDB happened to return first.
                var existing = await userService.FindByUsernameAsync(seedSettings.Username);

                if (existing == null)
                {
                    var seedUser = new User
                    {
                        // Lower case, the same as every username created through Register.
                        Username = seedSettings.Username.Trim().ToLowerInvariant(),
                        PasswordHash = BCrypt.Net.BCrypt.HashPassword(seedSettings.Password),
                        Role = Roles.Backoffice,
                        FullName = seedSettings.FullName,
                        Email = seedSettings.Email,
                        Phone = seedSettings.Phone,
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow
                    };

                    await userService.CreateUserAsync(seedUser);
                    Console.WriteLine($"Seeded initial Backoffice account: \"{seedUser.Username}\". Create your real admin accounts and stop using this one.");
                }
                else if (existing.Role == Roles.Backoffice)
                {
                    // The seed account is still in the database but was deactivated, so the system ends up with nobody to administer it. 
                    // Restoring it is the recovery path.
                    // The stored spelling, since the lookup ignores case but the update matches exactly.
                    await userService.SetStaffActiveAsync(existing.Username!, true);
                    Console.WriteLine($"No active Backoffice account found — restored the existing seed account \"{existing.Username}\".");
                }
                else
                {
                    Console.WriteLine($"No active Backoffice account exists, but the username \"{seedSettings.Username}\" already belongs to a {existing.Role} account. Set a different SeedAdminSettings:Username so the seed can be created.");
                }
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