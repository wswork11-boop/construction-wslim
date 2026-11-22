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
}
