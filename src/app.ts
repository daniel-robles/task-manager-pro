import express from "express";
import type { Application, Request, Response } from "express";
import helmet from "helmet";
import cors from "cors";
import morgan from "morgan";

import { taskRouter } from "./infrastructure/http/task.router.js";
import {
  notFoundMiddleware,
  errorMiddleware,
} from "./infrastructure/http/error.middleware.js";

export function createApp(): Application {
  const app = express();

  // -------------------------------------------------------------------------
  // Security & CORS
  // -------------------------------------------------------------------------
  app.use(helmet());
  app.use(cors());

  // -------------------------------------------------------------------------
  // Logging — concise in production, verbose in development
  // -------------------------------------------------------------------------
  app.use(morgan(process.env["NODE_ENV"] === "production" ? "combined" : "dev"));

  // -------------------------------------------------------------------------
  // Body parsing
  // -------------------------------------------------------------------------
  app.use(express.json());

  // -------------------------------------------------------------------------
  // Health check — intentionally before the API prefix so it stays
  // lightweight and unauthenticated (no versioning, no error wrapping).
  // -------------------------------------------------------------------------
  app.get("/health", (_req: Request, res: Response): void => {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // -------------------------------------------------------------------------
  // API routes
  // -------------------------------------------------------------------------
  app.use("/api/v1/tasks", taskRouter);

  // -------------------------------------------------------------------------
  // Catch-all and error handling — order is mandatory
  // -------------------------------------------------------------------------
  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
}
