import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma } from 'src/generated/prisma/client';
import { CreateOrderDto, ListOrdersDto } from '../dto/order.dto';
import { OrdersRepository, Sale } from '../repositories/orders.repository';

export function paidTotal(order: Sale) {
  return order.payments
    .filter((p) => p.status === 'PAID')
    .reduce((sum, p) => sum.add(p.amount), new Prisma.Decimal(0));
}
@Injectable()
export class CreateOrderUseCase {
  constructor(private readonly repository: OrdersRepository) {}
  execute(dto: CreateOrderDto) {
    return this.repository.transaction(async (store) => {
      if (dto.customerId && !(await store.customer(dto.customerId)))
        throw new NotFoundException('Customer not found');
      const quantities = new Map<string, number>();
      for (const item of dto.items)
        quantities.set(
          item.productId,
          (quantities.get(item.productId) ?? 0) + item.quantity,
        );
      const products = await store.products([...quantities.keys()]);
      if (products.length !== quantities.size)
        throw new BadRequestException('Products must exist and be active');
      const items = products.map((p) => ({
        product: { connect: { id: p.id } },
        quantity: quantities.get(p.id)!,
        unitPrice: p.price,
        totalPrice: p.price.mul(quantities.get(p.id)!),
      }));
      const total = items.reduce(
        (sum, item) => sum.add(item.totalPrice),
        new Prisma.Decimal(0),
      );
      if (total.gt('99999999.99'))
        throw new BadRequestException('Order total exceeds limit');
      return store.create({
        ...(dto.customerId
          ? { customer: { connect: { id: dto.customerId } } }
          : {}),
        total,
        items: { create: items },
      });
    });
  }
}
@Injectable()
export class GetOrderUseCase {
  constructor(private readonly repository: OrdersRepository) {}
  async execute(id: string) {
    const order = await this.repository.get(id);
    if (!order) throw new NotFoundException('Order not found');
    return {
      ...order,
      paidAmount: paidTotal(order),
      remainingAmount: order.total.sub(paidTotal(order)),
    };
  }
}
@Injectable()
export class ListOrdersUseCase {
  constructor(private readonly repository: OrdersRepository) {}
  execute(dto: ListOrdersDto) {
    if (dto.from && dto.to && new Date(dto.from) > new Date(dto.to))
      throw new BadRequestException('Invalid date range');
    return this.repository.list({
      status: dto.status,
      customerId: dto.customerId,
      createdAt: { gte: dto.from, lte: dto.to },
    });
  }
}
@Injectable()
export class TransitionOrderUseCase {
  constructor(private readonly repository: OrdersRepository) {}
  execute(id: string, target: OrderStatus, userId: string, reason?: string) {
    return this.repository.transaction(async (store) => {
      const order = await store.lock(id);
      if (!order) throw new NotFoundException('Order not found');
      if (order.status === target) return order;
      if (target === 'CANCELLED') {
        if (!['OPEN', 'CONFIRMED'].includes(order.status))
          throw new ConflictException(
            'Cancellation is only allowed before preparation',
          );
        if (
          order.payments.some((p) =>
            ['PAID', 'PENDING', 'REFUND_PENDING'].includes(p.status),
          )
        )
          throw new ConflictException(
            'Reverse active payments before cancelling',
          );
        if (!reason?.trim())
          throw new BadRequestException('Cancellation reason is required');
        if (order.status === 'CONFIRMED') {
          for (const item of [...order.items].sort((a, b) =>
            a.productId.localeCompare(b.productId),
          )) {
            await store.restore(item.productId, item.quantity);
            await store.movement({
              productId: item.productId,
              orderId: id,
              userId,
              type: 'ENTRY',
              quantity: item.quantity,
              reason,
            });
          }
        }
        return store.update(id, { status: target, cancellationReason: reason });
      }
      if (order.payments.some((p) => p.status === 'REFUND_PENDING'))
        throw new ConflictException(
          'Resolve pending refunds before advancing the order',
        );
      const next: Partial<Record<OrderStatus, OrderStatus>> = {
        OPEN: 'CONFIRMED',
        CONFIRMED: 'PREPARING',
        PREPARING: 'READY',
        READY: 'COMPLETED',
      };
      if (next[order.status] !== target)
        throw new ConflictException('Invalid order transition');
      if (target === 'COMPLETED' && paidTotal(order).lt(order.total))
        throw new ConflictException('Order must be fully paid');
      if (target === 'CONFIRMED') {
        if (
          (await store.products(order.items.map((i) => i.productId))).length !==
          order.items.length
        )
          throw new ConflictException('An order product is inactive');
        for (const item of [...order.items].sort((a, b) =>
          a.productId.localeCompare(b.productId),
        )) {
          if (!(await store.debit(item.productId, item.quantity)).count)
            throw new ConflictException('Insufficient stock');
          await store.movement({
            productId: item.productId,
            orderId: id,
            userId,
            type: 'EXIT',
            quantity: item.quantity,
            reason: 'Order confirmation',
          });
        }
      }
      return store.update(id, { status: target });
    });
  }
}
