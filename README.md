# Ordering Service Backend

A robust, production-ready e-commerce ordering system built with NestJS, featuring advanced order processing, real-time stock management, and enterprise-grade security. This microservice handles the complete order lifecycle from product showcase to order fulfillment with VIP user prioritization and atomic transaction processing.

## 🚀 Overview

This ordering service backend is designed for high-performance e-commerce applications requiring:
- **Atomic order processing** with race condition prevention
- **VIP customer prioritization** in order queues
- **Real-time stock management** with optimistic locking
- **Secure JWT authentication** with HTTP-only cookies
- **Asynchronous order processing** with Redis-based queues
- **Comprehensive API documentation** with Swagger/OpenAPI

## 🏗️ Architecture

### Core Technologies
- **Framework**: NestJS (Node.js/TypeScript)
- **Database**: MongoDB with Mongoose ODM
- **Queue System**: Redis with BullMQ
- **Authentication**: JWT with Passport.js
- **API Documentation**: Swagger/OpenAPI
- **Logging**: Winston
- **Containerization**: Docker with Docker Compose
- **Reverse Proxy**: Nginx

### Key Modules
```
src/
├── auth/           # JWT authentication & authorization
├── users/          # User management & profiles
├── order/          # Order processing & lifecycle management
├── stock/          # Product catalog & inventory management
├── health/         # Health checks & monitoring
└── config/         # Application configuration
```

## ✨ Features

### 🔐 Authentication & Security
- **JWT Authentication** with access/refresh token rotation
- **HTTP-only cookies** for secure token storage
- **Password hashing** with bcrypt
- **Role-based access control** with VIP user support
- **CORS configuration** for cross-origin requests

### 📦 Order Management
- **Atomic order processing** preventing overselling
- **VIP user priority** in order queues
- **Order status tracking** (PENDING → CONFIRMED → FAILED)
- **Dead letter queue** handling for failed orders
- **Optimistic locking** for concurrent stock updates

### 🛍️ Product & Stock Management
- **Product showcase** with real-time stock availability
- **Atomic stock operations** with version control
- **Stock reservation** during order processing
- **Automatic rollback** on order failures

### 🔄 Asynchronous Processing
- **Redis-based queues** for order processing
- **Bull Dashboard** for queue monitoring
- **Retry mechanisms** for transient failures
- **Dead letter queue** for failed job handling

### 📊 Monitoring & Observability
- **Health checks** for all services
- **Winston logging** with structured logs
- **Queue monitoring** via Bull Dashboard
- **Docker health checks** for container orchestration

## 🗂️ Project Structure

```
ordering-service-backend/
├── src/
│   ├── auth/                    # Authentication module
│   │   ├── decorators/          # Custom decorators (@CurrentUser)
│   │   ├── dto/                 # Data transfer objects
│   │   ├── auth.controller.ts   # Auth endpoints
│   │   ├── auth.service.ts      # Auth business logic
│   │   └── jwt.strategy.ts      # JWT strategy
│   ├── order/
│   │   ├── dto/                 # Order DTOs
│   │   ├── entities/            # Order entity & schema
│   │   ├── order.controller.ts  # Order endpoints
│   │   ├── order.service.ts     # Order business logic
│   │   ├── order.processor.ts   # Async order processing
│   │   └── order-dlq.processor.ts # Dead letter queue handler
│   ├── stock/
│   │   ├── entities/            # Product & Stock entities
│   │   ├── dto/                 # Stock DTOs
│   │   ├── stock.controller.ts  # Stock endpoints
│   │   └── stock.service.ts     # Stock management logic
│   ├── users/                   # User management
│   ├── health/                  # Health check endpoints
│   ├── config/                  # Configuration files
│   ├── app.module.ts           # Root application module
│   └── main.ts                 # Application bootstrap
├── docker/
│   ├── docker-compose.yml      # Multi-service orchestration
│   ├── Dockerfile              # Application container
│   └── nginx.conf              # Reverse proxy configuration
├── test/                       # E2E and integration tests
├── docs/                       # Documentation
└── logs/                       # Application logs
```

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for local development)
- Git

### 1. Clone & Setup
```bash
git clone <repository-url>
cd ordering-service-backend
cp .env.example .env
```

### 2. Configure Environment
Edit `.env` with your configuration:
```bash
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-min-32-characters
JWT_REFRESH_SECRET=your-super-secret-refresh-key-min-32-characters

# Database
MONGODB_URI=mongodb://localhost:27017/ordering-service

# Server
PORT=8000
NODE_ENV=development

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 3. Start with Docker
```bash
cd docker
docker-compose up -d
```

### 4. Access Services
- **API**: http://localhost:80
- **API Documentation**: http://localhost:80/api/docs
- **Health Check**: http://localhost:80/health
- **Queue Dashboard**: http://localhost:80/admin/queues
- **Redis UI**: http://localhost:8081 (admin/admin123)

## 📚 API Documentation

### Authentication Endpoints
```bash
POST /auth/register    # Register new user
POST /auth/login       # User login (sets cookies)
POST /auth/logout      # User logout (clears cookies)
POST /auth/refresh     # Refresh access token
GET  /auth/profile     # Get user profile (protected)
```

### Product & Stock Endpoints
```bash
GET /stock/products-with-stock           # Get all products with stock
GET /stock/products-with-stock/:id       # Get specific product with stock
```

### Order Endpoints
```bash
POST /order            # Create new order (protected)
GET  /order            # Get user orders (protected)
```

### Example: Create Order
```bash
curl -X POST http://localhost:8000/order \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <jwt-token>" \
  -d '{
    "stockId": "507f1f77bcf86cd799439011",
    "quantity": 2,
    "priceAtPurchase": 999.99
  }'
```

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov

# Load testing
node test/load-test.js
```

## 🐳 Docker Development

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Run tests in container
docker-compose exec app npm run test

# Access container shell
docker-compose exec app sh

# Stop services
docker-compose down
```

## 🔧 Development Scripts

```bash
# Development
npm run start:dev      # Watch mode
npm run start:debug    # Debug mode

# Code Quality
npm run lint           # ESLint
npm run format         # Prettier
npm run build          # Production build

# Testing
npm run test:watch     # Watch mode testing
npm run test:debug     # Debug tests
```

## 🏭 Production Deployment

### Environment Variables
```bash
NODE_ENV=production
JWT_SECRET=<secure-32-char-secret>
JWT_REFRESH_SECRET=<secure-32-char-secret>
MONGODB_URI=<production-mongodb-uri>
REDIS_HOST=<redis-host>
REDIS_PORT=6379
PORT=8000
```

### Docker Production
```bash
# Build production image
docker build -f docker/Dockerfile --target production -t ordering-service .

# Run production container
docker run -d \
  --name ordering-service \
  --env-file .env \
  -p 8000:8000 \
  ordering-service
```

## 📊 Monitoring

### Health Checks
- **Application**: `GET /health`
- **Database**: Automatic MongoDB connection monitoring
- **Redis**: Queue system health monitoring

### Logging
- **Error logs**: `logs/error.log`
- **Combined logs**: `logs/combined.log`
- **Console output**: Development mode

### Queue Monitoring
- **Bull Dashboard**: http://localhost:8000/admin/queues
- **Redis Commander**: http://localhost:8081

## 🔒 Security Features

- **JWT token rotation** with short-lived access tokens
- **HTTP-only cookies** preventing XSS attacks
- **Password hashing** with bcrypt
- **Input validation** with class-validator
- **CORS protection** with configurable origins
- **Rate limiting** ready for implementation

## 🚨 Troubleshooting

### Common Issues

**Port conflicts:**
```bash
lsof -i :8000
kill -9 <PID>
```

**Database connection:**
```bash
docker-compose logs mongodb
docker-compose restart mongodb
```

**Redis connection:**
```bash
docker-compose exec redis redis-cli ping
```

**Container rebuild:**
```bash
docker-compose down
docker-compose up --build
```

## 📖 Additional Documentation

- **[Setup Guide](docs/SETUP_GUIDE.md)** - Detailed setup instructions
- **[API Integration Guide](docs/API_INTEGRATION_GUIDE.md)** - Frontend integration examples
- **[Swagger Documentation](http://localhost:8000/api/docs)** - Interactive API docs

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
