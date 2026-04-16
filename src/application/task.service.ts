import { NotFoundError, ValidationError } from "../shared/errors.js";
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
} from "../domain/task.entity.js";

export interface TaskServiceRepository extends ITaskRepository {
  countByStatus(options?: {
    includeDeleted?: boolean;
  }): Promise<Record<TaskStatus, number>>;
}

// Allowed target statuses for each source status.
// CANCELLED is a terminal state and has no valid outbound transitions.
const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  PENDING:     ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED",   "CANCELLED"],
  COMPLETED:   ["PENDING"],
  CANCELLED:   [],
};

export class TaskService {
  constructor(private readonly repo: TaskServiceRepository) {}

  async listTasks(filters: TaskFilters, page: PageRequest): Promise<PaginatedResult<Task>> {
    return this.repo.list(filters, page);
  }

  async getTask(id: UUID): Promise<Task> {
    const task = await this.repo.getById(id);
    if (!task) {
      throw new NotFoundError(`Task not found: ${id}`);
    }
    return task;
  }

  async createTask(input: CreateTaskInput): Promise<Task> {
    if (input.dueDate != null && input.dueDate.getTime() <= Date.now()) {
      throw new ValidationError("dueDate must be a date in the future");
    }
    return this.repo.create(input);
  }

  async updateTask(input: UpdateTaskInput): Promise<Task> {
    const task = await this.repo.getById(input.id);
    if (!task) {
      throw new NotFoundError(`Task not found: ${input.id}`);
    }

    // CANCELLED is a terminal state — no further mutations allowed.
    if (task.status === "CANCELLED") {
      throw new ValidationError("Cannot update a cancelled task");
    }

    // Validate the status transition only when a status change is requested.
    if (input.status != null && input.status !== task.status) {
      const allowed = VALID_TRANSITIONS[task.status];
      if (!allowed.includes(input.status)) {
        throw new ValidationError(
          `Invalid status transition: ${task.status} → ${input.status}`,
        );
      }
    }

    return this.repo.update(input);
  }

  async deleteTask(id: UUID): Promise<void> {
    return this.repo.softDelete(id);
  }

  async filterByStatus(
    status: TaskStatus,
    page: PageRequest = { limit: 20 },
  ): Promise<PaginatedResult<Task>> {
    return this.repo.list({ status }, page);
  }

  async getStatusSummary(): Promise<Record<TaskStatus, number>> {
    return this.repo.countByStatus();
  }
}
