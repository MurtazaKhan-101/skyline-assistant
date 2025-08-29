require("dotenv").config();
const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User");
const connectDB = require("./database");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_REDIRECT_URI,
      accessType: "offline", // ✅ CRITICAL: Forces refresh token
      prompt: "consent", // ✅ CRITICAL: Always asks for consent = always gets refresh token
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
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Ensure database connection is established
        await connectDB();

        console.log("🔑 OAuth tokens received:", {
          accessToken: accessToken
            ? `${accessToken.substring(0, 20)}...`
            : "MISSING",
          refreshToken: refreshToken
            ? `${refreshToken.substring(0, 20)}...`
            : "MISSING",
          refreshTokenFull: refreshToken
            ? "PROVIDED"
            : "NOT PROVIDED BY GOOGLE",
          profileId: profile.id,
          email: profile.emails[0].value,
        });

        console.log("Google OAuth Profile:", {
          id: profile.id,
          email: profile.emails[0].value,
          name: profile.displayName,
        });

        // Check if user already exists with this Google ID
        let user = await User.findOne({ googleId: profile.id });

        if (user) {
          // ✅ FIXED: Preserve existing refresh token if new one not provided
          const tokenData = {
            accessToken,
            refreshToken: refreshToken || user.googleTokens?.refreshToken, // Preserve existing
            accessTokenExpiry: new Date(Date.now() + 3600000), // 1 hour for access token
            expiryDate: new Date(Date.now() + 3600000), // Backward compatibility
            refreshTokenExpiry: null, // Refresh tokens don't have fixed expiry (up to 6 months of inactivity)
            scope: [
              "https://www.googleapis.com/auth/gmail.readonly",
              "https://www.googleapis.com/auth/gmail.send",
              "https://www.googleapis.com/auth/gmail.modify",
              "https://www.googleapis.com/auth/calendar.readonly",
              "https://www.googleapis.com/auth/calendar.events",
              "https://www.googleapis.com/auth/tasks",
              "https://www.googleapis.com/auth/tasks.readonly",
            ],
          };

          // Update existing user's tokens
          user.googleTokens = tokenData;
          user.lastLogin = new Date();
          await user.save();

          console.log(`✅ Updated tokens for existing user: ${user.email}`);
          console.log(
            `🔑 Refresh token status: ${refreshToken ? "NEW" : "PRESERVED"}`
          );
          return done(null, user);
        }

        // Check if user exists with same email
        user = await User.findOne({ email: profile.emails[0].value });

        if (user) {
          // ✅ FIXED: Preserve existing refresh token if new one not provided
          const tokenData = {
            accessToken,
            refreshToken: refreshToken || user.googleTokens?.refreshToken, // Preserve existing
            accessTokenExpiry: new Date(Date.now() + 3600000), // 1 hour for access token
            expiryDate: new Date(Date.now() + 3600000), // Backward compatibility
            refreshTokenExpiry: null, // Refresh tokens don't have fixed expiry (up to 6 months of inactivity)
            scope: [
              "https://www.googleapis.com/auth/gmail.readonly",
              "https://www.googleapis.com/auth/gmail.send",
              "https://www.googleapis.com/auth/gmail.modify",
              "https://www.googleapis.com/auth/calendar.readonly",
              "https://www.googleapis.com/auth/calendar.events",
              "https://www.googleapis.com/auth/tasks",
              "https://www.googleapis.com/auth/tasks.readonly",
            ],
          };

          // Link Google account to existing user
          user.googleId = profile.id;
          user.profilePicture = profile.photos[0]?.value;
          user.googleTokens = tokenData;
          user.lastLogin = new Date();
          await user.save();

          console.log(
            `✅ Linked Google account for existing user: ${user.email}`
          );
          console.log(
            `🔑 Refresh token status: ${refreshToken ? "NEW" : "PRESERVED"}`
          );
          return done(null, user);
        }

        // ✅ FIXED: Create new user with proper token validation
        const tokenData = {
          accessToken,
          refreshToken, // For new users, this should be provided by Google
          accessTokenExpiry: new Date(Date.now() + 3600000), // 1 hour for access token
          expiryDate: new Date(Date.now() + 3600000), // Backward compatibility
          refreshTokenExpiry: null, // Refresh tokens don't have fixed expiry (up to 6 months of inactivity)
          scope: [
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.send",
            "https://www.googleapis.com/auth/gmail.modify",
            "https://www.googleapis.com/auth/calendar.readonly",
            "https://www.googleapis.com/auth/calendar.events",
            "https://www.googleapis.com/auth/tasks",
            "https://www.googleapis.com/auth/tasks.readonly",
          ],
        };

        // Create new user
        user = await User.create({
          googleId: profile.id,
          name: profile.displayName,
          email: profile.emails[0].value,
          profilePicture: profile.photos[0]?.value,
          googleTokens: tokenData,
          lastLogin: new Date(),
        });

        console.log(`✅ Created new user: ${user.email}`);
        console.log(
          `🔑 New user refresh token: ${
            refreshToken
              ? "PROVIDED"
              : "MISSING - May need re-auth with prompt=consent"
          }`
        );

        return done(null, user);
      } catch (error) {
        console.error("Google OAuth Error:", error);
        return done(error, null);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    // Ensure database connection is established
    await connectDB();
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;
