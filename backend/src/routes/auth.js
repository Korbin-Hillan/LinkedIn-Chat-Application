const express = require("express");
const { body, validationResult } = require("express-validator");
const {
  linkedinAuth,
  getProfile,
  logout,
} = require("../controllers/authController");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// 1) Start OAuth redirect
router.get("/linkedin", (req, res) => {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.LINKEDIN_CLIENT_ID,
    redirect_uri: process.env.LINKEDIN_CALLBACK_URL,
    scope: "openid r_liteprofile r_emailaddress",
  });
  res.redirect(`https://www.linkedin.com/oauth/v2/authorization?${params}`);
});

// 2) Exchange code for token & upsert user
router.post(
  "/linkedin",
  body("code").notEmpty().withMessage("Authorization code is required"),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  },
  linkedinAuth
);

// 3) Protected routes
router.get("/profile", authMiddleware, getProfile);
router.post("/logout", authMiddleware, logout);

module.exports = router;
