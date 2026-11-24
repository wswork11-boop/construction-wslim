import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
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
    const projects = Array.isArray(user.memberships)
      ? user.memberships
          .filter((m: any) => m.project)
          .map((m: any) => ({
            id: m.project.id,
            code: m.project.code,
            name: m.project.name,
            companyId: m.project.companyId ?? null,
          }))
      : [];

    const companyMap = new Map<string, { id: string; code: string | null; name: string }>();
    if (Array.isArray(user.companies)) {
      for (const uc of user.companies) {
        if (uc.company) {
          companyMap.set(uc.company.id, {
            id: uc.company.id,
            code: uc.company.code ?? null,
            name: uc.company.name,
          });
        }
      }
    }
    if (user.company && !companyMap.has(user.company.id)) {
      companyMap.set(user.company.id, {
        id: user.company.id,
        code: user.company.code ?? null,
        name: user.company.name,
      });
    }
    const companies = Array.from(companyMap.values());
    const companyIds = companies.map((c) => c.id);
    const derivedCompanyName =
      user.companyName ?? (companies.length > 0 ? companies.map((c) => c.name).join(', ') : null);

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone ?? null,
      role: user.role,
      companyId: user.companyId ?? companies[0]?.id ?? null,
      companyName: derivedCompanyName,
      companies,
      companyIds,
      projects,
      projectIds: projects.map((p: any) => p.id),
      isActive: user.isActive,
      createdAt: user.createdAt instanceof Date ? user.createdAt.toISOString() : user.createdAt,
      updatedAt: user.updatedAt instanceof Date ? user.updatedAt.toISOString() : user.updatedAt,
    };
  }

  private async syncUserCompanies(tx: any, userId: string, companyIds: string[]) {
    const uniqueIds = Array.from(new Set(companyIds));
    for (const cid of uniqueIds) {
      const comp = await tx.company.findUnique({ where: { id: cid } });
      if (!comp) {
        throw AppException.unprocessable('COMPANY_NOT_FOUND', `Company ${cid} does not exist`);
      }
    }
    await tx.userCompany.deleteMany({ where: { userId } });
    for (const cid of uniqueIds) {
      await tx.userCompany.create({
        data: {
          id: uuidv7(),
          userId,
          companyId: cid,
        },
      });
    }
  }

  private async syncUserProjects(tx: any, userId: string, projectIds: string[]) {
    const uniqueIds = Array.from(new Set(projectIds));
    for (const pid of uniqueIds) {
      const proj = await tx.project.findUnique({ where: { id: pid } });
      if (!proj) {
        throw AppException.unprocessable('PROJECT_NOT_FOUND', `Project ${pid} does not exist`);
      }
    }
    await tx.projectMember.deleteMany({ where: { userId } });
    for (const pid of uniqueIds) {
      await tx.projectMember.create({
        data: {
          id: uuidv7(),
          projectId: pid,
          userId,
        },
      });
    }
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
      where.OR = [{ name: { contains: query.q } }, { email: { contains: query.q } }];
    }

    const orderBy = parseSort(query.sort, ['createdAt', 'name', 'email', 'role']);
    const skip = (query.page - 1) * query.pageSize;

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy,
        skip,
        take: query.pageSize,
        include: {
          company: true,
          companies: { include: { company: true } },
          memberships: { include: { project: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map((u) => this.serializeUser(u)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async getById(id: string, tx: any = this.prisma) {
    const user = await tx.user.findUnique({
      where: { id },
      include: {
        company: true,
        companies: { include: { company: true } },
        memberships: { include: { project: true } },
      },
    });
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

    const companyIds = Array.from(
      new Set([
        ...(Array.isArray(dto.companyIds) ? dto.companyIds : []),
        ...(dto.companyId ? [dto.companyId] : []),
      ]),
    );
    const primaryCompanyId = dto.companyId ?? companyIds[0] ?? null;

    let resolvedCompanyName = dto.companyName?.trim() || null;
    if (primaryCompanyId) {
      const comp = await this.prisma.company.findUnique({ where: { id: primaryCompanyId } });
      if (!comp) {
        throw AppException.unprocessable('COMPANY_NOT_FOUND', 'companyId does not exist');
      }
    }

    const passwordHash = await hashPassword(dto.password);
    return this.prisma.$transaction(async (tx: any) => {
      const created = await tx.user.create({
        data: {
          email,
          name: dto.name.trim(),
          phone: dto.phone ?? null,
          role: dto.role,
          companyId: primaryCompanyId,
          companyName: resolvedCompanyName,
          passwordHash,
          isActive: true,
        },
      });

      if (companyIds.length > 0) {
        await this.syncUserCompanies(tx, created.id, companyIds);
      }

      if (Array.isArray(dto.projectIds)) {
        await this.syncUserProjects(tx, created.id, dto.projectIds);
      }

      const full = await this.getById(created.id, tx);
      await this.auditService.log(
        {
          userId: currentUser.id,
          entity: 'User',
          entityId: created.id,
          action: 'CREATE',
          after: full,
        },
        tx,
      );
      return full;
    });
  }

  async update(currentUser: AuthUser, id: string, dto: UserUpdate) {
    const existing = await this.prisma.user.findUnique({
      where: { id },
      include: {
        company: true,
        companies: { include: { company: true } },
        memberships: { include: { project: true } },
      },
    });
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
    if (Array.isArray(dto.companyIds)) {
      updateData.companyId = dto.companyId !== undefined ? dto.companyId : (dto.companyIds[0] ?? null);
    } else if (dto.companyId !== undefined) {
      updateData.companyId = dto.companyId;
    }
    if (dto.companyName !== undefined) {
      updateData.companyName = dto.companyName?.trim() || null;
    }
    if (dto.password !== undefined) {
      updateData.passwordHash = await hashPassword(dto.password);
    }

    return this.prisma.$transaction(async (tx: any) => {
      if (Object.keys(updateData).length > 0) {
        await tx.user.update({
          where: { id },
          data: updateData,
        });
      }

      if (Array.isArray(dto.companyIds)) {
        await this.syncUserCompanies(tx, id, dto.companyIds);
      } else if (dto.companyId !== undefined) {
        await this.syncUserCompanies(tx, id, dto.companyId ? [dto.companyId] : []);
      }

      if (Array.isArray(dto.projectIds)) {
        await this.syncUserProjects(tx, id, dto.projectIds);
      }

      if (dto.isActive === false || dto.password !== undefined) {
        await tx.refreshToken.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

      const full = await this.getById(id, tx);
      const action = dto.isActive === false && existing.isActive ? 'DEACTIVATE' : 'UPDATE';
      await this.auditService.log(
        {
          userId: currentUser.id,
          entity: 'User',
          entityId: id,
          action,
          before: this.serializeUser(existing),
          after: full,
        },
        tx,
      );

      return full;
    });
  }
}
