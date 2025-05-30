const { verifyToken } = require("../utils/jwt");
const User = require("../models/User");

const auth = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res
        .status(401)
        .json({ error: "Access denied. No token provided." });
    }

    // Verify the token
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ error: "Invalid token." });
    }

    req.user = user; // Attach user to request object

    next(); // Call next middleware if token is present
  } catch (error) {
    console.error("Authentication error:", error);
    res.status(401).json({ error: "Invalid token." });
  }
};

module.exports = auth;
