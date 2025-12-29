import { ApiProperty } from '@nestjs/swagger';

export class UsersPerCountryDto {
  @ApiProperty({
    description: 'Country name',
    example: 'cameroon',
  })
  country!: string;

  @ApiProperty({
    description: 'Number of users from this country',
    example: 150,
  })
  count!: number;
}

export class AdminUsersPerCountryResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Users per country retrieved successfully',
  })
  message!: string;

  @ApiProperty({
    description: 'List of countries with user counts',
    type: [UsersPerCountryDto],
  })
  data!: UsersPerCountryDto[];
}

