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
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const errorResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : { message: 'Internal server error', error: 'Internal Server Error' };

    if (exception instanceof Error) {
      this.logger.error(
        `[${request.method}] ${request.url} - Status: ${status} - Error: ${exception.message}`,
        exception.stack,
      );
    } else {
      this.logger.error(`HTTP Status: ${status} Error: ${JSON.stringify(errorResponse)}`);
    }

    const message =
      typeof errorResponse === 'object' && errorResponse !== null && 'message' in errorResponse
        ? (errorResponse as any).message
        : errorResponse;
        
    const errorType = 
      typeof errorResponse === 'object' && errorResponse !== null && 'error' in errorResponse
        ? (errorResponse as any).error
        : 'Error';

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: Array.isArray(message) ? message : [message],
      error: errorType, 
    });
  }
}