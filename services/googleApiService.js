const { google } = require("googleapis");
const User = require("../models/User");

class GoogleApiService {
  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
  }

  // Set up OAuth2 client with user tokens
  async setupClient(userId) {
    try {
      const user = await User.findById(userId).select(
        "+googleTokens.accessToken +googleTokens.refreshToken"
      );

      if (!user || !user.googleTokens.accessToken) {
        throw new Error("User not found or no Google tokens available");
      }

      this.oauth2Client.setCredentials({
        access_token: user.googleTokens.accessToken,
        refresh_token: user.googleTokens.refreshToken,
      });

      // Check if token needs refresh
      if (
        user.googleTokens.expiryDate &&
        new Date() > user.googleTokens.expiryDate
      ) {
        await this.refreshToken(userId);
      }

      return this.oauth2Client;
    } catch (error) {
      console.error("Error setting up Google client:", error);
      throw error;
    }
  }

  // Refresh access token
  async refreshToken(userId) {
    try {
      const user = await User.findById(userId).select(
        "+googleTokens.refreshToken"
      );

      this.oauth2Client.setCredentials({
        refresh_token: user.googleTokens.refreshToken,
      });

      const { credentials } = await this.oauth2Client.refreshAccessToken();

      // Update user's tokens
      await User.findByIdAndUpdate(userId, {
        "googleTokens.accessToken": credentials.access_token,
        "googleTokens.expiryDate": new Date(credentials.expiry_date),
      });

      this.oauth2Client.setCredentials(credentials);
      return credentials;
    } catch (error) {
      console.error("Error refreshing token:", error);
      throw error;
    }
  }

  // Gmail API methods
  async getGmailProfile(userId) {
    try {
      await this.setupClient(userId);
      const gmail = google.gmail({ version: "v1", auth: this.oauth2Client });

      const profile = await gmail.users.getProfile({ userId: "me" });
      return profile.data;
    } catch (error) {
      console.error("Error getting Gmail profile:", error);
      throw error;
    }
  }

  async getEmails(userId, query = "", maxResults = 10) {
    try {
      await this.setupClient(userId);
      const gmail = google.gmail({ version: "v1", auth: this.oauth2Client });

      const messages = await gmail.users.messages.list({
        userId: "me",
        q: query,
        maxResults,
      });

      if (!messages.data.messages) {
        return [];
      }

      const emailDetails = await Promise.all(
        messages.data.messages.map(async (message) => {
          const email = await gmail.users.messages.get({
            userId: "me",
            id: message.id,
          });
          return email.data;
        })
      );

      return emailDetails;
    } catch (error) {
      console.error("Error getting emails:", error);
      throw error;
    }
  }

  async sendEmail(userId, to, subject, body, isHtml = false) {
    try {
      await this.setupClient(userId);
      const gmail = google.gmail({ version: "v1", auth: this.oauth2Client });

      const email = [
        `To: ${to}`,
        `Subject: ${subject}`,
        `Content-Type: ${isHtml ? "text/html" : "text/plain"}; charset="UTF-8"`,
        "",
        body,
      ].join("\n");

      const encodedEmail = Buffer.from(email)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");

      const result = await gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: encodedEmail,
        },
      });

      return result.data;
    } catch (error) {
      console.error("Error sending email:", error);
      throw error;
    }
  }

  // Calendar API methods
  async getCalendarEvents(userId, timeMin, timeMax, maxResults = 20) {
    try {
      await this.setupClient(userId);
      const calendar = google.calendar({
        version: "v3",
        auth: this.oauth2Client,
      });

      const events = await calendar.events.list({
        calendarId: "primary",
        timeMin: timeMin || new Date().toISOString(),
        timeMax: timeMax,
        maxResults,
        singleEvents: true,
        orderBy: "startTime",
      });

      return events.data.items || [];
    } catch (error) {
      console.error("Error getting calendar events:", error);
      throw error;
    }
  }

  async createCalendarEvent(userId, eventData) {
    try {
      await this.setupClient(userId);
      const calendar = google.calendar({
        version: "v3",
        auth: this.oauth2Client,
      });

      const event = await calendar.events.insert({
        calendarId: "primary",
        requestBody: eventData,
      });

      return event.data;
    } catch (error) {
      console.error("Error creating calendar event:", error);
      throw error;
    }
  }

  async updateCalendarEvent(userId, eventId, eventData) {
    try {
      await this.setupClient(userId);
      const calendar = google.calendar({
        version: "v3",
        auth: this.oauth2Client,
      });

      const event = await calendar.events.update({
        calendarId: "primary",
        eventId,
        requestBody: eventData,
      });

      return event.data;
    } catch (error) {
      console.error("Error updating calendar event:", error);
      throw error;
    }
  }

  async deleteCalendarEvent(userId, eventId) {
    try {
      await this.setupClient(userId);
      const calendar = google.calendar({
        version: "v3",
        auth: this.oauth2Client,
      });

      await calendar.events.delete({
        calendarId: "primary",
        eventId,
      });

      return { success: true, message: "Event deleted successfully" };
    } catch (error) {
      console.error("Error deleting calendar event:", error);
      throw error;
    }
  }

  // ========================
  // GOOGLE TASKS METHODS
  // ========================

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
      console.error("Error fetching task lists:", error);
      throw error;
    }
  }

  async createTaskList(userId, title) {
    try {
      await this.setupClient(userId);
      const tasks = google.tasks({
        version: "v1",
        auth: this.oauth2Client,
      });

      const response = await tasks.tasklists.insert({
        requestBody: {
          title,
        },
      });

      return response.data;
    } catch (error) {
      console.error("Error creating task list:", error);
      throw error;
    }
  }

  async getTasks(userId, tasklistId = "@default", options = {}) {
    try {
      await this.setupClient(userId);
      const tasks = google.tasks({
        version: "v1",
        auth: this.oauth2Client,
      });

      const queryParams = {
        tasklist: tasklistId,
        maxResults: options.maxResults || 100,
        showCompleted: options.showCompleted !== false,
        showDeleted: options.showDeleted || false,
        showHidden: options.showHidden || false,
      };

      if (options.completedMin) {
        queryParams.completedMin = options.completedMin;
      }
      if (options.completedMax) {
        queryParams.completedMax = options.completedMax;
      }
      if (options.dueMin) {
        queryParams.dueMin = options.dueMin;
      }
      if (options.dueMax) {
        queryParams.dueMax = options.dueMax;
      }
      if (options.updatedMin) {
        queryParams.updatedMin = options.updatedMin;
      }

      const response = await tasks.tasks.list(queryParams);
      return response.data.items || [];
    } catch (error) {
      console.error("Error fetching tasks:", error);
      throw error;
    }
  }

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

      return { success: true, message: "Task deleted successfully" };
    } catch (error) {
      console.error("Error deleting task:", error);
      throw error;
    }
  }

  async moveTask(
    userId,
    taskId,
    parentId,
    previousId,
    tasklistId = "@default"
  ) {
    try {
      await this.setupClient(userId);
      const tasks = google.tasks({
        version: "v1",
        auth: this.oauth2Client,
      });

      const moveParams = {
        tasklist: tasklistId,
        task: taskId,
      };

      if (parentId) {
        moveParams.parent = parentId;
      }
      if (previousId) {
        moveParams.previous = previousId;
      }

      const response = await tasks.tasks.move(moveParams);
      return response.data;
    } catch (error) {
      console.error("Error moving task:", error);
      throw error;
    }
  }

  async clearTaskList(userId, tasklistId) {
    try {
      await this.setupClient(userId);
      const tasks = google.tasks({
        version: "v1",
        auth: this.oauth2Client,
      });

      await tasks.tasks.clear({
        tasklist: tasklistId,
      });

      return { success: true, message: "Task list cleared successfully" };
    } catch (error) {
      console.error("Error clearing task list:", error);
      throw error;
    }
  }
}

module.exports = new GoogleApiService();
