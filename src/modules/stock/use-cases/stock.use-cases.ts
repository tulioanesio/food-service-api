import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateStockMovementDto,
  ListStockMovementsDto,
} from '../dto/stock.dto';
import { StockRepository } from '../repositories/stock.repository';

@Injectable()
export class MoveStockUseCase {
  constructor(private readonly repository: StockRepository) {}
  execute(productId: string, dto: CreateStockMovementDto, userId: string) {
    if (
      dto.quantity === 0 ||
      !Number.isInteger(dto.quantity) ||
      (dto.type !== 'ADJUSTMENT' && dto.quantity < 0)
    )
      throw new BadRequestException(
        'Only adjustments accept a negative quantity; zero is not allowed',
      );
    const delta = ['EXIT', 'LOSS'].includes(dto.type)
      ? -dto.quantity
      : dto.quantity;
    return this.repository.transaction(async (store) => {
      const product = await store.product(productId);
      if (!product) throw new NotFoundException('Product not found');
      const stock = await store.lock(productId);
      const previous = await store.previous(productId, dto.idempotencyKey);
      if (previous) {
        if (
          previous.type !== dto.type ||
          previous.quantity !== dto.quantity ||
          previous.reason !== dto.reason
        )
          throw new ConflictException(
            'Idempotency key already used with different parameters',
          );
        return previous;
      }
      if (!product.isActive || product.deletedAt)
        throw new ConflictException('Product is inactive');
      if (stock.totalQuantity + delta < 0)
        throw new ConflictException('Insufficient stock');
      // All counters use PostgreSQL int; reject overflow before writing.
      if (
        stock.totalQuantity + delta > 2147483647 ||
        stock.inputQuantity + Math.max(delta, 0) > 2147483647 ||
        stock.outputQuantity + Math.max(-delta, 0) > 2147483647
      )
        throw new ConflictException('Stock quantity exceeds limit');
      await store.update(productId, {
        totalQuantity: { increment: delta },
        inputQuantity: { increment: Math.max(delta, 0) },
        outputQuantity: { increment: Math.max(-delta, 0) },
      });
      return store.movement({
        productId,
        userId,
        type: dto.type,
        quantity: dto.quantity,
        reason: dto.reason,
        idempotencyKey: dto.idempotencyKey,
      });
    });
  }
}
@Injectable()
export class GetStockUseCase {
  constructor(private readonly repository: StockRepository) {}
  async execute(productId: string) {
    const stock = await this.repository.find(productId);
    if (!stock) throw new NotFoundException('Stock not found');
    return { ...stock, lowStock: stock.totalQuantity < stock.minimumQuantity };
  }
}
@Injectable()
export class ListStockUseCase {
  constructor(private readonly repository: StockRepository) {}
  execute(lowStock = false) {
    return this.repository.list(lowStock);
  }
}
@Injectable()
export class StockHistoryUseCase {
  constructor(private readonly repository: StockRepository) {}
  async execute(productId: string, filters: ListStockMovementsDto) {
    if (
      filters.from &&
      filters.to &&
      new Date(filters.from) > new Date(filters.to)
    )
      throw new BadRequestException('Invalid date range');
    if (!(await this.repository.product(productId)))
      throw new NotFoundException('Product not found');
    return this.repository.history({
      productId,
      type: filters.type,
      userId: filters.userId,
      createdAt: { gte: filters.from, lte: filters.to },
    });
  }
}
@Injectable()
export class UpdateStockMinimumUseCase {
  constructor(private readonly repository: StockRepository) {}
  execute(productId: string, minimumQuantity: number) {
    return this.repository.transaction(async (store) => {
      if (!(await store.product(productId)))
        throw new NotFoundException('Product not found');
      await store.lock(productId);
      return store.update(productId, { minimumQuantity });
    });
  }
}
