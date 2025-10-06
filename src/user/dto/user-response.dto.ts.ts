import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from 'generated/prisma';

export class UserResponseDto {
  @ApiProperty({ example: 'a3f0cfe6-8b8c-4e2f-9a0b-8b9c5c1f3f20' })
  id!: string;

  @ApiProperty({ example: 'user@example.com' })
  email!: string;

  @ApiProperty({ example: 'Jane Doe', nullable: true })
  name!: string | null;

  @ApiProperty({ example: 'Jane Doe', nullable: true })
  firstName!: string | null;

  @ApiProperty({ example: 'Jane Doe', nullable: true })
  lastName!: string | null;

  @ApiProperty({ example: '+237690264775', nullable: false })
  phone!: string | null;

  @ApiProperty({ example: 'Messassi', nullable: false })
  address!: string | null;

  @ApiProperty({ example: 'Yaounde', nullable: true })
  city!: string | null;

  @ApiProperty({ example: 'Cameroun', nullable: true })
  state!: string | null;

  @ApiProperty({ example: 'Zip', nullable: true })
  zip!: string | null;

  @ApiProperty({ example: 'true', nullable: false })
  isFreightForwarder!: string | null;

  @ApiProperty({ example: 'Company', nullable: false })
  companyName!: string | null;

  @ApiProperty({ example: 'Adresse', nullable: false })
  companyAddress!: string | null;

  @ApiProperty({ example: 'https://example.com/avatar.png', nullable: true })
  picture!: string | null;

  @ApiProperty({ enum: UserRole, example: UserRole.USER })
  role!: UserRole;

  @ApiProperty({ example: '2025-09-24T21:14:13.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2025-09-24T21:14:13.000Z' })
  updatedAt!: Date;
}
