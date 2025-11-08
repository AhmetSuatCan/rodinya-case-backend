import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiParam,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  UserResponseDto,
  UsersListResponseDto,
  UserErrorResponseDto,
} from './dto/user-response.dto';

@ApiTags('users')
@Controller('users')
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a new user',
    description: 'Creates a new user account with the provided information',
  })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({
    status: 201,
    description: 'User successfully created',
    type: UserResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data',
    type: UserErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'User with this email already exists',
    type: UserErrorResponseDto,
  })
  async create(@Body() createUserDto: CreateUserDto) {
    return await this.usersService.create(createUserDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all users',
    description:
      'Retrieves a list of all users (excluding sensitive information)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of users retrieved successfully',
    type: [UserResponseDto],
  })
  async findAll() {
    return await this.usersService.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get user by ID',
    description: 'Retrieves a specific user by their ID',
  })
  @ApiParam({
    name: 'id',
    description: 'User ID',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 200,
    description: 'User retrieved successfully',
    type: UserResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'User not found',
    type: UserErrorResponseDto,
  })
  async findOne(@Param('id') id: string) {
    return await this.usersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update user',
    description: 'Updates user information by ID',
  })
  @ApiParam({
    name: 'id',
    description: 'User ID',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully',
    type: UserResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid input data',
    type: UserErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'User not found',
    type: UserErrorResponseDto,
  })
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return await this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete user',
    description: 'Deletes a user by ID',
  })
  @ApiParam({
    name: 'id',
    description: 'User ID',
    example: '507f1f77bcf86cd799439011',
  })
  @ApiResponse({
    status: 204,
    description: 'User deleted successfully',
  })
  @ApiNotFoundResponse({
    description: 'User not found',
    type: UserErrorResponseDto,
  })
  async remove(@Param('id') id: string) {
    await this.usersService.remove(id);
  }

  @Post(':email/promote-vip')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Promote user to VIP',
    description: 'Promotes a user to VIP status using their email address',
  })
  @ApiParam({
    name: 'email',
    description: 'User email address',
    example: 'user@example.com',
  })
  @ApiResponse({
    status: 200,
    description: 'User promoted to VIP successfully',
    type: UserResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'User not found',
    type: UserErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'User is already a VIP',
    type: UserErrorResponseDto,
  })
  async promoteToVIP(@Param('email') email: string) {
    return await this.usersService.promoteToVIP(email);
  }

  @Post(':email/demote-vip')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Demote user from VIP',
    description: 'Demotes a user from VIP status using their email address',
  })
  @ApiParam({
    name: 'email',
    description: 'User email address',
    example: 'user@example.com',
  })
  @ApiResponse({
    status: 200,
    description: 'User demoted from VIP successfully',
    type: UserResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'User not found',
    type: UserErrorResponseDto,
  })
  @ApiConflictResponse({
    description: 'User is not a VIP',
    type: UserErrorResponseDto,
  })
  async demoteFromVIP(@Param('email') email: string) {
    return await this.usersService.demoteFromVIP(email);
  }
}
