import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AcademyService } from './academy.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('academy')
export class AcademyController {
  constructor(private readonly academyService: AcademyService) {}

  @Get('courses')
  @UseGuards(JwtAuthGuard)
  async getCourses(@CurrentUser() user: any) {
    return this.academyService.getCourses(user?.id);
  }

  @Get('articles')
  @UseGuards(JwtAuthGuard)
  async getArticles(@CurrentUser() user: any) {
    return this.academyService.getArticles(user?.id);
  }

  @Get('my-materials')
  @UseGuards(JwtAuthGuard)
  async getMyMaterials(@CurrentUser() user: any) {
    return this.academyService.getUserMaterials(user.id);
  }

  @Post('courses/:id/purchase')
  @UseGuards(JwtAuthGuard)
  async purchaseCourse(@CurrentUser() user: any, @Param('id') id: string) {
    return this.academyService.purchaseCourse(user.id, id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@CurrentUser() user: any, @Param('id') id: string) {
    return this.academyService.findOne(id, user?.id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@CurrentUser() user: any, @Body() articleData: any) {
    if (!user.isAdmin) {
      throw new Error('Недостаточно прав');
    }
    return this.academyService.create({ ...articleData, author: user.username });
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(@CurrentUser() user: any, @Param('id') id: string, @Body() articleData: any) {
    if (!user.isAdmin) {
      throw new Error('Недостаточно прав');
    }
    return this.academyService.update(id, articleData);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async delete(@CurrentUser() user: any, @Param('id') id: string) {
    if (!user.isAdmin) {
      throw new Error('Недостаточно прав');
    }
    await this.academyService.delete(id);
    return { message: 'Статья удалена' };
  }
}

