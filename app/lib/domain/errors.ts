export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function badRequest(message: string) {
  return new AppError(400, message, "BAD_REQUEST");
}

export function unauthorized(message = "Không xác định được email người dùng.") {
  return new AppError(401, message, "UNAUTHORIZED");
}

export function forbidden(message = "Bạn không có quyền thực hiện thao tác này.") {
  return new AppError(403, message, "FORBIDDEN");
}

export function notFound(message: string) {
  return new AppError(404, message, "NOT_FOUND");
}

export function conflict(message: string) {
  return new AppError(409, message, "CONFLICT");
}
