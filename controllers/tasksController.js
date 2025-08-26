const asyncHandler = require("../utils/asyncHandler");
const ErrorResponse = require("../utils/errorResponse");
const googleApiService = require("../services/googleApiService");

// @desc    Test Google Tasks API connection
// @route   GET /api/gtasks/test
// @access  Private
exports.testConnection = asyncHandler(async (req, res, next) => {
  try {
    const taskLists = await googleApiService.getTaskLists(req.user._id);

    res.status(200).json({
      success: true,
      message: "Google Tasks API connection successful",
      data: {
        taskListsCount: taskLists.length,
        userHasAccess: true,
      },
    });
  } catch (error) {
    console.error("Google Tasks API test error:", error);
    return next(new ErrorResponse("Google Tasks API connection failed", 500));
  }
});

// @desc    Get all task lists
// @route   GET /api/gtasks/lists
// @access  Private
exports.getTaskLists = asyncHandler(async (req, res, next) => {
  try {
    const taskLists = await googleApiService.getTaskLists(req.user._id);

    res.status(200).json({
      success: true,
      data: {
        taskLists,
        count: taskLists.length,
      },
    });
  } catch (error) {
    console.error("Get task lists error:", error);
    return next(new ErrorResponse("Failed to fetch task lists", 500));
  }
});

// @desc    Create a new task list
// @route   POST /api/tasks/lists
// @access  Private
exports.createTaskList = asyncHandler(async (req, res, next) => {
  const { title } = req.body;

  if (!title) {
    return next(new ErrorResponse("Task list title is required", 400));
  }

  try {
    const taskList = await googleApiService.createTaskList(req.user._id, title);

    res.status(201).json({
      success: true,
      data: {
        taskList,
      },
    });
  } catch (error) {
    console.error("Create task list error:", error);
    return next(new ErrorResponse("Failed to create task list", 500));
  }
});

// @desc    Get tasks from a specific task list
// @route   GET /api/gtasks/:tasklistId?
// @access  Private
exports.getTasks = asyncHandler(async (req, res, next) => {
  const { tasklistId } = req.params;
  const {
    maxResults,
    showCompleted,
    showDeleted,
    showHidden,
    completedMin,
    completedMax,
    dueMin,
    dueMax,
    updatedMin,
  } = req.query;

  const options = {
    maxResults: maxResults ? parseInt(maxResults) : 100,
    showCompleted: showCompleted !== "false",
    showDeleted: showDeleted === "true",
    showHidden: showHidden === "true",
  };

  // Add date filters if provided
  if (completedMin) options.completedMin = completedMin;
  if (completedMax) options.completedMax = completedMax;
  if (dueMin) options.dueMin = dueMin;
  if (dueMax) options.dueMax = dueMax;
  if (updatedMin) options.updatedMin = updatedMin;

  try {
    const tasks = await googleApiService.getTasks(
      req.user._id,
      tasklistId || "@default",
      options
    );

    res.status(200).json({
      success: true,
      data: {
        tasks,
        count: tasks.length,
        tasklistId: tasklistId || "@default",
      },
    });
  } catch (error) {
    console.error("Get tasks error:", error);
    return next(new ErrorResponse("Failed to fetch tasks", 500));
  }
});

// @desc    Create a new task
// @route   POST /api/gtasks/:tasklistId?
// @access  Private
exports.createTask = asyncHandler(async (req, res, next) => {
  const { tasklistId } = req.params;
  const { title, notes, due, status, parent } = req.body;

  if (!title) {
    return next(new ErrorResponse("Task title is required", 400));
  }

  const taskData = {
    title,
  };

  if (notes) taskData.notes = notes;
  if (due) {
    // Ensure due date is in RFC 3339 format
    taskData.due = new Date(due).toISOString();
  }
  if (status) taskData.status = status; // 'needsAction' or 'completed'
  if (parent) taskData.parent = parent;

  try {
    const task = await googleApiService.createTask(
      req.user._id,
      taskData,
      tasklistId || "@default"
    );

    res.status(201).json({
      success: true,
      data: {
        task,
      },
    });
  } catch (error) {
    console.error("Create task error:", error);
    return next(new ErrorResponse("Failed to create task", 500));
  }
});

// @desc    Update a task
// @route   PUT /api/gtasks/:tasklistId/:taskId
// @access  Private
exports.updateTask = asyncHandler(async (req, res, next) => {
  const { tasklistId, taskId } = req.params;
  const { title, notes, due, status, completed } = req.body;

  if (!taskId) {
    return next(new ErrorResponse("Task ID is required", 400));
  }

  const taskData = {};

  if (title) taskData.title = title;
  if (notes !== undefined) taskData.notes = notes; // Allow empty string
  if (due !== undefined) {
    if (due) {
      // Ensure due date is in RFC 3339 format
      taskData.due = new Date(due).toISOString();
    } else {
      // Allow null to remove due date
      taskData.due = null;
    }
  }
  if (status) taskData.status = status;
  if (completed !== undefined) {
    if (completed) {
      // Ensure completed date is in RFC 3339 format
      taskData.completed = new Date(completed).toISOString();
    } else {
      // Don't include completed field when setting to null/false
      // The API will handle removing the completed status
    }
  }

  try {
    const task = await googleApiService.updateTask(
      req.user._id,
      taskId,
      taskData,
      tasklistId || "@default"
    );

    res.status(200).json({
      success: true,
      data: {
        task,
      },
    });
  } catch (error) {
    console.error("Update task error:", error);
    return next(new ErrorResponse("Failed to update task", 500));
  }
});

// @desc    Delete a task
// @route   DELETE /api/gtasks/:tasklistId/:taskId
// @access  Private
exports.deleteTask = asyncHandler(async (req, res, next) => {
  const { tasklistId, taskId } = req.params;

  if (!taskId) {
    return next(new ErrorResponse("Task ID is required", 400));
  }

  try {
    const result = await googleApiService.deleteTask(
      req.user._id,
      taskId,
      tasklistId || "@default"
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Delete task error:", error);
    return next(new ErrorResponse("Failed to delete task", 500));
  }
});

// @desc    Move a task
// @route   POST /api/gtasks/:tasklistId/:taskId/move
// @access  Private
exports.moveTask = asyncHandler(async (req, res, next) => {
  const { tasklistId, taskId } = req.params;
  const { parentId, previousId } = req.body;

  if (!taskId) {
    return next(new ErrorResponse("Task ID is required", 400));
  }

  try {
    const task = await googleApiService.moveTask(
      req.user._id,
      taskId,
      parentId,
      previousId,
      tasklistId || "@default"
    );

    res.status(200).json({
      success: true,
      data: {
        task,
      },
    });
  } catch (error) {
    console.error("Move task error:", error);
    return next(new ErrorResponse("Failed to move task", 500));
  }
});

// @desc    Clear all completed tasks from a task list
// @route   DELETE /api/gtasks/:tasklistId/clear
// @access  Private
exports.clearTaskList = asyncHandler(async (req, res, next) => {
  const { tasklistId } = req.params;

  if (!tasklistId || tasklistId === "@default") {
    return next(new ErrorResponse("Cannot clear the default task list", 400));
  }

  try {
    const result = await googleApiService.clearTaskList(
      req.user._id,
      tasklistId
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Clear task list error:", error);
    return next(new ErrorResponse("Failed to clear task list", 500));
  }
});

// @desc    Mark task as completed/uncompleted
// @route   PATCH /api/gtasks/:tasklistId/:taskId/toggle
// @access  Private
exports.toggleTaskCompletion = asyncHandler(async (req, res, next) => {
  const { tasklistId, taskId } = req.params;

  if (!taskId) {
    return next(new ErrorResponse("Task ID is required", 400));
  }

  try {
    // First get the current task to check its status
    const tasks = await googleApiService.getTasks(
      req.user._id,
      tasklistId || "@default"
    );

    const currentTask = tasks.find((task) => task.id === taskId);
    if (!currentTask) {
      return next(new ErrorResponse("Task not found", 404));
    }

    // Toggle the completion status
    const newStatus =
      currentTask.status === "completed" ? "needsAction" : "completed";

    // Preserve all existing task data and only update status/completed fields
    const updateData = {
      title: currentTask.title,
      notes: currentTask.notes || "",
      status: newStatus,
    };

    // Preserve other fields if they exist
    if (currentTask.due) {
      updateData.due = currentTask.due;
    }
    if (currentTask.parent) {
      updateData.parent = currentTask.parent;
    }

    // If marking as completed, set completed date
    if (newStatus === "completed") {
      updateData.completed = new Date().toISOString();
    }
    // For "needsAction", we don't include the completed field at all

    const task = await googleApiService.updateTask(
      req.user._id,
      taskId,
      updateData,
      tasklistId || "@default"
    );

    res.status(200).json({
      success: true,
      data: {
        task,
        message: `Task ${
          newStatus === "completed" ? "completed" : "marked as incomplete"
        }`,
      },
    });
  } catch (error) {
    console.error("Toggle task completion error:", error);
    return next(new ErrorResponse("Failed to toggle task completion", 500));
  }
});
