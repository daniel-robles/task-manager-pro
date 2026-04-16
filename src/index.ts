import "dotenv/config";
import { z } from "zod";
import type { Server } from "node:http";
import { prismaClient } from "./infrastructure/db/prisma.client.js";
import { createApp } from "./app.js";

// ---------------------------------------------------------------------------
// Environment validation
// ---------------------------------------------------------------------------

const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL must not be empty")
    .refine(
      (v) => v.startsWith("file:") || v.startsWith("postgresql://") || v.startsWith("mysql://"),
      { message: 'DATABASE_URL must start with "file:", "postgresql://", or "mysql://"' },
    ),
});

function validateEnv() {
  const result = EnvSchema.safeParse(process.env);

  if (!result.success) {
    const lines = result.error.issues.map(
      (issue) => `  ${issue.path.join(".")}: ${issue.message}`,
    );
    console.error("Invalid environment variables:\n" + lines.join("\n"));
    process.exit(1);
  }

  return result.data;
}

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

async function start(): Promise<void> {
  const env = validateEnv();

  // Connect Prisma before accepting traffic so any misconfiguration surfaces
  // immediately rather than on the first request.
  try {
    await prismaClient.$connect();
    console.log("Database connected");
  } catch (err) {
    console.error("Failed to connect to the database:", err);
    process.exit(1);
  }

  const app = createApp();

  const server: Server = app.listen(env.PORT, () => {
    console.log(
      `Server running in ${env.NODE_ENV} mode on http://localhost:${env.PORT}`,
    );
  });

  // -------------------------------------------------------------------------
  // Graceful shutdown
  // -------------------------------------------------------------------------

  let isShuttingDown = false;

  async function shutdown(signal: string): Promise<void> {
    if (isShuttingDown) return;
    isShuttingDown = true;

    console.log(`\n${signal} received — shutting down gracefully`);

    // Stop accepting new connections; wait for in-flight requests to finish.
    server.close(async (closeErr) => {
      if (closeErr) {
        console.error("Error closing HTTP server:", closeErr);
      } else {
        console.log("HTTP server closed");
      }

      try {
        await prismaClient.$disconnect();
        console.log("Database disconnected");
      } catch (disconnectErr) {
        console.error("Error disconnecting from database:", disconnectErr);
      }

      process.exit(closeErr ? 1 : 0);
    });
  }

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

start().catch((err) => {
  console.error("Unexpected startup error:", err);
  process.exit(1);
});
