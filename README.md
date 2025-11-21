# Customer Registration Service

A NestJS-based microservice for managing customer registration with authentication, authorization, and SMS notification capabilities.

## Features

- 🔐 **Authentication & Authorization**: Built with Better Auth, supporting user sessions, roles, and permissions
- 👥 **Customer Management**: Full CRUD operations for customer records
- 📝 **Self-Registration**: Public endpoint for customers to register themselves
- 📱 **SMS Notifications**: Automated welcome SMS notifications for new customers
- 🔍 **Advanced Querying**: Flexible query builder with pagination, sorting, and filtering
- 📚 **API Documentation**: Swagger/OpenAPI documentation with Scalar UI
- 🐳 **Docker Support**: Containerized development and production environments
- 🗄️ **Database**: PostgreSQL with Prisma ORM

## Tech Stack

- **Framework**: NestJS 11
- **Language**: TypeScript
- **Database**: PostgreSQL 16
- **ORM**: Prisma 6
- **Authentication**: Better Auth
- **Package Manager**: pnpm
- **API Documentation**: Swagger/OpenAPI with Scalar
- **Validation**: Zod

## Prerequisites

- Node.js 20 or higher
- pnpm (package manager)
- PostgreSQL 16 (or use Docker)
- Docker and Docker Compose (optional, for containerized setup)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd customer-registration-service
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
Create a `.env` file in the root directory:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/customer_registration
PORT=2000
BETTER_AUTH_URL=http://localhost:2000
```

4. Generate Prisma Client:
```bash
pnpm prisma generate
```

5. Run database migrations:
```bash
pnpm prisma migrate dev
```

## Running the Application

### Development Mode

#### Option 1: Using Docker Compose (Recommended)
```bash
docker-compose -f docker-compose.dev.yml up
```

This will start:
- PostgreSQL database on port `5432`
- NestJS application on port `2000` with hot reload

#### Option 2: Local Development
1. Start PostgreSQL database (or use Docker):
```bash
docker run -d \
  --name customer-registration-db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=customer_registration \
  -p 5432:5432 \
  postgres:16-alpine
```

2. Run database migrations:
```bash
pnpm prisma migrate dev
```

3. Start the application:
```bash
pnpm start:dev
```

The application will be available at `http://localhost:2000`

### Production Mode

#### Using Docker Compose
```bash
docker-compose up -d
```

#### Manual Build
```bash
pnpm build
pnpm start:prod
```

## API Documentation

Once the application is running, access the API documentation at:
- **Swagger UI**: `http://localhost:2000/api-doc`
- **OpenAPI JSON**: `http://localhost:2000/api-json`

The API is prefixed with `/api`, so all endpoints are available under `http://localhost:2000/api/*`

## Database Schema

The application uses the following main models:

- **User**: Authentication and user management
- **Customer**: Customer registration data with support for staff-created and self-registered customers
- **SMSNotification**: SMS notification tracking
- **Session**: User session management
- **Account**: OAuth and authentication accounts

See `prisma/schema.prisma` for the complete schema definition.

## Available Scripts

- `pnpm start` - Start the application
- `pnpm start:dev` - Start in development mode with watch
- `pnpm start:debug` - Start in debug mode
- `pnpm start:prod` - Start in production mode
- `pnpm build` - Build the application
- `pnpm test` - Run unit tests
- `pnpm test:watch` - Run tests in watch mode
- `pnpm test:cov` - Run tests with coverage
- `pnpm test:e2e` - Run end-to-end tests
- `pnpm lint` - Lint the codebase
- `pnpm format` - Format code with Prettier
- `pnpm db` - Prisma CLI shortcut
- `pnpm auth:gen` - Generate Better Auth types

## API Endpoints

### Authentication
All authentication endpoints are managed by Better Auth and available under `/api/auth/*`

### Customer Management
- `GET /api/customer` - List customers (requires `customer:list` permission)
- `GET /api/customer/:id` - Get customer by ID (requires `customer:list` permission)
- `POST /api/customer` - Create customer (requires `customer:create` permission)
- `PUT /api/customer/:id` - Update customer (requires `customer:update` permission)
- `DELETE /api/customer/:id` - Delete customer (requires `customer:delete` permission)
- `PATCH /api/customer/:id/restore` - Restore deleted customer (requires `customer:restore` permission)
- `POST /api/customer/self-register` - Self-register customer (public endpoint)

## Project Structure

```
src/
├── auth/              # Authentication and authorization module
├── config/            # Application configuration
├── customer/          # Customer management module
├── notification/      # SMS notification service
├── prisma/            # Prisma service and module
├── query-builder/     # Query builder utilities
├── app.module.ts      # Root application module
└── main.ts            # Application entry point
```

## Docker

### Development
The `docker-compose.dev.yml` file sets up a development environment with:
- Hot reload enabled
- Source code mounted as volumes
- PostgreSQL database with health checks

### Production
The `Dockerfile` uses a multi-stage build for optimized production images.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `PORT` | Application port | `2000` |
| `BETTER_AUTH_URL` | Base URL for Better Auth | `http://localhost:2000` |
| `NODE_ENV` | Environment mode | `development` |

## Testing

Run unit tests:
```bash
pnpm test
```

Run tests with coverage:
```bash
pnpm test:cov
```

Run end-to-end tests:
```bash
pnpm test:e2e
```

## License

UNLICENSED

## Author

See package.json for author information.
