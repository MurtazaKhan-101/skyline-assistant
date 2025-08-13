const express = require("express");
const { body } = require("express-validator");
const {
  getTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
} = require("../controllers/taskController");
const { protect } = require("../middleware/auth");

const router = express.Router();

// Validation middleware
const taskValidation = [
  body("title")
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Title must be between 1 and 100 characters"),
  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Description cannot be more than 500 characters"),
  body("status")
    .optional()
    .isIn(["pending", "in-progress", "completed", "cancelled"])
    .withMessage(
      "Status must be one of: pending, in-progress, completed, cancelled"
    ),
  body("priority")
    .optional()
    .isIn(["low", "medium", "high", "urgent"])
    .withMessage("Priority must be one of: low, medium, high, urgent"),
  body("dueDate")
    .optional()
    .isISO8601()
    .withMessage("Due date must be a valid date"),
  body("assignedTo")
    .optional()
    .isMongoId()
    .withMessage("Assigned to must be a valid user ID"),
  body("tags").optional().isArray().withMessage("Tags must be an array"),
];

const createTaskValidation = [
  body("title")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("Title is required and must be between 1 and 100 characters"),
  body("assignedTo")
    .isMongoId()
    .withMessage("Assigned to must be a valid user ID"),
  ...taskValidation.slice(1), // Include all optional validations
];

// All routes are protected
router.use(protect);

// Routes
router.route("/").get(getTasks).post(createTaskValidation, createTask);

router
  .route("/:id")
  .get(getTask)
  .put(taskValidation, updateTask)
  .delete(deleteTask);

module.exports = router;
