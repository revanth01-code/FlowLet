export class AppError extends Error {
    constructor(
        public code: string,
        message: string,
        public statusCode: number,
        public details: Record<string, unknown> = {},
    ) {
        super(message);
        this.name = "AppError";
    }

    toResponse() {
        return {
            error: {
                code: this.code,
                message: this.message,
                details: this.details,
            },
        };
    }
}

export class NotFoundError extends AppError {
    constructor(resource: string) {
        super("NOT_FOUND", `${resource} not found`, 404);
    }
}

export class ConflictError extends AppError {
    constructor(message: string) {
        super("CONFLICT", message, 409);
    }
}

export class UnauthorizedError extends AppError {
    constructor(message: string) {
        super("UNAUTHORIZED", message, 401);
    }
}

export class ValidationError extends AppError {
    constructor(message: string, details: Record<string, unknown> = {}) {
        super("VALIDATION_ERROR", message, 400, details);
    }
}