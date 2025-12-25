import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

async function bootstrap() {
  // Фикс для сериализации BigInt в JSON
  (BigInt.prototype as any).toJSON = function () {
    const num = Number(this);
    if (num > Number.MAX_SAFE_INTEGER || num < Number.MIN_SAFE_INTEGER) {
      return this.toString();
    }
    return num;
  };

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

  // Устанавливаем глобальный префикс для всех роутов
  // Статические файлы теперь обслуживаются через контроллер UploadController
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
  try {
    console.log(`📡 Attempting to start server on port ${port}...`);
    await app.listen(port);
    console.log(`🚀 Backend successfully started on port ${port}`);
  } catch (err) {
    console.error(`❌ Critical error during startup:`, err);
    process.exit(1);
  }
}

bootstrap();

