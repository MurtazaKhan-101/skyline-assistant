const Task = require("../models/Task");
const { validationResult } = require("express-validator");

// @desc    Get all tasks
// @route   GET /api/tasks
// @access  Private
exports.getTasks = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;

    // Build filter object
    let filter = {};

    // Filter by user's own tasks unless admin
    if (req.user.role !== "admin") {
      filter.$or = [{ assignedTo: req.user.id }, { createdBy: req.user.id }];
    }

    // Additional filters
    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.priority) {
      filter.priority = req.query.priority;
    }
    if (req.query.assignedTo) {
      filter.assignedTo = req.query.assignedTo;
    }

    const total = await Task.countDocuments(filter);
    const tasks = await Task.find(filter)
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email")
      .skip(startIndex)
      .limit(limit)
      .sort({ createdAt: -1 });

    const pagination = {
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalTasks: total,
      hasNext: page < Math.ceil(total / limit),
      hasPrev: page > 1,
    };

    res.status(200).json({
      success: true,
      count: tasks.length,
      pagination,
      data: {
        tasks,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Get single task
// @route   GET /api/tasks/:id
// @access  Private
exports.getTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id)
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email");

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Check if user has access to this task
    if (
      req.user.role !== "admin" &&
      task.assignedTo._id.toString() !== req.user.id &&
      task.createdBy._id.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    res.status(200).json({
      success: true,
      data: {
        task,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Create task
// @route   POST /api/tasks
// @access  Private
exports.createTask = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation errors",
        errors: errors.array(),
      });
    }

    // Add creator to task
    req.body.createdBy = req.user.id;

    const task = await Task.create(req.body);

    // Populate the created task
    await task.populate("assignedTo", "name email");
    await task.populate("createdBy", "name email");

    res.status(201).json({
      success: true,
      data: {
        task,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Update task
// @route   PUT /api/tasks/:id
// @access  Private
exports.updateTask = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation errors",
        errors: errors.array(),
      });
    }

    let task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Check if user has permission to update this task
    if (
      req.user.role !== "admin" &&
      task.createdBy.toString() !== req.user.id &&
      task.assignedTo.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    task = await Task.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email");

    res.status(200).json({
      success: true,
      data: {
        task,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Delete task
// @route   DELETE /api/tasks/:id
// @access  Private
exports.deleteTask = async (req, res, next) => {
  try {
    const task = await Task.findById(req.params.id);

    if (!task) {
      return res.status(404).json({
        success: false,
        message: "Task not found",
      });
    }

    // Check if user has permission to delete this task
    if (
      req.user.role !== "admin" &&
      task.createdBy.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    await Task.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      data: {
        message: "Task deleted successfully",
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
