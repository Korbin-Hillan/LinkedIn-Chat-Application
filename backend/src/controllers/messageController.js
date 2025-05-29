const Message = require("../models/Message");
const User = require("../models/User");
const { validationResult } = require("express-validator");
const { invalidateCache } = require("../middleware/cache");

const sendMessage = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { receiverId, content } = req.body;
    const senderId = req.user._id;

    // Check if receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ error: "Receiver not found" });
    }

    // Create message
    const message = new Message({
      sender: senderId,
      receiver: receiverId,
      content,
      timestamp: new Date(),
    });

    await message.save();

    await invalidateCache(`messages:${senderId}:*`);
    await invalidateCache(`messages:${receiverId}:*`);

    // Apply cache middleware to getChatHistory route in messages.js:
    router.get(
      "/:userId",
      auth,
      cacheMiddleware("messages", 600),
      getChatHistory,
    );

    // Populate sender and receiver info
    await message.populate("sender", "firstName lastName profilePicture");
    await message.populate("receiver", "firstName lastName profilePicture");

    res.status(201).json({
      success: true,
      message,
    });
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
};

const getChatHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const currentUserId = req.user._id;

    const skip = (page - 1) * limit;

    // Get messages between current user and specified user
    const messages = await Message.find({
      $or: [
        { sender: currentUserId, receiver: userId },
        { sender: userId, receiver: currentUserId },
      ],
    })
      .populate("sender", "firstName lastName profilePicture")
      .populate("receiver", "firstName lastName profilePicture")
      .sort({ timestamp: 1 }) // Sort by timestamp (oldest first)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Message.countDocuments({
      $or: [
        { sender: currentUserId, receiver: userId },
        { sender: userId, receiver: currentUserId },
      ],
    });

    res.json({
      success: true,
      messages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get chat history error:", error);
    res.status(500).json({ error: "Failed to retrieve chat history" });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const currentUserId = req.user._id;

    // Get all users except current user
    const users = await User.find({ _id: { $ne: currentUserId } })
      .select("firstName lastName profilePicture isOnline lastSeen")
      .sort({ firstName: 1 });

    res.json({
      success: true,
      users,
    });
  } catch (error) {
    console.error("Get all users error:", error);
    res.status(500).json({ error: "Failed to retrieve users" });
  }
};

module.exports = {
  sendMessage,
  getChatHistory,
  getAllUsers,
};
