# Local Development Setup Guide

This guide will help you set up and run the Ordering Service Backend using Docker containers.

## Prerequisites

Before running this project, ensure you have the following installed:

- **Docker** (v20 or higher)
- **Docker Compose** (v2 or higher)
- **Git** - for cloning the repository

## Environment Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd ordering-service-backend
```

### 2. Create Environment File

```bash
cp .env.example .env
```

### 3. Configure Environment Variables

Edit the `.env` file with the following configuration:

```bash
# JWT Configuration (generate secure random strings)
JWT_SECRET=your-super-secret-jwt-key-min-32-characters
JWT_REFRESH_SECRET=your-super-secret-refresh-key-min-32-characters

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/ordering-service

# Server Configuration  
PORT=8000
NODE_ENV=development

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

**⚠️ Important Security Notes:**
- Generate strong, unique secrets for JWT tokens (minimum 32 characters)
- Never commit your `.env` file to version control
- Use different secrets for development and production environments
- You can generate secure secrets using: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

## Docker Setup & Running

### 1. Start All Services

```bash
cd docker
docker-compose up -d
```

This will start:
- **Application** - NestJS backend service
- **MongoDB** - Database (automatically configured)
- **Redis** - Queue management (automatically configured)
- **Nginx** - Reverse proxy
- **Redis Commander** - Redis UI (optional)

### 2. Access Services

- **API:** http://localhost
- **Health Check:** http://localhost/health
- **API Documentation:** http://localhost/api/docs
- **Redis UI:** http://localhost:8081 (credentials: admin/admin123)
- **Direct API (bypassing nginx):** http://localhost:8000

### 3. View Logs

```bash
# View all services
docker-compose logs -f

# View specific service
docker-compose logs -f app

# View last 100 lines
docker-compose logs --tail=100 app
```

### 4. Stop Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (clears database)
docker-compose down -v
```

## Testing

### Run Tests in Docker

```bash
# Run tests inside the app container
docker-compose exec app npm run test

# Run E2E tests
docker-compose exec app npm run test:e2e

# Run tests with coverage
docker-compose exec app npm run test:cov

# Load testing
docker-compose exec app node test/load-test.js
```

## API Usage

### Authentication Flow

1. **Register a new user:**
   ```bash
   curl -X POST http://localhost:8000/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"user@example.com","password":"password123","name":"Test User"}'
   ```

2. **Login:**
   ```bash
   curl -X POST http://localhost:8000/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"user@example.com","password":"password123"}' \
     -c cookies.txt
   ```

3. **Access protected endpoints:**
   ```bash
   curl -X GET http://localhost:8000/auth/profile \
     -b cookies.txt
   ```

### Key Features

- **JWT Authentication** with HTTP-only cookies
- **Order Management** with VIP user priority
- **Product Showcase** with real-time stock information
- **Async Order Processing** with Redis queues
- **Atomic Stock Management** to prevent race conditions

## Troubleshooting

### Common Issues

#### 1. Port Already in Use

```bash
# Find process using port 8000
lsof -i :8000

# Kill the process
kill -9 <PID>

# Or use a different port in .env
PORT=3000
```

#### 2. MongoDB Connection Failed

- Check if MongoDB container is running:
  ```bash
  docker-compose ps
  ```
- View MongoDB logs:
  ```bash
  docker-compose logs mongodb
  ```
- Restart MongoDB service:
  ```bash
  docker-compose restart mongodb
  ```

#### 3. Redis Connection Failed

- Check if Redis container is running:
  ```bash
  docker-compose ps redis
  ```
- View Redis logs:
  ```bash
  docker-compose logs redis
  ```
- Test Redis connection:
  ```bash
  docker-compose exec redis redis-cli ping
  ```

#### 4. JWT Token Errors

- Ensure `JWT_SECRET` and `JWT_REFRESH_SECRET` are set in `.env`
- Secrets should be at least 32 characters long
- Generate new secrets if needed:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

#### 5. Container Build Errors

```bash
# Rebuild containers
docker-compose build --no-cache

# Remove all containers and rebuild
docker-compose down
docker-compose up --build
```

#### 6. Volume/Data Issues

```bash
# Reset all data (removes database content)
docker-compose down -v

# Clean up Docker system
docker system prune -f
```

### Application Logs

Application logs are stored in the `logs/` directory:

- `logs/error.log` - Error logs only
- `logs/combined.log` - All application logs
- Console output during development

### Performance Monitoring

Monitor your application performance:

```bash
# Check container resource usage
docker stats

# Monitor specific container
docker stats ordering-service-app

# View container processes
docker-compose top
```

## Development Tips

### Code Quality

```bash
# Format code inside container
docker-compose exec app npm run format

# Lint code
docker-compose exec app npm run lint

# Run all checks
docker-compose exec app npm run format && npm run lint && npm run test
```

### Database Management

```bash
# Connect to MongoDB inside container
docker-compose exec app mongosh $MONGODB_URI

# Or connect to MongoDB container directly
docker-compose exec mongodb mongosh

# View collections
show collections

# Query orders
db.orders.find().pretty()

# Query users
db.users.find().pretty()
```

### Redis Management

```bash
# Connect to Redis CLI
docker-compose exec redis redis-cli

# View all keys
KEYS *

# Monitor Redis commands
MONITOR

# View queue jobs
LLEN bull:order-processing:waiting
```

## Next Steps

1. **Explore the API:** Visit http://localhost:8000/api/docs for interactive API documentation
2. **Read the Code:** Start with `src/main.ts` to understand the application structure
3. **Test the Features:** Try creating users, products, and orders through the API
4. **Customize:** Modify the code to fit your specific requirements

## Support

If you encounter issues not covered in this guide:

1. Check the application logs in the `logs/` directory
2. Review the console output for error messages
3. Ensure all prerequisites are properly installed and running
4. Verify your `.env` configuration matches the requirements

For additional help, refer to the main README.md file or the API documentation at `/api/docs`.
