const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const passport = require("../config/passport");
require("dotenv").config();

const app = express();

// Import routes
const userRoutes = require("../routes/userRoutes");
const authRoutes = require("../routes/authRoutes");
const taskRoutes = require("../routes/taskRoutes");
const gmailRoutes = require("../routes/gmailRoutes");
const calendarRoutes = require("../routes/calendarRoutes");
const tasksRoutes = require("../routes/tasksRoutes");
const healthRoutes = require("../routes/healthRoutes");

// Import middleware
const errorHandler = require("../middleware/errorHandler");

// Import optimized middleware (with graceful fallbacks for Vercel)
let performanceMiddleware;
try {
  performanceMiddleware =
    require("../middleware/performance").performanceMiddleware;
} catch (error) {
  console.warn("Performance middleware not available, using fallback");
  performanceMiddleware = (req, res, next) => next();
}

const connectDB = require("../config/database");

// Initialize database connection
(async () => {
  await connectDB().catch((err) => {
    console.error("Failed to connect to MongoDB:", err);
    if (!process.env.VERCEL) {
      process.exit(1);
    }
  });
})();

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

// Performance middleware (applied early for Vercel)
app.use(compression()); // Compress all responses
app.use(performanceMiddleware); // Monitor performance

// Security and CORS middleware
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
);

// Optimized logging for serverless
if (process.env.NODE_ENV === "production") {
  app.use(morgan("combined"));
} else {
  app.use(morgan("dev"));
}

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static("public"));

// Routes
app.use("/api/health", healthRoutes); // Health check routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/gtasks", tasksRoutes);
app.use("/api/gmail", gmailRoutes);
app.use("/api/calendar", calendarRoutes);

app.get("/", async (req, res) => {
  // Get database status from the optimized connection
  const mongoose = require("mongoose");
  const dbState = mongoose.connection.readyState;
  const dbStatus =
    dbState === 1
      ? "Connected"
      : dbState === 0
      ? "Disconnected"
      : dbState === 2
      ? "Connecting"
      : "Disconnecting";

  res.json({
    status: "OK",
    message: "Skyline Assistant - Optimized for Vercel",
    timestamp: new Date().toISOString(),
    database: dbStatus,
    performance: "Optimized with caching, compression, and rate limiting",
    version: "2.0.0",
  });
});

// Simple health check endpoint for load balancers
app.get("/health", (req, res) => {
  const mongoose = require("mongoose");
  const dbState = mongoose.connection.readyState;

  res.status(200).json({
    status: "OK",
    message: "Skyline Assistant Backend - Vercel Optimized",
    timestamp: new Date().toISOString(),
    version: "2.0.0",
    database: dbState === 1 ? "Connected" : "Disconnected",
    optimizations: [
      "compression",
      "caching",
      "rate-limiting",
      "connection-pooling",
    ],
  });
});

// API documentation endpoint
app.get("/api", (req, res) => {
  res.status(200).json({
    message: "Skyline Assistant API - Vercel Optimized",
    version: "2.0.0",
    optimizations: [
      "Response compression with gzip",
      "Multi-level caching (emails, calendar, tasks, tokens)",
      "Rate limiting per endpoint type",
      "Connection pooling for Google APIs",
      "Database query optimization",
      "Performance monitoring",
    ],
    endpoints: {
      health: {
        "GET /health": "Simple health check for load balancers",
        "GET /api/health": "Basic health information",
        "GET /api/health/detailed": "Comprehensive system metrics",
      },
      auth: {
        "POST /api/auth/register": "Register with email/password",
        "POST /api/auth/login":
          "Login with email/password (rate limited: 5/15min)",
        "GET /api/auth/google": "Login with Google OAuth",
        "GET /api/auth/me": "Get current user info",
        "GET /api/auth/google/profile": "Get Google profile info",
        "DELETE /api/auth/google/disconnect": "Disconnect Google account",
      },
      gmail: {
        "GET /api/gmail/profile":
          "Get Gmail profile (cached 2min, rate limited: 30/min)",
        "GET /api/gmail/emails":
          "Get emails (cached 2min, rate limited: 30/min)",
        "GET /api/gmail/search":
          "Search emails (cached 2min, rate limited: 30/min)",
        "POST /api/gmail/send": "Send email (rate limited: 30/min)",
      },
      calendar: {
        "GET /api/calendar/events":
          "Get calendar events (cached 5min, rate limited: 20/min)",
        "POST /api/calendar/events":
          "Create calendar event (invalidates cache, rate limited: 20/min)",
        "PUT /api/calendar/events/:id":
          "Update calendar event (invalidates cache, rate limited: 20/min)",
        "DELETE /api/calendar/events/:id":
          "Delete calendar event (invalidates cache, rate limited: 20/min)",
        "GET /api/calendar/today":
          "Get today's events (cached 5min, rate limited: 20/min)",
        "GET /api/calendar/upcoming":
          "Get upcoming events (cached 5min, rate limited: 20/min)",
      },
      gtasks: {
        "GET /api/gtasks/lists": "Get Google task lists (rate limited: 50/min)",
        "POST /api/gtasks/lists":
          "Create Google task list (rate limited: 50/min)",
        "GET /api/gtasks/:tasklistId?":
          "Get Google tasks from list (cached 3min, rate limited: 50/min)",
        "POST /api/gtasks/:tasklistId?":
          "Create Google task (invalidates cache, rate limited: 50/min)",
        "PUT /api/gtasks/:tasklistId/:taskId":
          "Update Google task (invalidates cache, rate limited: 50/min)",
        "DELETE /api/gtasks/:tasklistId/:taskId":
          "Delete Google task (invalidates cache, rate limited: 50/min)",
        "POST /api/gtasks/:tasklistId/:taskId/move":
          "Move Google task (invalidates cache, rate limited: 50/min)",
        "PATCH /api/gtasks/:tasklistId/:taskId/toggle":
          "Toggle task completion (invalidates cache, rate limited: 50/min)",
        "DELETE /api/gtasks/:tasklistId/clear":
          "Clear completed tasks (invalidates cache, rate limited: 50/min)",
      },
    },
    performance: {
      caching: {
        emails: "2 minute TTL",
        calendar: "5 minute TTL",
        tasks: "3 minute TTL",
        tokens: "50 minute TTL",
      },
      rateLimits: {
        auth: "5 requests per 15 minutes",
        gmail: "30 requests per minute",
        calendar: "20 requests per minute",
        tasks: "50 requests per minute",
      },
      database: "Connection pooling with MongoDB",
      compression: "gzip compression on all responses",
      monitoring: "Real-time performance metrics available",
    },
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    availableEndpoints: [
      "GET /",
      "GET /health",
      "GET /api",
      "GET /api/health",
      "POST /api/auth/*",
      "GET /api/gmail/*",
      "GET /api/calendar/*",
      "GET /api/gtasks/*",
    ],
  });
});

// Error handling middleware
app.use(errorHandler);

// Export for Vercel - this is critical for serverless function
module.exports = app;

// Also export as default for compatibility
module.exports.default = app;
