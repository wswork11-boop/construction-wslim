import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule, configureApp } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const rawOrigins = configService.get<string>('WEB_ORIGIN') || 'http://localhost:5173';
  const originList = rawOrigins
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.use(helmet());
  app.enableCors({
    origin: originList.includes('*') ? true : originList,
    credentials: true,
  });

  configureApp(app);

  const port = Number(process.env.PORT || configService.get<number>('API_PORT') || 3000);
  await app.listen(port, '0.0.0.0');
  console.log(`Construction API listening on http://0.0.0.0:${port}/api/v1`);
}

bootstrap();
