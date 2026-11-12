import { spawn, execSync } from "child_process";
import net from "net";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
};

function logSystem(msg) {
  console.log(`${COLORS.green}${COLORS.bold}[wisebuy]${COLORS.reset} ${msg}`);
}

function logWarn(msg) {
  console.log(`${COLORS.yellow}${COLORS.bold}[wisebuy]${COLORS.reset} ${msg}`);
}

function checkPort(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(800);
    socket.on("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve(false);
    });
    socket.on("error", () => {
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function ensureMongo() {
  const isMongoRunning = await checkPort(27017);
  if (isMongoRunning) {
    logSystem(`MongoDB is already running on port 27017.`);
    return;
  }

  logWarn(`MongoDB is not running on port 27017. Attempting to start via Homebrew...`);
  try {
    execSync("brew services start mongodb/brew/mongodb-community || brew services start mongodb-community", {
      stdio: "ignore",
    });

    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 500));
      if (await checkPort(27017)) {
        logSystem(`MongoDB started successfully on port 27017.`);
        return;
      }
    }
  } catch {
    // If brew services start fails or isn't on mac, continue and let backend show its connection error
  }

  logWarn(
    `Could not auto-start MongoDB. If the backend fails to connect, please ensure MongoDB is running (e.g., brew services start mongodb-community or docker run -p 27017:27017 mongo:7).`
  );
}

function pipePrefixed(stream, prefixColor, prefixText) {
  let buffer = "";
  stream.on("data", (chunk) => {
    buffer += chunk.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop(); // keep partial line for next chunk
    for (const line of lines) {
      if (line.trim().length > 0) {
        console.log(`${prefixColor}${COLORS.bold}[${prefixText}]${COLORS.reset} ${line}`);
      }
    }
  });
  stream.on("end", () => {
    if (buffer.trim().length > 0) {
      console.log(`${prefixColor}${COLORS.bold}[${prefixText}]${COLORS.reset} ${buffer}`);
    }
  });
}

async function main() {
  console.log(`\n${COLORS.cyan}${COLORS.bold}===========================================${COLORS.reset}`);
  console.log(`${COLORS.cyan}${COLORS.bold}   🚀 Starting WiseBuy Services...     ${COLORS.reset}`);
  console.log(`${COLORS.cyan}${COLORS.bold}===========================================${COLORS.reset}\n`);

  await ensureMongo();

  const isWindows = process.platform === "win32";
  const npmCmd = isWindows ? "npm.cmd" : "npm";

  logSystem("Starting Backend API (http://localhost:5050)...");
  const backendProcess = spawn(npmCmd, ["run", "dev"], {
    cwd: path.join(__dirname, "backend"),
    env: { ...process.env, FORCE_COLOR: "true" },
  });

  pipePrefixed(backendProcess.stdout, COLORS.cyan, "backend ");
  pipePrefixed(backendProcess.stderr, COLORS.red, "backend ");

  logSystem("Starting Frontend App (http://localhost:5173)...");
  const frontendProcess = spawn(npmCmd, ["run", "dev"], {
    cwd: path.join(__dirname, "frontend"),
    env: { ...process.env, FORCE_COLOR: "true" },
  });

  pipePrefixed(frontendProcess.stdout, COLORS.magenta, "frontend");
  pipePrefixed(frontendProcess.stderr, COLORS.red, "frontend");

  const cleanup = () => {
    logSystem("Shutting down all services...");
    try {
      backendProcess.kill("SIGINT");
    } catch {}
    try {
      frontendProcess.kill("SIGINT");
    } catch {}
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);
  process.on("exit", () => {
    try {
      backendProcess.kill();
      frontendProcess.kill();
    } catch {}
  });

  backendProcess.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      logWarn(`Backend exited with code ${code}`);
    }
  });

  frontendProcess.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      logWarn(`Frontend exited with code ${code}`);
    }
  });
}

main().catch((err) => {
  console.error("Failed to start services:", err);
  process.exit(1);
});
