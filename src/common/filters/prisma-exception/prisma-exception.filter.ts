import { ArgumentsHost, Catch, HttpStatus, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Response } from 'express';
import { Prisma } from 'src/generated/prisma/client';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaClientExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(PrismaClientExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const errorMessage = exception.message.replace(/\n/g, '');

    switch (exception.code) {
      case 'P2002': {
        const status = HttpStatus.CONFLICT;
        this.logger.warn(
          `[${exception.code}] Unique constraint failed: ${errorMessage}`,
        );

        response.status(status).json({
          statusCode: status,
          timestamp: new Date().toISOString(),
          path: request.url,
          message: [
            'Conflict: A record with the specified unique constraint already exists.',
          ],
        });
        break;
      }
      case 'P2025': {
        const status = HttpStatus.NOT_FOUND;
        this.logger.warn(
          `[${exception.code}] Record not found: ${errorMessage}`,
        );

        response.status(status).json({
          statusCode: status,
          timestamp: new Date().toISOString(),
          path: request.url,
          message: ['Not found: The requested record does not exist.'],
        });
        break;
      }
      case 'P2023': {
        const status = HttpStatus.BAD_REQUEST;
        this.logger.warn(
          `[${exception.code}] Inconsistent column data: ${errorMessage}`,
        );

        response.status(status).json({
          statusCode: status,
          timestamp: new Date().toISOString(),
          path: request.url,
          message: [
            'Inconsistent column data. Please check your query and data types.',
          ],
          error: 'Bad Request',
        });
        break;
      }

      case 'P2014': {
        const status = HttpStatus.CONFLICT;
        this.logger.warn(
          `[${exception.code}] Relation violation: ${errorMessage}`,
        );

        response.status(status).json({
          statusCode: status,
          timestamp: new Date().toISOString(),
          path: request.url,
          message: [
            'Cannot delete or update a record because it is related to another record.',
          ],
          error: 'Conflict',
        });
        break;
      }
      default:
        super.catch(exception, host);
        break;
    }
  }
}
