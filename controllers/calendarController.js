const googleApiService = require("../services/googleApiService");
const { validationResult } = require("express-validator");

// @desc    Get calendar events
// @route   GET /api/calendar/events
// @access  Private
exports.getEvents = async (req, res) => {
  try {
    const { timeMin, timeMax, maxResults = 20 } = req.query;

    const events = await googleApiService.getCalendarEvents(
      req.user.id,
      timeMin,
      timeMax,
      parseInt(maxResults)
    );

    res.status(200).json({
      success: true,
      count: events.length,
      data: { events },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching calendar events",
      error: error.message,
    });
  }
};

// @desc    Create calendar event
// @route   POST /api/calendar/events
// @access  Private
exports.createEvent = async (req, res) => {
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

    const event = await googleApiService.createCalendarEvent(
      req.user.id,
      req.body
    );

    res.status(201).json({
      success: true,
      message: "Event created successfully",
      data: { event },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating calendar event",
      error: error.message,
    });
  }
};

// @desc    Update calendar event
// @route   PUT /api/calendar/events/:eventId
// @access  Private
exports.updateEvent = async (req, res) => {
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

    const { eventId } = req.params;
    const event = await googleApiService.updateCalendarEvent(
      req.user.id,
      eventId,
      req.body
    );

    res.status(200).json({
      success: true,
      message: "Event updated successfully",
      data: { event },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating calendar event",
      error: error.message,
    });
  }
};

// @desc    Delete calendar event
// @route   DELETE /api/calendar/events/:eventId
// @access  Private
exports.deleteEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const result = await googleApiService.deleteCalendarEvent(
      req.user.id,
      eventId
    );

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting calendar event",
      error: error.message,
    });
  }
};

// @desc    Get today's events
// @route   GET /api/calendar/today
// @access  Private
exports.getTodayEvents = async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const events = await googleApiService.getCalendarEvents(
      req.user.id,
      startOfDay.toISOString(),
      endOfDay.toISOString(),
      50
    );

    res.status(200).json({
      success: true,
      date: today.toDateString(),
      count: events.length,
      data: { events },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching today's events",
      error: error.message,
    });
  }
};

// @desc    Get upcoming events (next 7 days)
// @route   GET /api/calendar/upcoming
// @access  Private
exports.getUpcomingEvents = async (req, res) => {
  try {
    const now = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(now.getDate() + 7);

    const events = await googleApiService.getCalendarEvents(
      req.user.id,
      now.toISOString(),
      nextWeek.toISOString(),
      50
    );

    res.status(200).json({
      success: true,
      period: `${now.toDateString()} to ${nextWeek.toDateString()}`,
      count: events.length,
      data: { events },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching upcoming events",
      error: error.message,
    });
  }
};
