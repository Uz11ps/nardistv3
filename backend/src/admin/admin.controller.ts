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
  async adminLogin(@Body() loginDto: AdminLoginDto) {
    if (loginDto.login === '123' && loginDto.password === '123123') {
      // Создаем JWT токен для админа
      const payload = {
        sub: 'admin',
        login: '123',
        isAdmin: true,
      };
      const token = this.jwtService.sign(payload);
      return {
        access_token: token,
        user: {
          id: 'admin',
          login: '123',
          isAdmin: true,
        },
      };
    }
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
    @Body() body: CreateSkinDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    const imageUrl = file ? `/uploads/skins/${file.filename}` : body.imageUrl;
    return this.adminService.createSkin({ ...body, imageUrl });
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
}

