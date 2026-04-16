/**
 * Unit tests for TaskService.
 *
 * All repository calls are mocked — no real database is involved.
 * The tests document the business rules enforced by the service layer
 * so that the underlying infrastructure can be swapped freely.
 */

import { describe, it, expect, beforeEach } from "@jest/globals";
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
import { TaskService } from "./task.service.js";

// ---------------------------------------------------------------------------
// Repository type used by TaskService
// ---------------------------------------------------------------------------

/**
 * TaskService needs countByStatus in addition to the base ITaskRepository
 * contract so it can implement getStatusSummary without hitting Prisma APIs
 * directly.
 */
interface TaskServiceRepository extends ITaskRepository {
  countByStatus(options?: {
    includeDeleted?: boolean;
  }): Promise<Record<TaskStatus, number>>;
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const FIXED_ID: UUID = "550e8400-e29b-41d4-a716-446655440000";
const FIXED_NOW = new Date("2024-06-01T12:00:00.000Z");

/** Builds a complete Task, merging in any field overrides. */
function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: FIXED_ID,
    title: "Test Task",
    description: null,
    status: "PENDING",
    priority: "MEDIUM",
    dueDate: null,
    createdAt: FIXED_NOW,
    updatedAt: FIXED_NOW,
    deletedAt: null,
    ...overrides,
  };
}

const EMPTY_PAGE: PaginatedResult<Task> = {
  items: [],
  total: 0,
  nextCursor: null,
};

const DEFAULT_PAGE: PageRequest = { limit: 20 };

/** A date safely in the past (yesterday at noon UTC). */
function yesterday(): Date {
  return new Date(Date.now() - 86_400_000);
}

/** A date safely in the future (tomorrow at noon UTC). */
function tomorrow(): Date {
  return new Date(Date.now() + 86_400_000);
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("TaskService", () => {
  let repo: jest.Mocked<TaskServiceRepository>;
  let service: TaskService;

  beforeEach(() => {
    repo = {
      create: jest.fn<Promise<Task>, [CreateTaskInput]>(),
      update: jest.fn<Promise<Task>, [UpdateTaskInput]>(),
      getById: jest.fn<
        Promise<Task | null>,
        [UUID, ({ includeDeleted?: boolean } | undefined)?]
      >(),
      list: jest.fn<Promise<PaginatedResult<Task>>, [TaskFilters, PageRequest]>(),
      softDelete: jest.fn<Promise<void>, [UUID]>(),
      restore: jest.fn<Promise<void>, [UUID]>(),
      countByStatus: jest.fn<
        Promise<Record<TaskStatus, number>>,
        [({ includeDeleted?: boolean } | undefined)?]
      >(),
    };

    service = new TaskService(repo);
  });

  // -------------------------------------------------------------------------
  // listTasks
  // -------------------------------------------------------------------------

  describe("listTasks", () => {
    it("delegates to repo.list with the provided filters and page request", async () => {
      const task = makeTask();
      const result: PaginatedResult<Task> = {
        items: [task],
        total: 1,
        nextCursor: null,
      };
      repo.list.mockResolvedValue(result);

      const filters: TaskFilters = { status: "PENDING", priority: "HIGH" };
      const page: PageRequest = { limit: 10 };

      const outcome = await service.listTasks(filters, page);

      expect(repo.list).toHaveBeenCalledWith(filters, page);
      expect(outcome).toBe(result);
    });

    it("returns the paginated result as-is without reshaping", async () => {
      const result: PaginatedResult<Task> = {
        items: [makeTask(), makeTask({ id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" })],
        total: 2,
        nextCursor: "cursor-abc",
      };
      repo.list.mockResolvedValue(result);

      const outcome = await service.listTasks({}, DEFAULT_PAGE);

      expect(outcome.total).toBe(2);
      expect(outcome.nextCursor).toBe("cursor-abc");
      expect(outcome.items).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // getTask
  // -------------------------------------------------------------------------

  describe("getTask", () => {
    it("returns the task when the repository finds it", async () => {
      const task = makeTask();
      repo.getById.mockResolvedValue(task);

      const result = await service.getTask(FIXED_ID);

      expect(repo.getById).toHaveBeenCalledWith(FIXED_ID);
      expect(result).toBe(task);
    });

    it("throws NotFoundError when the repository returns null", async () => {
      repo.getById.mockResolvedValue(null);

      await expect(service.getTask(FIXED_ID)).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError with a descriptive message", async () => {
      repo.getById.mockResolvedValue(null);

      await expect(service.getTask(FIXED_ID)).rejects.toThrow(/task/i);
    });
  });

  // -------------------------------------------------------------------------
  // createTask
  // -------------------------------------------------------------------------

  describe("createTask", () => {
    it("creates and returns the task for valid input", async () => {
      const task = makeTask();
      repo.create.mockResolvedValue(task);

      const input: CreateTaskInput = { title: "Test Task" };
      const result = await service.createTask(input);

      expect(repo.create).toHaveBeenCalledWith(input);
      expect(result).toBe(task);
    });

    it("accepts a dueDate in the future", async () => {
      const task = makeTask({ dueDate: tomorrow() });
      repo.create.mockResolvedValue(task);

      await expect(
        service.createTask({ title: "Future task", dueDate: tomorrow() }),
      ).resolves.toBe(task);
    });

    it("throws ValidationError when dueDate is in the past", async () => {
      await expect(
        service.createTask({ title: "Overdue task", dueDate: yesterday() }),
      ).rejects.toThrow(ValidationError);

      // Repository must not be called when input is invalid.
      expect(repo.create).not.toHaveBeenCalled();
    });

    it("throws ValidationError with a message that mentions dueDate", async () => {
      await expect(
        service.createTask({ title: "Bad date", dueDate: yesterday() }),
      ).rejects.toThrow(/due/i);
    });

    it("creates without dueDate when it is omitted", async () => {
      const task = makeTask();
      repo.create.mockResolvedValue(task);

      await service.createTask({ title: "No due date" });

      expect(repo.create).toHaveBeenCalledWith(
        expect.not.objectContaining({ dueDate: expect.anything() }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // updateTask
  // -------------------------------------------------------------------------

  describe("updateTask", () => {
    it("fetches the current task then delegates to repo.update", async () => {
      const existing = makeTask();
      const updated = makeTask({ title: "Updated Title" });
      repo.getById.mockResolvedValue(existing);
      repo.update.mockResolvedValue(updated);

      const result = await service.updateTask({ id: FIXED_ID, title: "Updated Title" });

      expect(repo.getById).toHaveBeenCalledWith(FIXED_ID);
      expect(repo.update).toHaveBeenCalledWith(
        expect.objectContaining({ id: FIXED_ID, title: "Updated Title" }),
      );
      expect(result).toBe(updated);
    });

    it("throws NotFoundError when the task does not exist", async () => {
      repo.getById.mockResolvedValue(null);

      await expect(
        service.updateTask({ id: FIXED_ID, title: "Ghost update" }),
      ).rejects.toThrow(NotFoundError);

      expect(repo.update).not.toHaveBeenCalled();
    });

    it("throws ValidationError when the task is CANCELLED (terminal state guard)", async () => {
      repo.getById.mockResolvedValue(makeTask({ status: "CANCELLED" }));

      await expect(
        service.updateTask({ id: FIXED_ID, title: "Ignored" }),
      ).rejects.toThrow(ValidationError);

      expect(repo.update).not.toHaveBeenCalled();
    });

    it("throws ValidationError with a message mentioning 'cancelled'", async () => {
      repo.getById.mockResolvedValue(makeTask({ status: "CANCELLED" }));

      await expect(
        service.updateTask({ id: FIXED_ID, status: "PENDING" }),
      ).rejects.toThrow(/cancel/i);
    });

    it("throws ValidationError for the invalid transition COMPLETED → IN_PROGRESS", async () => {
      // A completed task cannot jump back to in-progress; it must be re-opened
      // to PENDING first.
      repo.getById.mockResolvedValue(makeTask({ status: "COMPLETED" }));

      await expect(
        service.updateTask({ id: FIXED_ID, status: "IN_PROGRESS" }),
      ).rejects.toThrow(ValidationError);

      expect(repo.update).not.toHaveBeenCalled();
    });

    it("throws ValidationError for the invalid transition PENDING → COMPLETED", async () => {
      // A task must pass through IN_PROGRESS before it can be marked completed.
      repo.getById.mockResolvedValue(makeTask({ status: "PENDING" }));

      await expect(
        service.updateTask({ id: FIXED_ID, status: "COMPLETED" }),
      ).rejects.toThrow(ValidationError);

      expect(repo.update).not.toHaveBeenCalled();
    });

    it("allows valid transition PENDING → IN_PROGRESS", async () => {
      repo.getById.mockResolvedValue(makeTask({ status: "PENDING" }));
      repo.update.mockResolvedValue(makeTask({ status: "IN_PROGRESS" }));

      await expect(
        service.updateTask({ id: FIXED_ID, status: "IN_PROGRESS" }),
      ).resolves.toBeDefined();
    });

    it("allows valid transition PENDING → CANCELLED", async () => {
      repo.getById.mockResolvedValue(makeTask({ status: "PENDING" }));
      repo.update.mockResolvedValue(makeTask({ status: "CANCELLED" }));

      await expect(
        service.updateTask({ id: FIXED_ID, status: "CANCELLED" }),
      ).resolves.toBeDefined();
    });

    it("allows valid transition IN_PROGRESS → COMPLETED", async () => {
      repo.getById.mockResolvedValue(makeTask({ status: "IN_PROGRESS" }));
      repo.update.mockResolvedValue(makeTask({ status: "COMPLETED" }));

      await expect(
        service.updateTask({ id: FIXED_ID, status: "COMPLETED" }),
      ).resolves.toBeDefined();
    });

    it("allows valid transition IN_PROGRESS → CANCELLED", async () => {
      repo.getById.mockResolvedValue(makeTask({ status: "IN_PROGRESS" }));
      repo.update.mockResolvedValue(makeTask({ status: "CANCELLED" }));

      await expect(
        service.updateTask({ id: FIXED_ID, status: "CANCELLED" }),
      ).resolves.toBeDefined();
    });

    it("allows valid transition COMPLETED → PENDING (reopen)", async () => {
      repo.getById.mockResolvedValue(makeTask({ status: "COMPLETED" }));
      repo.update.mockResolvedValue(makeTask({ status: "PENDING" }));

      await expect(
        service.updateTask({ id: FIXED_ID, status: "PENDING" }),
      ).resolves.toBeDefined();
    });

    it("does not validate transitions when no status change is requested", async () => {
      // Updating only the title of a COMPLETED task is allowed.
      repo.getById.mockResolvedValue(makeTask({ status: "COMPLETED" }));
      repo.update.mockResolvedValue(makeTask({ status: "COMPLETED", title: "New Title" }));

      await expect(
        service.updateTask({ id: FIXED_ID, title: "New Title" }),
      ).resolves.toBeDefined();

      expect(repo.update).toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // deleteTask
  // -------------------------------------------------------------------------

  describe("deleteTask", () => {
    it("calls repo.softDelete with the given id", async () => {
      repo.softDelete.mockResolvedValue(undefined);

      await service.deleteTask(FIXED_ID);

      expect(repo.softDelete).toHaveBeenCalledWith(FIXED_ID);
      expect(repo.softDelete).toHaveBeenCalledTimes(1);
    });

    it("resolves without a return value on success", async () => {
      repo.softDelete.mockResolvedValue(undefined);

      await expect(service.deleteTask(FIXED_ID)).resolves.toBeUndefined();
    });

    it("propagates NotFoundError thrown by the repository", async () => {
      repo.softDelete.mockRejectedValue(new NotFoundError("Task not found"));

      await expect(service.deleteTask(FIXED_ID)).rejects.toThrow(NotFoundError);
    });

    it("does not swallow unexpected repository errors", async () => {
      const unexpected = new Error("DB connection lost");
      repo.softDelete.mockRejectedValue(unexpected);

      await expect(service.deleteTask(FIXED_ID)).rejects.toThrow("DB connection lost");
    });
  });

  // -------------------------------------------------------------------------
  // filterByStatus
  // -------------------------------------------------------------------------

  describe("filterByStatus", () => {
    it("calls repo.list with the given status in the filters", async () => {
      repo.list.mockResolvedValue(EMPTY_PAGE);

      await service.filterByStatus("IN_PROGRESS");

      expect(repo.list).toHaveBeenCalledWith(
        expect.objectContaining({ status: "IN_PROGRESS" }),
        expect.any(Object),
      );
    });

    it("uses a sensible default page when no page request is provided", async () => {
      repo.list.mockResolvedValue(EMPTY_PAGE);

      await service.filterByStatus("PENDING");

      const [, pageArg] = repo.list.mock.calls[0]!;
      expect(pageArg.limit).toBeGreaterThan(0);
    });

    it("passes a custom page request through to the repository", async () => {
      repo.list.mockResolvedValue(EMPTY_PAGE);
      const page: PageRequest = { limit: 5, offset: 10 };

      await service.filterByStatus("COMPLETED", page);

      expect(repo.list).toHaveBeenCalledWith(
        expect.objectContaining({ status: "COMPLETED" }),
        page,
      );
    });

    it("returns the paginated result from the repository", async () => {
      const task = makeTask({ status: "IN_PROGRESS" });
      const result: PaginatedResult<Task> = {
        items: [task],
        total: 1,
        nextCursor: null,
      };
      repo.list.mockResolvedValue(result);

      const outcome = await service.filterByStatus("IN_PROGRESS");

      expect(outcome).toBe(result);
    });

    it("does not leak other filter keys when called with only a status", async () => {
      repo.list.mockResolvedValue(EMPTY_PAGE);

      await service.filterByStatus("CANCELLED");

      const [filtersArg] = repo.list.mock.calls[0]!;
      // Only status should be set; no accidental query, priority, etc.
      expect(filtersArg.status).toBe("CANCELLED");
      expect(filtersArg.priority).toBeUndefined();
      expect(filtersArg.query).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // getStatusSummary
  // -------------------------------------------------------------------------

  describe("getStatusSummary", () => {
    it("returns the per-status counts from the repository", async () => {
      const summary: Record<TaskStatus, number> = {
        PENDING: 3,
        IN_PROGRESS: 2,
        COMPLETED: 5,
        CANCELLED: 1,
      };
      repo.countByStatus.mockResolvedValue(summary);

      const result = await service.getStatusSummary();

      expect(repo.countByStatus).toHaveBeenCalled();
      expect(result).toEqual(summary);
    });

    it("returns zeros for all statuses when there are no tasks", async () => {
      const empty: Record<TaskStatus, number> = {
        PENDING: 0,
        IN_PROGRESS: 0,
        COMPLETED: 0,
        CANCELLED: 0,
      };
      repo.countByStatus.mockResolvedValue(empty);

      const result = await service.getStatusSummary();

      expect(result.PENDING).toBe(0);
      expect(result.IN_PROGRESS).toBe(0);
      expect(result.COMPLETED).toBe(0);
      expect(result.CANCELLED).toBe(0);
    });

    it("propagates errors thrown by the repository", async () => {
      repo.countByStatus.mockRejectedValue(new Error("groupBy failed"));

      await expect(service.getStatusSummary()).rejects.toThrow("groupBy failed");
    });
  });
});
