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
    // Connecting to Redis
    // In production connect to Redis using TLS
    redisClient = redis.createClient({
      url: process.env.REDIS_URL || "redis://localhost:6379",
      socket: {
        // https://github.com/redis/node-redis/issues/2115#issuecomment-1235149557
        // Used link above to learn about the reconnectStrategy
        reconnectStrategy: (retries) => {
          // Stop trying after 3 attempts
          if (retries > 3) {
            console.log(
              "⚠️  Redis connection failed after 3 attempts. Continuing without cache."
            );
            redisEnabled = false;
            return false;
          }
          // progressively wait longer between retries
          return Math.min(retries * 100, 1000);
        },
        connectTimeout: 5000,
      },
      lazyConnect: true, // Don't connect automatically allow the user to specify when to connect
    });

    // Set up event handlers before connecting
    redisClient.on("error", (err) => {
      // Only log the first error to avoid spam
      // Was having an issue where the error was spamming the console
      if (redisEnabled) {
        console.error("❌ Redis connection error:", err.message);
      }
    });

    // event listener for connect from redis client
    // This will be called when the client successfully connects to Redis
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
      "⚠️  Redis not available. Application will run without caching."
    );
    console.log(
      "   To use Redis: 1) Install Redis locally, or 2) Set REDIS_ENABLED=false to disable"
    );
    redisEnabled = false;
    redisClient = null;
  }
};

// Returns the redisClient object
const getRedisClient = () => {
  return redisEnabled ? redisClient : null;
};

module.exports = { connectRedis, getRedisClient };
