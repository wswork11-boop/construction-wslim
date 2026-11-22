import { Injectable } from '@nestjs/common';
import { Role, UserCreate, UserListQuery, UserUpdate } from '@construction/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit.service';
import { AuthUser } from '../common/decorators';
import { AppException } from '../common/errors';
import { parseSort } from '../common/pagination';
import { hashPassword } from '../common/password';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  serializeUser(user: any) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone ?? null,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt,
      updatedAt: user.updatedAt instanceof Date ? user.updatedAt.toISOString() : user.updatedAt,
    };
  }

  async list(query: UserListQuery) {
    const where: any = {};
    if (query.role) {
      where.role = query.role;
    }
    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }
    if (query.q) {
      where.OR = [
        { name: { contains: query.q } },
        { email: { contains: query.q } },
      ];
    }

    const orderBy = parseSort(query.sort, ['createdAt', 'name', 'email', 'role']);
    const skip = (query.page - 1) * query.pageSize;

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({ where, orderBy, skip, take: query.pageSize }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map((u) => this.serializeUser(u)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async getById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw AppException.notFound('NOT_FOUND', 'User not found');
    }
    return this.serializeUser(user);
  }

  async create(currentUser: AuthUser, dto: UserCreate) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw AppException.conflict('USER_EMAIL_TAKEN', 'Another user already has this email');
    }

    const passwordHash = await hashPassword(dto.password);
    return this.prisma.$transaction(async (tx: any) => {
      const created = await tx.user.create({
        data: {
          email,
          name: dto.name.trim(),
          phone: dto.phone ?? null,
          role: dto.role,
          passwordHash,
          isActive: true,
        },
      });
      await this.auditService.log(
        {
          userId: currentUser.id,
          entity: 'User',
          entityId: created.id,
          action: 'CREATE',
          after: this.serializeUser(created),
        },
        tx,
      );
      return this.serializeUser(created);
    });
  }

  async update(currentUser: AuthUser, id: string, dto: UserUpdate) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw AppException.notFound('NOT_FOUND', 'User not found');
    }

    if (
      id === currentUser.id &&
      (dto.isActive === false || (dto.role !== undefined && dto.role !== Role.OWNER))
    ) {
      throw AppException.conflict(
        'CANNOT_DEACTIVATE_SELF',
        'An OWNER cannot deactivate or demote their own account',
      );
    }

    let email: string | undefined;
    if (dto.email !== undefined) {
      email = dto.email.toLowerCase().trim();
      if (email !== existing.email) {
        const conflict = await this.prisma.user.findUnique({ where: { email } });
        if (conflict) {
          throw AppException.conflict('USER_EMAIL_TAKEN', 'Another user already has this email');
        }
      }
    }

    const updateData: any = {};
    if (email !== undefined) updateData.email = email;
    if (dto.name !== undefined) updateData.name = dto.name.trim();
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.role !== undefined) updateData.role = dto.role;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.password !== undefined) {
      updateData.passwordHash = await hashPassword(dto.password);
    }

    return this.prisma.$transaction(async (tx: any) => {
      const updated = await tx.user.update({
        where: { id },
        data: updateData,
      });

      if (dto.isActive === false || dto.password !== undefined) {
        await tx.refreshToken.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      const action =
        dto.isActive === false && existing.isActive ? 'DEACTIVATE' : 'UPDATE';
      await this.auditService.log(
        {
          userId: currentUser.id,
          entity: 'User',
          entityId: id,
          action,
          before: this.serializeUser(existing),
          after: this.serializeUser(updated),
        },
        tx,
      );

      return this.serializeUser(updated);
    });
  }
}
