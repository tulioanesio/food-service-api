import { Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
type ProductRow = {
  productId: string;
  name: string;
  category: string;
  quantitySold: bigint;
  totalSold: Prisma.Decimal;
};
type StockRow = {
  productId: string;
  name: string;
  isActive: boolean;
  currentQuantity: number;
  minimumQuantity: number;
  lowStock: boolean;
  entries: bigint;
  exits: bigint;
  losses: bigint;
  positiveAdjustments: bigint;
  negativeAdjustments: bigint;
};
@Injectable()
export class ReportsRepository {
  constructor(private readonly db: PrismaService) {}
  sales(from: Date, to: Date) {
    return this.db.$transaction(
      [
        this.db.order.aggregate({
          where: { status: 'COMPLETED', createdAt: { gte: from, lt: to } },
          _count: { _all: true },
          _sum: { total: true },
        }),
        this.db.$queryRaw<
          { method: string; count: bigint; amount: Prisma.Decimal }[]
        >(Prisma.sql`
          SELECT method, COUNT(*) AS count, SUM(amount) AS amount FROM "Payment"
          WHERE status = 'PAID' AND "paidAt" >= ${from} AND "paidAt" < ${to}
          GROUP BY method ORDER BY method ASC`),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
  }
  products(from: Date, to: Date, page: number, limit: number) {
    const eligible = Prisma.sql`o.status = 'COMPLETED' AND o."createdAt" >= ${from} AND o."createdAt" < ${to}`;
    return this.db.$transaction(
      [
        this.db.$queryRaw<ProductRow[]>(Prisma.sql`
        SELECT p.id AS "productId", p.name, p.category, SUM(i.quantity)::bigint AS "quantitySold", SUM(i."totalPrice") AS "totalSold"
        FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId" JOIN "Product" p ON p.id = i."productId"
        WHERE ${eligible} GROUP BY p.id ORDER BY "quantitySold" DESC, p.id ASC LIMIT ${limit} OFFSET ${(page - 1) * limit}`),
        this.db.$queryRaw<{ total: bigint }[]>(
          Prisma.sql`SELECT COUNT(DISTINCT i."productId") AS total FROM "OrderItem" i JOIN "Order" o ON o.id = i."orderId" WHERE ${eligible}`,
        ),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
  }
  stock(from: Date, to: Date, page: number, limit: number, lowStock?: string) {
    const low = Prisma.sql`COALESCE(s."totalQuantity", 0) < COALESCE(s."minimumQuantity", 0)`;
    const filter =
      lowStock === undefined
        ? Prisma.sql`TRUE`
        : lowStock === 'true'
          ? low
          : Prisma.sql`NOT (${low})`;
    return this.db.$transaction(
      async (tx) => {
        const [timestamp] = await tx.$queryRaw<
          { asOf: Date }[]
        >`SELECT transaction_timestamp() AS "asOf"`;
        const counts = await tx.$queryRaw<{ total: bigint }[]>(
          Prisma.sql`SELECT COUNT(*) AS total FROM "Product" p LEFT JOIN "Stock" s ON s."productId" = p.id WHERE ${filter}`,
        );
        const rows = await tx.$queryRaw<StockRow[]>(Prisma.sql`
        WITH selected AS (
          SELECT p.id AS "productId", p.name, p."isActive", COALESCE(s."totalQuantity", 0) AS "currentQuantity", COALESCE(s."minimumQuantity", 0) AS "minimumQuantity", (${low}) AS "lowStock"
          FROM "Product" p LEFT JOIN "Stock" s ON s."productId" = p.id WHERE ${filter}
          ORDER BY p.id LIMIT ${limit} OFFSET ${(page - 1) * limit}
        )
        SELECT s.*, COALESCE(m.entries, 0)::bigint AS entries, COALESCE(m.exits, 0)::bigint AS exits, COALESCE(m.losses, 0)::bigint AS losses,
          COALESCE(m.positive, 0)::bigint AS "positiveAdjustments", COALESCE(m.negative, 0)::bigint AS "negativeAdjustments"
        FROM selected s LEFT JOIN LATERAL (
          SELECT SUM(ABS(quantity::bigint)) FILTER (WHERE type = 'ENTRY') AS entries,
            SUM(ABS(quantity::bigint)) FILTER (WHERE type = 'EXIT') AS exits,
            SUM(ABS(quantity::bigint)) FILTER (WHERE type = 'LOSS') AS losses,
            SUM(quantity::bigint) FILTER (WHERE type = 'ADJUSTMENT' AND quantity > 0) AS positive,
            SUM(-quantity::bigint) FILTER (WHERE type = 'ADJUSTMENT' AND quantity < 0) AS negative
          FROM "StockMovement" WHERE "productId" = s."productId" AND "createdAt" >= ${from} AND "createdAt" < ${to}
        ) m ON TRUE ORDER BY s."productId"`);
        return { rows, total: Number(counts[0].total), asOf: timestamp.asOf };
      },
      { isolationLevel: 'RepeatableRead' },
    );
  }
}
