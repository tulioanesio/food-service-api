import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { AllExceptionsFilter } from './http-exception.filter';

describe('AllExceptionsFilter', () => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'GET', url: '/test' }),
    }),
  } as unknown as ArgumentsHost;

  beforeEach(() => {
    jest.clearAllMocks();
    status.mockReturnValue({ json });
  });

  it('handles HttpException with object response and array message', () => {
    const filter = new AllExceptionsFilter();
    const exception = new BadRequestException(['field must not be empty']);

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      timestamp: expect.any(String) as string,
      path: '/test',
      message: ['field must not be empty'],
      error: 'Bad Request',
    });
  });

  it('handles HttpException with string response', () => {
    const filter = new AllExceptionsFilter();
    const exception = new HttpException('Forbidden', HttpStatus.FORBIDDEN);

    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.FORBIDDEN,
      timestamp: expect.any(String) as string,
      path: '/test',
      message: ['Forbidden'],
      error: 'Error',
    });
  });

  it('handles generic Error as 500 Internal Server Error', () => {
    const filter = new AllExceptionsFilter();

    filter.catch(new Error('unexpected failure'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      timestamp: expect.any(String) as string,
      path: '/test',
      message: ['Internal server error'],
      error: 'Internal Server Error',
    });
  });

  it('handles non-Error unknown exception as 500 Internal Server Error', () => {
    const filter = new AllExceptionsFilter();

    filter.catch('raw string error', host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      timestamp: expect.any(String) as string,
      path: '/test',
      message: ['Internal server error'],
      error: 'Internal Server Error',
    });
  });
});
