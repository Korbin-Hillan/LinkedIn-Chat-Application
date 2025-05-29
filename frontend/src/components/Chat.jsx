// src/components/Chat.js
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import io from "socket.io-client";
import "./chat.css"; // Import your CSS styles
import DefaultAvatar from "./DefaultAvatar";

const Chat = () => {
  const navigate = useNavigate();
  const [socket, setSocket] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [typingUser, setTypingUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showUserList, setShowUserList] = useState(false);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5002";

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize chat on component mount
  useEffect(() => {
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user") || "{}");

    console.log("🔍 Auth check:", { hasToken: !!token, hasUser: !!user.id });

    if (!token || !user.id) {
      console.log("❌ No token or user, redirecting to login");
      navigate("/");
      return;
    }

    setCurrentUser(user);

    // Initialize Socket.IO connection with more debugging
    console.log("🔌 Attempting to connect to:", API_URL);
    console.log("🔑 Using token:", token);

    // Initialize Socket.IO connection
    const newSocket = io(API_URL, {
      auth: {
        token: token,
      },
      transports: ['websocket', 'polling'], // Explicitly set transports
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    setSocket(newSocket);

    // Socket event listeners
    newSocket.on("connect", () => {
      console.log("Connected to chat server");
      console.log("🆔 Socket ID:", newSocket.id);
      setLoading(false);
      loadUsers();
    });

      newSocket.on("user_status_changed", (data) => {
    console.log("User status changed:", data);
    
    // Update the users list
    setUsers((prevUsers) => {
      // If user already exists, update their status
      const existingUserIndex = prevUsers.findIndex(u => u._id === data.userId);
      
      if (existingUserIndex !== -1) {
        const updatedUsers = [...prevUsers];
        updatedUsers[existingUserIndex] = data.user;
        return updatedUsers;
      } else if (data.status === "online") {
        // New user came online, add them to the list
        return [...prevUsers, data.user];
      }
      
      return prevUsers;
    });
  });

    // Listen for complete user list updates
  newSocket.on("user_list_updated", () => {
    console.log("User list updated, reloading...");
    loadUsers();
  });

  // Listen for new user registrations
  newSocket.on("new_user_registered", (userData) => {
    console.log("New user registered:", userData);
    loadUsers(); // Reload the entire list to get the new user
  });

    newSocket.on("disconnect", () => {
      console.log("Disconnected from chat server");
      setError("Connection lost. Reconnecting...");
    });

    newSocket.on("connect_error", (error) => {
      console.error("❌ Connection error:", error.message);
      console.error("🔍 Error type:", error.type);
      console.error("🔍 Full error:", error);

      if (error.message === "Authentication error") {
        console.log("🔐 Auth failed, clearing credentials");
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        navigate("/");
      }
    });

    newSocket.on("receive_message", (message) => {
      setMessages((prev) => [...prev, message]);

      // Show notification if the message is from the selected user
      if (message.sender._id === selectedUser?._id && document.hidden) {
        showNotification(message);
      }
    });

    newSocket.on("message_sent", (message) => {
      setMessages((prev) => [...prev, message]);
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
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === data.messageId ? { ...msg, isRead: true } : msg
        )
      );
    });

  newSocket.io.on("error", (error) => {
    console.error("❌ Socket.IO error:", error);
   });

  setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [navigate, API_URL]);

  // Load all users
  const loadUsers = async () => {
    try {
      const token = localStorage.getItem("token");
      const user = JSON.parse(localStorage.getItem("user") || "{}");

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
        setUsers(data.users);
      }
    } catch (err) {
      console.error("Error loading users:", err);
      setError("Failed to load users");
    }
  };

  // Load chat history with selected user
  const loadChatHistory = async (userId) => {
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/api/messages/${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load chat history");
      }

      const data = await response.json();
      if (data.success) {
        setMessages(data.messages);

        // Mark unread messages as read
        data.messages.forEach((msg) => {
          if (!msg.isRead && msg.receiver._id === currentUser.id) {
            socket.emit("message_read", { messageId: msg._id });
          }
        });
      }
    } catch (err) {
      console.error("Error loading chat history:", err);
      setError("Failed to load chat history");
    }
  };

  // Select a user to chat with
  const selectUser = (user) => {
    setSelectedUser(user);
    setMessages([]);
    setShowUserList(false);
    loadChatHistory(user._id);
  };

  // Send a message
  const sendMessage = (e) => {
    e.preventDefault();

    if (!newMessage.trim() || !selectedUser || !socket) return;

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

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout
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


    // Only call API if we have a token
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
    // Continue with logout even if API call fails
  }
  // Clear all storage
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  sessionStorage.clear();
  if (socket) {
    socket.disconnect();
  }
  
  // Use window.location for a clean redirect
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
      const timer = setTimeout(() => setError(null), 3000);
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
          <h3>Contacts</h3>
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
              {messages.length === 0 ? (
                <div className="no-messages">
                  <p>No messages yet. Start a conversation!</p>
                </div>
              ) : (
                messages.map((message) => (
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
              />
              <button
                type="submit"
                className="send-btn"
                disabled={!newMessage.trim()}
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
          </div>
        )}
      </div>

      {error && <div className="error-toast">{error}</div>}
    </div>
  );
};

export default Chat;