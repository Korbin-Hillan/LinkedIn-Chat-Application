// src/components/Chat.js - FIXED VERSION
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import io from "socket.io-client";
import "./chat.css";

const Chat = () => {
  const navigate = useNavigate();
  const [socket, setSocket] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  // FIXED: Store messages per user conversation
  const [messagesByUser, setMessagesByUser] = useState(new Map());
  const [newMessage, setNewMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showUserList, setShowUserList] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const [isChatFocused, setIsChatFocused] = useState(true);

  const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5002";

  // Get current messages for selected user
  const getCurrentMessages = () => {
    if (!selectedUser) return [];
    return messagesByUser.get(selectedUser._id) || [];
  };

  // Update messages for specific user
  const updateMessagesForUser = (userId, updater) => {
    setMessagesByUser((prev) => {
      const newMap = new Map(prev);
      const currentMessages = newMap.get(userId) || [];
      const updatedMessages =
        typeof updater === "function" ? updater(currentMessages) : updater;
      newMap.set(userId, updatedMessages);
      return newMap;
    });
  };

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  useEffect(() => {
    const handleFocus = () => setIsChatFocused(true);
    const handleBlur = () => setIsChatFocused(false);

    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [selectedUser, messagesByUser]);

  // Initialize chat on component mount
  useEffect(() => {
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");

    console.log("🔍 Auth check:", {
      hasToken: !!token,
      userStr,
      hasUserStr: !!userStr,
    });

    if (!token || !userStr) {
      console.log("❌ No token or user, redirecting to login");
      navigate("/");
      return;
    }

    let user;
    try {
      user = JSON.parse(userStr);
    } catch (e) {
      console.error("Failed to parse user from localStorage:", e);
      navigate("/");
      return;
    }

    // FIXED: Ensure we have a valid user ID
    if (!user || (!user.id && !user._id)) {
      console.log("❌ Invalid user object, redirecting to login");
      navigate("/");
      return;
    }

    // FIXED: Normalize user ID
    const normalizedUser = {
      ...user,
      id: user.id || user._id,
      _id: user._id || user.id,
    };

    setCurrentUser(normalizedUser);

    console.log("🔌 Attempting to connect to:", API_URL);
    console.log("🔑 Using token:", token);
    console.log("👤 Current user:", normalizedUser);

    // Initialize Socket.IO connection
    const newSocket = io(API_URL, {
      auth: {
        token: token,
      },
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    // Socket event listeners
    newSocket.on("connect", () => {
      console.log("✅ Connected to chat server");
      console.log("🆔 Socket ID:", newSocket.id);
      setLoading(false);
      loadUsers();
    });

    newSocket.on("user_status_changed", (data) => {
      console.log("👤 User status changed:", data);
      setUsers((prevUsers) => {
        const existingUserIndex = prevUsers.findIndex(
          (u) => u._id === data.userId
        );

        if (existingUserIndex !== -1) {
          const updatedUsers = [...prevUsers];
          updatedUsers[existingUserIndex] = data.user;
          return updatedUsers;
        } else if (data.status === "online") {
          return [...prevUsers, data.user];
        }
        return prevUsers;
      });
    });

    newSocket.on("user_list_updated", () => {
      console.log("📋 User list updated, reloading...");
      loadUsers();
    });

    newSocket.on("new_user_registered", (userData) => {
      console.log("🆕 New user registered:", userData);
      loadUsers();
    });

    newSocket.on("disconnect", () => {
      console.log("❌ Disconnected from chat server");
      setError("Connection lost. Reconnecting...");
    });

    newSocket.on("connect_error", (error) => {
      console.error("❌ Connection error:", error.message);
      if (error.message === "Authentication error") {
        console.log("🔐 Auth failed, clearing credentials");
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/");
      }
    });

    // FIXED: Better message handling
    newSocket.on("receive_message", (message) => {
      console.log("📨 Received message:", message);

      const currentUserId = normalizedUser.id;
      const isFromSelectedUser =
        selectedUser && message.sender._id === selectedUser._id;
      const isForCurrentUser = message.receiver._id === currentUserId;

      // Add message to the appropriate conversation
      if (message.sender._id === currentUserId) {
        // Message sent by current user
        updateMessagesForUser(message.receiver._id, (prev) => [
          ...prev,
          message,
        ]);
      } else if (isForCurrentUser) {
        // Message received by current user
        updateMessagesForUser(message.sender._id, (prev) => [...prev, message]);

        // Auto-mark as read if chat is focused and this is the selected user
        if (isChatFocused && isFromSelectedUser) {
          console.log("✅ Auto-marking message as read");
          newSocket.emit("message_read", { messageId: message._id });

          // Update local state to show read status
          updateMessagesForUser(message.sender._id, (prev) =>
            prev.map((msg) =>
              msg._id === message._id ? { ...msg, isRead: true } : msg
            )
          );
        }
      }

      // Show notification if needed
      if (
        message.sender._id !== currentUserId &&
        (!isChatFocused || !isFromSelectedUser)
      ) {
        if (document.hidden || !isFromSelectedUser) {
          showNotification(message);
        }
      }
    });

    newSocket.on("message_sent", (message) => {
      console.log("✅ Message sent confirmation:", message);
      // Message should already be added via receive_message or send logic
    });

    newSocket.on("user_typing", (data) => {
      if (data.userId === selectedUser?._id) {
        setTypingUser(data.userName);
      }
    });

    newSocket.on("user_stopped_typing", (data) => {
      if (data.userId === selectedUser?._id) {
        setTypingUser(null);
      }
    });

    newSocket.on("message_read_receipt", (data) => {
      console.log("📖 Message read receipt:", data);
      // Update read status for all conversations that might contain this message
      setMessagesByUser((prev) => {
        const newMap = new Map(prev);
        for (const [userId, messages] of newMap.entries()) {
          const updatedMessages = messages.map((msg) =>
            msg._id === data.messageId ? { ...msg, isRead: true } : msg
          );
          newMap.set(userId, updatedMessages);
        }
        return newMap;
      });
    });

    setSocket(newSocket);

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      newSocket.close();
    };
  }, [navigate, API_URL]);

  // Load all users
  const loadUsers = async () => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/api/messages/users/all`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load users");
      }

      const data = await response.json();
      if (data.success) {
        console.log("👥 Loaded users:", data.users.length);
        setUsers(data.users);
      }
    } catch (err) {
      console.error("Error loading users:", err);
      setError("Failed to load users");
    }
  };

  // FIXED: Load chat history with better state management
  const loadChatHistory = async (userId) => {
    try {
      setLoadingMessages(true);
      const token = localStorage.getItem("token");

      console.log("📚 Loading chat history for user:", userId);

      const response = await fetch(`${API_URL}/api/messages/${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to load chat history: ${response.statusText}`);
      }

      const data = await response.json();
      if (data.success) {
        console.log("📚 Chat history loaded:", {
          totalMessages: data.messages.length,
          userId: userId,
        });

        // FIXED: Store messages for this specific user
        updateMessagesForUser(userId, data.messages);

        const currentUserId = currentUser.id;

        // Mark unread messages as read
        const unreadMessages = data.messages.filter(
          (msg) => !msg.isRead && msg.receiver._id === currentUserId
        );

        console.log("📖 Marking as read:", unreadMessages.length, "messages");

        // Batch mark as read
        unreadMessages.forEach((msg) => {
          if (socket) {
            socket.emit("message_read", { messageId: msg._id });
          }
        });

        // Update local state for read status
        if (unreadMessages.length > 0) {
          updateMessagesForUser(userId, (prev) =>
            prev.map((msg) => {
              const shouldMarkRead = unreadMessages.some(
                (unread) => unread._id === msg._id
              );
              return shouldMarkRead ? { ...msg, isRead: true } : msg;
            })
          );
        }
      }
    } catch (err) {
      console.error("Error loading chat history:", err);
      setError("Failed to load chat history");
    } finally {
      setLoadingMessages(false);
    }
  };

  // Handle read receipts when selected user changes
  useEffect(() => {
    if (selectedUser && socket && isChatFocused && currentUser) {
      const currentUserId = currentUser.id;
      const messages = getCurrentMessages();

      const unreadFromSelected = messages.filter(
        (msg) =>
          msg.sender._id === selectedUser._id &&
          msg.receiver._id === currentUserId &&
          !msg.isRead
      );

      console.log(
        "📖 Marking as read on user switch:",
        unreadFromSelected.length
      );

      unreadFromSelected.forEach((msg) => {
        socket.emit("message_read", { messageId: msg._id });
      });

      if (unreadFromSelected.length > 0) {
        updateMessagesForUser(selectedUser._id, (prev) =>
          prev.map((msg) => {
            const shouldMarkRead = unreadFromSelected.some(
              (unread) => unread._id === msg._id
            );
            return shouldMarkRead ? { ...msg, isRead: true } : msg;
          })
        );
      }
    }
  }, [selectedUser?._id, isChatFocused]);

  // Handle window visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && selectedUser && socket && currentUser) {
        const currentUserId = currentUser.id;
        const messages = getCurrentMessages();

        const unreadFromSelected = messages.filter(
          (msg) =>
            msg.sender._id === selectedUser._id &&
            msg.receiver._id === currentUserId &&
            !msg.isRead
        );

        unreadFromSelected.forEach((msg) => {
          socket.emit("message_read", { messageId: msg._id });
        });

        if (unreadFromSelected.length > 0) {
          updateMessagesForUser(selectedUser._id, (prev) =>
            prev.map((msg) => {
              const shouldMarkRead = unreadFromSelected.some(
                (unread) => unread._id === msg._id
              );
              return shouldMarkRead ? { ...msg, isRead: true } : msg;
            })
          );
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [selectedUser, socket, currentUser, messagesByUser]);

  // FIXED: Select a user and load their chat history
  const selectUser = (user) => {
    console.log("👤 Selecting user:", user);
    setSelectedUser(user);
    setShowUserList(false);

    // Check if we already have messages for this user
    const existingMessages = messagesByUser.get(user._id);
    if (!existingMessages || existingMessages.length === 0) {
      loadChatHistory(user._id);
    }
  };

  // Send a message
  const sendMessage = (e) => {
    e.preventDefault();

    if (!newMessage.trim() || !selectedUser || !socket) return;

    console.log("📤 Sending message:", {
      receiverId: selectedUser._id,
      content: newMessage.trim(),
    });

    socket.emit("send_message", {
      receiverId: selectedUser._id,
      content: newMessage.trim(),
    });

    setNewMessage("");

    // Stop typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      socket.emit("typing_stop", { receiverId: selectedUser._id });
    }
  };

  // Handle typing indicator
  const handleTyping = (e) => {
    setNewMessage(e.target.value);

    if (!socket || !selectedUser) return;

    if (!isTyping) {
      setIsTyping(true);
      socket.emit("typing_start", { receiverId: selectedUser._id });
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socket.emit("typing_stop", { receiverId: selectedUser._id });
    }, 1000);
  };

  // Show notification for new messages
  const showNotification = (message) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(`New message from ${message.sender.firstName}`, {
        body: message.content,
        icon: message.sender.profilePicture || "/default-avatar.png",
      });
    }
  };

  // Request notification permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Logout
  const handleLogout = async () => {
    try {
      const token = localStorage.getItem("token");
      if (token) {
        await fetch(`${API_URL}/api/auth/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (err) {
      console.error("Logout error:", err);
    }

    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.clear();

    if (socket) {
      socket.disconnect();
    }

    window.location.href = "/";
  };

  // Format timestamp
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } else {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    }
  };

  // Hide error after 3 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  if (loading) {
    return (
      <div className="chat-loading">
        <div className="spinner"></div>
        <p>Connecting to chat server...</p>
      </div>
    );
  }

  const currentMessages = getCurrentMessages();

  return (
    <div className="chat-container">
      <div className={`users-sidebar ${showUserList ? "show" : ""}`}>
        <div className="sidebar-header">
          <h2>LinkedIn Chat</h2>
          <button className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>

        <div className="current-user">
          <img
            src={currentUser?.profilePicture || "/default-avatar.png"}
            alt={currentUser?.firstName}
            onError={(e) => {
              e.target.src = "/default-avatar.png";
            }}
          />
          <div>
            <div className="user-name">
              {currentUser?.firstName} {currentUser?.lastName}
            </div>
            <div className="user-status">Online</div>
          </div>
        </div>

        <div className="users-list">
          <h3>Contacts ({users.length})</h3>
          {users.length === 0 ? (
            <p className="no-users">No users available</p>
          ) : (
            users.map((user) => (
              <div
                key={user._id}
                className={`user-item ${
                  selectedUser?._id === user._id ? "active" : ""
                }`}
                onClick={() => selectUser(user)}
              >
                <img
                  src={user.profilePicture || "/default-avatar.png"}
                  alt={user.firstName}
                  onError={(e) => {
                    e.target.src = "/default-avatar.png";
                  }}
                />
                <div className="user-info">
                  <div className="user-name">
                    {user.firstName} {user.lastName}
                  </div>
                  <div className="user-status">
                    {user.isOnline ? (
                      <>
                        <span className="status-dot online"></span> Online
                      </>
                    ) : (
                      <>Last seen {formatTime(user.lastSeen)}</>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="chat-main">
        {selectedUser ? (
          <>
            <div className="chat-header">
              <button
                className="mobile-menu-btn"
                onClick={() => setShowUserList(true)}
              >
                ☰
              </button>
              <img
                src={selectedUser.profilePicture || "/default-avatar.png"}
                alt={selectedUser.firstName}
                onError={(e) => {
                  e.target.src = "/default-avatar.png";
                }}
              />
              <div className="header-info">
                <div className="user-name">
                  {selectedUser.firstName} {selectedUser.lastName}
                </div>
                <div className="user-status">
                  {typingUser ? (
                    <span className="typing">typing...</span>
                  ) : selectedUser.isOnline ? (
                    "Online"
                  ) : (
                    `Last seen ${formatTime(selectedUser.lastSeen)}`
                  )}
                </div>
              </div>
            </div>

            <div className="messages-container">
              {loadingMessages ? (
                <div className="loading-messages">
                  <div className="spinner"></div>
                  <p>Loading messages...</p>
                </div>
              ) : currentMessages.length === 0 ? (
                <div className="no-messages">
                  <p>No messages yet. Start a conversation!</p>
                </div>
              ) : (
                currentMessages.map((message) => (
                  <div
                    key={message._id}
                    className={`message ${
                      message.sender._id === currentUser.id
                        ? "sent"
                        : "received"
                    }`}
                  >
                    <div className="message-content">{message.content}</div>
                    <div className="message-meta">
                      <span className="message-time">
                        {formatTime(message.timestamp)}
                      </span>
                      {message.sender._id === currentUser.id && (
                        <span className="message-status">
                          {message.isRead ? "✓✓" : "✓"}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <form className="message-input-form" onSubmit={sendMessage}>
              <input
                type="text"
                value={newMessage}
                onChange={handleTyping}
                placeholder="Type a message..."
                className="message-input"
                disabled={loadingMessages}
              />
              <button
                type="submit"
                className="send-btn"
                disabled={!newMessage.trim() || loadingMessages}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </form>
          </>
        ) : (
          <div className="no-chat-selected">
            <h2>Welcome to LinkedIn Chat</h2>
            <p>Select a contact to start messaging</p>
            {users.length > 0 && (
              <p className="hint">You have {users.length} contacts available</p>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="error-toast">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}
    </div>
  );
};

export default Chat;
