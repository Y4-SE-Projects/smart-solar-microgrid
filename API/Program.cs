using API.Settings;
using API.Data;
using API.Services;

var builder = WebApplication.CreateBuilder(args);

// MongoDB configuration
builder.Services.Configure<MongoDbSettings>(builder.Configuration.GetSection("MongoDbSettings"));
builder.Services.AddSingleton<MongoDbContext>();

builder.Services.AddScoped<ReservationOperationsService>();

// Controllers
builder.Services.AddControllers();

// Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
        policy.AllowAnyOrigin()
            .AllowAnyMethod()
            .AllowAnyHeader());
});

var app = builder.Build();

// Verify MongoDB connections startup
try
{
    var mongoContext = app.Services.GetRequiredService<MongoDbContext>();
    mongoContext.GetCollection<object>("Users").Database
        .RunCommand<MongoDB.Bson.BsonDocument>(new MongoDB.Bson.BsonDocument("ping", 1));
    Console.WriteLine("MongoDB connections successful!");
}
catch (Exception ex)
{
    Console.WriteLine($"MongoDB connection FAILED: {ex.Message}");
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

app.MapControllers();

app.MapGet("/api/health/mongo", (MongoDbContext context) =>
{
    try
    {
        context.GetCollection<object>("Users").Database
            .RunCommand<MongoDB.Bson.BsonDocument>(new MongoDB.Bson.BsonDocument("ping", 1));
        return Results.Ok(new { success = true, message = "MongoDB connected." });
    }
    catch (Exception ex)
    {
       return Results.Problem($"MongoDB connection failed: {ex.Message}");
    }
});

app.Run();