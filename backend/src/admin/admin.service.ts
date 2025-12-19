import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { TournamentsService } from '../tournaments/tournaments.service';
import { AcademyService } from '../academy/academy.service';
import { SkinsService } from '../skins/skins.service';

@Injectable()
export class AdminService {
  constructor(
    private usersService: UsersService,
    private tournamentsService: TournamentsService,
    private academyService: AcademyService,
    private skinsService: SkinsService,
  ) {}

  async getAllUsers() {
    return this.usersService.findAll();
  }

  async banUser(userId: string, reason: string) {
    return this.usersService.banUser(userId, reason);
  }

  async unbanUser(userId: string) {
    return this.usersService.unbanUser(userId);
  }
}

