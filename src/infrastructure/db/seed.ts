import "dotenv/config";
import { prismaClient } from "./prisma.client.js";

const seeds = [
  {
    title: "Design system architecture",
    description: "Define the overall architecture including layers, dependencies, and tech stack.",
    status: "COMPLETED" as const,
    priority: "HIGH" as const,
    dueDate: new Date("2024-05-01"),
  },
  {
    title: "Set up CI/CD pipeline",
    description: "Configure GitHub Actions for lint, test, and build on every pull request.",
    status: "COMPLETED" as const,
    priority: "HIGH" as const,
    dueDate: new Date("2024-05-10"),
  },
  {
    title: "Implement task REST API",
    description: "CRUD endpoints for tasks with filtering, pagination, and soft-delete support.",
    status: "IN_PROGRESS" as const,
    priority: "URGENT" as const,
    dueDate: new Date("2024-06-15"),
  },
  {
    title: "Write unit tests for TaskService",
    description: "Cover all business rules: validation, status transitions, and error handling.",
    status: "IN_PROGRESS" as const,
    priority: "HIGH" as const,
    dueDate: new Date("2024-06-20"),
  },
  {
    title: "Add request validation middleware",
    description: "Use Zod schemas to validate incoming request bodies and query parameters.",
    status: "PENDING" as const,
    priority: "MEDIUM" as const,
    dueDate: new Date("2024-07-01"),
  },
  {
    title: "Integrate authentication",
    description: "Protect all task endpoints with JWT-based authentication.",
    status: "PENDING" as const,
    priority: "HIGH" as const,
    dueDate: new Date("2024-07-15"),
  },
  {
    title: "Add pagination to list endpoint",
    description: "Support both cursor-based and offset-based pagination strategies.",
    status: "PENDING" as const,
    priority: "MEDIUM" as const,
    dueDate: null,
  },
  {
    title: "Write API documentation",
    description: "Generate OpenAPI/Swagger docs from route definitions.",
    status: "PENDING" as const,
    priority: "LOW" as const,
    dueDate: null,
  },
  {
    title: "Performance audit",
    description: "Profile slow queries and add missing database indexes.",
    status: "PENDING" as const,
    priority: "LOW" as const,
    dueDate: null,
  },
  {
    title: "Deprecated spike: GraphQL layer",
    description: "Exploration spike — decided to keep REST only.",
    status: "CANCELLED" as const,
    priority: "LOW" as const,
    dueDate: null,
  },
];

async function main(): Promise<void> {
  console.log("Seeding database...");

  await prismaClient.task.deleteMany();

  for (const seed of seeds) {
    await prismaClient.task.create({ data: seed });
  }

  console.log(`Seeded ${seeds.length} tasks.`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(() => prismaClient.$disconnect());
