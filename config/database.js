const mongoose = require("mongoose");

let isConnected = false;

const connectDB = async () => {
  if (isConnected) {
    console.log("=> Using existing database connection");
    return Promise.resolve();
  }

  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // Connection pooling optimization
      maxPoolSize: process.env.NODE_ENV === "production" ? 10 : 50,
      minPoolSize: process.env.NODE_ENV === "production" ? 1 : 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      // Allow buffering in serverless environments to prevent connection race conditions
      bufferCommands: process.env.VERCEL ? true : false,

      // Performance optimizations
      maxIdleTimeMS: 30000,

      // Replica set optimization (if using Atlas)
      readPreference: "secondaryPreferred",
      retryWrites: true,
      w: "majority",
    });

    isConnected = true;
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Connection event handlers
    mongoose.connection.on("error", (err) => {
      console.error("MongoDB connection error:", err);
      isConnected = false;
    });

    mongoose.connection.on("disconnected", () => {
      console.log("MongoDB disconnected");
      isConnected = false;
    });

    // For serverless, handle connection cleanup
    if (process.env.VERCEL) {
      mongoose.connection.on("connected", () => {
        console.log("MongoDB connected in serverless environment");
      });
    }
  } catch (error) {
    console.error("Database connection error:", error);
    isConnected = false;
    // Don't exit process in serverless environment
    if (!process.env.VERCEL) {
      process.exit(1);
    }
    throw error;
  }
};

module.exports = connectDB;
