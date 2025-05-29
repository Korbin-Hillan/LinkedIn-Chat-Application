const { getRedisClient } = require("../config/redis");

const cacheMiddleware = (keyPrefix, ttl = 300) => {
  return async (req, res, next) => {
    const redis = getRedisClient();
    if (!redis || !redis.isOpen) return next();

    const key = `${keyPrefix}:${req.user._id}:${req.params.userId || "all"}`;

    try {
      const cached = await redis.get(key);
      if (cached) {
        console.log(`Cache hit for key: ${key}`);
        return res.json(JSON.parse(cached));
      }
    } catch (error) {
      console.error("Cache read error:", error);
    }

    // Store original res.json
    const originalJson = res.json;
    res.json = function (data) {
      // Cache the response
      if (redis && redis.isOpen && data.success) {
        redis
          .setEx(key, ttl, JSON.stringify(data))
          .catch((err) => console.error("Cache write error:", err));
      }
      return originalJson.call(this, data);
    };

    next();
  };
};

const invalidateCache = async (pattern) => {
  const redis = getRedisClient();
  if (!redis || !redis.isOpen) return;

  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(keys);
      console.log(
        `Invalidated ${keys.length} cache entries matching pattern: ${pattern}`,
      );
    }
  } catch (error) {
    console.error("Cache invalidation error:", error);
  }
};

module.exports = { cacheMiddleware, invalidateCache };
