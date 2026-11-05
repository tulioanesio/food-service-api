import { Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

export const orderInclude = {
  items: true,
  payments: true,
} satisfies Prisma.OrderInclude;
export type Sale = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

// Every mutation of an existing sale locks the same order row first.
export class OrderStore {
  constructor(private readonly db: Prisma.TransactionClient) {}
  async lock(id: string) {
    await this.db.$queryRaw`SELECT id FROM "Order" WHERE id = ${id} FOR UPDATE`;
    return this.get(id);
  }
  get(id: string) {
    return this.db.order.findUnique({ where: { id }, include: orderInclude });
  }
  list(where: Prisma.OrderWhereInput) {
    return this.db.order.findMany({
      where,
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
  products(ids: string[]) {
    return this.db.product.findMany({
      where: { id: { in: ids }, isActive: true, deletedAt: null },
    });
  }
  customer(id: string) {
    return this.db.customer.findUnique({ where: { id }, select: { id: true } });
  }
  create(data: Prisma.OrderCreateInput) {
    return this.db.order.create({ data, include: orderInclude });
  }
  update(id: string, data: Prisma.OrderUpdateInput) {
    return this.db.order.update({ where: { id }, data, include: orderInclude });
  }
  debit(productId: string, quantity: number) {
    return this.db.stock.updateMany({
      where: { productId, totalQuantity: { gte: quantity } },
      data: {
        totalQuantity: { decrement: quantity },
        outputQuantity: { increment: quantity },
      },
    });
  }
  restore(productId: string, quantity: number) {
    return this.db.stock.update({
      where: { productId },
      data: {
        totalQuantity: { increment: quantity },
        inputQuantity: { increment: quantity },
      },
    });
  }
  movement(data: Prisma.StockMovementUncheckedCreateInput) {
    return this.db.stockMovement.create({ data });
  }
  paymentByTransaction(transactionId: string) {
    return this.db.payment.findUnique({ where: { transactionId } });
  }
  payment(id: string) {
    return this.db.payment.findUnique({ where: { id } });
  }
  createPayment(data: Prisma.PaymentUncheckedCreateInput) {
    return this.db.payment.create({ data });
  }
  updatePayment(id: string, data: Prisma.PaymentUpdateInput) {
    return this.db.payment.update({ where: { id }, data });
  }
}

@Injectable()
export class OrdersRepository extends OrderStore {
  constructor(private readonly prisma: PrismaService) {
    super(prisma);
  }
  transaction<T>(work: (store: OrderStore) => Promise<T>) {
    return this.prisma.$transaction((tx) => work(new OrderStore(tx)), {
      timeout: 30000,
    });
  }
}
