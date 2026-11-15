import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import { pagination } from 'src/common/dto/pagination.dto';
import {
  ReportPeriodDto,
  ProductsReportDto,
  StockReportDto,
} from '../dto/report.dto';
import { ReportsRepository } from '../repositories/reports.repository';
function period(dto: ReportPeriodDto) {
  const from = new Date(dto.from),
    to = new Date(dto.to);
  if (
    !Number.isFinite(from.getTime()) ||
    !Number.isFinite(to.getTime()) ||
    from >= to
  )
    throw new BadRequestException('from must be earlier than to');
  return { from, to };
}
@Injectable()
export class SalesReportUseCase {
  constructor(private readonly repo: ReportsRepository) {}
  async execute(dto: ReportPeriodDto) {
    const bounds = period(dto);
    const [orders, payments] = await this.repo.sales(bounds.from, bounds.to);
    const total = orders._sum.total ?? new Prisma.Decimal(0);
    const count = orders._count._all;
    return {
      period: bounds,
      orders: {
        count,
        total: total.toFixed(2),
        averageTicket: (count
          ? total.div(count)
          : new Prisma.Decimal(0)
        ).toFixed(2, Prisma.Decimal.ROUND_HALF_UP),
      },
      receiptsByMethod: payments.map((p) => ({
        method: p.method,
        count: Number(p.count),
        amount: p.amount.toFixed(2),
      })),
    };
  }
}
@Injectable()
export class ProductsReportUseCase {
  constructor(private readonly repo: ReportsRepository) {}
  async execute(dto: ProductsReportDto) {
    const bounds = period(dto);
    const [rows, counts] = await this.repo.products(
      bounds.from,
      bounds.to,
      dto.page,
      dto.limit,
    );
    return {
      period: bounds,
      data: rows.map((row) => ({
        ...row,
        quantitySold: Number(row.quantitySold),
        totalSold: row.totalSold.toFixed(2),
      })),
      meta: pagination(dto.page, dto.limit, Number(counts[0].total)),
    };
  }
}
@Injectable()
export class StockReportUseCase {
  constructor(private readonly repo: ReportsRepository) {}
  async execute(dto: StockReportDto) {
    const bounds = period(dto);
    const { rows, total, asOf } = await this.repo.stock(
      bounds.from,
      bounds.to,
      dto.page,
      dto.limit,
      dto.lowStock,
    );
    return {
      period: bounds,
      asOf,
      data: rows.map((row) => {
        const entries = Number(row.entries),
          exits = Number(row.exits),
          losses = Number(row.losses),
          positiveAdjustments = Number(row.positiveAdjustments),
          negativeAdjustments = Number(row.negativeAdjustments);
        return {
          ...row,
          entries,
          exits,
          losses,
          positiveAdjustments,
          negativeAdjustments,
          netMovement:
            entries +
            positiveAdjustments -
            exits -
            losses -
            negativeAdjustments,
        };
      }),
      meta: pagination(dto.page, dto.limit, total),
    };
  }
}
