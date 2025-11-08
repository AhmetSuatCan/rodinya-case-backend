import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Check if response has already been sent
    if (response.headersSent) {
      this.logger.error(
        `Cannot send response - headers already sent for ${request.method} ${request.url}`,
      );
      return;
    }

    let status: number;
    let message: string;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message = typeof exceptionResponse === 'string' 
        ? exceptionResponse 
        : (exceptionResponse as any)?.message || 'An error occurred';
    } else {
      // Handle non-HTTP exceptions (like database errors, etc.)
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      
      // Safely extract error message without circular references
      if (exception instanceof Error) {
        message = exception.message;
        this.logger.error(
          `Unhandled exception: ${exception.message}`,
          exception.stack,
        );
      } else {
        message = 'Internal server error';
        this.logger.error(
          `Unknown exception type: ${typeof exception}`,
          String(exception),
        );
      }
    }

    // Create a clean response object without circular references
    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message,
    };

    // Safely log the error without JSON.stringify to avoid circular reference issues
    this.logger.error(
      `HTTP ${status} Error: ${request.method} ${request.url} - ${message}`,
    );

    try {
      response.status(status).json(errorResponse);
    } catch (responseError) {
      this.logger.error(
        `Failed to send error response: ${responseError.message}`,
      );
    }
  }
}
