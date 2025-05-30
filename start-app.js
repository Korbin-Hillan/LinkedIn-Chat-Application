const { spawn } = require("child_process");
const path = require("path");

console.log("🚀 Starting LinkedIn Chat Application...\n");

// Start backend server
console.log("📦 Starting backend server...");
const backend = spawn("npm", ["run", "dev"], {
  cwd: path.join(__dirname, "backend"),
  stdio: "pipe",
  shell: true,
});

// Handle backend output
backend.stdout.on("data", (data) => {
  console.log(`[Backend] ${data.toString().trim()}`);
});

backend.stderr.on("data", (data) => {
  console.error(`[Backend Error] ${data.toString().trim()}`);
});

// Start frontend after a delay to ensure backend is running
let frontend;
setTimeout(() => {
  console.log("\n📱 Starting frontend...");
  frontend = spawn("npm", ["start"], {
    cwd: path.join(__dirname, "frontend"),
    stdio: "pipe",
    shell: true,
  });

  // Handle frontend output
  frontend.stdout.on("data", (data) => {
    console.log(`[Frontend] ${data.toString().trim()}`);
  });

  frontend.stderr.on("data", (data) => {
    console.error(`[Frontend Error] ${data.toString().trim()}`);
  });

  frontend.on("close", (code) => {
    console.log(`\n📱 Frontend process exited with code ${code}`);
  });
}, 3000);

backend.on("close", (code) => {
  console.log(`\n📦 Backend process exited with code ${code}`);
});

// Graceful shutdown
const shutdown = (signal) => {
  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);

  if (frontend) {
    console.log("📱 Stopping frontend...");
    frontend.kill("SIGTERM");
  }

  console.log("📦 Stopping backend...");
  backend.kill("SIGTERM");

  // Force exit after 5 seconds if processes don't close gracefully
  setTimeout(() => {
    console.log("⚠️  Force closing application...");
    process.exit(0);
  }, 5000);
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// Handle process errors
backend.on("error", (error) => {
  console.error("❌ Backend process error:", error);
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  shutdown("uncaughtException");
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
  shutdown("unhandledRejection");
});
