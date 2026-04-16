import type {
  CreateTaskInput,
  ITaskRepository,
  PageRequest,
  PaginatedResult,
  Task,
  TaskFilters,
  TaskStatus,
  UpdateTaskInput,
  UUID,
} from "../../domain/task.entity.js";
import { NotFoundError } from "../../shared/errors.js";
import { prismaClient } from "./prisma.client.js";

import type { Prisma, Task as PrismaTask } from "../../../generated/prisma/client.js";

function buildTaskWhere(filters: TaskFilters): Prisma.TaskWhereInput {
  const where: Prisma.TaskWhereInput = {};

  const onlyDeleted = filters.onlyDeleted === true;
  const includeDeleted = filters.includeDeleted === true;

  if (onlyDeleted) {
    where.deletedAt = { not: null };
  } else if (!includeDeleted) {
    where.deletedAt = null;
  }

  if (filters.status) where.status = filters.status;
  if (filters.priority) where.priority = filters.priority;

  if (filters.query) {
    where.OR = [
      { title: { contains: filters.query } },
      { description: { contains: filters.query } },
    ];
  }

  if (filters.dueFrom || filters.dueTo) {
    where.dueDate = {
      ...(filters.dueFrom ? { gte: filters.dueFrom } : {}),
      ...(filters.dueTo ? { lte: filters.dueTo } : {}),
    };
  }

  if (filters.createdFrom || filters.createdTo) {
    where.createdAt = {
      ...(filters.createdFrom ? { gte: filters.createdFrom } : {}),
      ...(filters.createdTo ? { lte: filters.createdTo } : {}),
    };
  }

  return where;
}

function toDomainTask(row: PrismaTask): Task {
  // Prisma returns JS Dates for DateTime columns; the shape already matches our domain type.
  return row;
}

export class PrismaTaskRepository implements ITaskRepository {
  async create(input: CreateTaskInput): Promise<Task> {
    const data: Prisma.TaskCreateInput = {
      title: input.title,
      description: input.description ?? null,
      dueDate: input.dueDate ?? null,
    };

    if (input.status !== undefined) data.status = input.status;
    if (input.priority !== undefined) data.priority = input.priority;

    const created = await prismaClient.task.create({
      data,
    });

    return toDomainTask(created);
  }

  async update(input: UpdateTaskInput): Promise<Task> {
    const existing = await prismaClient.task.findFirst({
      where: { id: input.id, deletedAt: null },
    });

    if (!existing) throw new NotFoundError("Task not found");

    const data: Prisma.TaskUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description;
    if (input.status !== undefined) data.status = input.status;
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.dueDate !== undefined) data.dueDate = input.dueDate;

    const updated = await prismaClient.task.update({
      where: { id: input.id },
      data,
    });

    return toDomainTask(updated);
  }

  async getById(
    id: UUID,
    options?: { includeDeleted?: boolean },
  ): Promise<Task | null> {
    const row = await prismaClient.task.findFirst({
      where: {
        id,
        ...(options?.includeDeleted ? {} : { deletedAt: null }),
      },
    });

    return row ? toDomainTask(row) : null;
  }

  async list(filters: TaskFilters, page: PageRequest): Promise<PaginatedResult<Task>> {
    return this.findAll(filters, page);
  }

  async softDelete(id: UUID): Promise<void> {
    const now = new Date();
    const result = await prismaClient.task.updateMany({
      where: { id, deletedAt: null },
      data: { deletedAt: now },
    });

    if (result.count === 0) throw new NotFoundError("Task not found");
  }

  async restore(id: UUID): Promise<void> {
    const result = await prismaClient.task.updateMany({
      where: { id, deletedAt: { not: null } },
      data: { deletedAt: null },
    });

    if (result.count === 0) throw new NotFoundError("Task not found");
  }

  /**
   * Convenience alias (requested): repository query with filters + pagination.
   */
  async findAll(filters: TaskFilters, page: PageRequest): Promise<PaginatedResult<Task>> {
    const where = buildTaskWhere(filters);
    const orderBy: Prisma.TaskOrderByWithRelationInput[] = [
      { createdAt: "desc" },
      { id: "desc" },
    ];

    const take = page.limit;
    const cursor =
      page.cursor !== undefined ? { id: page.cursor } : undefined;
    const skip = cursor ? 1 : page.offset ?? 0;

    const [rows, total] = await prismaClient.$transaction([
      prismaClient.task.findMany({
        where,
        orderBy,
        take,
        skip,
        ...(cursor ? { cursor } : {}),
      }),
      prismaClient.task.count({ where }),
    ]);

    const items = rows.map(toDomainTask);
    const nextCursor = items.length === take ? items[items.length - 1]?.id ?? null : null;

    return { items, total, nextCursor };
  }

  /**
   * Convenience alias (requested): find task by id with soft-delete check.
   */
  async findById(id: UUID, options?: { includeDeleted?: boolean }): Promise<Task | null> {
    return this.getById(id, options);
  }

  async countByStatus(options?: { includeDeleted?: boolean }): Promise<Record<TaskStatus, number>> {
    const where: Prisma.TaskWhereInput =
      options?.includeDeleted ? {} : { deletedAt: null };

    const grouped = await prismaClient.task.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    });

    const result: Record<TaskStatus, number> = {
      PENDING: 0,
      IN_PROGRESS: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };

    for (const row of grouped) {
      // Prisma returns status as string union matching our domain values
      result[row.status as TaskStatus] = row._count._all;
    }

    return result;
  }
}

