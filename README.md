# TaskMaster Pro

A RESTful task management API built with **Express 5**, **Prisma**, **SQLite**, and **TypeScript**, following Clean Architecture principles.

## Tech Stack

- **Runtime**: Node.js with TypeScript (`tsx`)
- **Framework**: Express 5
- **ORM**: Prisma with SQLite (via `better-sqlite3`)
- **Validation**: Zod
- **Testing**: Jest + Supertest
- **Security**: Helmet, CORS

## Project Structure

```
src/
├── domain/              # Entities, interfaces, value objects (no framework deps)
│   └── task.entity.ts
├── application/         # Use-case orchestration, service tests
│   └── task.service.ts
├── infrastructure/
│   ├── db/              # Prisma client, repository implementation, seed
│   └── http/            # Express router, error middleware
├── shared/              # Validators (Zod), error types, response helpers
├── app.ts               # Express app factory
└── index.ts             # Entry point, env validation, graceful shutdown
prisma/
└── schema.prisma        # SQLite schema (Task model)
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create a `.env` file in the project root:

```env
NODE_ENV=development
PORT=3000
DATABASE_URL=file:./dev.db
```

### 3. Generate Prisma client and run migrations

```bash
npx prisma generate
npx prisma migrate dev --name init
```

### 4. (Optional) Seed the database

```bash
npm run seed
```

### 5. Start the development server

```bash
npm run dev
```

The server starts at `http://localhost:3000`.

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start with hot-reload via nodemon + tsx |
| `npm test` | Run Jest test suite |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run seed` | Seed the database with sample tasks |

---

## API Reference

Base URL: `http://localhost:3000/api/v1`

### Health Check

```
GET /health
```

Returns `{ "status": "ok", "timestamp": "..." }`.

---

### Tasks

#### List tasks

```
GET /api/v1/tasks
```

Query parameters:

| Param | Type | Description |
|---|---|---|
| `status` | `PENDING` \| `IN_PROGRESS` \| `COMPLETED` \| `CANCELLED` | Filter by status |
| `priority` | `LOW` \| `MEDIUM` \| `HIGH` \| `URGENT` | Filter by priority |
| `search` | string | Case-insensitive search on title/description |
| `limit` | number (1–100, default 20) | Page size |
| `page` | number | Offset-based page number |
| `cursor` | string | Cursor for cursor-based pagination |
| `includeDeleted` | `true` \| `false` | Include soft-deleted tasks |
| `onlyDeleted` | `true` \| `false` | Return only soft-deleted tasks |
| `dueFrom` | ISO 8601 date | Filter tasks due on or after this date |
| `dueTo` | ISO 8601 date | Filter tasks due on or before this date |
| `createdFrom` | ISO 8601 date | Filter tasks created on or after this date |
| `createdTo` | ISO 8601 date | Filter tasks created on or before this date |

---

#### Get task summary (counts by status)

```
GET /api/v1/tasks/summary
```

---

#### Get a single task

```
GET /api/v1/tasks/:id
```

---

#### Create a task

```
POST /api/v1/tasks
Content-Type: application/json
```

Request body:

```json
{
  "title": "Buy groceries",
  "description": "Milk, eggs, bread",
  "priority": "MEDIUM",
  "dueDate": "2026-04-20T00:00:00.000Z"
}
```

| Field | Required | Type | Constraints |
|---|---|---|---|
| `title` | Yes | string | 1–200 chars |
| `description` | No | string \| null | min 1 char if provided |
| `priority` | No | `LOW` \| `MEDIUM` \| `HIGH` \| `URGENT` | defaults to `MEDIUM` |
| `dueDate` | No | ISO 8601 date string \| null | |

Returns `201 Created`.

---

#### Update a task

```
PUT /api/v1/tasks/:id
Content-Type: application/json
```

All fields are optional (partial update):

```json
{
  "title": "Buy groceries (updated)",
  "status": "IN_PROGRESS",
  "priority": "HIGH",
  "dueDate": null
}
```

| Field | Type | Constraints |
|---|---|---|
| `title` | string | 1–200 chars |
| `description` | string \| null | min 1 char if provided |
| `status` | `PENDING` \| `IN_PROGRESS` \| `COMPLETED` \| `CANCELLED` | |
| `priority` | `LOW` \| `MEDIUM` \| `HIGH` \| `URGENT` | |
| `dueDate` | ISO 8601 date string \| null | |

---

#### Delete a task (soft delete)

```
DELETE /api/v1/tasks/:id
```

Sets `deletedAt` on the task. Returns `204 No Content`.

---

## Task Model

```typescript
{
  id:          string    // UUID
  title:       string
  description: string | null
  status:      "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
  priority:    "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  dueDate:     Date | null
  createdAt:   Date
  updatedAt:   Date
  deletedAt:   Date | null  // null = not deleted
}
```

---

## Error Responses

All errors follow a consistent shape:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "title: String must contain at least 1 character(s)"
  }
}
```

| HTTP Status | When |
|---|---|
| 400 | Validation error (bad request body or query params) |
| 404 | Task not found |
| 500 | Unexpected server error |

---

## Running Tests

```bash
npm test
```

Tests use Jest with Supertest for integration-style tests against the application layer.

---

## Prompts Used

This project was built with AI assistance (Cursor + Claude). Below are the key prompts used during development.

### 1. Project scaffolding

```
Create a Node.js + TypeScript REST API for task management using:
- Express 5
- Prisma with SQLite
- Zod for validation
- Clean Architecture (Domain, Application, Infrastructure, Delivery layers)
- Strict TypeScript
- Helmet and CORS middleware
- Morgan for request logging
- Graceful shutdown on SIGTERM/SIGINT
- Environment variable validation with Zod on startup
```

### 2. Task entity and domain model

```
Define the Task domain entity with:
- Fields: id (UUID), title, description, status, priority, dueDate, createdAt, updatedAt, deletedAt
- Status enum: PENDING, IN_PROGRESS, COMPLETED, CANCELLED
- Priority enum: LOW, MEDIUM, HIGH, URGENT
- Soft delete support via deletedAt
- ITaskRepository port interface with: create, update, getById, list, softDelete, restore
- PaginatedResult and PageRequest types supporting both cursor and offset pagination
- TaskFilters interface with: status, priority, query, dueFrom, dueTo, createdFrom, createdTo, includeDeleted, onlyDeleted
```

### 3. Prisma schema

```
Create a Prisma schema for SQLite with a Task model matching the domain entity.
Add database indexes on status, priority, dueDate, and deletedAt fields.
```

### 4. Zod validators

```
Create shared Zod schemas for:
- CreateTaskSchema: title (required, 1-200 chars), description (optional), priority (optional), dueDate (optional ISO date)
- UpdateTaskSchema: all fields optional, adds status field
- UuidSchema for path params
- Handle ISO date strings and null gracefully with preprocess
```

### 5. REST router

```
Create an Express router for /api/v1/tasks with:
- GET / — list with filters and pagination (query param validation with Zod)
- GET /summary — counts by status (registered before /:id to avoid UUID collision)
- GET /:id — fetch single task
- POST / — create task, returns 201
- PUT /:id — update task
- DELETE /:id — soft delete, returns 204
Use safeParse for all validation and forward errors via next() to centralized error middleware.
```

### 6. Centralized error middleware

```
Create Express error middleware that:
- Maps NotFoundError → 404
- Maps ValidationError → 400
- Maps unknown errors → 500
- Never leaks stack traces or internal details to the client
- Returns a consistent { success, error: { code, message } } envelope
```

### 7. Seed script

```
Create a seed script using tsx that inserts sample Task records into the database using the Prisma client.
Cover a variety of statuses, priorities, and due dates.
```

### 8. .cursorrules (coding agent rules)

```
Write a .cursorrules file enforcing:
- Clean Architecture layering and dependency direction
- TypeScript strict mode (no any, no type assertions without proof)
- Zod validation at all external boundaries
- Repository pattern with intention-revealing method names
- RESTful API conventions (nouns, standard status codes)
- Centralized error handling
- JSDoc on public APIs and ports
- No circular dependencies, minimal barrel exports
```
