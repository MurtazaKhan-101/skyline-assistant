// Performance monitoring middleware
const performanceMiddleware = (req, res, next) => {
  const start = Date.now();
  const startUsage = process.cpuUsage();

  // Add request ID for tracking
  req.requestId = Math.random().toString(36).substr(2, 9);

  // Set headers early before response is sent (with safety check)
  if (!res.headersSent) {
    res.set("X-Request-ID", req.requestId);
  }

  res.on("finish", () => {
    const duration = Date.now() - start;
    const cpuUsage = process.cpuUsage(startUsage);

    // Log slow requests
    if (duration > 2000) {
      console.warn(
        `🐌 Slow request [${req.requestId}]: ${req.method} ${req.path} - ${duration}ms`
      );
    }

    // Log very slow requests with more details
    if (duration > 5000) {
      console.error(`🚨 Very slow request [${req.requestId}]:`, {
        method: req.method,
        path: req.path,
        duration: `${duration}ms`,
        userAgent: req.get("User-Agent"),
        ip: req.ip,
        userId: req.user?._id,
        cpuUser: `${Math.round(cpuUsage.user / 1000)}ms`,
        cpuSystem: `${Math.round(cpuUsage.system / 1000)}ms`,
        memory: process.memoryUsage(),
      });
    }

    // Log performance metrics in development
    if (process.env.NODE_ENV === "development" && duration > 1000) {
      console.log(`⏱️  ${req.method} ${req.path} - ${duration}ms`);
    }
  });

  next();
};

// Memory monitoring
const memoryMonitor = () => {
  setInterval(() => {
    const usage = process.memoryUsage();
    const used = Math.round(usage.heapUsed / 1024 / 1024);
    const total = Math.round(usage.heapTotal / 1024 / 1024);
    const external = Math.round(usage.external / 1024 / 1024);

    // Alert if memory usage is high
    if (used > 200) {
      // Alert if over 200MB
      console.warn(
        `🧠 High memory usage: ${used}MB / ${total}MB (External: ${external}MB)`
      );
    }

    // Log memory usage in development
    if (process.env.NODE_ENV === "development") {
      console.log(`💾 Memory: ${used}MB / ${total}MB`);
    }
  }, 30000); // Check every 30 seconds
};

// Error tracking middleware
const errorTracker = (err, req, res, next) => {
  const errorId = Math.random().toString(36).substr(2, 9);

  console.error(`🔥 Error [${errorId}]:`, {
    message: err.message,
    stack: err.stack,
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    userId: req.user?._id,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });

  // Add error ID to response (with safety check)
  if (!res.headersSent) {
    res.set("X-Error-ID", errorId);
  }

  next(err);
};

// Health check helper
const getHealthStatus = () => {
  const usage = process.memoryUsage();
  return {
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    memory: {
      used: Math.round(usage.heapUsed / 1024 / 1024),
      total: Math.round(usage.heapTotal / 1024 / 1024),
      external: Math.round(usage.external / 1024 / 1024),
    },
    cpu: process.cpuUsage(),
    env: process.env.NODE_ENV,
    version: process.version,
  };
};

module.exports = {
  performanceMiddleware,
  memoryMonitor,
  errorTracker,
  getHealthStatus,
};
