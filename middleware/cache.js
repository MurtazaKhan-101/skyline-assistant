const NodeCache = require("node-cache");

// Different cache instances for different data types
const userCache = new NodeCache({ stdTTL: 600 }); // 10 minutes
const emailCache = new NodeCache({ stdTTL: 120 }); // 2 minutes
const calendarCache = new NodeCache({ stdTTL: 300 }); // 5 minutes
const tasksCache = new NodeCache({ stdTTL: 180 }); // 3 minutes
const tokenCache = new NodeCache({ stdTTL: 3000 }); // 50 minutes (tokens expire in 60)

const createCacheMiddleware = (cache, keyGenerator, ttl) => {
  return (req, res, next) => {
    // Skip caching in development if needed
    if (
      process.env.NODE_ENV === "development" &&
      process.env.DISABLE_CACHE === "true"
    ) {
      return next();
    }

    const key = keyGenerator(req);
    const cached = cache.get(key);

    if (cached) {
      return res.json({
        success: true,
        data: cached,
        cached: true,
        timestamp: new Date().toISOString(),
      });
    }

    // Store original send method
    const originalSend = res.send;

    // Override send to cache successful responses
    res.send = function (body) {
      if (res.statusCode === 200) {
        try {
          const data = JSON.parse(body);
          if (data.success && data.data) {
            cache.set(key, data.data, ttl || undefined);
          }
        } catch (e) {
          // Continue if parsing fails
        }
      }
      originalSend.call(this, body);
    };

    next();
  };
};

// Cache invalidation helper
const invalidateCache = (cache, pattern) => {
  const keys = cache.keys();
  keys.forEach((key) => {
    if (key.includes(pattern)) {
      cache.del(key);
    }
  });
};

// Specific cache middleware
const cacheEmails = createCacheMiddleware(
  emailCache,
  (req) =>
    `emails_${req.user._id}_${req.query.q || ""}_${req.query.maxResults || 10}`,
  120
);

const cacheCalendarEvents = createCacheMiddleware(
  calendarCache,
  (req) =>
    `calendar_${req.user._id}_${req.params.calendarId || "primary"}_${
      req.query.timeMin || ""
    }_${req.query.timeMax || ""}`,
  300
);

const cacheTasks = createCacheMiddleware(
  tasksCache,
  (req) =>
    `tasks_${req.user._id}_${req.params.tasklistId || "@default"}_${
      req.query.showCompleted || "true"
    }`,
  180
);

const cacheTaskLists = createCacheMiddleware(
  tasksCache,
  (req) => `tasklists_${req.user._id}`,
  300
);

// Cache invalidation middleware for write operations
const invalidateEmailCache = (req, res, next) => {
  res.on("finish", () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      invalidateCache(emailCache, req.user._id);
    }
  });
  next();
};

const invalidateCalendarCache = (req, res, next) => {
  res.on("finish", () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      invalidateCache(calendarCache, req.user._id);
    }
  });
  next();
};

const invalidateTasksCache = (req, res, next) => {
  res.on("finish", () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      invalidateCache(tasksCache, req.user._id);
    }
  });
  next();
};

module.exports = {
  cacheEmails,
  cacheCalendarEvents,
  cacheTasks,
  cacheTaskLists,
  invalidateEmailCache,
  invalidateCalendarCache,
  invalidateTasksCache,
  userCache,
  emailCache,
  calendarCache,
  tasksCache,
  tokenCache,
  invalidateCache,
};
