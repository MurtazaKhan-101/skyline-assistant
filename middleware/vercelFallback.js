// Fallback middleware for Vercel deployment
// This handles cases where the full middleware might not be available in serverless environment

// Simple performance monitoring fallback
const performanceMonitorFallback = (req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.warn(
        `Slow request: ${req.method} ${req.path} took ${duration}ms`
      );
    }
  });

  next();
};

// Simple cache fallback using Map
class SimpleCacheFallback {
  constructor() {
    this.cache = new Map();
    this.maxSize = 1000; // Limit cache size
  }

  set(key, value, ttl = 300) {
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      value,
      expires: Date.now() + ttl * 1000,
    });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    if (Date.now() > item.expires) {
      this.cache.delete(key);
      return null;
    }

    return item.value;
  }

  del(key) {
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }
}

// Simple rate limiting fallback
const rateLimitFallback = (maxRequests = 100, windowMs = 60000) => {
  const requests = new Map();

  return (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress || "unknown";
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean old entries
    for (const [ip, timestamps] of requests.entries()) {
      const filtered = timestamps.filter((time) => time > windowStart);
      if (filtered.length === 0) {
        requests.delete(ip);
      } else {
        requests.set(ip, filtered);
      }
    }

    // Check current requests
    const userRequests = requests.get(key) || [];
    const recentRequests = userRequests.filter((time) => time > windowStart);

    if (recentRequests.length >= maxRequests) {
      return res.status(429).json({
        error: "Too many requests",
        retryAfter: Math.ceil(windowMs / 1000),
      });
    }

    // Add current request
    recentRequests.push(now);
    requests.set(key, recentRequests);

    next();
  };
};

// Create fallback instances
const tokenCacheFallback = new SimpleCacheFallback();
const emailsCacheFallback = new SimpleCacheFallback();
const calendarCacheFallback = new SimpleCacheFallback();
const tasksCacheFallback = new SimpleCacheFallback();

module.exports = {
  performanceMonitor: performanceMonitorFallback,
  tokenCache: tokenCacheFallback,
  emailsCache: emailsCacheFallback,
  calendarCache: calendarCacheFallback,
  tasksCache: tasksCacheFallback,
  authRateLimit: rateLimitFallback(5, 15 * 60 * 1000), // 5 per 15 minutes
  emailRateLimit: rateLimitFallback(30, 60 * 1000), // 30 per minute
  calendarRateLimit: rateLimitFallback(20, 60 * 1000), // 20 per minute
  tasksRateLimit: rateLimitFallback(50, 60 * 1000), // 50 per minute

  // Cache middleware functions
  emailsCacheMiddleware: (req, res, next) => {
    const key = `${req.userId || "anon"}_${req.path}_${JSON.stringify(
      req.query
    )}`;
    const cached = emailsCacheFallback.get(key);

    if (cached) {
      return res.json(cached);
    }

    // Store original json method
    const originalJson = res.json;
    res.json = function (data) {
      emailsCacheFallback.set(key, data, 120); // 2 minutes
      return originalJson.call(this, data);
    };

    next();
  },

  calendarCacheMiddleware: (req, res, next) => {
    const key = `${req.userId || "anon"}_${req.path}_${JSON.stringify(
      req.query
    )}`;
    const cached = calendarCacheFallback.get(key);

    if (cached) {
      return res.json(cached);
    }

    const originalJson = res.json;
    res.json = function (data) {
      calendarCacheFallback.set(key, data, 300); // 5 minutes
      return originalJson.call(this, data);
    };

    next();
  },

  tasksCacheMiddleware: (req, res, next) => {
    const key = `${req.userId || "anon"}_${req.path}_${JSON.stringify(
      req.query
    )}`;
    const cached = tasksCacheFallback.get(key);

    if (cached) {
      return res.json(cached);
    }

    const originalJson = res.json;
    res.json = function (data) {
      tasksCacheFallback.set(key, data, 180); // 3 minutes
      return originalJson.call(this, data);
    };

    next();
  },

  // Cache invalidation
  invalidateEmailsCache: (req, res, next) => {
    emailsCacheFallback.clear();
    next();
  },

  invalidateCalendarCache: (req, res, next) => {
    calendarCacheFallback.clear();
    next();
  },

  invalidateTasksCache: (req, res, next) => {
    tasksCacheFallback.clear();
    next();
  },
};
