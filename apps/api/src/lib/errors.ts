export class AppError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Não encontrado') {
    super(404, message);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Dados inválidos', details?: unknown) {
    super(400, message, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflito') {
    super(409, message);
  }
}
