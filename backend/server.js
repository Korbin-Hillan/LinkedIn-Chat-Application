require("dotenv").config();

const express = require("express");
const https = require("https");
const socketIo = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const fs = require("fs");
console.log("Loaded MONGO_URI:", process.env.MONGO_URI);

const connectDB = require("./src/config/database");

connectDB();

const app = express();

// Read the local .pem files
const options = {
  key: fs.readFileSync("../key.pem"),
  cert: fs.readFileSync("../cert.pem"),
};

const server = https.createServer(options, app);

server.listen(443, () => {
  console.log("HTTPS server running at https://localhost");
});
