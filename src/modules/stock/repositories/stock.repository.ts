import { Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

const stockInclude = {
  product: { select: { id: true, name: true, category: true, isActive: true } },
} satisfies Prisma.StockInclude;
export class StockStore {
  constructor(private readonly db: Prisma.TransactionClient) {}
  product(productId: string) {
    return this.db.product.findUnique({
      where: { id: productId },
      select: { id: true, isActive: true, deletedAt: true },
    });
  }
  async lock(productId: string) {
    // Lazy initialization also supports legacy/imported products without stock.
    await this.db.stock.upsert({
      where: { productId },
      create: { productId },
      update: {},
    });
    await this.db
      .$queryRaw`SELECT id FROM "Stock" WHERE "productId" = ${productId} FOR UPDATE`;
    return this.db.stock.findUniqueOrThrow({ where: { productId } });
  }
  find(productId: string) {
    return this.db.stock.findUnique({
      where: { productId },
      include: stockInclude,
    });
  }
  list(lowStock: boolean) {
    return this.db.stock.findMany({
      where: lowStock
        ? { totalQuantity: { lt: this.db.stock.fields.minimumQuantity } }
        : {},
      include: stockInclude,
      orderBy: { productId: 'asc' },
      take: 100,
    });
  }
  previous(productId: string, idempotencyKey: string) {
    return this.db.stockMovement.findUnique({
      where: { productId_idempotencyKey: { productId, idempotencyKey } },
    });
  }
  update(productId: string, data: Prisma.StockUpdateInput) {
    return this.db.stock.update({ where: { productId }, data });
  }
  movement(data: Prisma.StockMovementUncheckedCreateInput) {
    return this.db.stockMovement.create({ data });
  }
  history(where: Prisma.StockMovementWhereInput) {
    return this.db.stockMovement.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
    });
  }
}
@Injectable()
export class StockRepository extends StockStore {
  constructor(private readonly prisma: PrismaService) {
    super(prisma);
  }
  transaction<T>(work: (store: StockStore) => Promise<T>) {
    return this.prisma.$transaction((tx) => work(new StockStore(tx)));
  }
}
