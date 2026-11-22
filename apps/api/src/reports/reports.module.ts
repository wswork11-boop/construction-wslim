import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { FilesModule } from '../files/files.module';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [ProjectsModule, FilesModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
