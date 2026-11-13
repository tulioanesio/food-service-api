import {
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import {
  SalesReportResponseDto,
  ProductsReportResponseDto,
  StockReportResponseDto,
} from './dto/report-response.dto';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from 'src/generated/prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  ReportPeriodDto,
  ProductsReportDto,
  StockReportDto,
} from './dto/report.dto';
import {
  SalesReportUseCase,
  ProductsReportUseCase,
  StockReportUseCase,
} from './use-cases/reports.use-cases';
@ApiBadRequestResponse({
  description:
    'Período ou paginação inválidos; from/to obrigatórios com fuso explícito e from < to.',
})
@ApiUnauthorizedResponse({ description: 'Autenticação necessária.' })
@ApiForbiddenResponse({ description: 'Apenas ADMIN e MANAGER.' })
@ApiTags('Reports')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.MANAGER)
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly salesReport: SalesReportUseCase,
    private readonly productsReport: ProductsReportUseCase,
    private readonly stockReport: StockReportUseCase,
  ) {}
  @ApiOkResponse({ type: SalesReportResponseDto })
  @Get('sales')
  @ApiOperation({
    summary: 'Vendas e recebimentos em [from, to)',
    description:
      'Pedidos atualmente COMPLETED filtrados por createdAt; recebimentos atualmente PAID filtrados por paidAt, agrupados por método. São conjuntos independentes: não somar. Valores monetários são strings com duas casas; ticket médio arredondado HALF_UP. Sem vendas: count=0, total e averageTicket="0.00". Estornos posteriores alteram períodos passados; não é fechamento contábil nem relatório por conclusão.',
  })
  sales(@Query() dto: ReportPeriodDto) {
    return this.salesReport.execute(dto);
  }
  @ApiOkResponse({ type: ProductsReportResponseDto })
  @Get('products')
  @ApiOperation({
    summary: 'Produtos vendidos em [from, to)',
    description:
      'Pedidos atualmente COMPLETED por createdAt. Nome/categoria atuais, inclusive inativos; totalSold histórico de OrderItem como string decimal. data: productId, name, category, quantitySold, totalSold. Ordenação por quantidade desc e ID; meta.total conta todos os produtos elegíveis.',
  })
  products(@Query() dto: ProductsReportDto) {
    return this.productsReport.execute(dto);
  }
  @ApiOkResponse({ type: StockReportResponseDto })
  @Get('stock')
  @ApiOperation({
    summary: 'Posição atual e movimentos em [from, to)',
    description:
      'asOf identifica o snapshot da consulta. Saldo atual não é saldo histórico em to. Todos os produtos, inclusive inativos; ausência de Stock implica saldo/mínimo zero. Entradas, saídas, perdas e ajustes separados; saídas/perdas/ajustes negativos em magnitudes positivas. netMovement = entries + positiveAdjustments - exits - losses - negativeAdjustments. lowStock usa saldo < mínimo. Movimentos filtrados por createdAt, contados uma vez.',
  })
  stock(@Query() dto: StockReportDto) {
    return this.stockReport.execute(dto);
  }
}
