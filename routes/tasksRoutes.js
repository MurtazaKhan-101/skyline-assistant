const express = require("express");
const {
  testConnection,
  getTaskLists,
  createTaskList,
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  moveTask,
  clearTaskList,
  toggleTaskCompletion,
} = require("../controllers/tasksController");
const { protect } = require("../middleware/auth");

const router = express.Router();

// Apply authentication middleware to all routes
router.use(protect);

// Test endpoint
router.get("/test", testConnection); // GET /api/gtasks/test - Test connection

// Task Lists routes
router
  .route("/lists")
  .get(getTaskLists) // GET /api/gtasks/lists - Get all task lists
  .post(createTaskList); // POST /api/gtasks/lists - Create new task list

// Tasks routes
router
  .route("/:tasklistId?")
  .get(getTasks) // GET /api/gtasks/:tasklistId? - Get tasks from list
  .post(createTask); // POST /api/gtasks/:tasklistId? - Create new task

// Individual task operations
router
  .route("/:tasklistId/:taskId")
  .put(updateTask) // PUT /api/gtasks/:tasklistId/:taskId - Update task
  .delete(deleteTask); // DELETE /api/gtasks/:tasklistId/:taskId - Delete task

// Task operations
router.post("/:tasklistId/:taskId/move", moveTask); // POST /api/gtasks/:tasklistId/:taskId/move - Move task
router.patch("/:tasklistId/:taskId/toggle", toggleTaskCompletion); // PATCH /api/gtasks/:tasklistId/:taskId/toggle - Toggle completion
router.delete("/:tasklistId/clear", clearTaskList); // DELETE /api/gtasks/:tasklistId/clear - Clear completed tasks

module.exports = router;
