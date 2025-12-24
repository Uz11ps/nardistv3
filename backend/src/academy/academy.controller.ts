import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { AcademyService } from './academy.service';
import { CourseTasksService } from './course-tasks.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('academy')
export class AcademyController {
  constructor(
    private readonly academyService: AcademyService,
    private readonly courseTasksService: CourseTasksService,
  ) {}

  @Get('courses')
  @UseGuards(JwtAuthGuard)
  async getCourses(@CurrentUser() user: any) {
    return this.academyService.getCourses(user?.id);
  }

  @Get('articles')
  @UseGuards(JwtAuthGuard)
  async getArticles(@CurrentUser() user: any) {
    return this.academyService.getArticles(user?.id, user?.isAdmin || false);
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

  @Get('materials/:id')
  @UseGuards(JwtAuthGuard)
  async getMaterial(@CurrentUser() user: any, @Param('id') id: string) {
    return this.academyService.findOne(id, user?.id);
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
    return this.academyService.create({ ...articleData, author: user.username }, true);
  }

  @Post('slots/purchase')
  @UseGuards(JwtAuthGuard)
  async purchaseSlot(@CurrentUser() user: any, @Body('price') price?: number) {
    return this.academyService.purchaseArticleSlot(user.id, price);
  }

  @Get('slots')
  @UseGuards(JwtAuthGuard)
  async getUserSlots(@CurrentUser() user: any) {
    return this.academyService.getUserSlots(user.id);
  }

  @Post('slots/:slotId/create')
  @UseGuards(JwtAuthGuard)
  async createUserArticle(
    @CurrentUser() user: any,
    @Param('slotId') slotId: string,
    @Body() articleData: { title: string; content: string; telegraphData?: any },
  ) {
    return this.academyService.createUserArticle(user.id, slotId, articleData);
  }

  @Post('courses/create')
  @UseGuards(JwtAuthGuard)
  async createUserCourse(
    @CurrentUser() user: any,
    @Body() courseData: { title: string; description?: string; content: string; price: number },
  ) {
    const course = await this.academyService.createUserCourse(user.id, courseData);
    return { message: 'Курс создан и отправлен на верификацию', course };
  }

  @Put('my-articles/:id')
  @UseGuards(JwtAuthGuard)
  async updateUserArticle(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() articleData: { title?: string; content?: string; telegraphData?: any },
  ) {
    return this.academyService.updateUserArticle(user.id, id, articleData);
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

  // Задания курсов
  @Get('courses/:courseId/tasks')
  @UseGuards(JwtAuthGuard)
  async getCourseTasks(@CurrentUser() user: any, @Param('courseId') courseId: string) {
    return this.courseTasksService.getCourseTasks(courseId, user.id);
  }

  @Post('courses/:courseId/tasks')
  @UseGuards(JwtAuthGuard)
  async createTask(
    @CurrentUser() user: any,
    @Param('courseId') courseId: string,
    @Body() taskData: any,
  ) {
    if (!user.isAdmin) {
      throw new Error('Недостаточно прав');
    }
    return this.courseTasksService.createTask(courseId, taskData);
  }

  @Post('tasks')
  @UseGuards(JwtAuthGuard)
  async createTaskWithoutCourse(
    @CurrentUser() user: any,
    @Body() taskData: { courseId?: string | null } & any,
  ) {
    if (!user.isAdmin) {
      throw new Error('Недостаточно прав');
    }
    const { courseId, ...rest } = taskData;
    return this.courseTasksService.createTask(courseId || null, rest);
  }

  @Post('tasks/:taskId/progress')
  @UseGuards(JwtAuthGuard)
  async updateTaskProgress(
    @CurrentUser() user: any,
    @Param('taskId') taskId: string,
    @Body() progressData: any,
  ) {
    return this.courseTasksService.updateTaskProgress(user.id, taskId, progressData);
  }

  @Post('tasks/:taskId/claim')
  @UseGuards(JwtAuthGuard)
  async claimTaskReward(@CurrentUser() user: any, @Param('taskId') taskId: string) {
    return this.courseTasksService.claimTaskReward(user.id, taskId);
  }

  @Get('onboarding/tasks')
  @UseGuards(JwtAuthGuard)
  async getOnboardingTasks(@CurrentUser() user: any) {
    return this.courseTasksService.getOnboardingTasks(user.id);
  }
}

