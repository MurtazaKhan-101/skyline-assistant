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

// All routes are protected
router.use(protect);

// Routes
router.get("/events", getEvents);
router.post("/events", createEventValidation, createEvent);
router.put("/events/:eventId", eventValidation, updateEvent);
router.delete("/events/:eventId", deleteEvent);

// Special routes
router.get("/today", getTodayEvents);
router.get("/upcoming", getUpcomingEvents);

module.exports = router;
