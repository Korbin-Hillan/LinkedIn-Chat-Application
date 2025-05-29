const axios = require("axios");
const User = require("../models/User");
const { generateToken } = require("../utils/jwt");

const linkedinAuth = async (req, res) => {
  try {
    const { code } = req.body;

    console.log(
      "📝 Received authorization code:",
      code ? "Present" : "Missing"
    );
    console.log(
      "🔧 Using Client ID:",
      process.env.LINKEDIN_CLIENT_ID ? "Set" : "Missing"
    );
    console.log(
      "🔑 Using Client Secret:",
      process.env.LINKEDIN_CLIENT_SECRET ? "Set" : "Missing"
    );
    console.log("🔗 Using Redirect URI:", process.env.LINKEDIN_CALLBACK_URL);

    if (!code) {
      return res.status(400).json({ error: "Authorization code is required" });
    }

    const tokenRequestData = {
      grant_type: "authorization_code",
      code,
      client_id: process.env.LINKEDIN_CLIENT_ID,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET,
      redirect_uri: process.env.LINKEDIN_CALLBACK_URL,
    };

    console.log("🚀 Token request data:", {
      ...tokenRequestData,
      client_secret: "[HIDDEN]",
    });

    const tokenResponse = await axios.post(
      "https://www.linkedin.com/oauth/v2/accessToken",
      new URLSearchParams(tokenRequestData),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    console.log("✅ Token exchange successful");

    const { access_token } = tokenResponse.data;

    // Get user info using OpenID Connect userinfo endpoint
    const userinfoResponse = await axios.get(
      "https://api.linkedin.com/v2/userinfo",
      {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      }
    );

    const userInfo = userinfoResponse.data;

    const userData = {
      linkedinId: userInfo.sub,
      firstName: userInfo.given_name,
      lastName: userInfo.family_name,
      email: userInfo.email,
      profilePicture: userInfo.picture,
      name: userInfo.name, // Full name
      locale: userInfo.locale,
      email_verified: userInfo.email_verified, // added this incase needed down the line
    };

    let user = await User.findOne({ linkedinId: userData.linkedinId });

    if (!user) {
      console.log("Creating new user...");
      user = new User({
        linkedinId: userData.linkedinId,
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
        profilePicture: userData.profilePicture,
        name: userData.name,
        locale: userData.locale,
      });
      await user.save();
    } else {
      console.log("Updating existing user...");
      user.firstName = userData.firstName;
      user.lastName = userData.lastName;
      user.email = userData.email;
      user.profilePicture = userData.profilePicture;
      user.name = userData.name;
      user.locale = userData.locale;
      user.lastLogin = new Date();
      await user.save();
    }

    const token = generateToken({
      userId: user._id,
      linkedinId: user.linkedinId,
    });

    console.log("Authentication successful for user:", user.email);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        linkedinId: user.linkedinId,
        firstName: user.firstName,
        lastName: user.lastName,
        name: user.name,
        email: user.email,
        profilePicture: user.profilePicture,
        locale: user.locale,
      },
    });
  } catch (error) {
    console.error(
      "LinkedIn OpenID Connect auth error:",
      error.response?.data || error.message
    );
    if (error.response?.status === 400) {
      return res.status(400).json({
        error: "Invalid authorization code or expired code",
        details: error.response.data,
      });
    }
    if (error.response?.status === 401) {
      return res.status(401).json({
        error: "Invalid LinkedIn credentials",
      });
    }

    res.status(500).json({
      error: "Authentication failed",
      message:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-__v");
    res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Get Profile Error:", error);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
};

const logout = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, {
      isOnline: false,
      lastSeen: new Date(),
    });

    res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Logout failed" });
  }
};

module.exports = {
  linkedinAuth,
  getProfile,
  logout,
};
