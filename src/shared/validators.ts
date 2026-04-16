import { z } from "zod";

export const UuidSchema = z.string().uuid();

const TaskStatusSchema = z.enum([
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
]);

const PrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);

const OptionalIsoDateSchema = z
  .preprocess((value) => {
    if (value === undefined || value === null || value === "") return undefined;
    if (value instanceof Date) return value;
    if (typeof value === "string" || typeof value === "number") return new Date(value);
    return value;
  }, z.date())
  .optional();

export const CreateTaskSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).optional().nullable(),
  priority: PrioritySchema.optional(),
  dueDate: OptionalIsoDateSchema,
});

export const UpdateTaskSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().min(1).optional().nullable(),
  status: TaskStatusSchema.optional(),
  priority: PrioritySchema.optional(),
  dueDate: OptionalIsoDateSchema,
});

export const TaskFilterSchema = z.object({
  status: TaskStatusSchema.optional(),
  priority: PrioritySchema.optional(),
  search: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

