import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { UploadController, UploadFileController } from './upload.controller';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    MulterModule.register({
      dest: './uploads',
    }),
    ConfigModule,
  ],
  controllers: [UploadController, UploadFileController],
})
export class UploadModule {}

