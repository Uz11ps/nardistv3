import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, UnauthorizedException, UploadedFile, UploadedFiles, UseInterceptors, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor, AnyFilesInterceptor } from '@nestjs/platform-express';
import { JwtService } from '@nestjs/jwt';
import { AdminService } from './admin.service';
import { ImageProcessorService } from './image-processor.service';
import { AcademyService } from '../academy/academy.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminAuthGuard } from '../common/guards/admin-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AdminLoginDto } from './dto/admin-login.dto';
import { CreateSkinDto } from './dto/create-skin.dto';
import { CourseTask } from '../academy/course-task.entity';
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
  @UseGuards(AdminAuthGuard)
  async getStats(@CurrentUser() user: any) {
    return this.adminService.getStats();
  }

  @Get('users')
  @UseGuards(AdminAuthGuard)
  async getUsers(@CurrentUser() user: any) {
    return this.adminService.getAllUsers();
  }

  @Get('users/:id')
  @UseGuards(AdminAuthGuard)
  async getUser(@CurrentUser() user: any, @Param('id') id: string) {
    return this.adminService.getUserDetails(id);
  }

  @Post('users/:id/ban')
  @UseGuards(AdminAuthGuard)
  async banUser(@CurrentUser() user: any, @Param('id') id: string, @Body('reason') reason: string) {
    return this.adminService.banUser(id, reason);
  }

  @Post('users/:id/unban')
  @UseGuards(AdminAuthGuard)
  async unbanUser(@CurrentUser() user: any, @Param('id') id: string) {
    return this.adminService.unbanUser(id);
  }

  @Delete('users/:id')
  @UseGuards(AdminAuthGuard)
  async deleteUser(@CurrentUser() user: any, @Param('id') id: string) {
    return this.adminService.deleteUser(id);
  }

  @Post('users/:id/subscription')
  @UseGuards(AdminAuthGuard)
  async giveSubscription(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: { plan: string; months?: number },
  ) {
    return this.adminService.giveSubscription(id, body.plan, body.months);
  }

  @Get('games')
  @UseGuards(AdminAuthGuard)
  async getGames(@CurrentUser() user: any) {
    return this.adminService.getAllGames();
  }

  @Get('games/:id')
  @UseGuards(AdminAuthGuard)
  async getGame(@CurrentUser() user: any, @Param('id') id: string) {
    return this.adminService.getGameDetails(id);
  }

  @Post('notifications')
  @UseGuards(AdminAuthGuard)
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
    
    let imageUrl: string | undefined;
    if (file) {
      const fileUrl = `/uploads/notifications/${file.filename}`;
      imageUrl = fileUrl;
    }
    
    return this.adminService.sendNotification({ ...body, imageUrl });
  }

  @Delete('notifications/:id')
  @UseGuards(AdminAuthGuard)
  async deleteNotification(@CurrentUser() user: any, @Param('id') id: string) {
    return this.adminService.deleteNotification(id);
  }

  @Delete('notifications/user/:userId')
  @UseGuards(AdminAuthGuard)
  async deleteUserNotifications(@CurrentUser() user: any, @Param('userId') userId: string) {
    return this.adminService.deleteUserNotifications(userId);
  }

  @Delete('notifications/all')
  @UseGuards(AdminAuthGuard)
  async deleteAllNotifications(@CurrentUser() user: any) {
    return this.adminService.deleteAllNotifications();
  }

  @Delete('notifications/bot/all')
  @UseGuards(AdminAuthGuard)
  async deleteAllBotNotifications(@CurrentUser() user: any) {
    return this.adminService.deleteAllBotNotifications();
  }

  @Delete('notifications/bot/last')
  @UseGuards(AdminAuthGuard)
  async deleteLastBotNotifications(@CurrentUser() user: any) {
    return this.adminService.deleteLastBotNotifications();
  }

  @Post('games/create')
  @UseGuards(AdminAuthGuard)
  async createGame(
    @CurrentUser() user: any, 
    @Body() body: { 
      player1Id: string; 
      player2Id?: string; 
      mode: string; 
      type: string;
      stake?: number;
      moveTimeout?: number;
      tournamentId?: string;
    }
  ) {
    return this.adminService.createGame(body);
  }

  @Post('tournaments/create')
  @UseGuards(AdminAuthGuard)
  async createTournament(@CurrentUser() user: any, @Body() body: any) {
    return this.adminService.createTournament(body);
  }

  @Get('tournaments')
  @UseGuards(AdminAuthGuard)
  async getTournaments(@CurrentUser() user: any) {
    return this.adminService.getAllTournaments();
  }

  @Get('tournaments/:id')
  @UseGuards(AdminAuthGuard)
  async getTournament(@CurrentUser() user: any, @Param('id') id: string) {
    return this.adminService.getTournament(id);
  }

  @Put('tournaments/:id')
  @UseGuards(AdminAuthGuard)
  async updateTournament(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.adminService.updateTournament(id, body);
  }

  @Delete('tournaments/:id')
  @UseGuards(AdminAuthGuard)
  async deleteTournament(@CurrentUser() user: any, @Param('id') id: string) {
    return this.adminService.deleteTournament(id);
  }

  @Post('academy/create')
  @UseGuards(AdminAuthGuard)
  async createArticle(@CurrentUser() user: any, @Body() body: any) {
    return this.adminService.createArticle(body);
  }

  @Get('academy')
  @UseGuards(AdminAuthGuard)
  async getArticles(@CurrentUser() user: any) {
    return this.adminService.getAllArticles();
  }

  @Get('courses/pending')
  @UseGuards(AdminAuthGuard)
  async getPendingCourses(@CurrentUser() user: any) {
    if (!user.isAdmin && !user.isTrainer) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.getPendingCourses();
  }

  @Post('courses/:id/verify')
  @UseGuards(AdminAuthGuard)
  async verifyCourse(@CurrentUser() user: any, @Param('id') id: string) {
    if (!user.isAdmin && !user.isTrainer) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.academyService.verifyCourse(id, user.id);
  }

  @Post('courses/:id/reject')
  @UseGuards(AdminAuthGuard)
  async rejectCourse(@CurrentUser() user: any, @Param('id') id: string) {
    if (!user.isAdmin && !user.isTrainer) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    await this.academyService.rejectCourse(id);
    return { message: 'Курс отклонен' };
  }

  @Post('settings')
  @UseGuards(AdminAuthGuard)
  async setSystemSetting(
    @CurrentUser() user: any,
    @Body() body: { key: string; value: string; description?: string },
  ) {
    return this.adminService.setSystemSetting(body.key, body.value, body.description);
  }

  @Put('academy/:id')
  @UseGuards(AdminAuthGuard)
  async updateArticle(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.adminService.updateArticle(id, body);
  }

  @Delete('academy/:id')
  @UseGuards(AdminAuthGuard)
  async deleteArticle(@CurrentUser() user: any, @Param('id') id: string) {
    return this.adminService.deleteArticle(id);
  }

  // ==================== ONBOARDING TASKS MANAGEMENT ====================

  @Get('onboarding/tasks')
  @UseGuards(AdminAuthGuard)
  async getAllOnboardingTasks(@CurrentUser() user: any) {
    return this.adminService.getAllOnboardingTasks();
  }

  @Get('onboarding/tasks/stats')
  @UseGuards(AdminAuthGuard)
  async getOnboardingStats(@CurrentUser() user: any) {
    return this.adminService.getOnboardingStats();
  }

  @Get('onboarding/tasks/:id')
  @UseGuards(AdminAuthGuard)
  async getOnboardingTask(@CurrentUser() user: any, @Param('id') id: string) {
    return this.adminService.getOnboardingTask(id);
  }

  @Post('onboarding/tasks')
  @UseGuards(AdminAuthGuard)
  async createOnboardingTask(@CurrentUser() user: any, @Body() body: any) {
    return this.adminService.createOnboardingTask(body);
  }

  @Put('onboarding/tasks/:id')
  @UseGuards(AdminAuthGuard)
  async updateOnboardingTask(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.adminService.updateOnboardingTask(id, body);
  }

  @Delete('onboarding/tasks/:id')
  @UseGuards(AdminAuthGuard)
  async deleteOnboardingTask(@CurrentUser() user: any, @Param('id') id: string) {
    await this.adminService.deleteOnboardingTask(id);
    return { message: 'Онбординговое задание удалено' };
  }

  @Get('city/rewards')
  @UseGuards(AdminAuthGuard)
  async getCityRewards(@CurrentUser() user: any) {
    return this.adminService.getCityRewards();
  }

  @Put('city/rewards')
  @UseGuards(AdminAuthGuard)
  async updateCityRewards(@CurrentUser() user: any, @Body() body: any) {
    return this.adminService.updateCityRewards(body);
  }

  // CRUD для территорий
  @Get('districts')
  @UseGuards(AdminAuthGuard)
  async getAllDistricts(@CurrentUser() user: any) {
    return this.adminService.getAllDistricts();
  }

  @Get('districts/:id')
  @UseGuards(AdminAuthGuard)
  async getDistrict(@CurrentUser() user: any, @Param('id') id: string) {
    return this.adminService.getDistrict(id);
  }

  @Post('districts')
  @UseGuards(AdminAuthGuard)
  async createDistrict(@CurrentUser() user: any, @Body() body: any) {
    return this.adminService.createDistrict(body);
  }

  @Put('districts/:id')
  @UseGuards(AdminAuthGuard)
  async updateDistrict(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.adminService.updateDistrict(id, body);
  }

  @Delete('districts/:id')
  @UseGuards(AdminAuthGuard)
  async deleteDistrict(@CurrentUser() user: any, @Param('id') id: string) {
    return this.adminService.deleteDistrict(id);
  }

  // CRUD для конфигураций строений
  @Get('buildings')
  @UseGuards(AdminAuthGuard)
  async getAllBuildings(@CurrentUser() user: any) {
    return this.adminService.getAllBuildingConfigs();
  }

  @Get('buildings/:id')
  @UseGuards(AdminAuthGuard)
  async getBuilding(@CurrentUser() user: any, @Param('id') id: string) {
    return this.adminService.getBuildingConfig(id);
  }

  @Post('buildings')
  @UseGuards(AdminAuthGuard)
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
  @UseGuards(AdminAuthGuard)
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
  @UseGuards(AdminAuthGuard)
  async deleteBuilding(@CurrentUser() user: any, @Param('id') id: string) {
    return this.adminService.deleteBuildingConfig(id);
  }

  // CRUD для шаблонов уведомлений Telegram
  @Get('notification-templates')
  @UseGuards(AdminAuthGuard)
  async getAllNotificationTemplates(@CurrentUser() user: any) {
    return this.adminService.getAllNotificationTemplates();
  }

  @Get('notification-templates/:type')
  @UseGuards(AdminAuthGuard)
  async getNotificationTemplate(@CurrentUser() user: any, @Param('type') type: string) {
    return this.adminService.getNotificationTemplate(type as any);
  }

  @Post('notification-templates')
  @UseGuards(AdminAuthGuard)
  async createNotificationTemplate(@CurrentUser() user: any, @Body() body: any) {
    return this.adminService.createNotificationTemplate(body);
  }

  @Put('notification-templates/:type')
  @UseGuards(AdminAuthGuard)
  async updateNotificationTemplate(@CurrentUser() user: any, @Param('type') type: string, @Body() body: any) {
    return this.adminService.updateNotificationTemplate(type as any, body);
  }

  @Delete('notification-templates/:type')
  @UseGuards(AdminAuthGuard)
  async deleteNotificationTemplate(@CurrentUser() user: any, @Param('type') type: string) {
    await this.adminService.deleteNotificationTemplate(type as any);
    return { message: 'Шаблон удален' };
  }

  // CRUD для скинов
  @Get('skins')
  @UseGuards(AdminAuthGuard)
  async getSkins(@CurrentUser() user: any) {
    return this.adminService.getAllSkins();
  }

  @Post('skins')
  @UseGuards(AdminAuthGuard)
  async createSkin(
    @CurrentUser() user: any,
    @Body() body: any,
  ) {
    const skinType = body.type || 'board';
    
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
    };
    
    return this.adminService.createSkin(skinData);
  }

  @Put('skins/:id')
  @UseGuards(AdminAuthGuard)
  async updateSkin(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.adminService.updateSkin(id, body);
  }

  @Delete('skins/:id')
  @UseGuards(AdminAuthGuard)
  async deleteSkin(@CurrentUser() user: any, @Param('id') id: string) {
    return this.adminService.deleteSkin(id);
  }

  // Эндпоинты для загрузки изображений удалены - скины теперь работают только на материалах (цветах)

  // CRUD для квестов
  @Get('quests')
  @UseGuards(AdminAuthGuard)
  async getQuests(@CurrentUser() user: any) {
    return this.adminService.getAllQuests();
  }

  @Get('quests/:id')
  @UseGuards(AdminAuthGuard)
  async getQuest(@CurrentUser() user: any, @Param('id') id: string) {
    return this.adminService.getQuest(id);
  }

  @Post('quests')
  @UseGuards(AdminAuthGuard)
  async createQuest(@CurrentUser() user: any, @Body() body: any) {
    return this.adminService.createQuest(body);
  }

  @Put('quests/:id')
  @UseGuards(AdminAuthGuard)
  async updateQuest(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.adminService.updateQuest(id, body);
  }

  @Delete('quests/:id')
  @UseGuards(AdminAuthGuard)
  async deleteQuest(@CurrentUser() user: any, @Param('id') id: string) {
    return this.adminService.deleteQuest(id);
  }

  // CRUD для кланов
  @Get('clans')
  @UseGuards(AdminAuthGuard)
  async getClans(@CurrentUser() user: any) {
    return this.adminService.getAllClans();
  }

  @Get('clans/:id')
  @UseGuards(AdminAuthGuard)
  async getClan(@CurrentUser() user: any, @Param('id') id: string) {
    return this.adminService.getClan(id);
  }

  @Put('clans/:id')
  @UseGuards(AdminAuthGuard)
  async updateClan(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.adminService.updateClan(id, body);
  }

  @Delete('clans/:id')
  @UseGuards(AdminAuthGuard)
  async deleteClan(@CurrentUser() user: any, @Param('id') id: string) {
    return this.adminService.deleteClan(id);
  }

  @Delete('clans/:clanId/members/:userId')
  @UseGuards(AdminAuthGuard)
  async removeClanMember(@CurrentUser() user: any, @Param('clanId') clanId: string, @Param('userId') userId: string) {
    return this.adminService.removeClanMember(clanId, userId);
  }

  // Расширенное управление пользователями
  @Put('users/:id/balance')
  @UseGuards(AdminAuthGuard)
  async updateUserBalance(@CurrentUser() user: any, @Param('id') userId: string, @Body() body: { narCoin: number; xp?: number }) {
    return this.adminService.updateUserBalance(userId, body.narCoin, body.xp);
  }

  @Put('users/:id/level')
  @UseGuards(AdminAuthGuard)
  async setUserLevel(@CurrentUser() user: any, @Param('id') userId: string, @Body() body: { level: number }) {
    return this.adminService.setUserLevel(userId, body.level);
  }

  @Post('users/:id/recalculate-skill-points')
  @UseGuards(AdminAuthGuard)
  async recalculateSkillPoints(@CurrentUser() user: any, @Param('id') userId: string) {
    return this.adminService.recalculateSkillPoints(userId);
  }

  @Post('users/:id/sync-level')
  @UseGuards(AdminAuthGuard)
  async syncUserLevelFromXP(@CurrentUser() user: any, @Param('id') userId: string) {
    return this.adminService.syncUserLevelFromXP(userId);
  }

  @Put('users/:id/role')
  @UseGuards(AdminAuthGuard)
  async setUserRole(@CurrentUser() user: any, @Param('id') userId: string, @Body() body: { isAdmin: boolean; isTrainer: boolean }) {
    return this.adminService.setUserRole(userId, body.isAdmin, body.isTrainer);
  }

  @Post('users/:id/reset-progress')
  @UseGuards(AdminAuthGuard)
  async resetUserProgress(@CurrentUser() user: any, @Param('id') userId: string) {
    return this.adminService.resetUserProgress(userId);
  }

  @Put('users/:id/referral-settings')
  @UseGuards(AdminAuthGuard)
  async updateUserReferralSettings(
    @CurrentUser() user: any,
    @Param('id') userId: string,
    @Body() body: { referralPercent?: number; referralBaseBonus?: number },
  ) {
    return this.adminService.updateUserReferralSettings(userId, body);
  }

  /**
   * Получить все кошельки пользователей
   */
  @Get('wallets')
  @UseGuards(AdminAuthGuard)
  async getAllWallets(@CurrentUser() user: any) {
    return this.adminService.getAllWallets();
  }

  /**
   * Получить расшифрованный приватный ключ кошелька (только для админа)
   */
  @Get('wallets/:walletId/private-key')
  @UseGuards(AdminAuthGuard)
  async getWalletPrivateKey(@CurrentUser() user: any, @Param('walletId') walletId: string) {
    return this.adminService.getWalletPrivateKey(walletId);
  }

  /**
   * Получить транзакции пользователя
   */
  @Get('users/:userId/transactions')
  @UseGuards(AdminAuthGuard)
  async getUserTransactions(@CurrentUser() user: any, @Param('userId') userId: string) {
    return this.adminService.getUserTransactions(userId);
  }

  /**
   * Получить все транзакции
   */
  @Get('transactions')
  @UseGuards(AdminAuthGuard)
  async getAllTransactions(@CurrentUser() user: any, @Query('limit') limit?: number) {
    return this.adminService.getAllTransactions(limit || 100);
  }

  /**
   * Проверить статус транзакции в блокчейне
   */
  @Post('transactions/:transactionId/check')
  @UseGuards(AdminAuthGuard)
  async checkTransactionStatus(@CurrentUser() user: any, @Param('transactionId') transactionId: string) {
    return this.adminService.checkTransactionStatus(transactionId);
  }

  // ========== РАСШИРЕННОЕ РЕДАКТИРОВАНИЕ ПОЛЬЗОВАТЕЛЕЙ ==========
  @Put('users/:id/full')
  @UseGuards(AdminAuthGuard)
  async updateUserFull(
    @CurrentUser() user: any,
    @Param('id') userId: string,
    @Body() body: {
      narCoin?: number;
      xp?: number;
      level?: number;
      energy?: number;
      maxEnergy?: number;
      lives?: number;
      maxLives?: number;
      skillPoints?: number;
      freeSkillPoints?: number;
      economySp?: number;
      energySp?: number;
      livesSp?: number;
      powerSp?: number;
      hasBusinessLicense?: boolean;
    },
  ) {
    return this.adminService.updateUserFull(userId, body);
  }

  // ========== ОТДЕЛЬНЫЕ ЭНДПОИНТЫ ДЛЯ РЕДАКТИРОВАНИЯ ПОЛЬЗОВАТЕЛЕЙ ==========
  
  // Базовая информация
  @Put('users/:id/profile')
  @UseGuards(AdminAuthGuard)
  async updateUserProfile(
    @CurrentUser() user: any,
    @Param('id') userId: string,
    @Body() body: {
      username?: string;
      nickname?: string;
      firstName?: string;
      lastName?: string;
      country?: string;
      languageCode?: string;
      avatarUrl?: string;
    },
  ) {
    return this.adminService.updateUserProfile(userId, body);
  }

  // Telegram данные
  @Put('users/:id/telegram')
  @UseGuards(AdminAuthGuard)
  async updateUserTelegram(
    @CurrentUser() user: any,
    @Param('id') userId: string,
    @Body() body: {
      telegramId?: string;
    },
  ) {
    return this.adminService.updateUserTelegram(userId, body);
  }

  // Реферальная программа
  @Put('users/:id/referral')
  @UseGuards(AdminAuthGuard)
  async updateUserReferral(
    @CurrentUser() user: any,
    @Param('id') userId: string,
    @Body() body: {
      referralCode?: string;
      referredBy?: string;
      referralPercent?: number;
      referralBaseBonus?: number;
      totalReferralEarnings?: number;
    },
  ) {
    return this.adminService.updateUserReferral(userId, body);
  }

  // Экономика
  @Put('users/:id/economy')
  @UseGuards(AdminAuthGuard)
  async updateUserEconomy(
    @CurrentUser() user: any,
    @Param('id') userId: string,
    @Body() body: {
      narCoin?: number;
      xp?: number;
      level?: number;
    },
  ) {
    return this.adminService.updateUserEconomy(userId, body);
  }

  // Энергия
  @Put('users/:id/energy')
  @UseGuards(AdminAuthGuard)
  async updateUserEnergy(
    @CurrentUser() user: any,
    @Param('id') userId: string,
    @Body() body: {
      energy?: number;
      maxEnergy?: number;
    },
  ) {
    return this.adminService.updateUserEnergy(userId, body);
  }

  // Жизни
  @Put('users/:id/lives')
  @UseGuards(AdminAuthGuard)
  async updateUserLives(
    @CurrentUser() user: any,
    @Param('id') userId: string,
    @Body() body: {
      lives?: number;
      maxLives?: number;
    },
  ) {
    return this.adminService.updateUserLives(userId, body);
  }

  // Skill Points
  @Put('users/:id/skill-points')
  @UseGuards(AdminAuthGuard)
  async updateUserSkillPoints(
    @CurrentUser() user: any,
    @Param('id') userId: string,
    @Body() body: {
      skillPoints?: number;
      freeSkillPoints?: number;
      economySp?: number;
      energySp?: number;
      livesSp?: number;
      powerSp?: number;
    },
  ) {
    return this.adminService.updateUserSkillPoints(userId, body);
  }

  // Усиления
  @Put('users/:id/enhancement')
  @UseGuards(AdminAuthGuard)
  async updateUserEnhancement(
    @CurrentUser() user: any,
    @Param('id') userId: string,
    @Body() body: {
      enhancement?: string;
    },
  ) {
    return this.adminService.updateUserEnhancement(userId, body);
  }

  // Лицензия
  @Put('users/:id/business-license')
  @UseGuards(AdminAuthGuard)
  async updateUserBusinessLicense(
    @CurrentUser() user: any,
    @Param('id') userId: string,
    @Body() body: {
      hasBusinessLicense?: boolean;
    },
  ) {
    return this.adminService.updateUserBusinessLicense(userId, body);
  }

  // Статус (бан, админ, гость)
  @Put('users/:id/status')
  @UseGuards(AdminAuthGuard)
  async updateUserStatus(
    @CurrentUser() user: any,
    @Param('id') userId: string,
    @Body() body: {
      isBanned?: boolean;
      banReason?: string;
      isAdmin?: boolean;
      isGuest?: boolean;
    },
  ) {
    return this.adminService.updateUserStatus(userId, body);
  }

  // ========== УПРАВЛЕНИЕ ЦЕНАМИ ==========
  @Get('prices/subscription')
  @UseGuards(AdminAuthGuard)
  async getSubscriptionPrices(@CurrentUser() user: any) {
    return this.adminService.getSubscriptionPrices();
  }

  @Put('prices/subscription')
  @UseGuards(AdminAuthGuard)
  async updateSubscriptionPrices(
    @CurrentUser() user: any,
    @Body() body: {
      month_1?: number;
      month_3?: number;
      month_12?: number;
    },
  ) {
    return this.adminService.updateSubscriptionPrices(body);
  }

  @Get('prices/nar-coin')
  @UseGuards(AdminAuthGuard)
  async getNarCoinPrices(@CurrentUser() user: any) {
    return this.adminService.getNarCoinPrices();
  }

  @Put('prices/nar-coin')
  @UseGuards(AdminAuthGuard)
  async updateNarCoinPrices(
    @CurrentUser() user: any,
    @Body() body: { packages: Array<{ amount: number; price: number }> },
  ) {
    return this.adminService.updateNarCoinPrices(body.packages);
  }

  // ========== СИСТЕМНЫЕ НАСТРОЙКИ ==========
  @Get('system-settings')
  @UseGuards(AdminAuthGuard)
  async getSystemSettings(@CurrentUser() user: any) {
    return this.adminService.getSystemSettings();
  }

  @Put('system-settings')
  @UseGuards(AdminAuthGuard)
  async updateSystemSettings(
    @CurrentUser() user: any,
    @Body() body: Record<string, any>,
  ) {
    return this.adminService.updateSystemSettings(body);
  }

  // ========== КУРСЫ (ПОЛНОЕ РЕДАКТИРОВАНИЕ) ==========
  @Put('courses/:id/full')
  @UseGuards(AdminAuthGuard)
  async updateCourseFull(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() body: Partial<CourseTask>,
  ) {
    return this.adminService.updateCourseFull(id, body);
  }

  // ========== СТАТИСТИКА ==========
  @Get('statistics')
  @UseGuards(AdminAuthGuard)
  async getStatistics(@CurrentUser() user: any) {
    return this.adminService.getStatistics();
  }

  @Get('payment-stats')
  @UseGuards(AdminAuthGuard)
  async getPaymentStats(@CurrentUser() user: any) {
    return this.adminService.getPaymentStats();
  }

  // ========== РЕПЛЕЙ ИГРЫ ==========
  @Get('games/:gameId/replay')
  @UseGuards(AdminAuthGuard)
  async getGameReplay(
    @CurrentUser() user: any,
    @Param('gameId') gameId: string,
    @Query('step') step?: string,
  ) {
    return this.adminService.getGameReplay(gameId, step ? parseInt(step, 10) : undefined);
  }

  // ==================== PROGRESSION CONFIG MANAGEMENT ====================

  @Get('progression/config')
  @UseGuards(AdminAuthGuard)
  async getProgressionConfig(@CurrentUser() user: any) {
    return this.adminService.getProgressionConfig();
  }

  @Put('progression/config')
  @UseGuards(AdminAuthGuard)
  async updateProgressionConfig(@CurrentUser() user: any, @Body() body: any) {
    return this.adminService.updateProgressionConfig(body);
  }
}

