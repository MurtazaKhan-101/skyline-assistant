const rateLimit = require("express-rate-limit");

// Create different rate limiters for different operations
const createRateLimiter = (
  windowMs,
  max,
  message,
  skipSuccessfulRequests = false
) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: message,
      retryAfter: Math.ceil(windowMs / 1000),
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    // Custom key generator for better control
    keyGenerator: (req) => {
      return req.user ? `${req.ip}_${req.user._id}` : req.ip;
    },
    // Skip rate limiting for health checks
    skip: (req) => {
      return req.path === "/health" || req.path === "/api/health";
    },
  });
};

// Rate limiters for different endpoints
const authLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  5, // 5 attempts
  "Too many authentication attempts, please try again later"
);

const emailLimiter = createRateLimiter(
  60 * 1000, // 1 minute
  30, // 30 requests
  "Too many email requests, please slow down"
);

const emailSearchLimiter = createRateLimiter(
  60 * 1000, // 1 minute
  10, // 10 searches per minute (more expensive)
  "Too many email search requests, please slow down"
);

const calendarLimiter = createRateLimiter(
  60 * 1000, // 1 minute
  20, // 20 requests
  "Too many calendar requests, please slow down"
);

const tasksLimiter = createRateLimiter(
  60 * 1000, // 1 minute
  50, // 50 requests (tasks are lighter)
  "Too many task requests, please slow down"
);

const generalLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  process.env.NODE_ENV === "production" ? 100 : 1000, // More lenient in development
  "Too many requests, please slow down"
);

// Stricter limiter for expensive operations
const expensiveLimiter = createRateLimiter(
  60 * 1000, // 1 minute
  5, // 5 requests per minute
  "This operation is rate limited, please try again later"
);

// Very permissive limiter for cached responses
const cachedResponseLimiter = createRateLimiter(
  60 * 1000, // 1 minute
  200, // 200 requests (cached responses are cheap)
  "Too many requests, please slow down",
  true // Skip successful requests
);

module.exports = {
  authLimiter,
  emailLimiter,
  emailSearchLimiter,
  calendarLimiter,
  tasksLimiter,
  generalLimiter,
  expensiveLimiter,
  cachedResponseLimiter,
};
