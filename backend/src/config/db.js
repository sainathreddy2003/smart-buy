import mongoose from "mongoose";
import { env } from "./env.js";

export async function connectDB() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.mongoUri);
  console.log(`[db] connected -> ${mongoose.connection.name}`);

  mongoose.connection.on("error", (err) => {
    console.error("[db] connection error:", err.message);
  });
}
