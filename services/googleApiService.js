const { google } = require("googleapis");
const User = require("../models/User");

// For Vercel compatibility, handle cache import gracefully
let tokenCache;
try {
  tokenCache = require("../middleware/cache").tokenCache;
} catch (error) {
  // ✅ FIXED: Proper fallback cache implementation
  console.warn("Cache middleware not available, using Map fallback");
  tokenCache = {
    cache: new Map(),
    set: function (key, value, ttl) {
      const expires = ttl ? Date.now() + ttl * 1000 : Date.now() + 3600000; // Default 1 hour
      this.cache.set(key, { value, expires });
    },
    get: function (key) {
      const item = this.cache.get(key);
      if (item && item.expires > Date.now()) {
        return item.value;
      }
      if (item) {
        this.cache.delete(key); // Clean up expired items
      }
      return null;
    },
    del: function (key) {
      this.cache.delete(key);
    },
  };
}

// OAuth client pool to reuse connections
const oauthClientPool = new Map();

class GoogleApiService {
  constructor() {
    this.oauth2Client = null;
  }

  // Get or create OAuth client with connection pooling
  getOAuthClient(userId, tokens) {
    const cacheKey = `oauth_${userId}`;

    if (oauthClientPool.has(cacheKey)) {
      const client = oauthClientPool.get(cacheKey);
      // Update tokens if they've changed
      if (tokens) {
        client.setCredentials(tokens);
      }
      return client;
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    if (tokens) {
      oauth2Client.setCredentials(tokens);
    }

    // Cache the client (limit cache size for memory efficiency)
    if (oauthClientPool.size > 100) {
      const firstKey = oauthClientPool.keys().next().value;
      oauthClientPool.delete(firstKey);
    }
    oauthClientPool.set(cacheKey, oauth2Client);

    // Auto-refresh token handling
    oauth2Client.on("tokens", async (newTokens) => {
      try {
        console.log(`🔄 Auto-refresh triggered for user ${userId}`);

        // ✅ ALWAYS update tokens when received from auto-refresh
        await this.updateUserTokens(userId, newTokens);

        // Update cache with proper structure
        const cacheTokens = {
          access_token: newTokens.access_token,
          refresh_token: newTokens.refresh_token,
          expiry_date: newTokens.expiry_date || Date.now() + 3600000, // 1 hour default
        };

        if (tokenCache && tokenCache.set) {
          tokenCache.set(`tokens_${userId}`, cacheTokens, 3000); // 50 minutes
        }
      } catch (error) {
        console.error("Error handling auto token refresh:", error);
      }
    });

    return oauth2Client;
  }

  // Set up OAuth2 client with user tokens (optimized)
  async setupClient(userId, req = null) {
    try {
      // Try to get tokens from cache first
      let tokens;
      if (tokenCache && tokenCache.get) {
        tokens = tokenCache.get(`tokens_${userId}`);
      }

      if (!tokens) {
        const user = await User.findById(userId)
          .select(
            "+googleTokens.accessToken +googleTokens.refreshToken +googleTokens.accessTokenExpiry +googleTokens.expiryDate"
          )
          .lean(); // Use lean for better performance

        if (!user || !user.googleTokens || !user.googleTokens.accessToken) {
          throw new Error("User not found or no Google tokens available");
        }

        tokens = {
          access_token: user.googleTokens.accessToken,
          refresh_token: user.googleTokens.refreshToken,
          expiry_date:
            user.googleTokens.accessTokenExpiry || user.googleTokens.expiryDate, // Use new field, fallback to old
        };

        // Cache tokens for 50 minutes if cache is available
        if (tokenCache && tokenCache.set) {
          tokenCache.set(`tokens_${userId}`, tokens, 3000); // 50 minutes
        }
      }

      // Get the OAuth client and store it in instance
      this.oauth2Client = this.getOAuthClient(userId, tokens);

      // ✅ FIXED: Better token expiry checking with preemptive refresh
      const now = new Date();
      const expiryDate = new Date(tokens.expiry_date);
      const timeUntilExpiry = expiryDate.getTime() - now.getTime();

      // Refresh if expires within 5 minutes (300,000 ms) to prevent mid-request expiry
      if (timeUntilExpiry < 300000) {
        console.log(
          `🔄 Token expires soon (${Math.round(
            timeUntilExpiry / 1000
          )}s), refreshing...`
        );
        await this.refreshToken(userId, req);
      }

      return this.oauth2Client;
    } catch (error) {
      console.error("Error setting up Google client:", error);
      throw error;
    }
  }

  // Update user tokens in database
  async updateUserTokens(userId, tokens, req = null) {
    try {
      const updateData = {
        "googleTokens.accessToken": tokens.access_token,
        "googleTokens.accessTokenExpiry": new Date(
          Date.now() + (tokens.expires_in || 3600) * 1000
        ),
        // Keep old field for backward compatibility
        "googleTokens.expiryDate": new Date(
          Date.now() + (tokens.expires_in || 3600) * 1000
        ),
      };

      // ✅ CRITICAL FIX: Only update refresh token if a new one is provided
      // This prevents losing the existing refresh token when Google doesn't send one
      if (tokens.refresh_token) {
        updateData["googleTokens.refreshToken"] = tokens.refresh_token;
      }
      // If no refresh_token in response, preserve the existing one!

      await User.findByIdAndUpdate(userId, updateData, { new: true });

      // ✅ NEW: Sync with passport session if available
      await this.syncTokensWithSession(userId, req);

      // Update cache with proper token structure
      const cacheTokens = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expiry_date: Date.now() + (tokens.expires_in || 3600) * 1000,
      };

      if (tokenCache && tokenCache.set) {
        tokenCache.set(`tokens_${userId}`, cacheTokens, 3000); // 50 minutes
      }
    } catch (error) {
      console.error("Error updating user tokens:", error);
      throw error;
    }
  }

  // ✅ NEW: Sync tokens with passport session (if available)
  async syncTokensWithSession(userId, req) {
    try {
      if (
        req &&
        req.user &&
        req.user._id &&
        req.user._id.toString() === userId
      ) {
        // Update session user with fresh tokens from database
        const updatedUser = await User.findById(userId).lean();
        if (updatedUser) {
          req.user = updatedUser;
          console.log(`🔄 Synced session tokens for user: ${req.user.email}`);
        }
      }
    } catch (error) {
      console.warn("Could not sync tokens with session:", error.message);
    }
  }

  // Refresh access token (optimized)
  async refreshToken(userId, req = null) {
    try {
      // Get current user data with refresh token
      const user = await User.findById(userId)
        .select("+googleTokens.refreshToken +googleTokens.accessToken")
        .lean();

      if (!user || !user.googleTokens || !user.googleTokens.refreshToken) {
        throw new Error(
          "No refresh token available - user needs to re-authenticate"
        );
      }

      const oauth2Client = this.getOAuthClient(userId);
      oauth2Client.setCredentials({
        refresh_token: user.googleTokens.refreshToken,
      });

      const { credentials } = await oauth2Client.refreshAccessToken();

      // ✅ PRESERVE existing refresh token if new one not provided
      if (!credentials.refresh_token) {
        credentials.refresh_token = user.googleTokens.refreshToken;
      }

      // ✅ Update user's tokens in database with session sync
      await this.updateUserTokens(userId, credentials, req);

      // ✅ UPDATE instance client with new credentials
      oauth2Client.setCredentials({
        access_token: credentials.access_token,
        refresh_token: credentials.refresh_token,
        expiry_date: credentials.expiry_date,
      });

      this.oauth2Client = oauth2Client;

      console.log(`✅ Token refreshed for user ${userId}`);
      return credentials;
    } catch (error) {
      console.error("Error refreshing token:", error);
      // Clear cached tokens on error
      if (tokenCache && tokenCache.del) {
        tokenCache.del(`tokens_${userId}`);
      }
      throw new Error(
        "Token refresh failed - user may need to re-authenticate"
      );
    }
  }

  // Get task lists with error handling
  async getTaskLists(userId) {
    try {
      await this.setupClient(userId);
      const tasks = google.tasks({
        version: "v1",
        auth: this.oauth2Client,
      });

      const response = await tasks.tasklists.list();
      return response.data.items || [];
    } catch (error) {
      console.error("Error getting task lists:", error);
      throw error;
    }
  }

  // Get Gmail profile
  async getGmailProfile(userId) {
    try {
      await this.setupClient(userId);
      const gmail = google.gmail({
        version: "v1",
        auth: this.oauth2Client,
      });

      const response = await gmail.users.getProfile({ userId: "me" });
      return response.data;
    } catch (error) {
      console.error("Error getting Gmail profile:", error);
      throw error;
    }
  }

  // Get emails with optimized parameters
  async getEmails(userId, query = "", maxResults = 10) {
    try {
      await this.setupClient(userId);
      const gmail = google.gmail({
        version: "v1",
        auth: this.oauth2Client,
      });

      // Get list of messages
      const listResponse = await gmail.users.messages.list({
        userId: "me",
        q: query,
        maxResults: Math.min(maxResults, 50), // Limit for performance
      });

      if (!listResponse.data.messages) {
        return [];
      }

      // Get details for each message (batch processing for efficiency)
      const emailPromises = listResponse.data.messages
        .slice(0, maxResults)
        .map(async (message) => {
          try {
            const emailResponse = await gmail.users.messages.get({
              userId: "me",
              id: message.id,
              format: "full",
            });
            return emailResponse.data;
          } catch (error) {
            console.error(`Error fetching email ${message.id}:`, error);
            return null;
          }
        });

      const emails = await Promise.all(emailPromises);
      return emails.filter((email) => email !== null);
    } catch (error) {
      console.error("Error getting emails:", error);
      throw error;
    }
  }

  // Send email
  async sendEmail(userId, emailData) {
    try {
      await this.setupClient(userId);
      const gmail = google.gmail({
        version: "v1",
        auth: this.oauth2Client,
      });

      // Create email message
      const { to, subject, body, isHtml = false } = emailData;

      const messageParts = [
        `To: ${to}`,
        `Subject: ${subject}`,
        `Content-Type: ${isHtml ? "text/html" : "text/plain"}; charset="UTF-8"`,
        "",
        body,
      ];

      const message = messageParts.join("\n");
      const encodedMessage = Buffer.from(message).toString("base64url");

      const response = await gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: encodedMessage,
        },
      });

      return response.data;
    } catch (error) {
      console.error("Error sending email:", error);
      throw error;
    }
  }

  // Get calendar events
  async getCalendarEvents(userId, options = {}) {
    try {
      await this.setupClient(userId);
      const calendar = google.calendar({
        version: "v3",
        auth: this.oauth2Client,
      });

      const {
        calendarId = "primary",
        timeMin = new Date().toISOString(),
        timeMax,
        maxResults = 10,
        singleEvents = true,
        orderBy = "startTime",
      } = options;

      const response = await calendar.events.list({
        calendarId,
        timeMin,
        timeMax,
        maxResults: Math.min(maxResults, 50), // Limit for performance
        singleEvents,
        orderBy,
      });

      return response.data.items || [];
    } catch (error) {
      console.error("Error getting calendar events:", error);
      throw error;
    }
  }

  // Create calendar event
  async createCalendarEvent(userId, eventData, calendarId = "primary") {
    try {
      await this.setupClient(userId);
      const calendar = google.calendar({
        version: "v3",
        auth: this.oauth2Client,
      });

      const response = await calendar.events.insert({
        calendarId,
        requestBody: eventData,
      });

      return response.data;
    } catch (error) {
      console.error("Error creating calendar event:", error);
      throw error;
    }
  }

  // Update calendar event
  async updateCalendarEvent(
    userId,
    eventId,
    eventData,
    calendarId = "primary"
  ) {
    try {
      await this.setupClient(userId);
      const calendar = google.calendar({
        version: "v3",
        auth: this.oauth2Client,
      });

      const response = await calendar.events.update({
        calendarId,
        eventId,
        requestBody: eventData,
      });

      return response.data;
    } catch (error) {
      console.error("Error updating calendar event:", error);
      throw error;
    }
  }

  // Delete calendar event
  async deleteCalendarEvent(userId, eventId, calendarId = "primary") {
    try {
      await this.setupClient(userId);
      const calendar = google.calendar({
        version: "v3",
        auth: this.oauth2Client,
      });

      await calendar.events.delete({
        calendarId,
        eventId,
      });

      return { success: true };
    } catch (error) {
      console.error("Error deleting calendar event:", error);
      throw error;
    }
  }

  // Create task list
  async createTaskList(userId, title) {
    try {
      await this.setupClient(userId);
      const tasks = google.tasks({
        version: "v1",
        auth: this.oauth2Client,
      });

      const response = await tasks.tasklists.insert({
        requestBody: {
          title: title,
        },
      });

      return response.data;
    } catch (error) {
      console.error("Error creating task list:", error);
      throw error;
    }
  }

  // Get tasks from a task list
  async getTasks(userId, tasklistId = "@default", options = {}) {
    try {
      await this.setupClient(userId);
      const tasks = google.tasks({
        version: "v1",
        auth: this.oauth2Client,
      });

      const {
        maxResults = 100,
        showCompleted = true,
        showDeleted = false,
        showHidden = false,
      } = options;

      const response = await tasks.tasks.list({
        tasklist: tasklistId,
        maxResults: Math.min(maxResults, 100), // Limit for performance
        showCompleted,
        showDeleted,
        showHidden,
      });

      return response.data.items || [];
    } catch (error) {
      console.error("Error getting tasks:", error);
      throw error;
    }
  }

  // Create a new task
  async createTask(userId, taskData, tasklistId = "@default") {
    try {
      await this.setupClient(userId);
      const tasks = google.tasks({
        version: "v1",
        auth: this.oauth2Client,
      });

      const response = await tasks.tasks.insert({
        tasklist: tasklistId,
        requestBody: taskData,
      });

      return response.data;
    } catch (error) {
      console.error("Error creating task:", error);
      throw error;
    }
  }

  // Update an existing task (FIXED - includes task ID in request body)
  async updateTask(userId, taskId, taskData, tasklistId = "@default") {
    try {
      await this.setupClient(userId);
      const tasks = google.tasks({
        version: "v1",
        auth: this.oauth2Client,
      });

      // Include the task ID in the request body as required by Google Tasks API
      const taskDataWithId = {
        id: taskId,
        ...taskData,
      };

      // Use requestBody parameter with task ID included in the body
      const response = await tasks.tasks.update({
        tasklist: tasklistId,
        task: taskId,
        requestBody: taskDataWithId,
      });

      return response.data;
    } catch (error) {
      console.error("Error updating task:", error);
      throw error;
    }
  }

  // Delete a task
  async deleteTask(userId, taskId, tasklistId = "@default") {
    try {
      await this.setupClient(userId);
      const tasks = google.tasks({
        version: "v1",
        auth: this.oauth2Client,
      });

      await tasks.tasks.delete({
        tasklist: tasklistId,
        task: taskId,
      });

      return { success: true };
    } catch (error) {
      console.error("Error deleting task:", error);
      throw error;
    }
  }

  // Move a task
  async moveTask(userId, taskId, options = {}, tasklistId = "@default") {
    try {
      await this.setupClient(userId);
      const tasks = google.tasks({
        version: "v1",
        auth: this.oauth2Client,
      });

      const { parent, previous } = options;

      const response = await tasks.tasks.move({
        tasklist: tasklistId,
        task: taskId,
        parent,
        previous,
      });

      return response.data;
    } catch (error) {
      console.error("Error moving task:", error);
      throw error;
    }
  }

  // Clear completed tasks
  async clearTaskList(userId, tasklistId = "@default") {
    try {
      await this.setupClient(userId);
      const tasks = google.tasks({
        version: "v1",
        auth: this.oauth2Client,
      });

      await tasks.tasks.clear({
        tasklist: tasklistId,
      });

      return { success: true };
    } catch (error) {
      console.error("Error clearing task list:", error);
      throw error;
    }
  }
}

// Export a singleton instance
module.exports = new GoogleApiService();
