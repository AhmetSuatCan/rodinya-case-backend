import { Injectable, ExecutionContext, Inject } from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService,
  ) {
    super();
  }

  canActivate(context: ExecutionContext) {
    this.logger.log('JWT Auth Guard activated', 'JwtAuthGuard');
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any, context: ExecutionContext) {
    if (err || !user) {
      this.logger.error(`JWT Authentication failed: ${err?.message || info?.message || 'Unknown error'}`, 'JwtAuthGuard');
      throw err || new Error('Unauthorized');
    }
    this.logger.log(`JWT Authentication successful for user: ${user.email}`, 'JwtAuthGuard');
    return user;
  }
}
