const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Message = require("../models/Message");
const { getRedisClient } = require("../config/redis");
const { invalidateCache } = require("../middleware/cache");

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

  io.on("connection", async (socket) => {
    console.log(`User ${socket.user.firstName} connected`);

    // Store socket ID and online status in Redis for user session management
    const redis = getRedisClient();
    if (redis && redis.isOpen) {
      try {
        await redis.setEx(`socket:${socket.userId}`, 3600, socket.id);
        await redis.setEx(`online:${socket.userId}`, 3600, "true");
        await redis.sAdd("online_users", socket.userId);
      } catch (error) {
        console.error("Redis socket storage error:", error);
      }
    }

    // Update user online status in MongoDB
    await User.findByIdAndUpdate(socket.userId, {
      isOnline: true,
    }).exec();

    // Join user to their own room
    socket.join(socket.userId);

    // Get the updated user info and broadcast to all users
    try {
      const connectedUser = await User.findById(socket.userId).select(
        "firstName lastName profilePicture isOnline lastSeen"
      );

      // Broadcast to all connected clients that a user came online
      io.emit("user_status_changed", {
        userId: socket.userId,
        user: connectedUser,
        status: "online",
      });
    } catch (error) {
      console.error("Error broadcasting user status:", error);
    }

    // Emit current online users to the newly connected user
    if (redis && redis.isOpen) {
      try {
        const onlineUsers = await redis.sMembers("online_users");
        socket.emit("online_users", onlineUsers);
      } catch (error) {
        console.error("Redis online users fetch error:", error);
      }
    }

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

        // Save message to database
        await message.save();
        await message.populate("sender", "firstName lastName profilePicture");
        await message.populate("receiver", "firstName lastName profilePicture");

        // Invalidate cache for both users
        await invalidateCache(`messages:${socket.userId}:*`);
        await invalidateCache(`messages:${receiverId}:*`);

        // Cache recent message in Redis for quick access
        if (redis && redis.isOpen) {
          try {
            const recentKey = `recent_messages:${socket.userId}:${receiverId}`;
            await redis.lPush(recentKey, JSON.stringify(message));
            await redis.lTrim(recentKey, 0, 49); // Keep only last 50 messages
            await redis.expire(recentKey, 3600); // Expire after 1 hour
          } catch (error) {
            console.error("Redis message cache error:", error);
          }
        }

        // Send message to receiver if they're online
        socket.to(receiverId).emit("receive_message", message);

        // Send confirmation back to sender
        socket.emit("message_sent", message);
      } catch (error) {
        console.error("Socket send message error:", error);
        socket.emit("message_error", { error: "Failed to send message" });
      }
    });

    // Handle typing indicators with Redis for better performance
    socket.on("typing_start", async (data) => {
      const typingKey = `typing:${data.receiverId}:${socket.userId}`;

      if (redis && redis.isOpen) {
        try {
          // Store typing status expires in 5 seconds
          await redis.setEx(typingKey, 5, socket.user.firstName);
        } catch (error) {
          console.error("Redis typing indicator error:", error);
        }
      }

      // typing indicator to receiver
      socket.to(data.receiverId).emit("user_typing", {
        userId: socket.userId,
        userName: socket.user.firstName,
      });
    });

    socket.on("typing_stop", async (data) => {
      const typingKey = `typing:${data.receiverId}:${socket.userId}`;

      if (redis && redis.isOpen) {
        try {
          await redis.del(typingKey);
        } catch (error) {
          console.error("Redis typing indicator removal error:", error);
        }
      }

      socket.to(data.receiverId).emit("user_stopped_typing", {
        userId: socket.userId,
      });
    });

    // Handle read receipts with cache invalidation
    socket.on("message_read", async (data) => {
      try {
        const { messageId } = data;
        await Message.findByIdAndUpdate(messageId, { isRead: true });

        // Notify sender that message was read
        const message = await Message.findById(messageId);

        // Invalidate message cache for both users
        await invalidateCache(`messages:${message.sender}:*`);
        await invalidateCache(`messages:${message.receiver}:*`);

        socket.to(message.sender.toString()).emit("message_read_receipt", {
          messageId,
          readBy: socket.userId,
        });
      } catch (error) {
        console.error("Message read error:", error);
      }
    });

    // Handle getting online users
    socket.on("get_online_users", async () => {
      if (redis && redis.isOpen) {
        try {
          const onlineUsers = await redis.sMembers("online_users");
          socket.emit("online_users", onlineUsers);
        } catch (error) {
          console.error("Redis get online users error:", error);
        }
      }
    });

    // Handle disconnection
    socket.on("disconnect", async () => {
      console.log(`User ${socket.user.firstName} disconnected`);

      // Remove from Redis
      if (redis && redis.isOpen) {
        try {
          await redis.del(`socket:${socket.userId}`);
          await redis.del(`online:${socket.userId}`);
          await redis.sRem("online_users", socket.userId);

          const typingKeys = await redis.keys(`typing:*:${socket.userId}`);
          if (typingKeys.length > 0) {
            await redis.del(typingKeys);
          }
        } catch (error) {
          console.error("Redis cleanup error:", error);
        }
      }

      // Update user offline status in MongoDB
      await User.findByIdAndUpdate(socket.userId, {
        isOnline: false,
        lastSeen: new Date(),
      }).exec();

      // Get the updated user info and broadcast to all users
      try {
        const disconnectedUser = await User.findById(socket.userId).select(
          "firstName lastName profilePicture isOnline lastSeen"
        );

        // Broadcast to all connected clients that a user went offline
        io.emit("user_status_changed", {
          userId: socket.userId,
          user: disconnectedUser,
          status: "offline",
        });
      } catch (error) {
        console.error("Error broadcasting disconnect status:", error);
      }
    });
  });
};

module.exports = socketHandler;
