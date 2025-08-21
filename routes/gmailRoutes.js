const express = require("express");
const { body } = require("express-validator");
const {
  getProfile,
  getEmails,
  sendEmail,
  searchEmails,
} = require("../controllers/gmailController");
const { protect } = require("../middleware/auth");

const router = express.Router();

// Email validation middleware
const sendEmailValidation = [
  body("to").isEmail().withMessage("Please provide a valid recipient email"),
  body("subject")
    .trim()
    .isLength({ min: 1, max: 200 })
    .withMessage("Subject is required and must be less than 200 characters"),
  body("body")
    .trim()
    .isLength({ min: 1 })
    .withMessage("Email body is required"),
  body("isHtml")
    .optional()
    .isBoolean()
    .withMessage("isHtml must be a boolean value"),
];

// All routes are protected
router.use(protect);

// Routes
router.get("/profile", getProfile);
router.get("/emails", getEmails);
router.get("/search", searchEmails);
router.post("/send", sendEmailValidation, sendEmail);

module.exports = router;
