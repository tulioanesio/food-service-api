import { Injectable } from '@nestjs/common';
import { Prisma } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
const select = {
  id: true,
  name: true,
  cpf: true,
  phone: true,
  createdAt: true,
} satisfies Prisma.CustomerSelect;
@Injectable()
export class CustomersRepository {
  constructor(private readonly db: PrismaService) {}
  create(data: Prisma.CustomerCreateInput) {
    return this.db.customer.create({ data, select });
  }
  get(id: string) {
    return this.db.customer.findUnique({ where: { id }, select });
  }
  update(id: string, data: Prisma.CustomerUpdateInput) {
    return this.db.customer.update({ where: { id }, data, select });
  }
  list(where: Prisma.CustomerWhereInput, page: number, limit: number) {
    return this.db.$transaction(
      [
        this.db.customer.findMany({
          where,
          select,
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.db.customer.count({ where }),
      ],
      { isolationLevel: 'RepeatableRead' },
    );
  }
}
