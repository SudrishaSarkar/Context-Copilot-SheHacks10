import mongoose from "mongoose";

// Get connection string from env, with fallback
let MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/context_copilot";

// If connection string doesn't have a database name, add it
if (MONGODB_URI.includes("mongodb+srv://") || MONGODB_URI.includes("mongodb://")) {
  // Check if database name is already in the URI
  if (!MONGODB_URI.match(/\/[^/?]+(\?|$)/)) {
    // No database name found, add it
    const separator = MONGODB_URI.includes("?") ? "&" : "?";
    const dbName = process.env.MONGODB_DB_NAME || "context_copilot";
    MONGODB_URI = MONGODB_URI.replace(/\?/, `/${dbName}?`).replace(/\?$/, `/${dbName}`);
    if (!MONGODB_URI.includes(dbName)) {
      MONGODB_URI = MONGODB_URI.replace(/(mongodb\+srv?:\/\/[^/]+)(\/[^?]*)?(\?|$)/, `$1/${dbName}$3`);
    }
  }
}

export async function connectDB(): Promise<void> {
  try {
    // Log connection attempt (hide credentials)
    const logUri = MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, "//$1:***@");
    console.log("🔌 Attempting to connect to MongoDB:", logUri);
    
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Connected to MongoDB successfully");
  } catch (error: any) {
    console.error("❌ MongoDB connection error:", error.message);
    
    // Provide helpful error messages
    if (error.message.includes("authentication failed") || error.message.includes("bad auth")) {
      console.error("\n💡 AUTHENTICATION ERROR TIPS:");
      console.error("   1. Check your username and password in the connection string");
      console.error("   2. If your password contains special characters, URL-encode them:");
      console.error("      - < becomes %3C");
      console.error("      - > becomes %3E");
      console.error("      - @ becomes %40");
      console.error("      - # becomes %23");
      console.error("      - / becomes %2F");
      console.error("      - : becomes %3A");
      console.error("   3. Make sure your MongoDB user has read/write permissions");
      console.error("   4. Check if your IP is whitelisted in MongoDB Atlas (if using Atlas)");
    }
    
    throw error;
  }
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}
