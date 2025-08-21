const googleApiService = require("../services/googleApiService");
const { validationResult } = require("express-validator");

// @desc    Get Gmail profile
// @route   GET /api/gmail/profile
// @access  Private
exports.getProfile = async (req, res) => {
  try {
    const profile = await googleApiService.getGmailProfile(req.user.id);

    res.status(200).json({
      success: true,
      data: { profile },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching Gmail profile",
      error: error.message,
    });
  }
};

// @desc    Get emails
// @route   GET /api/gmail/emails
// @access  Private
exports.getEmails = async (req, res) => {
  try {
    const { query = "", maxResults = 10 } = req.query;

    const emails = await googleApiService.getEmails(
      req.user.id,
      query,
      parseInt(maxResults)
    );

    res.status(200).json({
      success: true,
      count: emails.length,
      data: { emails },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching emails",
      error: error.message,
    });
  }
};

// @desc    Send email
// @route   POST /api/gmail/send
// @access  Private
exports.sendEmail = async (req, res) => {
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

    const { to, subject, body, isHtml = false } = req.body;

    const result = await googleApiService.sendEmail(
      req.user.id,
      to,
      subject,
      body,
      isHtml
    );

    res.status(201).json({
      success: true,
      message: "Email sent successfully",
      data: { result },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error sending email",
      error: error.message,
    });
  }
};

// @desc    Search emails
// @route   GET /api/gmail/search
// @access  Private
exports.searchEmails = async (req, res) => {
  try {
    const { q, maxResults = 20 } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    const emails = await googleApiService.getEmails(
      req.user.id,
      q,
      parseInt(maxResults)
    );

    res.status(200).json({
      success: true,
      query: q,
      count: emails.length,
      data: { emails },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error searching emails",
      error: error.message,
    });
  }
};
