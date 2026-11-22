import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v7 as uuidv7 } from 'uuid';
import { FileStatus, PresignRequest } from '@construction/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/decorators';
import { AppException } from '../common/errors';

const PURPOSE_RULES: Record<string, { allowedMime: string[]; maxSize: number }> = {
  DAILY_REPORT_PHOTO: {
    allowedMime: ['image/jpeg', 'image/png', 'image/webp'],
    maxSize: 10 * 1024 * 1024, // 10 MB
  },
  COMPANY_LOGO: {
    allowedMime: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
    maxSize: 5 * 1024 * 1024, // 5 MB
  },
  DOCUMENT_PDF: {
    allowedMime: ['application/pdf'],
    maxSize: 25 * 1024 * 1024, // 25 MB
  },
};

@Injectable()
export class FilesService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly useExternalS3: boolean;
  private readonly apiBaseUrl: string;
  private readonly inMemoryBlobs = new Map<string, Buffer>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.bucket = this.configService.get<string>('S3_BUCKET') || 'construction-dev';
    const endpoint = this.configService.get<string>('S3_ENDPOINT') || 'http://localhost:9000';
    this.useExternalS3 =
      this.configService.get<string>('S3_PROVIDER') === 's3' &&
      !endpoint.includes('localhost:9000');
    const port = this.configService.get<number>('API_PORT') || 3000;
    this.apiBaseUrl = `http://localhost:${port}/api/v1`;

    this.s3 = new S3Client({
      region: this.configService.get<string>('S3_REGION') || 'ap-southeast-1',
      endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: this.configService.get<string>('S3_ACCESS_KEY') || 'minioadmin',
        secretAccessKey: this.configService.get<string>('S3_SECRET_KEY') || 'minioadmin',
      },
    });
  }

  async presign(user: AuthUser, dto: PresignRequest) {
    const rule = PURPOSE_RULES[dto.purpose] || {
      allowedMime: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
      maxSize: 20 * 1024 * 1024,
    };

    if (!rule.allowedMime.includes(dto.mimeType)) {
      throw AppException.unprocessable(
        'FILE_TYPE_NOT_ALLOWED',
        `mimeType ${dto.mimeType} is not allowed for ${dto.purpose}`,
      );
    }

    if (dto.size > rule.maxSize) {
      throw AppException.unprocessable(
        'FILE_TOO_LARGE',
        `File size exceeds limit of ${rule.maxSize} bytes for ${dto.purpose}`,
      );
    }

    const fileId = uuidv7();
    const safeName = dto.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const bucketKey = `${dto.purpose.toLowerCase()}/${fileId}/${safeName}`;

    await this.prisma.file.create({
      data: {
        id: fileId,
        bucketKey,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        size: dto.size,
        purpose: dto.purpose,
        status: FileStatus.PENDING,
        uploadedById: user.id,
      },
    });

    const expiresInSeconds = 900;
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

    let uploadUrl = `${this.apiBaseUrl}/files/${fileId}/content`;
    if (this.useExternalS3) {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: bucketKey,
        ContentType: dto.mimeType,
      });
      uploadUrl = await getSignedUrl(this.s3, command, { expiresIn: expiresInSeconds });
    }

    return {
      fileId,
      uploadUrl,
      expiresAt,
    };
  }

  async getDownloadUrl(id: string) {
    const file = await this.prisma.file.findUnique({ where: { id } });
    if (!file) {
      throw AppException.notFound('NOT_FOUND', 'File not found');
    }
    if (file.status !== FileStatus.READY) {
      throw AppException.conflict(
        'FILE_NOT_READY',
        'The file is still PENDING (not uploaded or not yet attached)',
      );
    }

    const expiresInSeconds = 900;
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

    let url = `${this.apiBaseUrl}/files/${id}/content`;
    if (this.useExternalS3) {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: file.bucketKey,
      });
      url = await getSignedUrl(this.s3, command, { expiresIn: expiresInSeconds });
    }

    return { url, expiresAt };
  }

  async saveLocalContent(id: string, buffer: Buffer) {
    const file = await this.prisma.file.findUnique({ where: { id } });
    if (!file) {
      throw AppException.notFound('NOT_FOUND', 'File not found');
    }
    this.inMemoryBlobs.set(file.bucketKey, buffer);
    await this.prisma.file.update({
      where: { id },
      data: { status: FileStatus.READY },
    });
    return { status: 'READY' };
  }

  async getLocalContent(id: string): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
    const file = await this.prisma.file.findUnique({ where: { id } });
    if (!file) {
      throw AppException.notFound('NOT_FOUND', 'File not found');
    }
    const buffer = this.inMemoryBlobs.get(file.bucketKey) || Buffer.alloc(0);
    return { buffer, mimeType: file.mimeType, fileName: file.fileName };
  }

  async verifyAndMarkReady(fileId: string, tx?: any) {
    const client = tx || this.prisma;
    const file = await client.file.findUnique({ where: { id: fileId } });
    if (!file) {
      throw AppException.unprocessable(
        'FILE_NOT_UPLOADED',
        `File ${fileId} does not reference an uploaded file`,
      );
    }
    if (file.status !== FileStatus.READY) {
      await client.file.update({
        where: { id: fileId },
        data: { status: FileStatus.READY },
      });
    }
    return file;
  }

  async storeBuffer(
    buffer: Buffer,
    meta: { fileName: string; mimeType: string; purpose: string; uploadedById: string },
    tx?: any,
  ) {
    const client = tx || this.prisma;
    const fileId = uuidv7();
    const safeName = meta.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const bucketKey = `${meta.purpose.toLowerCase()}/${fileId}/${safeName}`;

    this.inMemoryBlobs.set(bucketKey, buffer);
    if (this.useExternalS3) {
      try {
        await this.s3.send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: bucketKey,
            Body: buffer,
            ContentType: meta.mimeType,
          }),
        );
      } catch {
        // fallback to in-memory blob
      }
    }

    const file = await client.file.create({
      data: {
        id: fileId,
        bucketKey,
        fileName: meta.fileName,
        mimeType: meta.mimeType,
        size: buffer.byteLength,
        purpose: meta.purpose,
        status: FileStatus.READY,
        uploadedById: meta.uploadedById,
      },
    });
    return file;
  }
}
