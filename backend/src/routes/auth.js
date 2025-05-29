const express = require("express");
const { body } = require("express-validator");
const {
  linkedinAuth,
  getProfile,
  logout,
} = require("../controllers/authController");
const auth = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimiter");

const router = express.Router();

router.use(authLimiter);

router.post(
  "/linkedin",
  [body("code").notEmpty().withMessage("Authorization code is required")],
  linkedinAuth,
);

router.get("/profile", auth, getProfile); // Add auth middleware and getProfile handler

router.post("/logout", auth, logout); // Add logout route

module.exports = router;
