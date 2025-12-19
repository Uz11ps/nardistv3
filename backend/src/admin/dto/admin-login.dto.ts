import { IsString, IsNotEmpty } from 'class-validator';

export class AdminLoginDto {
  @IsString()
  @IsNotEmpty()
  login: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

