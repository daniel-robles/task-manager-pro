export type UUID = string;

export type TaskStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface Task {
  id: UUID;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface CreateTaskInput {
  title: string;
  description?: string | null | undefined;
  status?: TaskStatus | undefined;
  priority?: Priority | undefined;
  dueDate?: Date | null | undefined;
}

export interface UpdateTaskInput {
  id: UUID;
  title?: string | undefined;
  description?: string | null | undefined;
  status?: TaskStatus | undefined;
  priority?: Priority | undefined;
  dueDate?: Date | null | undefined;
}

export interface TaskFilters {
  /**
   * When omitted, repositories should default to excluding soft-deleted rows.
   * Set to true to include deleted tasks in results.
   */
  includeDeleted?: boolean;
  /**
   * When true, repositories should return only soft-deleted rows.
   */
  onlyDeleted?: boolean;
  status?: TaskStatus;
  priority?: Priority;
  /**
   * Case-insensitive search over title/description (implementation-defined).
   */
  query?: string;
  dueFrom?: Date;
  dueTo?: Date;
  createdFrom?: Date;
  createdTo?: Date;
}

export interface PageRequest {
  /**
   * Maximum items to return (repository may clamp to an upper bound).
   */
  limit: number;
  /**
   * Opaque cursor returned by a previous call, if cursor-based pagination is used.
   */
  cursor?: string;
  /**
   * Offset-based pagination support (prefer cursor if available).
   */
  offset?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  /**
   * Opaque cursor for the next page, if any (cursor-based pagination).
   */
  nextCursor?: string | null;
  /**
   * Total count, if the repository can provide it efficiently.
   */
  total?: number;
}

/**
 * Domain port for task persistence.
 *
 * Infrastructure (e.g. Prisma/SQLite) must implement this interface.
 * Domain/Application code depends only on this abstraction (DIP).
 */
export interface ITaskRepository {
  create(input: CreateTaskInput): Promise<Task>;
  update(input: UpdateTaskInput): Promise<Task>;

  getById(id: UUID, options?: { includeDeleted?: boolean }): Promise<Task | null>;

  list(filters: TaskFilters, page: PageRequest): Promise<PaginatedResult<Task>>;

  /**
   * Soft delete: sets deletedAt.
   */
  softDelete(id: UUID): Promise<void>;
  /**
   * Restore: clears deletedAt.
   */
  restore(id: UUID): Promise<void>;
}

