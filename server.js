const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const session = require("express-session");
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

// Import middleware
const errorHandler = require("./middleware/errorHandler");

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((error) => console.error("MongoDB connection error:", error));

// Session configuration for Passport
app.use(
  session({
    secret: process.env.JWT_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  })
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Middleware
app.use(helmet()); // Security headers
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? ["https://your-frontend-domain.com"]
        : ["http://localhost:3000", "http://localhost:3001"],
    credentials: true,
  })
); // Enable CORS
app.use(morgan("combined")); // Logging
app.use(express.json({ limit: "10mb" })); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Serve static files
app.use(express.static("public"));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/tasks", taskRoutes); // Local tasks (MongoDB)
app.use("/api/gtasks", tasksRoutes); // Google Tasks API
app.use("/api/gmail", gmailRoutes);
app.use("/api/calendar", calendarRoutes);

// Health check endpoint
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
