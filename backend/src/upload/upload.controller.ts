import {
  Controller,
  Get,
  Param,
  Res,
  Post,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { Response } from 'express';
import { existsSync, createReadStream } from 'fs';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ConfigService } from '@nestjs/config';

@Controller('uploads')
export class UploadController {
  constructor(private configService: ConfigService) {}

  /**
   * Отдача статических файлов скинов
   * Доступен без авторизации для публичных изображений
   */
  @Get('skins/:filename')
  async getSkinImage(@Param('filename') filename: string, @Res() res: Response) {
    // Используем __dirname для правильного пути в Docker контейнере
    const filePath = join(__dirname, '..', 'uploads', 'skins', filename);
    
    if (!existsSync(filePath)) {
      throw new NotFoundException(`File not found: ${filename}`);
    }

    // Определяем MIME тип по расширению
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
    };

    res.setHeader('Content-Type', mimeTypes[ext || ''] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    const fileStream = createReadStream(filePath);
    fileStream.pipe(res);
  }

  /**
   * Отдача других изображений
   */
  @Get('images/:filename')
  async getImage(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = join(__dirname, '..', 'uploads', 'images', filename);
    
    if (!existsSync(filePath)) {
      throw new NotFoundException(`File not found: ${filename}`);
    }

    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
    };

    res.setHeader('Content-Type', mimeTypes[ext || ''] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    const fileStream = createReadStream(filePath);
    fileStream.pipe(res);
  }
}

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadFileController {
  constructor(private configService: ConfigService) {}

  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads/images',
        filename: (req, file, cb) => {
          const randomName = Array(32)
            .fill(null)
            .map(() => Math.round(Math.random() * 16).toString(16))
            .join('');
          cb(null, `${randomName}${extname(file.originalname)}`);
        },
      }),
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
      fileFilter: (req, file, cb) => {
        const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Неподдерживаемый тип файла'), false);
        }
      },
    }),
  )
  async uploadImage(@UploadedFile() file: any, @CurrentUser() user: any) {
    if (!file) {
      throw new BadRequestException('Файл не загружен');
    }

    const domain = this.configService.get<string>('DOMAIN', 'nardist.site');
    const protocol = this.configService.get<string>('NODE_ENV') === 'production' ? 'https' : 'http';
    
    const url = `${protocol}://${domain}/api/uploads/images/${file.filename}`;

    return {
      url,
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
    };
  }
}