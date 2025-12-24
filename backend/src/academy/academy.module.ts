import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademyService } from './academy.service';
import { CourseTasksService } from './course-tasks.service';
import { AcademyController } from './academy.controller';
import { Article } from './article.entity';
import { UserMaterial } from './user-material.entity';
import { ArticleSlot } from './article-slot.entity';
import { CourseTask } from './course-task.entity';
import { CourseTaskProgress } from './course-task-progress.entity';
import { UsersModule } from '../users/users.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Article, UserMaterial, ArticleSlot, CourseTask, CourseTaskProgress]),
    UsersModule,
    forwardRef(() => AdminModule),
  ],
  controllers: [AcademyController],
  providers: [AcademyService, CourseTasksService],
  exports: [AcademyService, CourseTasksService],
})
export class AcademyModule {}

