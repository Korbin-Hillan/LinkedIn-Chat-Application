require("dotenv").config();
const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const mongoose = require("mongoose");

const connectDB = require("./src/config/database");
const authRoutes = require("./src/routes/auth");
const messageRoutes = require("./src/routes/messages");
const socketHandler = require("./src/utils/socketHandler");
const { errorHandler } = require("./src/middleware/errorHandler");
const { generalLimiter } = require("./src/middleware/rateLimiter");
const { connectRedis, getRedisClient } = require("./src/config/redis");

// Connect to MongoDB
connectDB().catch((err) => {
  console.error("❌ Failed to connect to MongoDB:", err.message);
  process.exit(1);
});

const app = express();

// Read the local .pem files if i was to use HTTPS
//const options = {
//  key: fs.readFileSync("../key.pem"),
//  cert: fs.readFileSync("../cert.pem"),
//};

const httpServer = http.createServer(app);
const io = socketIo(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "https://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"], // prioritize WebSocket but fallback to polling if necessary
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Connect to Redis (non-blocking)
connectRedis().catch((err) => {
  console.error(
    "⚠️  Redis connection failed, continuing without cache:",
    err.message
  );
});

// Security Middleware for express.js for http headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"], // only allows resource from your own domain
        styleSrc: ["'self'"], // CSS can only come from your own domain
        scriptSrc: ["'self'"], // blocks external scripts
        imgSrc: ["'self'", "https:", "data:"], // allows images from your own domain, HTTPS, and data URIs
        connectSrc: ["'self'", "wss:", "https:"], // allows WebSocket and HTTPS connections
      },
    },
    // Forces browsers to use HTTPS
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);

// supports secure cross-origin requests
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "https://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
} else {
  app.use(morgan("combined"));
}

// Performance monitoring middleware
app.use((req, res, next) => {
  req.startTime = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - req.startTime;
    console.log(
      `${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`
    );
  });

  next();
});

// middleware for parsing JSON and URL-encoded data
// protects against large payloads
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);

// Rate limiting for all routes with /api/
// Protects against brute force attacks and abuse
app.use("/api/", generalLimiter);

// Health check endpoint
app.get("/health", async (req, res) => {
  const redis = getRedisClient();

  const health = {
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    uptime: process.uptime(),
    dependencies: {
      mongodb:
        mongoose.connection.readyState === 1 ? "connected" : "disconnected",
      redis: redis && redis.isOpen ? "connected" : "disconnected",
    },
  };

  const httpStatus = health.dependencies.mongodb === "connected" ? 200 : 503;
  res.status(httpStatus).json(health);
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "LinkedIn Chat API",
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth",
      messages: "/api/messages",
      health: "/health",
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found",
  });
});

app.use(errorHandler);

// Initialize socket handling
socketHandler(io);

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log("Received shutdown signal, closing httpServer gracefully...");

  // Close server to new connections
  httpServer.close(() => {
    console.log("HTTP server closed");
  });

  // Close Redis connection
  try {
    const redis = getRedisClient();
    if (redis && redis.isOpen) {
      await redis.quit();
      console.log("Redis connection closed");
    }
  } catch (err) {
    console.error("Error closing Redis connection:", err);
  }

  // Close database connection
  try {
    await mongoose.connection.close();
    console.log("MongoDB connection closed");
  } catch (err) {
    console.error("Error closing MongoDB connection:", err);
  }
};

// Listen for termination signals
process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

// Handle uncaught exceptions
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  gracefulShutdown();
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err) => {
  console.error("Unhandled Promise Rejection:", err);
  gracefulShutdown();
});

// Start server
const PORT = process.env.PORT || 5002;
httpServer.listen(PORT, () => {
  console.log(`
🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}
📊 Health check available at http://localhost:${PORT}/health
🔗 API endpoints available at http://localhost:${PORT}/api
  `);
});

module.exports = { app, httpServer, io };
