const axios = require("axios");

async function testConnection() {
  console.log("🔍 Testing backend connection...\n");

  const backends = [
    "http://localhost:5000",
    "http://localhost:5001",
    "http://localhost:5002",
    "http://127.0.0.1:5000",
    "http://127.0.0.1:5001",
    "http://127.0.0.1:5002",
  ];

  for (const url of backends) {
    try {
      console.log(`Testing ${url}/health ...`);
      const response = await axios.get(`${url}/health`, { timeout: 2000 });
      console.log(`✅ SUCCESS: Backend found at ${url}`);
      console.log(`   Response:`, response.data);
      console.log(`\n🎉 Your backend is running at: ${url}`);
      console.log(`📝 Update your frontend .env file:`);
      console.log(`   REACT_APP_API_URL=${url}\n`);
      return;
    } catch (error) {
      console.log(`❌ Failed: ${error.message}`);
    }
  }

  console.log("\n😞 No backend server found!");
  console.log("\nTroubleshooting steps:");
  console.log(
    "1. Make sure your backend is running: cd backend && npm run dev"
  );
  console.log("2. Check if MongoDB is running or accessible");
  console.log("3. Check your backend .env file has correct PORT setting");
  console.log("4. Check for any error messages in the backend console");
}

// Also test MongoDB connection
async function testMongoDB() {
  console.log("\n🔍 Testing MongoDB connection...\n");

  try {
    const mongoose = require("mongoose");
    const uri =
      process.env.MONGODB_URI || "mongodb://localhost:27017/linkedin-chat";

    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
    });

    console.log("✅ MongoDB connection successful!");
    await mongoose.connection.close();
  } catch (error) {
    console.log("❌ MongoDB connection failed:", error.message);
    console.log("\nPossible solutions:");
    console.log("1. Start MongoDB locally: mongod");
    console.log("2. Check MongoDB Atlas connection string");
    console.log("3. Whitelist your IP in MongoDB Atlas");
  }
}

// Run tests
console.log("LinkedIn Chat Backend Connection Tester");
console.log("======================================\n");

testConnection().then(() => testMongoDB());
