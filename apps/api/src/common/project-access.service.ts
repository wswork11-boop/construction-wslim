import { Injectable } from '@nestjs/common';
import { Role } from '@construction/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from './decorators';
import { AppException } from './errors';

@Injectable()
export class ProjectAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertMember(user: AuthUser, projectId: string): Promise<void> {
    if (user.role === Role.OWNER || user.role === Role.OFFICE) {
      return;
    }
    const membership = await this.prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: user.id,
        },
      },
    });
    if (!membership) {
      throw AppException.forbidden(
        'NOT_PROJECT_MEMBER',
        'You are not a member of this project',
      );
    }
  }

  async getAccessibleProjectIds(user: AuthUser): Promise<string[] | null> {
    if (user.role === Role.OWNER || user.role === Role.OFFICE) {
      return null;
    }
    const memberships = await this.prisma.projectMember.findMany({
      where: { userId: user.id },
    });
    return memberships.map((m: any) => m.projectId);
  }

  /**
   * Returns the list of Company IDs assigned to a non-OWNER user,
   * or `null` for OWNER (who can see all companies).
   * Non-OWNER users only see companies they are explicitly assigned to via UserCompany,
   * User.companyId, or via their assigned ProjectMembers.
   */
  async getAccessibleCompanyIds(user: AuthUser): Promise<string[] | null> {
    if (user.role === Role.OWNER) {
      return null;
    }
    const ids = new Set<string>();

    const userRow = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: {
        companies: true,
        memberships: { include: { project: true } },
      },
    });

    if (userRow?.companyId) {
      ids.add(userRow.companyId);
    }
    if (Array.isArray(userRow?.companies)) {
      for (const uc of userRow.companies) {
        if (uc.companyId) ids.add(uc.companyId);
      }
    }
    if (Array.isArray(userRow?.memberships)) {
      for (const mem of userRow.memberships) {
        if (mem.project?.companyId) {
          ids.add(mem.project.companyId);
        }
      }
    }

    return Array.from(ids);
  }
}
