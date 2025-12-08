# Women Safety System - Backend

NestJS-based backend API with MongoDB, Socket.IO, and Redis for real-time women safety platform.

## 🚀 Features

- **REST API**: Complete CRUD operations for users, SOS, zones, volunteers
- **WebSocket**: Real-time SOS alerts, location tracking, volunteer coordination
- **Authentication**: JWT with OTP-based phone verification
- **Geospatial Queries**: MongoDB 2dsphere indexes for location-based features
- **Background Jobs**: BullMQ with Redis for media processing and alerts
- **Media Handling**: Audio/video upload with compression
- **Mock Services**: SMS, WhatsApp, and police alerts for development
- **API Documentation**: Auto-generated Swagger/OpenAPI docs

## 📦 Tech Stack

- **Framework**: NestJS 10.x
- **Database**: MongoDB 8.x with Mongoose
- **Cache & Queue**: Redis 7.x + BullMQ
- **WebSocket**: Socket.IO 4.x
- **Authentication**: JWT + Passport
- **Validation**: class-validator + class-transformer
- **Documentation**: Swagger/OpenAPI

## 🔧 Installation

### Prerequisites

- Node.js >= 18.x
- MongoDB >= 6.x
- Redis >= 7.x
- npm or yarn

### Steps

1. **Install dependencies**:
```bash
npm install
```

2. **Configure environment**:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Start MongoDB** (if not using Docker):
```bash
# Windows (if installed as service)
net start MongoDB

# Or use Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

4. **Start Redis** (if not using Docker):
```bash
# Windows
# Download from https://github.com/tporadowski/redis/releases
redis-server

# Or use Docker
docker run -d -p 6379:6379 --name redis redis:latest
```

5. **Run the application**:
```bash
# Development
npm run start:dev

# Production build
npm run build
npm run start:prod
```

The server will start on `http://localhost:3000`

## 📡 API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login with phone
- `POST /api/v1/auth/verify-otp` - Verify OTP
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - Logout

### Users
- `GET /api/v1/users/me` - Get current user
- `PATCH /api/v1/users/me` - Update profile
- `POST /api/v1/users/emergency-contacts` - Add emergency contact
- `PATCH /api/v1/users/location` - Update location

### SOS
- `POST /api/v1/sos` - Create SOS alert
- `GET /api/v1/sos` - List SOS incidents
- `GET /api/v1/sos/:id` - Get SOS details
- `PATCH /api/v1/sos/:id/status` - Update SOS status
- `POST /api/v1/sos/:id/location` - Stream location updates
- `DELETE /api/v1/sos/:id` - Cancel SOS

### Zones
- `GET /api/v1/zones` - List zones
- `POST /api/v1/zones` - Create zone (admin)
- `GET /api/v1/zones/nearby` - Find nearby zones
- `PATCH /api/v1/zones/:id` - Update zone (admin)
- `DELETE /api/v1/zones/:id` - Delete zone (admin)

### Volunteers
- `POST /api/v1/volunteers/register` - Register as volunteer
- `GET /api/v1/volunteers` - List volunteers (admin)
- `PATCH /api/v1/volunteers/status` - Update availability
- `GET /api/v1/volunteers/missions` - Get assigned missions

### Media
- `POST /api/v1/media/upload` - Upload audio/video
- `GET /api/v1/media/:id` - Get media file

### Admin
- `GET /api/v1/admin/dashboard` - Dashboard stats
- `GET /api/v1/admin/incidents` - All incidents
- `POST /api/v1/admin/assign-volunteer` - Assign volunteer to SOS

### Analytics
- `GET /api/v1/analytics/stats` - Overall statistics
- `GET /api/v1/analytics/heatmap` - Danger zone heatmap
- `GET /api/v1/analytics/response-times` - Average response times

**Full API documentation**: http://localhost:3000/api/v1/docs

## 🔌 WebSocket Events

### Client → Server

**Authentication**:
- `auth:register` - Register socket with user ID and role

**SOS Events**:
- `sos:create` - Create new SOS alert
- `sos:location:update` - Update location during SOS
- `sos:status:update` - Update SOS status
- `sos:cancel` - Cancel SOS

**Volunteer Events**:
- `volunteer:response` - Accept/decline SOS assignment

**Zone Events**:
- `zone:enter` - User entered zone

**Inactivity**:
- `redzone:inactivity:alert` - Red zone inactivity alert

### Server → Client

**SOS Events**:
- `sos:new` - New SOS created (to admins)
- `sos:location:updated` - Location updated
- `sos:status:changed` - Status changed
- `sos:cancelled` - SOS cancelled

**Volunteer Events**:
- `volunteer:assigned` - Volunteer assigned to SOS
- `volunteer:responded` - Volunteer responded
- `volunteer:sos:nearby` - Nearby SOS for volunteer

**Zone Events**:
- `zone:updated` - Zone information updated
- `zone:entered` - User entered zone

**Red Zone**:
- `redzone:inactivity` - Inactivity alert for admins

## 🧪 Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## 📊 Database Seeding

Populate database with sample data:

```bash
npm run seed
```

This creates:
- 1 admin user
- 10 regular users
- 5 volunteers
- 20 danger zones
- 10 safe zones
- 15 SOS incidents

## 🐳 Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop services
docker-compose down
```

## 📝 Environment Variables

See `.env.example` for all available configuration options.

Key variables:
- `MONGODB_URI` - MongoDB connection string
- `REDIS_HOST`, `REDIS_PORT` - Redis configuration
- `JWT_SECRET` - JWT signing secret
- `AWS_S3_BUCKET` - S3 bucket for media storage
- `MOCK_SMS=true` - Enable mock SMS in development
- `MOCK_POLICE_ALERTS=true` - Enable mock police alerts

## 🔒 Security

- Helmet.js for HTTP headers security
- Rate limiting with @nestjs/throttler
- Input validation with class-validator
- JWT authentication with refresh tokens
- CORS configuration
- Bcrypt for password hashing

## 📈 Monitoring

- Structured logging with Winston
- Health check endpoint: `/health`
- Prometheus metrics: `:9090/metrics` (if enabled)

## 🤝 Contributing

1. Create feature branch
2. Make changes
3. Add tests
4. Submit PR

## 📄 License

MIT
