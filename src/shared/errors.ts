export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    // Required when targeting ES5/older transpilation or certain runtimes.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not Found") {
    super(message, 404, true);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation Error") {
    super(message, 400, true);
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict") {
    super(message, 409, true);
  }
}

