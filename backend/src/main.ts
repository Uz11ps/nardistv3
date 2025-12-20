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

  // Устанавливаем глобальный префикс для всех роутов
  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Создаем папки для загрузок, если их нет
  const uploadsDir = join(__dirname, '..', 'uploads');
  const imagesDir = join(uploadsDir, 'images');
  const skinsDir = join(uploadsDir, 'skins');
  
  [uploadsDir, imagesDir, skinsDir].forEach(dir => {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  });

  // Настройка статической отдачи файлов
  app.useStaticAssets(join(__dirname, '..', 'uploads'), {
    prefix: '/api/uploads/',
  });

  app.enableCors({
    origin: true,
    credentials: true,
  });

  const port = process.env.BACKEND_PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Backend запущен на порту ${port}`);
}

bootstrap();

