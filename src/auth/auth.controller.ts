import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  UsePipes,
  Res,
  Req,
  Get,
  UseGuards,
  Inject
} from '@nestjs/common';
import type { LoggerService } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiCookieAuth,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiConflictResponse,
} from '@nestjs/swagger';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { Request } from 'express';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto } from './dto/register.dto';
import {
  LoginResponseDto,
  RegisterResponseDto,
  MessageResponseDto,
  ProfileResponseDto,
  ErrorResponseDto,
} from './dto/auth-response.dto';

@ApiTags('auth')
@Controller('auth')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService,
  ) { }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Register a new user',
    description: 'Creates a new user account with email, password, and name',
  })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    description: 'User successfully registered',
    type: RegisterResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data',
    type: ErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'User with this email already exists',
    type: ErrorResponseDto,
  })
  async register(@Body() registerDto: RegisterDto) {
    this.logger.log(`Registration attempt for email: ${registerDto.email}`, 'AuthController');
    try {
      const result = await this.authService.register(registerDto);
      this.logger.log(`User registered successfully: ${registerDto.email}`, 'AuthController');
      return result;
    } catch (error) {
      this.logger.error(`Registration failed for email: ${registerDto.email} - ${error.message}`, 'AuthController');
      throw error;
    }
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'User login',
    description: 'Authenticates user and sets JWT tokens in HTTP-only cookies',
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login successful, tokens set in cookies',
    type: LoginResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data',
    type: ErrorResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid email or password',
    type: ErrorResponseDto,
  })
  async login(@Body() loginDto: LoginDto, @Res({ passthrough: true }) res: Response) {
    this.logger.log(`Login attempt for email: ${loginDto.email}`, 'AuthController');
    try {
      const result = await this.authService.login(loginDto);

      // Set secure HTTP-only cookies
      res.cookie('access_token', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000, // 15 minutes
      });

      res.cookie('refresh_token', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      this.logger.log(`User logged in successfully: ${loginDto.email}`, 'AuthController');

      // Return response without tokens (they're in cookies now)
      return {
        user: result.user,
        message: result.message,
      };
    } catch (error) {
      this.logger.error(`Login failed for email: ${loginDto.email} - ${error.message}`, 'AuthController');
      throw error;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'User logout',
    description: 'Clears authentication cookies and logs out the user',
  })
  @ApiResponse({
    status: 200,
    description: 'Logout successful',
    type: MessageResponseDto,
  })
  async logout(@Res({ passthrough: true }) res: Response) {
    this.logger.log('User logout requested', 'AuthController');

    // Clear cookies
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');

    this.logger.log('User logged out successfully', 'AuthController');
    return { message: 'Logout successful' };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token',
    description: 'Uses refresh token from cookie to generate new access and refresh tokens',
  })
  @ApiResponse({
    status: 200,
    description: 'Tokens refreshed successfully',
    type: MessageResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid or missing refresh token',
    type: ErrorResponseDto,
  })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    this.logger.log('Token refresh requested', 'AuthController');
    const refreshToken = req.cookies?.refresh_token;

    if (!refreshToken) {
      this.logger.warn('Token refresh failed: No refresh token found in cookies', 'AuthController');
      return res.status(HttpStatus.UNAUTHORIZED).json({
        message: 'Refresh token not found',
      });
    }

    try {
      const tokens = await this.authService.refreshTokens(refreshToken);

      // Set new cookies
      res.cookie('access_token', tokens.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000, // 15 minutes
      });

      res.cookie('refresh_token', tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      });

      this.logger.log('Tokens refreshed successfully', 'AuthController');
      return { message: 'Tokens refreshed successfully' };
    } catch (error) {
      this.logger.error(`Token refresh failed: ${error.message}`, 'AuthController');
      res.clearCookie('access_token');
      res.clearCookie('refresh_token');
      return res.status(HttpStatus.UNAUTHORIZED).json({
        message: 'Invalid refresh token',
      });
    }
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth('access_token')
  @ApiOperation({
    summary: 'Get user profile',
    description: 'Returns the authenticated user profile information',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile retrieved successfully',
    type: ProfileResponseDto,
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required',
    type: ErrorResponseDto,
  })
  async getProfile(@Req() req: Request) {
    // The user is attached to the request by the JWT strategy
    const userId = req.user?.['userId'] || 'unknown';
    this.logger.log(`Profile requested for user: ${userId}`, 'AuthController');

    return {
      message: 'Profile retrieved successfully',
      user: req.user,
    };
  }
}
