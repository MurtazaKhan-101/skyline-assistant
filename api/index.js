const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const session = require("express-session");
const passport = require("../config/passport");
require("dotenv").config();

const app = express();

// Import routes
const userRoutes = require("../routes/userRoutes");
const authRoutes = require("../routes/authRoutes");
const taskRoutes = require("../routes/taskRoutes");
const gmailRoutes = require("../routes/gmailRoutes");
const calendarRoutes = require("../routes/calendarRoutes");

// Import middleware
const errorHandler = require("../middleware/errorHandler");

let dbStatus = "Not connected";
async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) {
    dbStatus = "Connected";
    return;
  }
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    dbStatus = "Connected";
    console.log("✅ Connected to MongoDB");
  } catch (error) {
    dbStatus = "Connection error: " + error.message;
    console.error("❌ MongoDB connection error:", error);
  }
}
connectToDatabase();
// Connect to MongoDB
// mongoose
//   .connect(process.env.MONGODB_URI)
//   .then(() => console.log("Connected to MongoDB"))
//   .catch((error) => console.error("MongoDB connection error:", error));

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
app.use("/api/tasks", taskRoutes);
app.use("/api/gmail", gmailRoutes);
app.use("/api/calendar", calendarRoutes);

app.get("/", async (req, res) => {
  // Ensure DB connection attempt happens on each cold start
  await connectToDatabase();

  res.json({
    status: "OK",
    message: "Skyline Assistant",
    timestamp: new Date().toISOString(),
    database: dbStatus,
  });
});

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

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Export for Vercel - this is critical for serverless function
module.exports = app;

// Also export as default for compatibility
module.exports.default = app;
