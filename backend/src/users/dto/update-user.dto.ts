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
}

