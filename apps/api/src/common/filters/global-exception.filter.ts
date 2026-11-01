import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { DomainError } from '../errors/domain-errors';

/** Converts every thrown error into one consistent JSON shape: { error, message, details? }. */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') return;
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof DomainError) {
      res.status(exception.httpStatus).json({
        error: exception.code,
        message: exception.message,
        details: exception.details,
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse() as string | { message?: string | string[] };
      const raw = typeof body === 'string' ? body : body.message ?? exception.message;
      const message = Array.isArray(raw) ? raw.join(', ') : raw;
      res.status(status).json({
        error: status === 400 ? 'VALIDATION_FAILED' : HttpStatus[status] ?? 'ERROR',
        message,
      });
      return;
    }

    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    res.status(500).json({ error: 'INTERNAL', message: 'Something went wrong on our side' });
  }
}
