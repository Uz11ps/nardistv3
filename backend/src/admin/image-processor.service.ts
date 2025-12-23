import { Injectable, Logger } from '@nestjs/common';
import * as sharp from 'sharp';
import { join } from 'path';
import { writeFileSync, unlinkSync, existsSync } from 'fs';

@Injectable()
export class ImageProcessorService {
  private readonly logger = new Logger(ImageProcessorService.name);

  /**
   * Обрабатывает изображение: ресайз и конвертация в SVG
   * @param inputPath Путь к исходному файлу
   * @param outputPath Путь для сохранения обработанного файла
   * @param width Ширина
   * @param height Высота
   * @param fieldName Тип файла (для определения типа скина)
   */
  async processImage(
    inputPath: string,
    outputPath: string,
    width: number,
    height: number,
    fieldName: string,
  ): Promise<string> {
    try {
      this.logger.log(`Processing image: ${inputPath} -> ${outputPath} (${width}x${height})`);

      // Ресайзим изображение до нужных размеров
      const resizedBuffer = await sharp(inputPath)
        .resize(width, height, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }, // Прозрачный фон
        })
        .png({ quality: 100, compressionLevel: 9 })
        .toBuffer();

      // Конвертируем в base64 для встраивания в SVG
      const base64Image = resizedBuffer.toString('base64');
      const mimeType = 'image/png';

      // Создаем SVG с встроенным изображением
      const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <image width="${width}" height="${height}" xlink:href="data:${mimeType};base64,${base64Image}"/>
</svg>`;

      // Сохраняем SVG
      writeFileSync(outputPath, svgContent, 'utf-8');

      this.logger.log(`✅ Image processed and saved as SVG: ${outputPath}`);
      return outputPath;
    } catch (error) {
      this.logger.error(`❌ Error processing image ${inputPath}:`, error);
      throw error;
    }
  }

  /**
   * Определяет размеры изображения в зависимости от типа скина и поля
   */
  getImageDimensions(fieldName: string, skinType?: string): { width: number; height: number } {
    // Доски: 256x512
    if (fieldName === 'boardTexture' || (fieldName === 'preview' && skinType === 'board')) {
      return { width: 256, height: 512 };
    }

    // Кубики: 64x64
    if (fieldName.startsWith('diceTexture') || fieldName === 'diceTexture') {
      return { width: 64, height: 64 };
    }

    // Шашки: 64x64
    if (
      fieldName === 'whiteCheckersTexture' ||
      fieldName === 'blackCheckersTexture' ||
      fieldName === 'checkersTexture'
    ) {
      return { width: 64, height: 64 };
    }

    // Превью для магазина/инвентаря - оставляем оригинальный размер или стандартный
    if (fieldName === 'preview' || fieldName === 'image' || fieldName === 'shopImage' || fieldName === 'shopPreview') {
      // Для превью можно оставить оригинальный размер или задать стандартный
      // Используем стандартный размер для превью
      return { width: 256, height: 256 };
    }

    // По умолчанию 64x64
    return { width: 64, height: 64 };
  }

  /**
   * Обрабатывает файл и возвращает путь к обработанному SVG
   */
  async processUploadedFile(
    filePath: string,
    fieldName: string,
    skinType?: string,
  ): Promise<string> {
    const { width, height } = this.getImageDimensions(fieldName, skinType);
    const outputPath = filePath.replace(/\.[^.]+$/, '.svg');
    
    await this.processImage(filePath, outputPath, width, height, fieldName);
    
    // Удаляем оригинальный файл после обработки
    try {
      if (existsSync(filePath) && filePath !== outputPath) {
        unlinkSync(filePath);
      }
    } catch (error) {
      this.logger.warn(`Could not delete original file ${filePath}:`, error);
    }

    return outputPath;
  }
}

