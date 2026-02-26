import { HttpException, HttpStatus } from '@nestjs/common';

export class TooManyRequestsException extends HttpException {
  constructor(message?: string) {
    const msg = message || 'Too many requests';
    super(msg, HttpStatus.TOO_MANY_REQUESTS);
  }
}
