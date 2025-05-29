const redis = require("redis");

let redisClient;
let redisEnabled = true;

const connectRedis = async () => {
  // Skip Redis if explicitly disabled
  if (process.env.REDIS_ENABLED === "false") {
    console.log("ℹ️  Redis is disabled via environment variable");
    redisEnabled = false;
    return;
  }

  try {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL || "redis://localhost:6379",
      socket: {
        reconnectStrategy: (retries) => {
          // Stop trying after 3 attempts
          if (retries > 3) {
            console.log(
              "⚠️  Redis connection failed after 3 attempts. Continuing without cache.",
            );
            redisEnabled = false;
            return false; // Stop reconnecting
          }
          return Math.min(retries * 100, 1000);
        },
        connectTimeout: 5000,
      },
      lazyConnect: true, // Don't connect automatically
    });

    // Set up event handlers before connecting
    redisClient.on("error", (err) => {
      // Only log the first error to avoid spam
      if (redisEnabled) {
        console.error("❌ Redis connection error:", err.message);
      }
    });

    redisClient.on("connect", () => {
      console.log("✅ Redis connected successfully");
      redisEnabled = true;
    });

    redisClient.on("ready", () => {
      console.log("✅ Redis ready for commands");
    });

    // Try to connect
    await redisClient.connect();
  } catch (error) {
    console.log(
      "⚠️  Redis not available. Application will run without caching.",
    );
    console.log(
      "   To use Redis: 1) Install Redis locally, or 2) Set REDIS_ENABLED=false to disable",
    );
    redisEnabled = false;
    redisClient = null;
  }
};

const getRedisClient = () => {
  return redisEnabled ? redisClient : null;
};

module.exports = { connectRedis, getRedisClient };
