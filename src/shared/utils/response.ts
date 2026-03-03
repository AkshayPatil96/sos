import type { Response } from 'express';

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  pagination?: Pagination;
  code?: string;
  errors?: Record<string, string[]>;
}

/**
 * Send a 200 OK success response.
 */
export function sendSuccess<T>(
  res: Response,
  data: T,
  message = 'Success',
  statusCode = 200,
): void {
  const body: ApiResponse<T> = { success: true, message, data };
  res.status(statusCode).json(body);
}

/**
 * Send a 201 Created response.
 */
export function sendCreated<T>(res: Response, data: T, message = 'Created successfully'): void {
  sendSuccess(res, data, message, 201);
}

/**
 * Send a 200 paginated list response.
 */
export function sendPaginated<T>(
  res: Response,
  data: T[],
  pagination: Pagination,
  message = 'Success',
): void {
  const body: ApiResponse<T[]> = { success: true, message, data, pagination };
  res.status(200).json(body);
}

/**
 * Send a 204 No Content response.
 */
export function sendNoContent(res: Response): void {
  res.status(204).send();
}
