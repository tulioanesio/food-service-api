import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaClientExceptionFilter } from './prisma-exception.filter';

describe('PrismaClientExceptionFilter', () => {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ url: '/items' }),
    }),
  } as unknown as ArgumentsHost;

  beforeEach(() => {
    jest.clearAllMocks();
    status.mockReturnValue({ json });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const makeException = (code: string) =>
    new Prisma.PrismaClientKnownRequestError(`Error\n${code}`, {
      code,
      clientVersion: '7.0.0',
    });

  it('maps P2002 to 409 Conflict', () => {
    const filter = new PrismaClientExceptionFilter();

    filter.catch(makeException('P2002'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.CONFLICT,
      timestamp: expect.any(String) as string,
      path: '/items',
      message: [
        'Conflict: A record with the specified unique constraint already exists.',
      ],
    });
  });

  it('maps P2025 to 404 Not Found', () => {
    const filter = new PrismaClientExceptionFilter();

    filter.catch(makeException('P2025'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.NOT_FOUND,
      timestamp: expect.any(String) as string,
      path: '/items',
      message: ['Not found: The requested record does not exist.'],
    });
  });

  it('maps P2023 to 400 Bad Request', () => {
    const filter = new PrismaClientExceptionFilter();

    filter.catch(makeException('P2023'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      timestamp: expect.any(String) as string,
      path: '/items',
      message: [
        'Inconsistent column data. Please check your query and data types.',
      ],
      error: 'Bad Request',
    });
  });

  it('maps P2014 to 409 Conflict', () => {
    const filter = new PrismaClientExceptionFilter();

    filter.catch(makeException('P2014'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.CONFLICT,
      timestamp: expect.any(String) as string,
      path: '/items',
      message: [
        'Cannot delete or update a record because it is related to another record.',
      ],
      error: 'Conflict',
    });
  });

  it('delegates unknown Prisma error codes to BaseExceptionFilter', () => {
    const filter = new PrismaClientExceptionFilter();
    const superSpy = jest
      .spyOn(BaseExceptionFilter.prototype, 'catch')
      .mockImplementation(() => undefined);
    const exception = makeException('P9999');

    filter.catch(exception, host);

    expect(superSpy).toHaveBeenCalledWith(exception, host);
    expect(status).not.toHaveBeenCalled();
  });
});
