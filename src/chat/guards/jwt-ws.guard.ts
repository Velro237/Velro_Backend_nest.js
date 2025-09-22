import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtWsGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient();
    const token = this.extractTokenFromHandshake(client);

    if (!token) {
      return false;
    }

    try {
      const secret =
        this.configService.get<string>('JWT_SECRET') || 'your-secret-key';
      const payload = this.jwtService.verify(token, { secret });

      // Attach user info to the client for later use
      (client.handshake as any).user = payload;

      return true;
    } catch (error) {
      return false;
    }
  }

  private extractTokenFromHandshake(client: any): string | null {
    const authHeader = client.handshake.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Also check query parameters
    const token = client.handshake.query.token;
    if (token) {
      return token;
    }

    return null;
  }
}
