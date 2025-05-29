const rateLimit = require("express-rate-limit");

// Rate limiter middleware
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: "Too many requests, please try again later.",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Strict rate limiter for end points
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 10 requests per windowMs
  message: {
    error: "Too many authentication requests, please try again later.",
  },
  skipSuccessfulRequests: true,
});

// Message sending rate limiter
const messageLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // Limit each IP to 30 messages per minute
  message: "Too many messages sent, please slow down.",
  keyGenerator: (req) => {
    // Use user ID instead of IP for authenticated users
    return req.user ? req.user._id.toString() : req.ip;
  },
});

module.exports = {
  generalLimiter,
  authLimiter,
  messageLimiter,
};
