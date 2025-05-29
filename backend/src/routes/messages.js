const express = require("express");
const { body } = require("express-validator");
const {
  sendMessage,
  getChatHistory,
  getAllUsers,
} = require("../controllers/messageController");
const auth = require("../middleware/auth");
const { cacheMiddleware } = require("../middleware/cache");
const { messageLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

// Apply message rate limiter to sending messages
router.use("/", messageLimiter);

// Send a message
router.post(
  "/",
  auth,
  [
    body("receiverId").notEmpty().withMessage("Receiver ID is required"),
    body("content").notEmpty().withMessage("Message content is required"),
  ],
  sendMessage,
);

// Get chat history with a specific user - with caching (10 minute cache)
router.get("/:userId", auth, cacheMiddleware("messages", 600), getChatHistory);

// Get all users (for chat list) - with caching (5 minute cache)
router.get("/users/all", auth, cacheMiddleware("users", 300), getAllUsers);

module.exports = router;
