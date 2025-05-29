const express = require("express");
const { body } = require("express-validator");
const {
  sendMessage,
  getChatHistory,
  getAllUsers,
} = require("../controllers/messageController");
const auth = require("../middleware/auth");

const router = express.Router();

// Send a message
router.post(
  "/",
  auth,
  [
    body("receiverId").notEmpty().withMessage("Receiver ID is required"),
    body("content").notEmpty().withMessage("Message content is required"),
  ],
  sendMessage
);

// Get chat history with a specific user
router.get("/:userId", auth, getChatHistory);

// Get all users (for chat list)
router.get("/users/all", auth, getAllUsers);

module.exports = router;
