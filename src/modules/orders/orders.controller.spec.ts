import { UserRole } from 'src/generated/prisma/client';
import type { AuthenticatedUser } from '../auth/auth.types';
import { OrdersController } from './orders.controller';
import {
  CreateOrderUseCase,
  GetOrderUseCase,
  ListOrdersUseCase,
  TransitionOrderUseCase,
} from './use-cases/orders.use-cases';

describe('OrdersController', () => {
  const createOrder = { execute: jest.fn() };
  const getOrder = { execute: jest.fn() };
  const listOrders = { execute: jest.fn() };
  const transition = { execute: jest.fn() };

  const controller = new OrdersController(
    createOrder as unknown as CreateOrderUseCase,
    getOrder as unknown as GetOrderUseCase,
    listOrders as unknown as ListOrdersUseCase,
    transition as unknown as TransitionOrderUseCase,
  );

  const user: AuthenticatedUser = {
    id: 'u1',
    login: 'admin',
    role: UserRole.ADMIN,
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('delegates create, list and get', async () => {
    const createDto = { items: [{ productId: 'p1', quantity: 1 }] };
    createOrder.execute.mockResolvedValue({ id: 'o1' });
    await expect(controller.create(createDto)).resolves.toEqual({ id: 'o1' });
    expect(createOrder.execute).toHaveBeenCalledWith(createDto);

    const listDto = { status: 'OPEN' as const };
    listOrders.execute.mockResolvedValue([{ id: 'o1' }]);
    await expect(controller.list(listDto)).resolves.toEqual([{ id: 'o1' }]);
    expect(listOrders.execute).toHaveBeenCalledWith(listDto);

    getOrder.execute.mockResolvedValue({ id: 'o1' });
    await expect(controller.get('o1')).resolves.toEqual({ id: 'o1' });
    expect(getOrder.execute).toHaveBeenCalledWith('o1');
  });

  it('delegates status transitions to TransitionOrderUseCase', async () => {
    transition.execute.mockResolvedValue({ id: 'o1' });

    await controller.confirm('o1', user);
    expect(transition.execute).toHaveBeenCalledWith('o1', 'CONFIRMED', 'u1');

    await controller.prepare('o1', user);
    expect(transition.execute).toHaveBeenCalledWith('o1', 'PREPARING', 'u1');

    await controller.ready('o1', user);
    expect(transition.execute).toHaveBeenCalledWith('o1', 'READY', 'u1');

    await controller.complete('o1', user);
    expect(transition.execute).toHaveBeenCalledWith('o1', 'COMPLETED', 'u1');

    await controller.cancel('o1', { reason: 'Customer left' }, user);
    expect(transition.execute).toHaveBeenCalledWith(
      'o1',
      'CANCELLED',
      'u1',
      'Customer left',
    );
  });
});
