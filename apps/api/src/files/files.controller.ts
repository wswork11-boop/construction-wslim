import { Body, Controller, Get, HttpStatus, Param, Post, Put, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { PresignRequestSchema } from '@construction/shared';
import { FilesService } from './files.service';
import { AuthUser, CurrentUser, Public } from '../common/decorators';
import { parseWithZod } from '../common/zod';

const DirectUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(100),
  purpose: z.string().trim().min(1).max(60),
  base64: z.string().min(1),
});

@ApiTags('Files')
@ApiBearerAuth()
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('presign')
  async presign(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = parseWithZod(PresignRequestSchema, body);
    return this.filesService.presign(user, dto);
  }

  @Post('upload')
  async uploadDirect(@CurrentUser() user: AuthUser, @Body() body: unknown) {
    const dto = parseWithZod(DirectUploadSchema, body);
    return this.filesService.uploadDirect(user, dto);
  }

  @Get(':id/url')
  async getUrl(@Param('id') id: string) {
    return this.filesService.getDownloadUrl(id);
  }

  @Public()
  @Put(':id/content')
  async uploadLocalContent(@Param('id') id: string, @Req() req: any) {
    const buf = Buffer.isBuffer(req.body)
      ? req.body
      : Buffer.from(typeof req.body === 'string' ? req.body : JSON.stringify(req.body || ''));
    return this.filesService.saveLocalContent(id, buf);
  }

  @Public()
  @Get(':id/content')
  async downloadLocalContent(@Param('id') id: string, @Res() res: any) {
    const { buffer, mimeType, fileName } = await this.filesService.getLocalContent(id);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.status(HttpStatus.OK).send(buffer);
  }
}
