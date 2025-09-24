/* eslint-disable @typescript-eslint/no-unsafe-function-type */
// src/auth/strategies/apple.strategy.ts
import { PassportStrategy } from '@nestjs/passport';
import { Strategy as AppleOAuthStrategy, Profile } from 'passport-apple';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppleStrategy extends PassportStrategy(
  AppleOAuthStrategy,
  'apple',
) {
  constructor() {
    super({
      clientID: process.env.APPLE_CLIENT_ID!, // Service ID (web)
      teamID: process.env.APPLE_TEAM_ID!,
      keyID: process.env.APPLE_KEY_ID!,
      privateKey: process.env.APPLE_PRIVATE_KEY!,
      callbackURL: process.env.APPLE_CALLBACK_URL!,
      scope: ['name', 'email'],
    });
  }

  // Apple renvoie accessToken, refreshToken, idToken (OpenID), profile
  async validate(
    accessToken: string,
    refreshToken: string,
    idToken: string,
    profile: Profile,
    done: Function,
  ) {
    // profile.id = "sub"
    const email = (profile as any)?._json?.email ?? null;
    const name = (profile as any)?.name?.firstName
      ? `${(profile as any).name.firstName} ${(profile as any).name.lastName ?? ''}`.trim()
      : null;

    const payload = {
      provider: 'APPLE',
      providerAccountId: profile.id,
      email,
      name,
      picture: null,
      accessToken,
      refreshToken,
      idToken,
    };
    done(null, payload);
  }
}
