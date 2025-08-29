const express = require("express");
const { body } = require("express-validator");
const {
  getEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  getTodayEvents,
  getUpcomingEvents,
} = require("../controllers/calendarController");
const { protect } = require("../middleware/auth");

// Import middleware with fallback for Vercel compatibility
let calendarRateLimit,
  calendarCacheMiddleware,
  invalidateCalendarCache,
  performanceMonitor;
try {
  const rateLimiter = require("../middleware/rateLimiter");
  const cache = require("../middleware/cache");
  const performance = require("../middleware/performance");
  calendarRateLimit = rateLimiter.calendarRateLimit;
  calendarCacheMiddleware = cache.calendarCacheMiddleware;
  invalidateCalendarCache = cache.invalidateCalendarCache;
  performanceMonitor = performance.performanceMonitor;
} catch (error) {
  console.warn("Using fallback middleware for Vercel deployment");
  const fallback = require("../middleware/vercelFallback");
  calendarRateLimit = fallback.calendarRateLimit;
  calendarCacheMiddleware = fallback.calendarCacheMiddleware;
  invalidateCalendarCache = fallback.invalidateCalendarCache;
  performanceMonitor = fallback.performanceMonitor;
}

const router = express.Router();

// Event validation middleware
const eventValidation = [
  body("summary")
    .optional()
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage("Summary must be between 1 and 200 characters"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description cannot be more than 1000 characters"),
  body("start.dateTime")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid ISO 8601 date"),
  body("end.dateTime")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid ISO 8601 date"),
  body("start.timeZone")
    .optional()
    .isString()
    .withMessage("Start timezone must be a string"),
  body("end.timeZone")
    .optional()
    .isString()
    .withMessage("End timezone must be a string"),
];

const createEventValidation = [
  body("summary")
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage(
      "Summary is required and must be between 1 and 200 characters"
    ),
  body("start.dateTime")
    .isISO8601()
    .withMessage("Start date is required and must be a valid ISO 8601 date"),
  body("end.dateTime")
    .isISO8601()
    .withMessage("End date is required and must be a valid ISO 8601 date"),
  ...eventValidation.slice(2), // Include optional validations
];

// All routes are protected (with safety checks)
router.use(protect);
if (calendarRateLimit) {
  router.use(calendarRateLimit);
}
if (performanceMonitor) {
  router.use(performanceMonitor);
}

// Routes
router.get(
  "/events",
  calendarCacheMiddleware || ((req, res, next) => next()),
  getEvents
);
router.post(
  "/events",
  invalidateCalendarCache || ((req, res, next) => next()),
  createEventValidation,
  createEvent
);
router.put(
  "/events/:eventId",
  invalidateCalendarCache || ((req, res, next) => next()),
  eventValidation,
  updateEvent
);
router.delete(
  "/events/:eventId",
  invalidateCalendarCache || ((req, res, next) => next()),
  deleteEvent
);

// Special routes
router.get(
  "/today",
  calendarCacheMiddleware || ((req, res, next) => next()),
  getTodayEvents
);
router.get(
  "/upcoming",
  calendarCacheMiddleware || ((req, res, next) => next()),
  getUpcomingEvents
);

module.exports = router;
