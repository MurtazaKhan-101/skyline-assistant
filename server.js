const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const passport = require("./config/passport");
require("dotenv").config();

const app = express();

// Import routes
const userRoutes = require("./routes/userRoutes");
const authRoutes = require("./routes/authRoutes");
const taskRoutes = require("./routes/taskRoutes");
const gmailRoutes = require("./routes/gmailRoutes");
const calendarRoutes = require("./routes/calendarRoutes");
const tasksRoutes = require("./routes/tasksRoutes"); // Google Tasks API routes
const healthRoutes = require("./routes/healthRoutes");

// Import middleware
const errorHandler = require("./middleware/errorHandler");
const { performanceMonitor } = require("./middleware/performance");

// Connect to MongoDB with optimized connection
const connectDB = require("./config/database");

// Initialize database connection
async function initDB() {
  await connectDB().catch((err) => {
    console.error("Failed to connect to MongoDB:", err);
    if (!process.env.VERCEL) {
      process.exit(1);
    }
  });
}

initDB();

// Session configuration for Passport with MongoDB store
app.use(
  session({
    secret: process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      touchAfter: 24 * 3600, // Lazy session update
      ttl: 24 * 60 * 60, // Session TTL in seconds (24 hours)
      autoRemove: "native", // Let MongoDB handle expired session removal
      crypto: {
        secret: process.env.JWT_SECRET,
      },
    }),
    cookie: {
      secure:
        process.env.NODE_ENV === "production" && !process.env.LOCAL_PRODUCTION, // Allow HTTP in local production testing
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: true, // Prevent XSS attacks
      sameSite: process.env.NODE_ENV === "production" ? "lax" : false, // CSRF protection
    },
    name: "skyline.sid", // Custom session name for better security
  })
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Performance Middleware (applied globally with safety check)
app.use(compression()); // Compress all responses
if (performanceMonitor) {
  app.use(performanceMonitor); // Monitor all requests
}

// Security and CORS Middleware
app.use(helmet()); // Security headers
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow localhost in development or local production testing
      const allowedOrigins = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
      ];

      // Add production domain if specified in environment
      if (process.env.FRONTEND_URL) {
        allowedOrigins.push(process.env.FRONTEND_URL);
      }

      // For production, add your actual domain
      if (
        process.env.NODE_ENV === "production" &&
        !process.env.LOCAL_PRODUCTION
      ) {
        allowedOrigins.push("https://your-frontend-domain.com");
      }

      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`CORS blocked origin: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
); // Enable CORS

// Logging (optimized for production)
if (process.env.NODE_ENV === "production") {
  app.use(morgan("combined"));
} else {
  app.use(morgan("dev"));
}

// Body parsing middleware
app.use(express.json({ limit: "10mb" })); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Serve static files
app.use(express.static("public"));

// Routes
app.use("/api/health", healthRoutes); // Health check routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/tasks", taskRoutes); // Local tasks (MongoDB)
app.use("/api/gtasks", tasksRoutes); // Google Tasks API
app.use("/api/gmail", gmailRoutes);
app.use("/api/calendar", calendarRoutes);

// Simple health check endpoint for load balancers
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    message: "Skyline Assistant Backend is running",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// API documentation endpoint
app.get("/api", (req, res) => {
  res.status(200).json({
    message: "Skyline Assistant API",
    version: "1.0.0",
    endpoints: {
      auth: {
        "POST /api/auth/register": "Register with email/password",
        "POST /api/auth/login": "Login with email/password",
        "GET /api/auth/google": "Login with Google OAuth",
        "GET /api/auth/me": "Get current user info",
        "GET /api/auth/google/profile": "Get Google profile info",
        "DELETE /api/auth/google/disconnect": "Disconnect Google account",
      },
      gmail: {
        "GET /api/gmail/profile": "Get Gmail profile",
        "GET /api/gmail/emails": "Get emails",
        "GET /api/gmail/search": "Search emails",
        "POST /api/gmail/send": "Send email",
      },
      calendar: {
        "GET /api/calendar/events": "Get calendar events",
        "POST /api/calendar/events": "Create calendar event",
        "PUT /api/calendar/events/:id": "Update calendar event",
        "DELETE /api/calendar/events/:id": "Delete calendar event",
        "GET /api/calendar/today": "Get today's events",
        "GET /api/calendar/upcoming": "Get upcoming events",
      },
      tasks: {
        "GET /api/tasks": "Get local tasks (MongoDB)",
        "POST /api/tasks": "Create local task (MongoDB)",
        "PUT /api/tasks/:id": "Update local task (MongoDB)",
        "DELETE /api/tasks/:id": "Delete local task (MongoDB)",
      },
      gtasks: {
        "GET /api/gtasks/lists": "Get Google task lists",
        "POST /api/gtasks/lists": "Create Google task list",
        "GET /api/gtasks/:tasklistId?": "Get Google tasks from list",
        "POST /api/gtasks/:tasklistId?": "Create Google task",
        "PUT /api/gtasks/:tasklistId/:taskId": "Update Google task",
        "DELETE /api/gtasks/:tasklistId/:taskId": "Delete Google task",
        "POST /api/gtasks/:tasklistId/:taskId/move": "Move Google task",
        "PATCH /api/gtasks/:tasklistId/:taskId/toggle":
          "Toggle task completion",
        "DELETE /api/gtasks/:tasklistId/clear": "Clear completed tasks",
      },
    },
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// Error handling middleware
app.use(errorHandler);

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 Skyline Assistant Backend is running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📚 API docs: http://localhost:${PORT}/api`);
});
