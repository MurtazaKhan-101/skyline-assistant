const express = require("express");
const { body } = require("express-validator");
const {
  getProfile,
  getEmails,
  sendEmail,
  searchEmails,
} = require("../controllers/gmailController");
const { protect } = require("../middleware/auth");

// Import middleware with fallback for Vercel compatibility
let emailRateLimit, emailsCacheMiddleware, performanceMonitor;
try {
  const rateLimiter = require("../middleware/rateLimiter");
  const cache = require("../middleware/cache");
  const performance = require("../middleware/performance");
  emailRateLimit = rateLimiter.emailRateLimit;
  emailsCacheMiddleware = cache.emailsCacheMiddleware;
  performanceMonitor = performance.performanceMonitor;
} catch (error) {
  console.warn("Using fallback middleware for Vercel deployment");
  const fallback = require("../middleware/vercelFallback");
  emailRateLimit = fallback.emailRateLimit;
  emailsCacheMiddleware = fallback.emailsCacheMiddleware;
  performanceMonitor = fallback.performanceMonitor;
}

const router = express.Router();

// Email validation middleware
const sendEmailValidation = [
  body("to").isEmail().withMessage("Please provide a valid recipient email"),
  body("subject")
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage("Subject is required and must be less than 200 characters"),
  body("body")
    .trim()
    .isLength({ min: 1 })
    .withMessage("Email body is required"),
  body("isHtml")
    .optional()
    .isBoolean()
    .withMessage("isHtml must be a boolean value"),
];

// All routes are protected (with safety checks)
router.use(protect);
if (emailRateLimit) {
  router.use(emailRateLimit);
}
if (performanceMonitor) {
  router.use(performanceMonitor);
}

// Routes
router.get(
  "/profile",
  emailsCacheMiddleware || ((req, res, next) => next()),
  getProfile
);
router.get(
  "/emails",
  emailsCacheMiddleware || ((req, res, next) => next()),
  getEmails
);
router.get(
  "/search",
  emailsCacheMiddleware || ((req, res, next) => next()),
  searchEmails
);
router.post("/send", sendEmailValidation, sendEmail);

module.exports = router;
