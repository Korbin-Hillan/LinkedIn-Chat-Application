const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Message = require("../models/Message");

const socketHandler = (io) => {
  // Middleware to authenticate socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error("Authentication error"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.userId);

      if (!user) {
        return next(new Error("User not found"));
      }

      socket.userId = user._id.toString();
      socket.user = user;
      next();
    } catch (error) {
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`User ${socket.user.firstName} connected`);

    // Update user online status
    User.findByIdAndUpdate(socket.userId, {
      isOnline: true,
    }).exec();

    // Join user to their own room
    socket.join(socket.userId);

    // Handle sending messages
    socket.on("send_message", async (data) => {
      try {
        const { receiverId, content } = data;

        // Create and save message
        const message = new Message({
          sender: socket.userId,
          receiver: receiverId,
          content,
          timestamp: new Date(),
        });

        await message.save();
        await message.populate("sender", "firstName lastName profilePicture");
        await message.populate("receiver", "firstName lastName profilePicture");

        // Send message to receiver if they're online
        socket.to(receiverId).emit("receive_message", message);

        // Send confirmation back to sender
        socket.emit("message_sent", message);
      } catch (error) {
        console.error("Socket send message error:", error);
        socket.emit("message_error", { error: "Failed to send message" });
      }
    });

    // Handle typing indicators
    socket.on("typing_start", (data) => {
      socket.to(data.receiverId).emit("user_typing", {
        userId: socket.userId,
        userName: socket.user.firstName,
      });
    });

    socket.on("typing_stop", (data) => {
      socket.to(data.receiverId).emit("user_stopped_typing", {
        userId: socket.userId,
      });
    });

    // Handle read receipts
    socket.on("message_read", async (data) => {
      try {
        const { messageId } = data;
        await Message.findByIdAndUpdate(messageId, { isRead: true });

        // Notify sender that message was read
        const message = await Message.findById(messageId);
        socket.to(message.sender.toString()).emit("message_read_receipt", {
          messageId,
          readBy: socket.userId,
        });
      } catch (error) {
        console.error("Message read error:", error);
      }
    });

    // Handle disconnection
    socket.on("disconnect", () => {
      console.log(`User ${socket.user.firstName} disconnected`);

      // Update user offline status
      User.findByIdAndUpdate(socket.userId, {
        isOnline: false,
        lastSeen: new Date(),
      }).exec();
    });
  });
};

module.exports = socketHandler;
