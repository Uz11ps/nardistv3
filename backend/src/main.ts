import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));

  // Создаем папки для загрузок, если их нет (ДО установки префикса)
  const uploadsDir = join(__dirname, '..', 'uploads');
  const imagesDir = join(uploadsDir, 'images');
  const skinsDir = join(uploadsDir, 'skins');
  
  [uploadsDir, imagesDir, skinsDir].forEach(dir => {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  });

  // Настройка статической отдачи файлов (ДО установки глобального префикса)
  // Используем полный путь /api/uploads/ чтобы обойти глобальный префикс
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/api/uploads/',
  });

  // Устанавливаем глобальный префикс для всех роутов (ПОСЛЕ статики)
  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: true,
    credentials: true,
  });

  const port = process.env.BACKEND_PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Backend запущен на порту ${port}`);
}

bootstrap();

