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

export class UsersListResponseDto {
  @ApiProperty({
    description: 'Array of users',
    type: [UserResponseDto],
  })
  users: UserResponseDto[];
}

export class UserErrorResponseDto {
  @ApiProperty({
    description: 'HTTP status code',
    example: 404,
  })
  statusCode: number;

  @ApiProperty({
    description: 'Error message',
    example: 'User with ID 507f1f77bcf86cd799439011 not found',
  })
  message: string;

  @ApiProperty({
    description: 'Error type',
    example: 'Not Found',
  })
  error: string;
}
