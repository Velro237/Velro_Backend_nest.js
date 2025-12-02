import { PartialType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';
import { IsString, MinLength, ValidateIf } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiPropertyOptional({ example: 'John' })
  @ValidateIf((o) => o.firstName !== undefined)
  @IsString()
  @MinLength(1, { message: 'First name cannot be empty' })
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @ValidateIf((o) => o.lastName !== undefined)
  @IsString()
  @MinLength(1, { message: 'Last name cannot be empty' })
  lastName?: string;

  @ApiPropertyOptional({ example: 'johndoe' })
  @ValidateIf((o) => o.username !== undefined)
  @IsString()
  @MinLength(1, { message: 'Username cannot be empty' })
  username?: string;
}
