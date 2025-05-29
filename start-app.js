// save as start-app.js in your project root
const { spawn } = require("child_process");
const path = require("path");

console.log("🚀 Starting LinkedIn Chat Application...\n");

// Start backend
console.log("📦 Starting backend server...");
const backend = spawn("npm", ["run", "dev"], {
  cwd: path.join(__dirname, "backend"),
  shell: true,
  stdio: "pipe",
});

backend.stdout.on("data", (data) => {
  console.log(`[Backend] ${data}`);
});

backend.stderr.on("data", (data) => {
  console.error(`[Backend Error] ${data}`);
});

// Wait for backend to start, then start frontend
setTimeout(() => {
  console.log("\n📱 Starting frontend...");
  const frontend = spawn("npm", ["start"], {
    cwd: path.join(__dirname, "frontend"),
    shell: true,
    stdio: "pipe",
  });

  frontend.stdout.on("data", (data) => {
    console.log(`[Frontend] ${data}`);
  });

  frontend.stderr.on("data", (data) => {
    console.error(`[Frontend Error] ${data}`);
  });
}, 5000);

// Handle exit
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down...");
  backend.kill();
  frontend.kill();
  process.exit();
});
