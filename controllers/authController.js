const User = require("../models/User");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");
const googleApiService = require("../services/googleApiService");

// Generate JWT token
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

// Create and send token response
const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);

  // Remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    success: true,
    token,
    data: {
      user,
    },
  });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation errors",
        errors: errors.array(),
      });
    }

    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email",
      });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
    });

    createSendToken(user, 201, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation errors",
        errors: errors.array(),
      });
    }

    const { email, password } = req.body;

    // Check if user exists and password is correct
    const user = await User.findOne({ email }).select("+password");

    if (!user || !(await user.correctPassword(password, user.password))) {
      return res.status(401).json({
        success: false,
        message: "Incorrect email or password",
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    createSendToken(user, 200, res);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    res.status(200).json({
      success: true,
      data: {
        user,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// @desc    Google OAuth Success
// @route   GET /api/auth/google/success
// @access  Public (called after OAuth)
exports.googleSuccess = async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect(
        `${process.env.FRONTEND_URL}/auth/callback?error=authentication_failed`
      );
    }

    const token = signToken(req.user._id);

    // Redirect to frontend with token
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
  } catch (error) {
    res.redirect(
      `${process.env.FRONTEND_URL}/auth/callback?error=server_error`
    );
  }
};

// @desc    Google OAuth Failure
// @route   GET /api/auth/google/failure
// @access  Public
exports.googleFailure = (req, res) => {
  res.redirect(
    `${process.env.FRONTEND_URL}/auth/callback?error=authentication_failed`
  );
};

// @desc    Get user's Google profile and permissions
// @route   GET /api/auth/google/profile
// @access  Private
exports.getGoogleProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("+googleTokens.scope");

    if (!user.googleId) {
      return res.status(400).json({
        success: false,
        message: "User is not connected to Google",
      });
    }

    const gmailProfile = await googleApiService.getGmailProfile(req.user.id);

    res.status(200).json({
      success: true,
      data: {
        googleId: user.googleId,
        gmailProfile,
        permissions: user.googleTokens.scope,
        connectedAt: user.updatedAt,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching Google profile",
      error: error.message,
    });
  }
};

// @desc    Disconnect Google account
// @route   DELETE /api/auth/google/disconnect
// @access  Private
exports.disconnectGoogle = async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        $unset: {
          googleId: 1,
          googleTokens: 1,
          profilePicture: 1,
        },
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Google account disconnected successfully",
      data: { user },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error disconnecting Google account",
      error: error.message,
    });
  }
};
