import { createApp } from "./app.js";
import { connectDB } from "./config/db.js";
import { env } from "./config/env.js";

async function start() {
  await connectDB();
  const app = createApp();

  app.listen(env.port, () => {
    console.log(`[server] SmartBuy AI API listening on http://localhost:${env.port}`);
  });
}

start().catch((err) => {
  console.error("[server] failed to start:", err);
  process.exit(1);
});
