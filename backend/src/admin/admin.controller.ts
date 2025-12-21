import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, UnauthorizedException, UploadedFile, UploadedFiles, UseInterceptors, BadRequestException } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { JwtService } from '@nestjs/jwt';
import { AdminService } from './admin.service';
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
    private readonly jwtService: JwtService,
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
  async sendNotification(@CurrentUser() user: any, @Body() body: { userId?: string; message: string; all?: boolean }) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.sendNotification(body);
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
    FilesInterceptor('files', 4, { // До 4 файлов: preview, boardTexture, diceTexture, checkersTexture
      storage: diskStorage({
        destination: (req, file, cb) => {
          // Используем абсолютный путь для Docker
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
    
    // Обрабатываем загруженные файлы
    let imageUrl = body.imageUrl || null;
    let boardTextureUrl = null;
    let diceTextureUrl = null;
    let checkersTextureUrl = null;
    
    if (files && files.length > 0) {
      for (const file of files) {
        const fileUrl = `/uploads/skins/${file.filename}`;
        // Определяем тип файла по fieldname
        if (file.fieldname === 'preview' || file.fieldname === 'image') {
          imageUrl = fileUrl;
        } else if (file.fieldname === 'boardTexture') {
          boardTextureUrl = fileUrl;
        } else if (file.fieldname === 'diceTexture') {
          diceTextureUrl = fileUrl;
        } else if (file.fieldname === 'checkersTexture') {
          checkersTextureUrl = fileUrl;
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
      boardTextureUrl,
      diceTextureUrl,
      checkersTextureUrl,
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

  @Post('skins/:id/upload-textures')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FilesInterceptor('files', 3, { // preview, boardTexture/diceTexture/checkersTexture
      storage: diskStorage({
        destination: (req, file, cb) => {
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
      const fileUrl = `/uploads/skins/${file.filename}`;
      if (file.fieldname === 'image' || file.fieldname === 'preview') {
        updateData.imageUrl = fileUrl;
      } else if (file.fieldname === 'boardTexture' && skin.type === 'board') {
        updateData.boardTextureUrl = fileUrl;
      } else if (file.fieldname === 'diceTexture' && skin.type === 'dice') {
        updateData.diceTextureUrl = fileUrl;
      } else if (file.fieldname === 'checkersTexture' && skin.type === 'checkers') {
        updateData.checkersTextureUrl = fileUrl;
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
}

