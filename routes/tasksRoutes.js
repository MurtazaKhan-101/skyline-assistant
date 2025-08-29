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

// Import middleware with fallback for Vercel compatibility
let tasksRateLimit,
  tasksCacheMiddleware,
  invalidateTasksCache,
  performanceMonitor;
try {
  const rateLimiter = require("../middleware/rateLimiter");
  const cache = require("../middleware/cache");
  const performance = require("../middleware/performance");
  tasksRateLimit = rateLimiter.tasksRateLimit;
  tasksCacheMiddleware = cache.tasksCacheMiddleware;
  invalidateTasksCache = cache.invalidateTasksCache;
  performanceMonitor = performance.performanceMonitor;
} catch (error) {
  console.warn("Using fallback middleware for Vercel deployment");
  const fallback = require("../middleware/vercelFallback");
  tasksRateLimit = fallback.tasksRateLimit;
  tasksCacheMiddleware = fallback.tasksCacheMiddleware;
  invalidateTasksCache = fallback.invalidateTasksCache;
  performanceMonitor = fallback.performanceMonitor;
}

const router = express.Router();

// Apply middleware to all routes (with safety checks)
router.use(protect);
if (tasksRateLimit) {
  router.use(tasksRateLimit);
}
if (performanceMonitor) {
  router.use(performanceMonitor);
}

// Test endpoint
router.get("/test", testConnection); // GET /api/gtasks/test - Test connection

// Task Lists routes
router
  .route("/lists")
  .get(tasksCacheMiddleware || ((req, res, next) => next()), getTaskLists) // GET /api/gtasks/lists - Get all task lists (cached)
  .post(invalidateTasksCache || ((req, res, next) => next()), createTaskList); // POST /api/gtasks/lists - Create new task list (invalidate cache)

// Tasks routes
router
  .route("/:tasklistId?")
  .get(tasksCacheMiddleware || ((req, res, next) => next()), getTasks) // GET /api/gtasks/:tasklistId? - Get tasks from list (cached)
  .post(invalidateTasksCache || ((req, res, next) => next()), createTask); // POST /api/gtasks/:tasklistId? - Create new task (invalidate cache)

// Individual task operations
router
  .route("/:tasklistId/:taskId")
  .put(invalidateTasksCache || ((req, res, next) => next()), updateTask) // PUT /api/gtasks/:tasklistId/:taskId - Update task (invalidate cache)
  .delete(invalidateTasksCache || ((req, res, next) => next()), deleteTask); // DELETE /api/gtasks/:tasklistId/:taskId - Delete task (invalidate cache)

// Task operations
router.post(
  "/:tasklistId/:taskId/move",
  invalidateTasksCache || ((req, res, next) => next()),
  moveTask
); // POST /api/gtasks/:tasklistId/:taskId/move - Move task (invalidate cache)
router.patch(
  "/:tasklistId/:taskId/toggle",
  invalidateTasksCache || ((req, res, next) => next()),
  toggleTaskCompletion
); // PATCH /api/gtasks/:tasklistId/:taskId/toggle - Toggle completion (invalidate cache)
router.delete(
  "/:tasklistId/clear",
  invalidateTasksCache || ((req, res, next) => next()),
  clearTaskList
); // DELETE /api/gtasks/:tasklistId/clear - Clear completed tasks (invalidate cache)

module.exports = router;
