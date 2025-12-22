import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademyService } from './academy.service';
import { AcademyController } from './academy.controller';
import { Article } from './article.entity';
import { UserMaterial } from './user-material.entity';
import { ArticleSlot } from './article-slot.entity';
import { UsersModule } from '../users/users.module';
import { AdminModule } from '../admin/admin.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Article, UserMaterial, ArticleSlot]),
    UsersModule,
    forwardRef(() => AdminModule),
  ],
  controllers: [AcademyController],
  providers: [AcademyService],
  exports: [AcademyService],
})
export class AcademyModule {}

