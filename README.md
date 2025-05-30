# LinkedIn Chat Application

A real-time chat application with LinkedIn OAuth authentication, built with Node.js, Express, MongoDB, and Socket.IO.

## 🚀 Features

### Core Features

- **LinkedIn OAuth 2.0 Authentication**: Secure login using LinkedIn profiles
- **JWT-based Authorization**: Stateless authentication for API requests
- **Real-time Messaging**: Instant message delivery using WebSocket connections
- **Chat History**: Persistent message storage with pagination support
- **User Presence**: Online/offline status tracking

### Bonus Features

- **Read Receipts**: Track message read status with visual indicators
- **Redis Caching**: Improved performance for frequently accessed data
- **Rate Limiting**: Protection against API abuse
- **Auto-reconnection**: Automatic WebSocket reconnection on disconnect

## 🛠️ Tech Stack

- **Backend Framework**: Node.js with Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: LinkedIn OAuth 2.0 + JWT (jsonwebtoken)
- **Real-time Communication**: Socket.IO
- **Caching**: Redis (optional)
- **Security**: Helmet, CORS, bcrypt, express-rate-limit

## 📋 Prerequisites

- Node.js (v14 or higher)
- MongoDB (local installation or MongoDB Atlas account)
- Redis (optional, for caching features)
- LinkedIn App credentials (Client ID and Client Secret)

## 🔧 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/linkedin-chat-app.git
cd linkedin-chat-app
```

### 2. Install Dependencies

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies (if using the provided frontend)
cd ../frontend
npm install
```

### 3. Environment Configuration

Create a `.env` file in the backend directory and frontend:

backend:

```env
# Server Configuration
PORT=5002
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Database
MONGODB_URI=mongodb://localhost:27017/linkedin-chat
# For MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/linkedin-chat

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d

# LinkedIn OAuth
LINKEDIN_CLIENT_ID=your-linkedin-client-id
LINKEDIN_CLIENT_SECRET=your-linkedin-client-secret
LINKEDIN_CALLBACK_URL=http://localhost:3000/auth/linkedin/callback

# Redis (Optional)
REDIS_URL=redis://localhost:6379
REDIS_ENABLED=true

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

frontend:
```env
# LinkedIn OAuth Configuration
REACT_APP_LINKEDIN_CLIENT_ID=your-linkedin-client-id
REACT_APP_REDIRECT_URI=http://localhost:3000/auth/linkedin/callback

# Backend API URL
REACT_APP_API_URL=http://localhost:5002

# Environment
REACT_APP_ENV=development
```

### 4. LinkedIn App Setup

1. Go to [LinkedIn Developers](https://www.linkedin.com/developers/)
2. Create a new app or select existing
3. In the **Products** tab, add "Sign In with LinkedIn using OpenID Connect"
4. In the **Auth** tab:
   - Add authorized redirect URL: `http://localhost:3000/auth/linkedin/callback`
   - Copy Client ID and Client Secret to your `.env` file
5. Verify the app has the required scopes: `openid`, `profile`, `email`

### 5. Database Setup

If using local MongoDB:

```bash
# Start MongoDB
mongod
```

If using MongoDB Atlas:

1. Create a free cluster at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Whitelist your IP address
3. Create a database user
4. Copy connection string to `MONGODB_URI` in `.env`

### 6. Redis Setup (Optional)

If using Redis for caching:

```bash
# Install Redis (macOS)
brew install redis
brew services start redis

# Install Redis (Ubuntu)
sudo apt update
sudo apt install redis-server
sudo systemctl start redis
```

## 🚀 Running the Application

### Development Mode

```bash
# Start backend server
cd backend
npm run dev

# Start frontend (in a new terminal)
cd frontend
npm start
```

### Production Mode

```bash
# Build frontend
cd frontend
npm run build

# Start backend in production
cd backend
npm start
```

### Using the Start Script

```bash
# From project root
node start-app.js
```

This will start both backend and frontend simultaneously.

## 📡 API Documentation

### Authentication Endpoints

#### 1. LinkedIn OAuth Login

```http
POST /api/auth/linkedin
Content-Type: application/json

{
  "code": "linkedin-authorization-code"
}
```

**Response:**

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "user-mongodb-id",
    "linkedinId": "linkedin-id",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "profilePicture": "https://media.licdn.com/..."
  }
}
```

#### 2. Get User Profile

```http
GET /api/auth/profile
Authorization: Bearer {jwt-token}
```

**Response:**

```json
{
  "success": true,
  "user": {
    "_id": "user-mongodb-id",
    "linkedinId": "linkedin-id",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "profilePicture": "https://media.licdn.com/...",
    "isOnline": true,
    "lastSeen": "2024-01-28T10:30:00.000Z"
  }
}
```

#### 3. Logout

```http
POST /api/auth/logout
Authorization: Bearer {jwt-token}
```

### Message Endpoints

#### 1. Send Message

```http
POST /api/messages
Authorization: Bearer {jwt-token}
Content-Type: application/json

{
  "receiverId": "recipient-user-id",
  "content": "Hello, how are you?"
}
```

**Response:**

```json
{
  "success": true,
  "message": {
    "_id": "message-id",
    "sender": {
      "_id": "sender-id",
      "firstName": "John",
      "lastName": "Doe",
      "profilePicture": "https://..."
    },
    "receiver": {
      "_id": "receiver-id",
      "firstName": "Jane",
      "lastName": "Smith",
      "profilePicture": "https://..."
    },
    "content": "Hello, how are you?",
    "timestamp": "2024-01-28T10:45:00.000Z",
    "isRead": false
  }
}
```

#### 2. Get Chat History

```http
GET /api/messages/{userId}?page=1&limit=50
Authorization: Bearer {jwt-token}
```

**Response:**

```json
{
  "success": true,
  "messages": [
    {
      "_id": "message-id",
      "sender": {
        /* sender details */
      },
      "receiver": {
        /* receiver details */
      },
      "content": "Message content",
      "timestamp": "2024-01-28T10:30:00.000Z",
      "isRead": true
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 123,
    "pages": 3
  }
}
```

#### 3. Get All Users

```http
GET /api/messages/users/all
Authorization: Bearer {jwt-token}
```

### Health Check

```http
GET /health
```

**Response:**

```json
{
  "status": "OK",
  "timestamp": "2024-01-28T10:30:00.000Z",
  "environment": "development",
  "uptime": 3600,
  "dependencies": {
    "mongodb": "connected",
    "redis": "connected"
  }
}
```

## 🔌 WebSocket Events

### Client to Server Events

#### Send Message

```javascript
socket.emit("send_message", {
  receiverId: "recipient-user-id",
  content: "Hello!",
});
```

#### Typing Indicators

```javascript
socket.emit("typing_start", { receiverId: "recipient-user-id" });
socket.emit("typing_stop", { receiverId: "recipient-user-id" });
```

#### Mark Message as Read

```javascript
socket.emit("message_read", { messageId: "message-id" });
```

### Server to Client Events

#### Receive Message

```javascript
socket.on("receive_message", (message) => {
  // Handle incoming message
});
```

#### Typing Status

```javascript
socket.on("user_typing", (data) => {
  // Show typing indicator
});

socket.on("user_stopped_typing", (data) => {
  // Hide typing indicator
});
```

#### Read Receipt

```javascript
socket.on("message_read_receipt", (data) => {
  // Update message read status
});
```

#### User Status Changes

````javascript
socket.on("user_status_changed", (data) => {
  // Update user online/offline status
});

### Test with Postman

1. Import the provided Postman collection
2. Set environment variables:
   - `baseUrl`: http://localhost:5002
   - `authToken`: (obtained from login)
   - `userId`: (your user ID)
   - `receiverId`: (another user's ID)

### Manual Testing Flow

1. **OAuth Flow**:

   - Navigate to http://localhost:3000
   - Click "Sign in with LinkedIn"
   - Authorize the application
   - Verify redirect to chat interface

2. **Messaging**:

   - Send messages between two logged-in users
   - Verify real-time delivery
   - Check typing indicators
   - Confirm read receipts

3. **API Testing**:

   ```bash
   # Test health endpoint
   curl http://localhost:5002/health

   # Test authenticated endpoint
   curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
        http://localhost:5002/api/auth/profile
````


4. Configure environment variables in Railway dashboard

## 📁 Project Structure

```
linkedin-chat-app/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.js      # MongoDB connection
│   │   │   └── redis.js         # Redis connection
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   └── messageController.js
│   │   ├── middleware/
│   │   │   ├── auth.js          # JWT authentication
│   │   │   ├── errorHandler.js
│   │   │   ├── rateLimiter.js
│   │   │   └── cache.js         # Redis caching
│   │   ├── models/
│   │   │   ├── User.js
│   │   │   └── Message.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   └── messages.js
│   │   └── utils/
│   │       ├── jwt.js
│   │       └── socketHandler.js
│   ├── tests/
│   ├── .env.example
│   ├── package.json
│   └── server.js
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── api/
│   │   └── App.js
│   └── package.json
└── README.md
```

## 🔒 Security Considerations

- JWT tokens expire after 7 days by default
- Rate limiting prevents API abuse (5 auth attempts per 15 minutes)
- CORS configured for specified frontend URL only
- Helmet.js provides security headers
- Input validation and sanitization on all endpoints
- MongoDB injection protection via Mongoose
- XSS prevention in message content
- Heroku handles handles SSL termination so no need to add HTTPS.

## 🐛 Troubleshooting

### Common Issues

1. **LinkedIn OAuth Error**:

   - Verify redirect URI matches exactly in LinkedIn app settings
   - Ensure "Sign In with LinkedIn using OpenID Connect" product is added
   - Check Client ID and Secret are correct

2. **WebSocket Connection Failed**:

   - Ensure backend is running on correct port
   - Check CORS settings match frontend URL
   - Verify JWT token is valid

3. **MongoDB Connection Error**:

   - Check MongoDB is running
   - Verify connection string is correct
   - For Atlas, ensure IP is whitelisted

4. **Redis Connection Error**:
   - Redis is optional; app works without it
   - To disable: set `REDIS_ENABLED=false`
