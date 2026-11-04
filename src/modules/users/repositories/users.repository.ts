import { Injectable } from '@nestjs/common';
import { UserRole } from 'src/generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { publicUserSelect } from './user.select';

@Injectable()
export class UsersRepository {
  constructor(private readonly prismaService: PrismaService) {}

  countActive(): Promise<number> {
    return this.prismaService.user.count({
      where: { deletedAt: null },
    });
  }

  countActiveAdministrators(): Promise<number> {
    return this.prismaService.user.count({
      where: {
        role: UserRole.ADMIN,
        isActive: true,
        deletedAt: null,
      },
    });
  }

  findByLoginOrEmail(login: string, email?: string) {
    return this.prismaService.user.findFirst({
      where: {
        OR: [{ login }, ...(email ? [{ email }] : [])],
      },
    });
  }

  create(data: {
    name: string;
    login: string;
    email?: string;
    passwordHash: string;
    role: UserRole;
  }) {
    return this.prismaService.user.create({
      data,
      select: publicUserSelect,
    });
  }

  findActiveById(id: string) {
    return this.prismaService.user.findFirst({
      where: {
        id,
        isActive: true,
        deletedAt: null,
      },
      select: publicUserSelect,
    });
  }

  findActiveByIdWithCredentials(id: string) {
    return this.prismaService.user.findFirst({
      where: {
        id,
        isActive: true,
        deletedAt: null,
      },
    });
  }

  findAllActive() {
    return this.prismaService.user.findMany({
      where: {
        isActive: true,
        deletedAt: null,
      },
      orderBy: { name: 'asc' },
      select: publicUserSelect,
    });
  }

  update(
    id: string,
    data: {
      name?: string;
      email?: string;
      passwordHash?: string;
    },
  ) {
    return this.prismaService.user.update({
      where: { id },
      data,
      select: publicUserSelect,
    });
  }

  deactivate(id: string) {
    return this.prismaService.user.update({
      where: { id },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
      select: publicUserSelect,
    });
  }

  purgeDeletedBefore(cutoff: Date) {
    return this.prismaService.user.deleteMany({
      where: {
        deletedAt: {
          lte: cutoff,
        },
      },
    });
  }
}
