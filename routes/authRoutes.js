const express = require("express");
const passport = require("passport");
const { body } = require("express-validator");
const {
  register,
  login,
  getMe,
  googleSuccess,
  googleFailure,
  getGoogleProfile,
  disconnectGoogle,
} = require("../controllers/authController");
const { protect } = require("../middleware/auth");

const router = express.Router();

// Validation middleware
const registerValidation = [
  body("name")
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Name must be between 2 and 50 characters"),
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long"),
];

const loginValidation = [
  body("email")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email"),
  body("password").notEmpty().withMessage("Password is required"),
];

// Routes
router.post("/register", registerValidation, register);
router.post("/login", loginValidation, login);
router.get("/me", protect, getMe);

// Google OAuth routes
router.get(
  "/google",
  passport.authenticate("google", {
    scope: [
      "profile",
      "email",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/tasks",
      "https://www.googleapis.com/auth/tasks.readonly",
    ],
  })
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    successRedirect: "/api/auth/google/success",
    failureRedirect: "/api/auth/google/failure",
  })
);

router.get("/google/success", googleSuccess);
router.get("/google/failure", googleFailure);

// Protected Google routes
router.get("/google/profile", protect, getGoogleProfile);
router.delete("/google/disconnect", protect, disconnectGoogle);

module.exports = router;
