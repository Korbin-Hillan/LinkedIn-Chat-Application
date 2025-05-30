const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    linkedinId: {
      type: String,
      required: true,
      unique: true,
    },
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    profilePicture: {
      type: String,
    },
    headline: {
      type: String,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// LinkIn ID lookup index
userSchema.index({ linkedinId: 1 });
// Email lookup index
userSchema.index({ email: 1 });

module.exports = mongoose.model("User", userSchema);
