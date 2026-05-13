const { spawn } = require("node:child_process");

const isWindows = process.platform === "win32";
const pnpm = isWindows ? "pnpm.cmd" : "pnpm";

const services = [
  "user-service",
  "notify-service",
  "ai-service",
  "chat-service",
  "job-service",
  "auth-service",
  "gateway-service",
];

const baseEnv = {
  ...process.env,
  FRONTEND_URL: process.env.FRONTEND_URL || "https://a-two-red.vercel.app",
  USER_SERVICE_URL: process.env.USER_SERVICE_URL || "http://127.0.0.1:5005/api/users",
  NOTIFY_SERVICE_URL: process.env.NOTIFY_SERVICE_URL || "http://127.0.0.1:5006/api/notify",
  AI_SERVICE_URL: process.env.AI_SERVICE_URL || "http://127.0.0.1:5004/api/ai",
  CHAT_SERVICE_URL: process.env.CHAT_SERVICE_URL || "http://127.0.0.1:5007/api/chat",
  JOB_SERVICE_URL: process.env.JOB_SERVICE_URL || "http://127.0.0.1:5003/api/jobs",
};

const children = services.map((service) => {
  const child = spawn(pnpm, ["--dir", `services/${service}`, "dev"], {
    env: baseEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => {
    process.stdout.write(`[${service}] ${chunk}`);
  });

  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[${service}] ${chunk}`);
  });

  child.on("exit", (code, signal) => {
    if (code !== 0 && signal !== "SIGTERM") {
      console.error(`[${service}] exited with code ${code ?? signal}`);
      shutdown(code || 1);
    }
  });

  return child;
});

function shutdown(code = 0) {
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
