import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from 'src/generated/prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import {
  CreateStockMovementDto,
  ListStockDto,
  ListStockMovementsDto,
  UpdateStockMinimumDto,
} from './dto/stock.dto';
import {
  GetStockUseCase,
  ListStockUseCase,
  MoveStockUseCase,
  StockHistoryUseCase,
  UpdateStockMinimumUseCase,
} from './use-cases/stock.use-cases';
const managers = [UserRole.ADMIN, UserRole.MANAGER, UserRole.STOCK_MANAGER];
@ApiTags('Stock')
@ApiBearerAuth()
@Controller('stock')
export class StockController {
  constructor(
    private readonly getStock: GetStockUseCase,
    private readonly listStock: ListStockUseCase,
    private readonly moveStock: MoveStockUseCase,
    private readonly history: StockHistoryUseCase,
    private readonly minimum: UpdateStockMinimumUseCase,
  ) {}
  @Roles(...managers, UserRole.ATTENDANT, UserRole.CASHIER, UserRole.KITCHEN)
  @Get()
  @ApiOperation({
    summary:
      'List stock (up to 100 products); lowStock=true filters below minimum',
  })
  list(@Query() dto: ListStockDto) {
    return this.listStock.execute(dto.lowStock === 'true');
  }
  @Roles(...managers, UserRole.ATTENDANT, UserRole.CASHIER, UserRole.KITCHEN)
  @Get(':productId')
  get(@Param('productId', ParseUUIDPipe) productId: string) {
    return this.getStock.execute(productId);
  }
  @Roles(...managers)
  @Post(':productId/movements')
  @ApiOperation({
    summary: 'Record an idempotent entry, exit, loss or signed adjustment',
  })
  move(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: CreateStockMovementDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.moveStock.execute(productId, dto, user.id);
  }
  @Roles(...managers)
  @Get(':productId/movements')
  historyList(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query() dto: ListStockMovementsDto,
  ) {
    return this.history.execute(productId, dto);
  }
  @Roles(...managers)
  @Patch(':productId/minimum')
  updateMinimum(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: UpdateStockMinimumDto,
  ) {
    return this.minimum.execute(productId, dto.minimumQuantity);
  }
}
