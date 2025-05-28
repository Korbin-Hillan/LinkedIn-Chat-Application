const mongoose = require("mongoose");
console.log("Loaded MONGO_URI:", process.env.MONGO_URI);

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      dbName: "linkedin-chat",
    });

    console.log(`MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
// This code connects to a MongoDB database using Mongoose.
// It exports a function `connectDB` that attempts to connect to the database
// using the connection string stored in the environment variable `MONGO_URI`.
// If the connection is successful, it logs the host of the connected database.
// If the connection fails, it logs the error message and exits the process with a failure code (1).
// The database name is specified as 'myDatabase' in the connection options.
