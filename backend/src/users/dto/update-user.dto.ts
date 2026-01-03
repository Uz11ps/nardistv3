import { IsString, IsOptional, IsNumber, IsBoolean } from 'class-validator';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  nickname?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @IsNumber()
  @IsOptional()
  narCoin?: number;

  @IsBoolean()
  @IsOptional()
  onboardingCompleted?: boolean;

  @IsBoolean()
  @IsOptional()
  profileSetupCompleted?: boolean;

  @IsBoolean()
  @IsOptional()
  starterKitClaimed?: boolean;

  @IsBoolean()
  @IsOptional()
  isGuest?: boolean;

  @IsString()
  @IsOptional()
  birthday?: string; // Дата в формате YYYY-MM-DD

  @IsString()
  @IsOptional()
  timezone?: string; // IANA timezone (например, 'Europe/Moscow', 'America/New_York')
}
