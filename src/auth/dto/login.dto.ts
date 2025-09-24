import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  email: string;

  @ApiProperty({
    description: 'User password',
    example: 'password123',
    minLength: 6,
  })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;
}

export class LoginResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Login successful',
  })
  message: string;

  @ApiProperty({
    description: 'JWT access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  access_token: string;

  @ApiProperty({
    description: 'User information',
    type: 'object',
    properties: {
      id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
      email: { type: 'string', example: 'user@example.com' },
      role: { type: 'string', example: 'USER' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  })
  user: {
    id: string;
    email: string;
    role: string;
    createdAt: Date;
  };
}

export class TokenLoginDto {
  @ApiProperty({
    description: 'ID token émis par Google/Apple (JWT côté client)',
    example:
      'eyJhbGciOiJSUzI1NiIsImtpZCI6IkpXVCJ9.eyJzdWIiOiJhYmMxMjMiLCJlbWFpbCI6InVzZXJAZXhhbXBsZS5jb20ifQ.sgn...',
  })
  @IsString()
  @IsNotEmpty()
  idToken!: string;
}

export class RefreshDto {
  @ApiProperty({
    description: "Refresh token émis par l'API",
    example: '1b7f9f3d0e2b4c0a1f2e3d4c5b6a7f8e9d0c1b2a3e4f5...',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

export class TokenPairDto {
  @ApiProperty({
    description: "JWT d'accès (Authorization: Bearer ...)",
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....',
  })
  accessToken!: string;

  @ApiProperty({
    description: 'Refresh token opaque (à stocker côté client avec soin)',
    example: '1b7f9f3d0e2b4c0a1f2e3d4c5b6a7f8e9d0c1b2a3e4f5...',
  })
  refreshToken!: string;
}
export class JwtPayloadDto {
  @ApiProperty({
    description: 'Identifiant utilisateur (sub)',
    example: 'ckzxy123abc456',
  })
  sub!: string;

  @ApiProperty({
    description: 'Email si présent dans le token',
    example: 'user@example.com',
    nullable: true,
    required: false,
  })
  email?: string | null;

  @ApiProperty({
    description: 'Issued At (timestamp)',
    example: 1732712345,
    required: false,
  })
  iat?: number;

  @ApiProperty({
    description: 'Expiration (timestamp)',
    example: 1732715945,
    required: false,
  })
  exp?: number;
}
