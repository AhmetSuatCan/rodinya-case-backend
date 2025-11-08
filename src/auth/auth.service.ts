import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { RegisterDto, LoginDto } from './dto/register.dto';
import { User, UserDocument } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto): Promise<User> {
    const { email, password, name } = registerDto;

    // Check if user already exists
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Create new user using UsersService
    return await this.usersService.create({
      name,
      email,
      password,
      isVIP: false, // Default to false for regular registration
    });
  }

  async login(loginDto: LoginDto): Promise<{
    user: Omit<User, 'passwordHash' | 'refreshToken'>;
    accessToken: string;
    refreshToken: string;
    message: string;
  }> {
    const { email, password } = loginDto;

    // Validate user credentials
    const user = await this.usersService.validatePassword(email, password);
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Generate tokens
    const payload = { email: user.email, sub: (user as any)._id };
    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(payload);

    // Store refresh token in database
    await this.usersService.updateRefreshToken(
      (user as any)._id.toString(),
      refreshToken,
    );

    // Remove sensitive fields from user object
    const userObj = (user as UserDocument).toObject();
    const {
      passwordHash,
      refreshToken: _,
      ...userWithoutSensitiveData
    } = userObj;

    return {
      user: userWithoutSensitiveData,
      accessToken,
      refreshToken,
      message: 'Login successful',
    };
  }

  private generateAccessToken(payload: any): string {
    return this.jwtService.sign(payload);
  }

  private generateRefreshToken(payload: any): string {
    return this.jwtService.sign(payload, {
      secret:
        this.configService.get<string>('JWT_REFRESH_SECRET') ||
        'your-refresh-secret-key',
      expiresIn: '7d', // Refresh token expires in 7 days
    });
  }

  async refreshTokens(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    try {
      // Verify refresh token
      const payload = this.jwtService.verify(refreshToken, {
        secret:
          this.configService.get<string>('JWT_REFRESH_SECRET') ||
          'your-refresh-secret-key',
      });

      // Find user by ID
      const user = await this.usersService.findOne(payload.sub);
      if (!user) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Generate new tokens
      const newPayload = { email: user.email, sub: payload.sub };
      const newAccessToken = this.generateAccessToken(newPayload);
      const newRefreshToken = this.generateRefreshToken(newPayload);

      // Update refresh token in database
      await this.usersService.updateRefreshToken(payload.sub, newRefreshToken);

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }
}
