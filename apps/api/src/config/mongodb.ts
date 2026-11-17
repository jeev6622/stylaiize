import mongoose from "mongoose";
import { env } from "./env";
import { isMongoConfigured } from "./features";
import { logError, logWarn } from "@/utils/logger";

export interface MongoStatus {
  connected: boolean;
  demoMode: boolean;
  uri: string | null;
}

let status: MongoStatus = { connected: false, demoMode: true, uri: null };

export async function connectToDatabase(): Promise<MongoStatus> {
  if (!isMongoConfigured) {
    if (env.NODE_ENV === "production" && !env.ALLOW_DEMO_MODE) {
      throw new Error(
        "MONGODB_URI is required in production. In-memory demo mode is disabled unless ALLOW_DEMO_MODE=true.",
      );
    }
    logWarn("MONGODB_URI not set - running in in-memory demo mode.");
    status = { connected: false, demoMode: true, uri: null };
    return status;
  }

  try {
    mongoose.set("strictQuery", true);
    await mongoose.connect(env.MONGODB_URI, {
      dbName: env.MONGODB_DB_NAME,
      serverSelectionTimeoutMS: 10000,
    });
    status = {
      connected: mongoose.connection.readyState === 1,
      demoMode: false,
      uri: redact(env.MONGODB_URI),
    };
    mongoose.connection.on("disconnected", () => {
      status.connected = false;
    });
    mongoose.connection.on("reconnected", () => {
      status.connected = true;
    });
    return status;
  } catch (err) {
    if (env.NODE_ENV === "production" && !env.ALLOW_DEMO_MODE) {
      logError("MongoDB connection failed in production - refusing to degrade to demo mode.", err);
      throw err;
    }
    logError("MongoDB connection failed, falling back to demo mode.", err);
    status = { connected: false, demoMode: true, uri: redact(env.MONGODB_URI) };
    return status;
  }
}

export function getDatabaseStatus(): MongoStatus {
  return status;
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

function redact(uri: string): string {
  return uri.replace(/:\/\/[^@]+@/, "://***:***@");
}
