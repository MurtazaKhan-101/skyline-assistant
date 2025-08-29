const express = require("express");
const mongoose = require("mongoose");
const { performance } = require("perf_hooks");

const router = express.Router();

// Health check endpoint
router.get("/", async (req, res) => {
  const startTime = performance.now();

  try {
    // Check database connection
    const dbState = mongoose.connection.readyState;
    const dbStatus = dbState === 1 ? "connected" : "disconnected";

    // Get memory usage
    const memUsage = process.memoryUsage();
    const memoryInfo = {
      rss: Math.round(memUsage.rss / 1024 / 1024) + " MB",
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + " MB",
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + " MB",
      external: Math.round(memUsage.external / 1024 / 1024) + " MB",
    };

    // Response time
    const responseTime = Math.round(performance.now() - startTime);

    // System uptime
    const uptime = Math.round(process.uptime());

    res.status(200).json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      uptime: `${uptime}s`,
      database: {
        status: dbStatus,
        readyState: dbState,
      },
      memory: memoryInfo,
      environment: process.env.NODE_ENV || "development",
      version: process.env.npm_package_version || "unknown",
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

// Detailed health check for monitoring systems
router.get("/detailed", async (req, res) => {
  const startTime = performance.now();

  try {
    // Database ping test
    const dbPingStart = performance.now();
    await mongoose.connection.db.admin().ping();
    const dbPingTime = Math.round(performance.now() - dbPingStart);

    // CPU usage (simple estimation)
    const cpuUsage = process.cpuUsage();

    res.status(200).json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      responseTime: `${Math.round(performance.now() - startTime)}ms`,
      checks: {
        database: {
          status: "healthy",
          pingTime: `${dbPingTime}ms`,
          connections:
            mongoose.connection.db.serverConfig?.connections?.length || 0,
        },
        memory: {
          usage: process.memoryUsage(),
          freeMemory: require("os").freemem(),
          totalMemory: require("os").totalmem(),
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system,
        },
        process: {
          uptime: process.uptime(),
          pid: process.pid,
          nodeVersion: process.version,
        },
      },
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      error: error.message,
      checks: {
        database: {
          status: "unhealthy",
          error: error.message,
        },
      },
    });
  }
});

module.exports = router;
