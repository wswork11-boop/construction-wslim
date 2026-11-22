import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuditService } from './audit.service';
import { ProjectAccessService } from './project-access.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [AuditService, ProjectAccessService, JwtAuthGuard, RolesGuard],
  exports: [JwtModule, AuditService, ProjectAccessService, JwtAuthGuard, RolesGuard],
})
export class CommonModule {}
