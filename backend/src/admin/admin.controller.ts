import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, UnauthorizedException, UploadedFile, UploadedFiles, UseInterceptors, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor, AnyFilesInterceptor } from '@nestjs/platform-express';
import { JwtService } from '@nestjs/jwt';
import { AdminService } from './admin.service';
import { ImageProcessorService } from './image-processor.service';
import { AcademyService } from '../academy/academy.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AdminLoginDto } from './dto/admin-login.dto';
import { CreateSkinDto } from './dto/create-skin.dto';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { extname } from 'path';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    @Inject(forwardRef(() => AcademyService))
    private readonly academyService: AcademyService,
    private readonly jwtService: JwtService,
    private readonly imageProcessor: ImageProcessorService,
  ) {}

  @Post('login')
  async adminLogin(@Body() loginDto: any) {
    // Отладочное логирование (принимаем any, чтобы увидеть все что приходит)
    console.log('Admin login attempt - raw body:', JSON.stringify(loginDto));
    console.log('Admin login attempt - typeof:', {
      loginDtoType: typeof loginDto,
      isObject: loginDto instanceof Object,
      keys: loginDto ? Object.keys(loginDto) : 'null/undefined',
      login: loginDto?.login,
      password: loginDto?.password ? '***' : undefined,
    });

    const expectedLogin = '123';
    const expectedPassword = '123123';

    // Более гибкая проверка - может прийти в разных форматах
    const receivedLogin = loginDto?.login?.toString().trim() || loginDto?.username?.toString().trim() || '';
    const receivedPassword = loginDto?.password?.toString().trim() || '';

    console.log('Admin login - comparison:', {
      receivedLogin,
      receivedPassword: receivedPassword ? '***' : 'empty',
      expectedLogin,
      loginMatch: receivedLogin === expectedLogin,
      passwordMatch: receivedPassword === expectedPassword,
    });

    if (receivedLogin === expectedLogin && receivedPassword === expectedPassword) {
      // Создаем JWT токен для админа
      const payload = {
        sub: 'admin',
        login: '123',
        isAdmin: true,
      };
      const token = this.jwtService.sign(payload);
      console.log('✅ Admin login successful');
      return {
        access_token: token,
        user: {
          id: 'admin',
          login: '123',
          isAdmin: true,
        },
      };
    }
    
    console.log('❌ Admin login failed');
    throw new UnauthorizedException('Неверный логин или пароль');
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getStats(@CurrentUser() user: any) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.getStats();
  }

  @Get('users')
  @UseGuards(JwtAuthGuard)
  async getUsers(@CurrentUser() user: any) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.getAllUsers();
  }

  @Get('users/:id')
  @UseGuards(JwtAuthGuard)
  async getUser(@CurrentUser() user: any, @Param('id') id: string) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.getUserDetails(id);
  }

  @Post('users/:id/ban')
  @UseGuards(JwtAuthGuard)
  async banUser(@CurrentUser() user: any, @Param('id') id: string, @Body('reason') reason: string) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.banUser(id, reason);
  }

  @Post('users/:id/unban')
  @UseGuards(JwtAuthGuard)
  async unbanUser(@CurrentUser() user: any, @Param('id') id: string) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.unbanUser(id);
  }

  @Delete('users/:id')
  @UseGuards(JwtAuthGuard)
  async deleteUser(@CurrentUser() user: any, @Param('id') id: string) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.deleteUser(id);
  }

  @Post('users/:id/subscription')
  @UseGuards(JwtAuthGuard)
  async giveSubscription(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { plan: string; months?: number },
  ) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.giveSubscription(id, body.plan, body.months);
  }

  @Get('games')
  @UseGuards(JwtAuthGuard)
  async getGames(@CurrentUser() user: any) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.getAllGames();
  }

  @Get('games/:id')
  @UseGuards(JwtAuthGuard)
  async getGame(@CurrentUser() user: any, @Param('id') id: string) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.getGameDetails(id);
  }

  @Post('notifications')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('image', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const uploadPath = join(process.cwd(), 'frontend', 'public', 'uploads', 'notifications');
        if (!existsSync(uploadPath)) {
          mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = extname(file.originalname);
        cb(null, `notification-${uniqueSuffix}${ext}`);
      },
    }),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  }))
  async sendNotification(
    @CurrentUser() user: any,
    @Body() body: { userId?: string; message: string; all?: boolean },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    
    let imageUrl: string | undefined;
    if (file) {
      const fileUrl = `/uploads/notifications/${file.filename}`;
      imageUrl = fileUrl;
    }
    
    return this.adminService.sendNotification({ ...body, imageUrl });
  }

  @Delete('notifications/:id')
  @UseGuards(JwtAuthGuard)
  async deleteNotification(@CurrentUser() user: any, @Param('id') id: string) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.deleteNotification(id);
  }

  @Delete('notifications/user/:userId')
  @UseGuards(JwtAuthGuard)
  async deleteUserNotifications(@CurrentUser() user: any, @Param('userId') userId: string) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.deleteUserNotifications(userId);
  }

  @Delete('notifications/all')
  @UseGuards(JwtAuthGuard)
  async deleteAllNotifications(@CurrentUser() user: any) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.deleteAllNotifications();
  }

  @Post('games/create')
  @UseGuards(JwtAuthGuard)
  async createGame(@CurrentUser() user: any, @Body() body: { player1Id: string; player2Id?: string; mode: string; type: string }) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.createGame(body);
  }

  @Post('tournaments/create')
  @UseGuards(JwtAuthGuard)
  async createTournament(@CurrentUser() user: any, @Body() body: any) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.createTournament(body);
  }

  @Get('tournaments')
  @UseGuards(JwtAuthGuard)
  async getTournaments(@CurrentUser() user: any) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.getAllTournaments();
  }

  @Get('tournaments/:id')
  @UseGuards(JwtAuthGuard)
  async getTournament(@CurrentUser() user: any, @Param('id') id: string) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.getTournament(id);
  }

  @Put('tournaments/:id')
  @UseGuards(JwtAuthGuard)
  async updateTournament(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.updateTournament(id, body);
  }

  @Delete('tournaments/:id')
  @UseGuards(JwtAuthGuard)
  async deleteTournament(@CurrentUser() user: any, @Param('id') id: string) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.deleteTournament(id);
  }

  @Post('academy/create')
  @UseGuards(JwtAuthGuard)
  async createArticle(@CurrentUser() user: any, @Body() body: any) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.createArticle(body);
  }

  @Get('academy')
  @UseGuards(JwtAuthGuard)
  async getArticles(@CurrentUser() user: any) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.getAllArticles();
  }

  @Get('courses/pending')
  @UseGuards(JwtAuthGuard)
  async getPendingCourses(@CurrentUser() user: any) {
    if (!user.isAdmin && !user.isTrainer) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.getPendingCourses();
  }

  @Post('courses/:id/verify')
  @UseGuards(JwtAuthGuard)
  async verifyCourse(@CurrentUser() user: any, @Param('id') id: string) {
    if (!user.isAdmin && !user.isTrainer) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.academyService.verifyCourse(id, user.id);
  }

  @Post('courses/:id/reject')
  @UseGuards(JwtAuthGuard)
  async rejectCourse(@CurrentUser() user: any, @Param('id') id: string) {
    if (!user.isAdmin && !user.isTrainer) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    await this.academyService.rejectCourse(id);
    return { message: 'Курс отклонен' };
  }

  @Get('settings')
  @UseGuards(JwtAuthGuard)
  async getSystemSettings(@CurrentUser() user: any) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.getAllSystemSettings();
  }

  @Post('settings')
  @UseGuards(JwtAuthGuard)
  async setSystemSetting(
    @CurrentUser() user: any,
    @Body() body: { key: string; value: string; description?: string },
  ) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.setSystemSetting(body.key, body.value, body.description);
  }

  @Put('academy/:id')
  @UseGuards(JwtAuthGuard)
  async updateArticle(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.updateArticle(id, body);
  }

  @Delete('academy/:id')
  @UseGuards(JwtAuthGuard)
  async deleteArticle(@CurrentUser() user: any, @Param('id') id: string) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.deleteArticle(id);
  }

  @Get('city/rewards')
  @UseGuards(JwtAuthGuard)
  async getCityRewards(@CurrentUser() user: any) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.getCityRewards();
  }

  @Put('city/rewards')
  @UseGuards(JwtAuthGuard)
  async updateCityRewards(@CurrentUser() user: any, @Body() body: any) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.updateCityRewards(body);
  }

  // CRUD для территорий
  @Get('districts')
  @UseGuards(JwtAuthGuard)
  async getAllDistricts(@CurrentUser() user: any) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.getAllDistricts();
  }

  @Get('districts/:id')
  @UseGuards(JwtAuthGuard)
  async getDistrict(@CurrentUser() user: any, @Param('id') id: string) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.getDistrict(id);
  }

  @Post('districts')
  @UseGuards(JwtAuthGuard)
  async createDistrict(@CurrentUser() user: any, @Body() body: any) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.createDistrict(body);
  }

  @Put('districts/:id')
  @UseGuards(JwtAuthGuard)
  async updateDistrict(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.updateDistrict(id, body);
  }

  @Delete('districts/:id')
  @UseGuards(JwtAuthGuard)
  async deleteDistrict(@CurrentUser() user: any, @Param('id') id: string) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.deleteDistrict(id);
  }

  // CRUD для конфигураций строений
  @Get('buildings')
  @UseGuards(JwtAuthGuard)
  async getAllBuildings(@CurrentUser() user: any) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.getAllBuildingConfigs();
  }

  @Get('buildings/:id')
  @UseGuards(JwtAuthGuard)
  async getBuilding(@CurrentUser() user: any, @Param('id') id: string) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.getBuildingConfig(id);
  }

  @Post('buildings')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    AnyFilesInterceptor({
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadsDir = join(process.cwd(), 'uploads', 'buildings');
          if (!existsSync(uploadsDir)) {
            mkdirSync(uploadsDir, { recursive: true });
          }
          cb(null, uploadsDir);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    }),
  )
  async createBuilding(
    @CurrentUser() user: any,
    @Body() body: any,
    @UploadedFiles() files?: Array<{ fieldname: string; filename: string; originalname: string; mimetype: string; size: number }>,
  ) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    
    // Обрабатываем загруженные файлы
    let iconUrl = body.icon || null;
    let imageUrl = body.image || null;
    
    if (files && files.length > 0) {
      for (const file of files) {
        const fileUrl = `/uploads/buildings/${file.filename}`;
        if (file.fieldname === 'icon') {
          iconUrl = fileUrl;
        } else if (file.fieldname === 'image') {
          imageUrl = fileUrl;
        }
      }
    }
    
    const buildingData = {
      ...body,
      icon: iconUrl,
      image: imageUrl,
    };
    
    return this.adminService.createBuildingConfig(buildingData);
  }

  @Put('buildings/:id')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    AnyFilesInterceptor({
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadsDir = join(process.cwd(), 'uploads', 'buildings');
          if (!existsSync(uploadsDir)) {
            mkdirSync(uploadsDir, { recursive: true });
          }
          cb(null, uploadsDir);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `${file.fieldname}-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    }),
  )
  async updateBuilding(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: any,
    @UploadedFiles() files?: Array<{ fieldname: string; filename: string; originalname: string; mimetype: string; size: number }>,
  ) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    
    const updateData: any = { ...body };
    
    // Обрабатываем загруженные файлы
    if (files && files.length > 0) {
      for (const file of files) {
        const fileUrl = `/uploads/buildings/${file.filename}`;
        if (file.fieldname === 'icon') {
          updateData.icon = fileUrl;
        } else if (file.fieldname === 'image') {
          updateData.image = fileUrl;
        }
      }
    }
    
    return this.adminService.updateBuildingConfig(id, updateData);
  }

  @Delete('buildings/:id')
  @UseGuards(JwtAuthGuard)
  async deleteBuilding(@CurrentUser() user: any, @Param('id') id: string) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.deleteBuildingConfig(id);
  }

  // CRUD для шаблонов уведомлений Telegram
  @Get('notification-templates')
  @UseGuards(JwtAuthGuard)
  async getAllNotificationTemplates(@CurrentUser() user: any) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.getAllNotificationTemplates();
  }

  @Get('notification-templates/:type')
  @UseGuards(JwtAuthGuard)
  async getNotificationTemplate(@CurrentUser() user: any, @Param('type') type: string) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.getNotificationTemplate(type as any);
  }

  @Post('notification-templates')
  @UseGuards(JwtAuthGuard)
  async createNotificationTemplate(@CurrentUser() user: any, @Body() body: any) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.createNotificationTemplate(body);
  }

  @Put('notification-templates/:type')
  @UseGuards(JwtAuthGuard)
  async updateNotificationTemplate(@CurrentUser() user: any, @Param('type') type: string, @Body() body: any) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.updateNotificationTemplate(type as any, body);
  }

  @Delete('notification-templates/:type')
  @UseGuards(JwtAuthGuard)
  async deleteNotificationTemplate(@CurrentUser() user: any, @Param('type') type: string) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    await this.adminService.deleteNotificationTemplate(type as any);
    return { message: 'Шаблон удален' };
  }

  // CRUD для скинов
  @Get('skins')
  @UseGuards(JwtAuthGuard)
  async getSkins(@CurrentUser() user: any) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.getAllSkins();
  }

  @Post('skins')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    AnyFilesInterceptor({ // Принимаем файлы с любыми именами полей: preview, boardTexture, diceTexture1-6, checkersTexture
      storage: diskStorage({
        destination: (req, file, cb) => {
          // ВСЕ скины сохраняются в backend/uploads/skins - единый путь для всех
          // Nginx отдает их напрямую из /app/uploads через /uploads/skins/
          const uploadsDir = join(process.cwd(), 'uploads', 'skins');
          // Создаем директорию если её нет
          if (!existsSync(uploadsDir)) {
            mkdirSync(uploadsDir, { recursive: true });
          }
          cb(null, uploadsDir);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const fieldName = file.fieldname || 'skin';
          cb(null, `${fieldName}-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        // Разрешаем изображения и другие файлы (для текстур могут быть разные форматы)
        if (file.mimetype.match(/\/(jpg|jpeg|png|gif|webp|svg|json)$/) || file.fieldname) {
          cb(null, true);
        } else {
          cb(new Error('Неподдерживаемый тип файла'), false);
        }
      },
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB для текстур
    }),
  )
  async createSkin(
    @CurrentUser() user: any,
    @Body() body: any,
    @UploadedFiles() files?: Array<{ fieldname: string; filename: string; originalname: string; mimetype: string; size: number }>,
  ) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    
    const skinType = body.type || 'board';
    
    // Для всех типов скинов требуется превью
    if (!body.imageUrl && (!files || !files.find(f => f.fieldname === 'preview' || f.fieldname === 'image'))) {
      throw new BadRequestException('Превью изображение обязательно для всех типов скинов');
    }
    
    // Для кубиков при создании требуется 6 файлов (diceTexture1-6)
    if (skinType === 'dice' && files && files.length > 0) {
      const diceFiles = files.filter(f => f.fieldname && f.fieldname.startsWith('diceTexture') && f.fieldname.match(/diceTexture(\d+)/));
      if (diceFiles.length > 0) {
        const diceNumbers = diceFiles.map(f => {
          const match = f.fieldname.match(/diceTexture(\d+)/);
          return match ? parseInt(match[1]) : 0;
        }).filter(n => n >= 1 && n <= 6).sort((a, b) => a - b);
        
        // Проверяем, что есть все числа от 1 до 6
        const expectedNumbers = [1, 2, 3, 4, 5, 6];
        const missingNumbers = expectedNumbers.filter(n => !diceNumbers.includes(n));
        if (missingNumbers.length > 0) {
          throw new BadRequestException(`Для кубиков требуется загрузить все 6 файлов (diceTexture1-6). Отсутствуют: diceTexture${missingNumbers.join(', diceTexture')}`);
        }
      }
    }
    
    // Обрабатываем загруженные файлы
    let imageUrl = body.imageUrl || null;
    let shopImageUrl = body.shopImageUrl || null;
    let boardTextureUrl = null;
    let diceTextureUrl = null;
    let diceTextureUrls: any = null;
    let checkersTextureUrl = null;
    let whiteCheckersTextureUrl = null;
    let blackCheckersTextureUrl = null;
    
    if (files && files.length > 0) {
      for (const file of files) {
        // Обрабатываем изображение: ресайз и конвертация в SVG
        const originalFilePath = join(process.cwd(), 'uploads', 'skins', file.filename);
        let processedFilePath: string;
        let processedFilename: string;
        
        try {
          // Обрабатываем файл (ресайз и конвертация в SVG)
          processedFilePath = await this.imageProcessor.processUploadedFile(
            originalFilePath,
            file.fieldname,
            skinType,
          );
          processedFilename = processedFilePath.split(/[/\\]/).pop() || file.filename.replace(/\.[^.]+$/, '.svg');
        } catch (error) {
          console.error(`Error processing file ${file.filename}:`, error);
          // Если обработка не удалась, используем оригинальный файл
          processedFilename = file.filename;
        }
        
        const fileUrl = `/uploads/skins/${processedFilename}`;
        
        // Определяем тип файла по fieldname
        if (file.fieldname === 'preview' || file.fieldname === 'image') {
          imageUrl = fileUrl;
        } else if (file.fieldname === 'shopImage' || file.fieldname === 'shopPreview') {
          shopImageUrl = fileUrl; // Отдельное изображение для магазина
        } else if (file.fieldname === 'boardTexture') {
          boardTextureUrl = fileUrl;
        } else if (file.fieldname === 'diceTexture') {
          diceTextureUrl = fileUrl; // Устаревшее, для обратной совместимости
        } else if (file.fieldname && file.fieldname.startsWith('diceTexture')) {
          // Поддержка diceTexture1, diceTexture2, diceTexture3, diceTexture4, diceTexture5, diceTexture6
          const match = file.fieldname.match(/diceTexture(\d+)/);
          if (match && match[1]) {
            const diceNumber = parseInt(match[1]);
            if (diceNumber >= 1 && diceNumber <= 6) {
              if (!diceTextureUrls) diceTextureUrls = {};
              diceTextureUrls[diceNumber] = fileUrl;
            }
          }
        } else if (file.fieldname === 'checkersTexture') {
          checkersTextureUrl = fileUrl; // Устаревшее, для обратной совместимости
        } else if (file.fieldname === 'whiteCheckersTexture') {
          whiteCheckersTextureUrl = fileUrl; // Текстура белых шашек
        } else if (file.fieldname === 'blackCheckersTexture') {
          blackCheckersTextureUrl = fileUrl; // Текстура черных шашек
        }
      }
    }
    
    // В зависимости от типа скина заполняем соответствующие конфиги
    let boardConfig = null;
    let diceConfig = null;
    let checkersConfig = null;
    
    if (skinType === 'board') {
      boardConfig = body.boardConfig ? (typeof body.boardConfig === 'string' ? JSON.parse(body.boardConfig) : body.boardConfig) : {};
    } else if (skinType === 'dice') {
      diceConfig = body.diceConfig ? (typeof body.diceConfig === 'string' ? JSON.parse(body.diceConfig) : body.diceConfig) : {};
    } else if (skinType === 'checkers') {
      checkersConfig = body.checkersConfig ? (typeof body.checkersConfig === 'string' ? JSON.parse(body.checkersConfig) : body.checkersConfig) : {};
    }
    
    const skinData = {
      name: body.name,
      description: body.description || null,
      type: skinType,
      theme: body.theme || skinType,
      boardConfig,
      diceConfig,
      checkersConfig,
      isDefault: body.isDefault === 'true' || body.isDefault === true,
      isPremium: body.isPremium === 'true' || body.isPremium === true,
      weight: body.weight ? parseFloat(body.weight) : 1,
      price: body.price ? parseFloat(body.price) : null,
      rarity: body.rarity || 'common',
      imageUrl,
      shopImageUrl, // Отдельное изображение для магазина
      boardTextureUrl,
      diceTextureUrl,
      diceTextureUrls: diceTextureUrls || null,
      checkersTextureUrl,
      whiteCheckersTextureUrl,
      blackCheckersTextureUrl,
    };
    
    return this.adminService.createSkin(skinData);
  }

  @Put('skins/:id')
  @UseGuards(JwtAuthGuard)
  async updateSkin(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.updateSkin(id, body);
  }

  @Delete('skins/:id')
  @UseGuards(JwtAuthGuard)
  async deleteSkin(@CurrentUser() user: any, @Param('id') id: string) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.deleteSkin(id);
  }

  @Post('skins/:id/upload-image')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          // ВСЕ скины сохраняются в backend/uploads/skins - единый путь для всех
          const uploadsDir = join(process.cwd(), 'uploads', 'skins');
          if (!existsSync(uploadsDir)) {
            mkdirSync(uploadsDir, { recursive: true });
          }
          cb(null, uploadsDir);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `preview-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          cb(null, true);
        } else {
          cb(new Error('Только изображения разрешены'), false);
        }
      },
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB для preview изображения
    }),
  )
  async uploadSkinImage(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @UploadedFile() file?: { fieldname: string; filename: string; originalname: string; mimetype: string; size: number },
  ) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    
    if (!file) {
      throw new BadRequestException('Файл не загружен');
    }
    
    // Обрабатываем изображение: ресайз и конвертация в SVG
    const originalFilePath = join(process.cwd(), 'uploads', 'skins', file.filename);
    let processedFilename: string;
    
    try {
      // Получаем тип скина для определения размеров
      const skin = await this.adminService.getSkin(id);
      const processedFilePath = await this.imageProcessor.processUploadedFile(
        originalFilePath,
        'image',
        skin?.type,
      );
      processedFilename = processedFilePath.split(/[/\\]/).pop() || file.filename.replace(/\.[^.]+$/, '.svg');
    } catch (error) {
      console.error(`Error processing file ${file.filename}:`, error);
      // Если обработка не удалась, используем оригинальный файл
      processedFilename = file.filename;
    }
    
    const fileUrl = `/uploads/skins/${processedFilename}`;
    return this.adminService.updateSkin(id, { imageUrl: fileUrl });
  }

  @Post('skins/:id/upload-textures')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    AnyFilesInterceptor({ // preview, boardTexture/diceTexture1-6/checkersTexture (до 10 файлов для кубиков)
      storage: diskStorage({
        destination: (req, file, cb) => {
          // ВСЕ скины сохраняются в backend/uploads/skins - единый путь для всех
          const uploadsDir = join(process.cwd(), 'uploads', 'skins');
          if (!existsSync(uploadsDir)) {
            mkdirSync(uploadsDir, { recursive: true });
          }
          cb(null, uploadsDir);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const fieldName = file.fieldname || 'skin';
          cb(null, `${fieldName}-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          cb(null, true);
        } else {
          cb(new Error('Только изображения разрешены'), false);
        }
      },
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB для текстур
    }),
  )
  async uploadSkinTextures(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @UploadedFiles() files?: Array<{ fieldname: string; filename: string; originalname: string; mimetype: string; size: number }>,
  ) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    
    if (!files || files.length === 0) {
      throw new BadRequestException('Файлы не загружены');
    }
    
    // Получаем скин для определения типа
    const skin = await this.adminService.getSkin(id);
    if (!skin) {
      throw new BadRequestException('Скин не найден');
    }
    
    const updateData: any = {};
    
    for (const file of files) {
      // Обрабатываем изображение: ресайз и конвертация в SVG
      const originalFilePath = join(process.cwd(), 'uploads', 'skins', file.filename);
      let processedFilePath: string;
      let processedFilename: string;
      
      try {
        // Обрабатываем файл (ресайз и конвертация в SVG)
        processedFilePath = await this.imageProcessor.processUploadedFile(
          originalFilePath,
          file.fieldname,
          skin.type,
        );
        processedFilename = processedFilePath.split(/[/\\]/).pop() || file.filename.replace(/\.[^.]+$/, '.svg');
      } catch (error) {
        console.error(`Error processing file ${file.filename}:`, error);
        // Если обработка не удалась, используем оригинальный файл
        processedFilename = file.filename;
      }
      
      const fileUrl = `/uploads/skins/${processedFilename}`;
      
      if (file.fieldname === 'image' || file.fieldname === 'preview') {
        updateData.imageUrl = fileUrl;
      } else if (file.fieldname === 'shopImage' || file.fieldname === 'shopPreview') {
        updateData.shopImageUrl = fileUrl; // Отдельное изображение для магазина
      } else if (file.fieldname === 'boardTexture' && skin.type === 'board') {
        updateData.boardTextureUrl = fileUrl;
      } else if (file.fieldname === 'diceTexture' && skin.type === 'dice') {
        updateData.diceTextureUrl = fileUrl; // Устаревшее, для обратной совместимости
      } else if (file.fieldname && file.fieldname.startsWith('diceTexture') && skin.type === 'dice') {
        // Поддержка diceTexture1, diceTexture2, diceTexture3, diceTexture4, diceTexture5, diceTexture6
        const match = file.fieldname.match(/diceTexture(\d+)/);
        if (match && match[1]) {
          const diceNumber = parseInt(match[1]);
          if (diceNumber >= 1 && diceNumber <= 6) {
            if (!updateData.diceTextureUrls) updateData.diceTextureUrls = skin.diceTextureUrls || {};
            updateData.diceTextureUrls[diceNumber] = fileUrl;
          }
        }
      } else if (file.fieldname === 'checkersTexture' && skin.type === 'checkers') {
        updateData.checkersTextureUrl = fileUrl; // Устаревшее, для обратной совместимости
      } else if (file.fieldname === 'whiteCheckersTexture' && skin.type === 'checkers') {
        updateData.whiteCheckersTextureUrl = fileUrl; // Текстура белых шашек
      } else if (file.fieldname === 'blackCheckersTexture' && skin.type === 'checkers') {
        updateData.blackCheckersTextureUrl = fileUrl; // Текстура черных шашек
      }
    }
    
    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException('Неверные поля файлов');
    }
    
    return this.adminService.updateSkin(id, updateData);
  }

  // CRUD для квестов
  @Get('quests')
  @UseGuards(JwtAuthGuard)
  async getQuests(@CurrentUser() user: any) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.getAllQuests();
  }

  @Get('quests/:id')
  @UseGuards(JwtAuthGuard)
  async getQuest(@CurrentUser() user: any, @Param('id') id: string) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.getQuest(id);
  }

  @Post('quests')
  @UseGuards(JwtAuthGuard)
  async createQuest(@CurrentUser() user: any, @Body() body: any) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.createQuest(body);
  }

  @Put('quests/:id')
  @UseGuards(JwtAuthGuard)
  async updateQuest(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.updateQuest(id, body);
  }

  @Delete('quests/:id')
  @UseGuards(JwtAuthGuard)
  async deleteQuest(@CurrentUser() user: any, @Param('id') id: string) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.deleteQuest(id);
  }

  // CRUD для кланов
  @Get('clans')
  @UseGuards(JwtAuthGuard)
  async getClans(@CurrentUser() user: any) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.getAllClans();
  }

  @Get('clans/:id')
  @UseGuards(JwtAuthGuard)
  async getClan(@CurrentUser() user: any, @Param('id') id: string) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.getClan(id);
  }

  @Put('clans/:id')
  @UseGuards(JwtAuthGuard)
  async updateClan(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.updateClan(id, body);
  }

  @Delete('clans/:id')
  @UseGuards(JwtAuthGuard)
  async deleteClan(@CurrentUser() user: any, @Param('id') id: string) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.deleteClan(id);
  }

  @Delete('clans/:clanId/members/:userId')
  @UseGuards(JwtAuthGuard)
  async removeClanMember(@CurrentUser() user: any, @Param('clanId') clanId: string, @Param('userId') userId: string) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.removeClanMember(clanId, userId);
  }

  // Расширенное управление пользователями
  @Put('users/:id/balance')
  @UseGuards(JwtAuthGuard)
  async updateUserBalance(@CurrentUser() user: any, @Param('id') userId: string, @Body() body: { narCoin: number; xp?: number }) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.updateUserBalance(userId, body.narCoin, body.xp);
  }

  @Put('users/:id/level')
  @UseGuards(JwtAuthGuard)
  async setUserLevel(@CurrentUser() user: any, @Param('id') userId: string, @Body() body: { level: number }) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.setUserLevel(userId, body.level);
  }

  @Post('users/:id/sync-level')
  @UseGuards(JwtAuthGuard)
  async syncUserLevelFromXP(@CurrentUser() user: any, @Param('id') userId: string) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.syncUserLevelFromXP(userId);
  }

  @Put('users/:id/role')
  @UseGuards(JwtAuthGuard)
  async setUserRole(@CurrentUser() user: any, @Param('id') userId: string, @Body() body: { isAdmin: boolean; isTrainer: boolean }) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.setUserRole(userId, body.isAdmin, body.isTrainer);
  }

  @Post('users/:id/reset-progress')
  @UseGuards(JwtAuthGuard)
  async resetUserProgress(@CurrentUser() user: any, @Param('id') userId: string) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.resetUserProgress(userId);
  }

  @Put('users/:id/referral-settings')
  @UseGuards(JwtAuthGuard)
  async updateUserReferralSettings(
    @CurrentUser() user: any,
    @Param('id') userId: string,
    @Body() body: { referralPercent?: number; referralBaseBonus?: number },
  ) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.updateUserReferralSettings(userId, body);
  }
}

