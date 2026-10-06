const mongoose = require("mongoose");

let isConnected = false;

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.log("[DB] MONGODB_URI not provided; using disk store fallback.");
    return false;
  }
  if (isConnected && mongoose.connection.readyState === 1) return true;

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
    });
    isConnected = true;
    console.log("[DB] Connected to MongoDB successfully.");
    return true;
  } catch (err) {
    console.warn("[DB] MongoDB connection failed; falling back to disk store:", err.message);
    isConnected = false;
    return false;
  }
}

function getIsConnected() {
  return isConnected && mongoose.connection.readyState === 1;
}

module.exports = { connectDB, getIsConnected };
