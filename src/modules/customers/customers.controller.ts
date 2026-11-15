import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiOperation,
} from '@nestjs/swagger';
import {
  CustomerResponseDto,
  CustomerListResponseDto,
} from './dto/customer-response.dto';
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
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserRole } from 'src/generated/prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  CreateCustomerDto,
  ListCustomersDto,
  UpdateCustomerDto,
} from './dto/customer.dto';
import {
  CreateCustomerUseCase,
  GetCustomerUseCase,
  ListCustomersUseCase,
  UpdateCustomerUseCase,
} from './use-cases/customers.use-cases';
@ApiBadRequestResponse({
  description: 'Dados ou UUID inválidos; campos desconhecidos rejeitados.',
})
@ApiUnauthorizedResponse({ description: 'Autenticação necessária.' })
@ApiForbiddenResponse({
  description: 'Perfil sem acesso à gestão de clientes.',
})
@ApiTags('Customers')
@ApiBearerAuth()
@Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.ATTENDANT, UserRole.CASHIER)
@Controller('customers')
export class CustomersController {
  constructor(
    private readonly createCustomer: CreateCustomerUseCase,
    private readonly listCustomers: ListCustomersUseCase,
    private readonly getCustomer: GetCustomerUseCase,
    private readonly updateCustomer: UpdateCustomerUseCase,
  ) {}
  @ApiCreatedResponse({ type: CustomerResponseDto })
  @Post()
  @ApiConflictResponse({ description: 'CPF já cadastrado.' })
  create(@Body() dto: CreateCustomerDto) {
    return this.createCustomer.execute(dto);
  }
  @ApiOkResponse({ type: CustomerListResponseDto })
  @ApiOperation({
    summary: 'Listar clientes',
    description:
      'Busca por nome sem distinção de caixa e CPF/telefone normalizados. Ordenação por nome e ID; meta.total representa todas as páginas.',
  })
  @Get()
  list(@Query() dto: ListCustomersDto) {
    return this.listCustomers.execute(dto);
  }
  @ApiOkResponse({ type: CustomerResponseDto })
  @Get(':id')
  @ApiNotFoundResponse({ description: 'Cliente inexistente.' })
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.getCustomer.execute(id);
  }
  @ApiOkResponse({ type: CustomerResponseDto })
  @ApiOperation({
    summary: 'Atualizar cliente',
    description:
      'Campos omitidos preservam valores; null limpa CPF/telefone. Nome não aceita null; strings vazias são inválidas.',
  })
  @Patch(':id')
  @ApiConflictResponse({ description: 'CPF já cadastrado.' })
  @ApiNotFoundResponse({ description: 'Cliente inexistente.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.updateCustomer.execute(id, dto);
  }
}
