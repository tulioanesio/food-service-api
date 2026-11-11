import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { publicProductSelect } from './product.select';

@Injectable()
export class ProductsRepository {
  constructor(private readonly prismaService: PrismaService) {}

  findByNameAndCategory(name: string, category: string) {
    return this.prismaService.product.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        category: { equals: category, mode: 'insensitive' },
        deletedAt: null,
      },
      select: { id: true },
    });
  }

  create(data: { name: string; category: string; price: number }) {
    return this.prismaService.product.create({
      data: { ...data, stock: { create: {} } },
      select: publicProductSelect,
    });
  }

  findAll(filters: { search?: string; category?: string }) {
    return this.prismaService.product.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        ...(filters.category
          ? {
              category: {
                equals: filters.category,
                mode: 'insensitive' as const,
              },
            }
          : {}),
        ...(filters.search
          ? {
              OR: [
                {
                  name: {
                    contains: filters.search,
                    mode: 'insensitive' as const,
                  },
                },
                {
                  category: {
                    contains: filters.search,
                    mode: 'insensitive' as const,
                  },
                },
              ],
            }
          : {}),
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      select: publicProductSelect,
    });
  }

  findActiveById(id: string) {
    return this.prismaService.product.findFirst({
      where: {
        id,
        isActive: true,
        deletedAt: null,
      },
      select: publicProductSelect,
    });
  }

  update(
    id: string,
    data: { name?: string; category?: string; price?: number },
  ) {
    return this.prismaService.product.update({
      where: { id },
      data,
      select: publicProductSelect,
    });
  }

  deactivate(id: string) {
    return this.prismaService.product.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
      select: publicProductSelect,
    });
  }
}
