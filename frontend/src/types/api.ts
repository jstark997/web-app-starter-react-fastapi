export interface ApiErrorResponse {
  message: string;
  errors?: FieldError[];
}

export interface FieldError {
  field: string;
  message: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: FieldError[];
  readonly details: Record<string, unknown>;

  constructor(
    message: string,
    status: number,
    fieldErrors: FieldError[] = [],
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
    this.details = details;
  }
}

export class RateLimitError extends ApiError {
  constructor(message: string = 'Too many requests. Please try again later.') {
    super(message, 429);
    this.name = 'RateLimitError';
  }
}

export interface ApiResponse<T> {
  data: T;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
