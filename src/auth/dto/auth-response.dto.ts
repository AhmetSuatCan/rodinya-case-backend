import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({
    description: 'User ID',
    example: '507f1f77bcf86cd799439011',
  })
  _id: string;

  @ApiProperty({
    description: 'User full name',
    example: 'John Doe',
  })
  name: string;

  @ApiProperty({
    description: 'User email address',
    example: 'john.doe@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'Whether user has VIP status',
    example: false,
  })
  isVIP: boolean;

  @ApiProperty({
    description: 'Account creation timestamp',
    example: '2023-11-07T02:10:00.000Z',
  })
  createdAt: string;

  @ApiProperty({
    description: 'Account last update timestamp',
    example: '2023-11-07T02:10:00.000Z',
  })
  updatedAt: string;
}

export class LoginResponseDto {
  @ApiProperty({
    description: 'User information',
    type: UserResponseDto,
  })
  user: UserResponseDto;

  @ApiProperty({
    description: 'Success message',
    example: 'Login successful',
  })
  message: string;
}

export class RegisterResponseDto {
  @ApiProperty({
    description: 'User ID',
    example: '507f1f77bcf86cd799439011',
  })
  _id: string;

  @ApiProperty({
    description: 'User full name',
    example: 'John Doe',
  })
  name: string;

  @ApiProperty({
    description: 'User email address',
    example: 'john.doe@example.com',
  })
  email: string;

  @ApiProperty({
    description: 'Whether user has VIP status',
    example: false,
  })
  isVIP: boolean;

  @ApiProperty({
    description: 'Account creation timestamp',
    example: '2023-11-07T02:10:00.000Z',
  })
  createdAt: string;

  @ApiProperty({
    description: 'Account last update timestamp',
    example: '2023-11-07T02:10:00.000Z',
  })
  updatedAt: string;
}

export class MessageResponseDto {
  @ApiProperty({
    description: 'Response message',
    example: 'Operation successful',
  })
  message: string;
}

export class ProfileResponseDto {
  @ApiProperty({
    description: 'Success message',
    example: 'Profile retrieved successfully',
  })
  message: string;

  @ApiProperty({
    description: 'User information',
    type: UserResponseDto,
  })
  user: UserResponseDto;
}

export class ErrorResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 400,
  })
  statusCode: number;

  @ApiProperty({
    description: 'Error message',
    example: 'Invalid email or password',
  })
  message: string;

  @ApiProperty({
    description: 'Error type',
    example: 'Bad Request',
  })
  error: string;
}
