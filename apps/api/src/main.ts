import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule, configureApp } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);

  app.useBodyParser('json', { limit: '25mb' });
  app.useBodyParser('urlencoded', { extended: true, limit: '25mb' });
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.enableCors({
    origin: true,
    credentials: true,
  });

  configureApp(app);

  const port = Number(process.env.PORT || configService.get<number>('API_PORT') || 3000);
  await app.listen(port, '0.0.0.0');
  console.log(`Construction API listening on http://0.0.0.0:${port}/api/v1`);
}

bootstrap();
