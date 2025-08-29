const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [50, "Name cannot be more than 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please provide a valid email",
      ],
    },
    password: {
      type: String,
      minlength: [6, "Password must be at least 6 characters"],
      select: false, // Don't include password in queries by default
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
    },
    // Google OAuth fields
    googleId: {
      type: String,
      unique: true,
      sparse: true, // Allows null values while maintaining uniqueness
    },
    profilePicture: {
      type: String,
    },
    // Google API tokens for accessing Gmail and Calendar
    googleTokens: {
      accessToken: {
        type: String,
      },
      refreshToken: {
        type: String,
      },
      tokenType: {
        type: String,
        default: "Bearer",
      },
      accessTokenExpiry: {
        type: Date,
      },
      refreshTokenExpiry: {
        type: Date,
        default: null, // Refresh tokens don't have fixed expiry
      },
      // Keep the old field for backward compatibility
      expiryDate: {
        type: Date,
      },
      scope: [
        {
          type: String,
        },
      ],
    },
    // Preferences for automation
    automationSettings: {
      emailNotifications: {
        type: Boolean,
        default: true,
      },
      calendarSync: {
        type: Boolean,
        default: true,
      },
      autoRespond: {
        type: Boolean,
        default: false,
      },
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt fields
  }
);

// Encrypt password before saving
userSchema.pre("save", async function (next) {
  // Only run this function if password was actually modified and exists
  if (!this.isModified("password") || !this.password) return next();

  // Hash the password with cost of 12
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Create indexes for better query performance
userSchema.index({ email: 1 }); // For login queries
userSchema.index({ googleId: 1 }); // For Google OAuth queries
userSchema.index({ isActive: 1 }); // For filtering active users
userSchema.index({ lastLogin: -1 }); // For sorting by last login
userSchema.index({ "googleTokens.expiryDate": 1 }); // For token expiry checks

// Compound index for common query patterns
userSchema.index({ email: 1, isActive: 1 });

// Instance method to check password
userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

// Instance method to check if password changed after JWT was issued
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

module.exports = mongoose.model("User", userSchema);
