import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import type { TaskFilters } from "../../domain/task.entity.js";
import { NotFoundError, ValidationError } from "../../shared/errors.js";
import {
  CreateTaskSchema,
  UpdateTaskSchema,
  UuidSchema,
} from "../../shared/validators.js";
import { sendSuccess } from "../../shared/api-response.js";
import { PrismaTaskRepository } from "../db/task.repository.js";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Converts a raw query-string value to Date, or undefined if absent/empty. */
const IsoDateQueryParam = z.preprocess((v) => {
  if (v === undefined || v === null || v === "") return undefined;
  if (v instanceof Date) return v;
  if (typeof v === "string" || typeof v === "number") return new Date(v);
  return v;
}, z.date().optional());

/** Coerces the string "true"/"false" to a boolean for query params. */
const BoolQueryParam = z
  .string()
  .optional()
  .transform((v) => {
    if (v === "true") return true;
    if (v === "false") return false;
    return undefined;
  });

// ---------------------------------------------------------------------------
// Route-level Zod schemas
// ---------------------------------------------------------------------------

const ListTasksQuerySchema = z.object({
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  search: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).optional(),
  cursor: z.string().optional(),
  includeDeleted: BoolQueryParam,
  onlyDeleted: BoolQueryParam,
  dueFrom: IsoDateQueryParam,
  dueTo: IsoDateQueryParam,
  createdFrom: IsoDateQueryParam,
  createdTo: IsoDateQueryParam,
});

const IdParamSchema = z.object({
  id: UuidSchema,
});

// ---------------------------------------------------------------------------
// Repository singleton (DI can replace this later)
// ---------------------------------------------------------------------------

const repo = new PrismaTaskRepository();

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
      return `${path}${issue.message}`;
    })
    .join("; ");
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const taskRouter = Router();

/**
 * GET /tasks
 * List tasks with optional filters and pagination.
 *
 * Query params: status, priority, search, limit, page, cursor,
 *               includeDeleted, onlyDeleted, dueFrom, dueTo,
 *               createdFrom, createdTo
 */
taskRouter.get(
  "/",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = ListTasksQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return void next(new ValidationError(formatZodError(parsed.error)));
      }

      const {
        status,
        priority,
        search,
        limit = 20,
        page,
        cursor,
        includeDeleted,
        onlyDeleted,
        dueFrom,
        dueTo,
        createdFrom,
        createdTo,
      } = parsed.data;

      const filters: TaskFilters = {};
      if (status !== undefined) filters.status = status;
      if (priority !== undefined) filters.priority = priority;
      if (search !== undefined) filters.query = search;
      if (includeDeleted !== undefined) filters.includeDeleted = includeDeleted;
      if (onlyDeleted !== undefined) filters.onlyDeleted = onlyDeleted;
      if (dueFrom !== undefined) filters.dueFrom = dueFrom;
      if (dueTo !== undefined) filters.dueTo = dueTo;
      if (createdFrom !== undefined) filters.createdFrom = createdFrom;
      if (createdTo !== undefined) filters.createdTo = createdTo;

      const pageReq = {
        limit,
        ...(cursor !== undefined ? { cursor } : {}),
        ...(cursor === undefined && page !== undefined
          ? { offset: (page - 1) * limit }
          : {}),
      };

      const result = await repo.list(filters, pageReq);

      sendSuccess(res, result.items, {
        total: result.total,
        nextCursor: result.nextCursor ?? null,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /tasks/summary
 * Returns per-status task counts.
 * Must be registered before /:id to avoid "summary" being treated as a UUID.
 */
taskRouter.get(
  "/summary",
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const counts = await repo.countByStatus();
      sendSuccess(res, counts);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /tasks/:id
 * Fetch a single task by UUID.
 */
taskRouter.get(
  "/:id",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = IdParamSchema.safeParse(req.params);
      if (!parsed.success) {
        return void next(new ValidationError(formatZodError(parsed.error)));
      }

      const task = await repo.getById(parsed.data.id);
      if (task === null) {
        return void next(new NotFoundError("Task not found"));
      }

      sendSuccess(res, task);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /tasks
 * Create a new task. Returns 201 on success.
 */
taskRouter.post(
  "/",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = CreateTaskSchema.safeParse(req.body);
      if (!parsed.success) {
        return void next(new ValidationError(formatZodError(parsed.error)));
      }

      const task = await repo.create(parsed.data);
      sendSuccess(res, task, undefined, 201);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PUT /tasks/:id
 * Update an existing task (partial update supported).
 */
taskRouter.put(
  "/:id",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const idParsed = IdParamSchema.safeParse(req.params);
      if (!idParsed.success) {
        return void next(new ValidationError(formatZodError(idParsed.error)));
      }

      const bodyParsed = UpdateTaskSchema.safeParse(req.body);
      if (!bodyParsed.success) {
        return void next(new ValidationError(formatZodError(bodyParsed.error)));
      }

      const task = await repo.update({ id: idParsed.data.id, ...bodyParsed.data });
      sendSuccess(res, task);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * DELETE /tasks/:id
 * Soft-delete a task (sets deletedAt). Returns 204 No Content.
 */
taskRouter.delete(
  "/:id",
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const parsed = IdParamSchema.safeParse(req.params);
      if (!parsed.success) {
        return void next(new ValidationError(formatZodError(parsed.error)));
      }

      await repo.softDelete(parsed.data.id);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  },
);
