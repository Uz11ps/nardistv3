import { Controller, Get, Put, Post, Body, UseGuards, Param } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@CurrentUser() user: any) {
    return this.usersService.findOne(user.id);
  }

  @Put('me')
  @UseGuards(JwtAuthGuard)
  async updateMe(@CurrentUser() user: any, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(user.id, updateUserDto);
  }

  @Get('onboarding-progress')
  @UseGuards(JwtAuthGuard)
  async getOnboardingProgress(@CurrentUser() user: any) {
    return this.usersService.getOnboardingProgress(user.id);
  }

  @Post('complete-onboarding-step')
  @UseGuards(JwtAuthGuard)
  async completeOnboardingStep(
    @CurrentUser() user: any,
    @Body() body: { stepId: string },
  ) {
    return this.usersService.completeOnboardingStep(user.id, body.stepId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getUser(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }
}

