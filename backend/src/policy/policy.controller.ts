import { Controller, Get, Post, Put, Body, Param, UseGuards } from '@nestjs/common';
import { PolicyService } from './policy.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminAuthGuard } from '../common/guards/admin-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UnauthorizedException } from '@nestjs/common';

@Controller('policy')
export class PolicyController {
  constructor(private readonly policyService: PolicyService) {}

  @Get(':type')
  async getPolicy(@Param('type') type: 'privacy' | 'agreement') {
    const policy = await this.policyService.getPolicy(type);
    if (!policy) {
      return { type, content: 'Политика еще не создана' };
    }
    return policy;
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async createPolicy(
    @CurrentUser() user: any,
    @Body() body: { type: 'privacy' | 'agreement'; content: string },
  ) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.policyService.createOrUpdatePolicy(body.type, body.content);
  }

  @Put(':type')
  @UseGuards(JwtAuthGuard)
  async updatePolicy(
    @CurrentUser() user: any,
    @Param('type') type: 'privacy' | 'agreement',
    @Body() body: { content: string },
  ) {
    if (!user.isAdmin) {
      throw new UnauthorizedException('Недостаточно прав');
    }
    return this.policyService.createOrUpdatePolicy(type, body.content);
  }

  @Get('admin/all')
  @UseGuards(AdminAuthGuard)
  async getAllPolicies(@CurrentUser() user: any) {
    return this.policyService.getAllPolicies();
  }
}

