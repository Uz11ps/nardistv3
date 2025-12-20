import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, UnauthorizedException, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtService } from '@nestjs/jwt';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AdminLoginDto } from './dto/admin-login.dto';
import { CreateSkinDto } from './dto/create-skin.dto';
import { diskStorage } from 'multer';
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
    FileInterceptor('image', {
      storage: diskStorage({
        destination: './uploads/skins',
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, `skin-${uniqueSuffix}${extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (file.mimetype.match(/\/(jpg|jpeg|png|gif|webp)$/)) {
          cb(null, true);
        } else {
          cb(new Error('Только изображения разрешены'), false);
        }
      },
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    }),
  )
  async createSkin(
    @CurrentUser() user: any,
    @Body() body: any,
    @UploadedFile() file?: { filename: string; originalname: string; mimetype: string; size: number },
  ) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    
    // При multipart/form-data все значения приходят как строки, нужно их распарсить
    const imageUrl = file ? `/uploads/skins/${file.filename}` : body.imageUrl;
    
    const skinData = {
      name: body.name,
      description: body.description || null,
      theme: body.theme,
      boardConfig: body.boardConfig ? (typeof body.boardConfig === 'string' ? JSON.parse(body.boardConfig) : body.boardConfig) : {},
      diceConfig: body.diceConfig ? (typeof body.diceConfig === 'string' ? JSON.parse(body.diceConfig) : body.diceConfig) : {},
      isDefault: body.isDefault === 'true' || body.isDefault === true,
      isPremium: body.isPremium === 'true' || body.isPremium === true,
      weight: body.weight ? parseFloat(body.weight) : 1,
      price: body.price ? parseFloat(body.price) : null,
      rarity: body.rarity || 'common',
      imageUrl,
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
  async uploadSkinImage(@CurrentUser() user: any, @Param('id') id: string, @Body() body: { imageUrl: string }) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.adminService.updateSkinImage(id, body.imageUrl);
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

