/* eslint-disable @typescript-eslint/no-unsafe-function-type */
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: process.env.GOOGLE_CALLBACK_URL!,
      scope: ['profile', 'email'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: Function,
  ) {
    // Données minimales utilisées par AuthService
    const payload = {
      provider: 'GOOGLE',
      providerAccountId: profile.id,
      email: profile.emails?.[0]?.value || null,
      name: profile.displayName,
      picture: profile.photos?.[0]?.value || null,
      accessToken,
      refreshToken,
      // profile._json ? profile._json : {}
    };
    done(null, payload);
  }
}
