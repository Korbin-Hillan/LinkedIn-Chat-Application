require("dotenv").config();

const express = require("express");
const https = require("https");
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

connectDB();

const app = express();

// Read the local .pem files
//const options = {
//  key: fs.readFileSync("../key.pem"),
//  cert: fs.readFileSync("../cert.pem"),
//};

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "https://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Security Middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable for development
  })
);

// CORS configuration
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

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    uptime: process.uptime(),
  });
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

// Initialize socket handling
socketHandler(io);

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log("Received shutdown signal, closing server gracefully...");

  // Close server to new connections
  server.close(() => {
    console.log("HTTP server closed");
  });

  // Close database connection
  try {
    await mongoose.connection.close();
    console.log("MongoDB connection closed");
  } catch (err) {
    console.error("Error closing MongoDB connection:", err);
  }

  // Force exit after 10 seconds
  setTimeout(() => {
    console.error(
      "Could not close connections in time, forcefully shutting down"
    );
    process.exit(1);
  }, 10000);
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
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`
🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}
📊 Health check available at http://localhost:${PORT}/health
🔗 API endpoints available at http://localhost:${PORT}/api
  `);
});

module.exports = { app, server, io };
