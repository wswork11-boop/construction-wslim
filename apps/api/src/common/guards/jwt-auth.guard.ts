import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators';
import { AppException } from '../errors';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader: string | undefined = request.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw AppException.unauthorized('UNAUTHENTICATED', 'Access token is missing or expired');
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw AppException.unauthorized('UNAUTHENTICATED', 'Access token is missing or expired');
    }

    try {
      const secret =
        this.configService.get<string>('JWT_ACCESS_SECRET') ||
        'dev-access-secret-do-not-use-in-prod';
      const payload = await this.jwtService.verifyAsync(token, { secret });
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });
      if (!user || !user.isActive) {
        throw AppException.unauthorized('UNAUTHENTICATED', 'User is inactive or not found');
      }
      request.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
      return true;
    } catch (err) {
      if (err instanceof AppException) {
        throw err;
      }
      throw AppException.unauthorized('UNAUTHENTICATED', 'Access token is missing or expired');
    }
  }
}
