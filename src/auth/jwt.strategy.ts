import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { UsersService } from '../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER)
    private readonly logger: LoggerService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request) => {
          const token = request?.cookies?.access_token;
          if (!token) {
            this.logger.warn('No access_token found in cookies', 'JwtStrategy');
          } else {
            this.logger.log('Access token found in cookies', 'JwtStrategy');
          }
          return token;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_SECRET') || 'fallback-secret-key',
    });
  }

  async validate(payload: any) {
    this.logger.log(
      `JWT validation for user ID: ${payload.sub}`,
      'JwtStrategy',
    );
    const user = await this.usersService.findOne(payload.sub);
    if (!user) {
      this.logger.error(`User not found for ID: ${payload.sub}`, 'JwtStrategy');
      throw new UnauthorizedException();
    }
    this.logger.log(
      `JWT validation successful for user: ${user.email}`,
      'JwtStrategy',
    );
    return user;
  }
}
