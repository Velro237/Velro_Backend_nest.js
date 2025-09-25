import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiProperty,
  ApiUnauthorizedResponse,
  ApiBearerAuth,
  // ApiBearerAuth,
  // ApiSecurity,
} from '@nestjs/swagger';
import { SignupDto, SignupResponseDto } from '../dto/signup.dto';
import {
  LoginDto,
  LoginResponseDto,
  RefreshDto,
  TokenLoginDto,
} from '../dto/login.dto';
// ======================
// DTOs pour la doc Swagger
// ======================

export class TokenPairDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6...' })
  accessToken!: string;

  @ApiProperty({ example: '1b7f9f3d0e2b4c0a1f2e3d4c5b6a7...' })
  refreshToken!: string;
}

export class JwtPayloadDto {
  @ApiProperty({ example: 'ckzxy123abc456' })
  sub!: string;

  @ApiProperty({ example: 'user@example.com', nullable: true, required: false })
  email?: string | null;

  @ApiProperty({ example: 1732712345, required: false })
  iat?: number;

  @ApiProperty({ example: 1732715945, required: false })
  exp?: number;
}

// ======================
// Helpers d’erreur (schémas réutilisables)
// ======================

const BadRequestStringSchema = (example: string) => ({
  type: 'object',
  properties: {
    message: { type: 'string', example },
    error: { type: 'string', example: 'Bad Request' },
    statusCode: { type: 'number', example: 400 },
  },
});

const UnauthorizedSchema = (example = 'Unauthorized') => ({
  type: 'object',
  properties: {
    message: { type: 'string', example },
    error: { type: 'string', example: 'Unauthorized' },
    statusCode: { type: 'number', example: 401 },
  },
});

const InternalErrorSchema = (example = 'Internal Server Error') => ({
  type: 'object',
  properties: {
    message: { type: 'string', example },
    error: { type: 'string', example: 'Internal Server Error' },
    statusCode: { type: 'number', example: 500 },
  },
});

export function ApiSignup() {
  return applyDecorators(
    ApiOperation({
      summary: 'User registration',
      description: 'Create a new user account with email and password',
    }),
    ApiBody({ type: SignupDto }),
    ApiResponse({
      status: 201,
      description: 'User created successfully',
      type: SignupResponseDto,
    }),
    ApiResponse({
      status: 409,
      description: 'User with this email already exists',
      schema: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            example: 'User with this email already exists',
          },
          error: {
            type: 'string',
            example: 'Conflict',
          },
          statusCode: {
            type: 'number',
            example: 409,
          },
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: 'Bad Request - Invalid input data',
      schema: {
        type: 'object',
        properties: {
          message: {
            type: 'array',
            items: {
              type: 'string',
            },
            example: [
              'Please provide a valid email address',
              'Password must be at least 8 characters long',
            ],
          },
          error: {
            type: 'string',
            example: 'Bad Request',
          },
          statusCode: {
            type: 'number',
            example: 400,
          },
        },
      },
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error',
      schema: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            example: 'Failed to create user',
          },
          error: {
            type: 'string',
            example: 'Internal Server Error',
          },
          statusCode: {
            type: 'number',
            example: 500,
          },
        },
      },
    }),
  );
}

export function ApiLogin() {
  return applyDecorators(
    ApiOperation({
      summary: 'User login',
      description: 'Authenticate user with email and password',
    }),
    ApiBody({ type: LoginDto }),
    ApiResponse({
      status: 200,
      description: 'Login successful',
      type: LoginResponseDto,
    }),
    ApiResponse({
      status: 401,
      description: 'Invalid credentials',
    }),
    ApiResponse({
      status: 500,
      description: 'Internal server error',
    }),
  );
}

// ======================
// GOOGLE (redirect web)
// ======================

export function ApiGoogleOAuth() {
  return applyDecorators(
    ApiOperation({
      summary: 'Google OAuth (web redirect)',
      description:
        'Démarre le flux OAuth Google côté serveur. Répond par une redirection 302 vers Google.',
    }),
    ApiResponse({
      status: 302,
      description: 'Redirection vers la page de consentement Google',
      headers: {
        Location: {
          description: 'URL de redirection Google',
          schema: {
            type: 'string',
            example:
              'https://accounts.google.com/o/oauth2/v2/auth?client_id=...&redirect_uri=...&scope=profile%20email&response_type=code',
          },
        },
      },
    }),
    ApiResponse({
      status: 500,
      description: 'Erreur serveur (config OAuth invalide)',
      schema: InternalErrorSchema('OAuth misconfiguration or runtime error'),
    }),
  );
}

export function ApiGoogleOAuthCallback() {
  return applyDecorators(
    ApiOperation({
      summary: 'Google OAuth callback',
      description:
        'Endpoint de retour Google. Crée/lie un utilisateur puis redirige (302) vers APP_URL avec les tokens en query string.',
    }),
    ApiResponse({
      status: 302,
      description: 'Redirection vers le front avec tokens',
      headers: {
        Location: {
          description: 'URL front avec tokens',
          schema: {
            type: 'string',
            example:
              'http://localhost:3000/oauth/callback?access=<JWT>&refresh=<REFRESH>',
          },
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: 'Erreur OAuth',
      schema: BadRequestStringSchema('Invalid OAuth response or denied access'),
    }),
    ApiResponse({
      status: 500,
      description: 'Erreur serveur',
      schema: InternalErrorSchema('Failed to complete OAuth flow'),
    }),
  );
}

// ======================
// APPLE (redirect web)
// ======================

export function ApiAppleOAuth() {
  return applyDecorators(
    ApiOperation({
      summary: 'Apple Sign In (web redirect)',
      description:
        'Démarre le flux Sign in with Apple. Répond par une redirection 302 vers Apple.',
    }),
    ApiResponse({
      status: 302,
      description: 'Redirection vers la page Apple',
      headers: {
        Location: {
          description: 'URL de redirection Apple',
          schema: {
            type: 'string',
            example:
              'https://appleid.apple.com/auth/authorize?client_id=...&redirect_uri=...&response_type=code%20id_token&scope=name%20email',
          },
        },
      },
    }),
    ApiResponse({
      status: 500,
      description: 'Erreur serveur (config Apple invalide)',
      schema: InternalErrorSchema(
        'Apple OAuth misconfiguration or runtime error',
      ),
    }),
  );
}

export function ApiAppleOAuthCallback() {
  return applyDecorators(
    ApiOperation({
      summary: 'Apple Sign In callback',
      description:
        'Endpoint de retour Apple. Crée/lie un utilisateur puis redirige (302) vers APP_URL avec tokens.',
    }),
    ApiResponse({
      status: 302,
      description: 'Redirection vers le front avec tokens',
      headers: {
        Location: {
          description: 'URL front avec tokens',
          schema: {
            type: 'string',
            example:
              'http://localhost:3000/oauth/callback?access=<JWT>&refresh=<REFRESH>',
          },
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: 'Erreur OAuth',
      schema: BadRequestStringSchema(
        'Invalid Apple OAuth response or denied access',
      ),
    }),
    ApiResponse({
      status: 500,
      description: 'Erreur serveur',
      schema: InternalErrorSchema('Failed to complete Apple OAuth flow'),
    }),
  );
}

// ======================
// GOOGLE (token mobile)
// ======================

export function ApiGoogleTokenLogin() {
  return applyDecorators(
    ApiOperation({
      summary: 'Login Google (token mobile)',
      description:
        'Reçoit un id_token Google issu du client (GSI/mobile), vérifie, upsert le user et renvoie un couple access/refresh.',
    }),
    ApiBody({ type: TokenLoginDto }),
    ApiResponse({
      status: 200,
      description: 'Authentification réussie',
      type: TokenPairDto,
    }),
    ApiResponse({
      status: 400,
      description: 'Bad Request - id_token invalide',
      schema: BadRequestStringSchema('Invalid Google id_token'),
    }),
    ApiUnauthorizedResponse({
      description: 'Unauthorized',
      schema: UnauthorizedSchema(),
    }),
    ApiResponse({
      status: 500,
      description: 'Erreur serveur',
      schema: InternalErrorSchema('Failed to verify Google token'),
    }),
  );
}

// ======================
// APPLE (token mobile)
// ======================

export function ApiAppleTokenLogin() {
  return applyDecorators(
    ApiOperation({
      summary: 'Login Apple (token mobile)',
      description:
        'Reçoit un id_token Apple, vérification via JWKS Apple, upsert user, renvoie access/refresh.',
    }),
    ApiBody({ type: TokenLoginDto }),
    ApiResponse({
      status: 200,
      description: 'Authentification réussie',
      type: TokenPairDto,
    }),
    ApiResponse({
      status: 400,
      description: 'Bad Request - id_token invalide',
      schema: BadRequestStringSchema('Invalid Apple id_token'),
    }),
    ApiUnauthorizedResponse({
      description: 'Unauthorized',
      schema: UnauthorizedSchema(),
    }),
    ApiResponse({
      status: 500,
      description: 'Erreur serveur',
      schema: InternalErrorSchema('Failed to verify Apple token'),
    }),
  );
}

// ======================
// Refresh token
// ======================

export function ApiRefresh() {
  return applyDecorators(
    ApiOperation({
      summary: 'Refresh tokens',
      description:
        'Échange un refresh token valide contre un nouveau couple access/refresh (rotation).',
    }),
    ApiBody({ type: RefreshDto }),
    ApiResponse({
      status: 200,
      description: 'Tokens régénérés',
      type: TokenPairDto,
    }),
    ApiResponse({
      status: 400,
      description: 'Refresh token invalide',
      schema: BadRequestStringSchema('Invalid refresh token'),
    }),
    ApiUnauthorizedResponse({
      description: 'Unauthorized',
      schema: UnauthorizedSchema(),
    }),
    ApiResponse({
      status: 500,
      description: 'Erreur serveur',
      schema: InternalErrorSchema('Failed to rotate refresh token'),
    }),
  );
}

// ======================
// /me (route protégée JWT)
// ======================

export function ApiMe() {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: 'Profil courant (payload JWT)',
      description:
        'Retourne le payload JWT (ex. sub, email) injecté par la stratégie JWT pour l’utilisateur courant.',
    }),
    ApiResponse({
      status: 200,
      description: 'Payload JWT de la session',
      type: JwtPayloadDto,
    }),
    ApiUnauthorizedResponse({
      description: 'Unauthorized - Token manquant/invalide',
      schema: UnauthorizedSchema(),
    }),
    ApiResponse({
      status: 500,
      description: 'Erreur serveur',
      schema: InternalErrorSchema(),
    }),
  );
}
