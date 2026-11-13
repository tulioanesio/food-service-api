import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import { pagination } from 'src/common/dto/pagination.dto';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
  ListCustomersDto,
  normalizePhone,
} from '../dto/customer.dto';
import { CustomersRepository } from '../repositories/customers.repository';
@Injectable()
export class CreateCustomerUseCase {
  constructor(private readonly repo: CustomersRepository) {}
  execute(dto: CreateCustomerDto) {
    return this.repo.create(dto);
  }
}
@Injectable()
export class GetCustomerUseCase {
  constructor(private readonly repo: CustomersRepository) {}
  async execute(id: string) {
    const customer = await this.repo.get(id);
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }
}
@Injectable()
export class UpdateCustomerUseCase {
  constructor(private readonly repo: CustomersRepository) {}
  async execute(id: string, dto: UpdateCustomerDto) {
    if (!(await this.repo.get(id)))
      throw new NotFoundException('Customer not found');
    return this.repo.update(id, dto);
  }
}
@Injectable()
export class ListCustomersUseCase {
  constructor(private readonly repo: CustomersRepository) {}
  async execute({ search, page, limit }: ListCustomersDto) {
    const where: Prisma.CustomerWhereInput = {};
    if (search) {
      where.OR = [{ name: { contains: search, mode: 'insensitive' } }];
      if (/^\+?[\d()\s.-]+$/.test(search)) {
        const digits = search.replace(/\D/g, '');
        const phone = normalizePhone(search);
        if (digits) where.OR.push({ cpf: { contains: digits } });
        if (typeof phone === 'string' && /^\d+$/.test(phone))
          where.OR.push({ phone: { contains: phone } });
      }
    }
    const [data, total] = await this.repo.list(where, page, limit);
    return { data, meta: pagination(page, limit, total) };
  }
}
