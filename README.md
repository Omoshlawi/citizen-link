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

### For Docker Setup (Recommended)

- **Docker Desktop** (or Docker Engine + Docker Compose) version 20.10 or higher
- **Docker Compose** version 2.0 or higher
- At least **2GB of free disk space** for images and volumes
- **4GB of RAM** recommended for smooth operation

### For Local Development

- **Node.js** 20 or higher
- **pnpm** (package manager) - Install with `npm install -g pnpm`
- **PostgreSQL** 16 (or use Docker for database only)

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

**Prerequisites:**

- Docker Desktop (or Docker Engine + Docker Compose) installed and running
- Docker version 20.10 or higher
- Docker Compose version 2.0 or higher

**Step-by-step instructions:**

1. **Start the development environment:**

   ```bash
   docker-compose -f docker-compose.dev.yml up
   ```

   This command will:
   - Build the development Docker image (if not already built)
   - Start PostgreSQL database container
   - Start the NestJS application container with hot reload enabled
   - Mount your source code as volumes for live code changes

2. **Run database migrations:**

   In a new terminal, execute migrations inside the app container:

   ```bash
   docker-compose -f docker-compose.dev.yml exec app pnpm prisma migrate dev
   ```

   Or if you prefer to run migrations locally (requires local Prisma setup):

   ```bash
   pnpm prisma migrate dev
   ```

3. **Access the application:**
   - Application: `http://localhost:2000`
   - API Documentation: `http://localhost:2000/api-doc`
   - Database: `localhost:5432` (credentials: postgres/postgres)

**Development Docker Features:**

- ✅ Hot reload enabled - code changes are automatically reflected
- ✅ Source code mounted as volumes - edit files locally, see changes in container
- ✅ PostgreSQL with health checks - ensures database is ready before app starts
- ✅ Persistent database volume - data persists between container restarts

**Useful Development Commands:**

```bash
# Start in detached mode (background)
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f app
docker-compose -f docker-compose.dev.yml logs -f postgres

# Stop containers
docker-compose -f docker-compose.dev.yml down

# Stop and remove volumes (⚠️ deletes database data)
docker-compose -f docker-compose.dev.yml down -v

# Rebuild images (after Dockerfile changes)
docker-compose -f docker-compose.dev.yml build --no-cache

# Execute commands in running container
docker-compose -f docker-compose.dev.yml exec app pnpm prisma studio
docker-compose -f docker-compose.dev.yml exec app sh

# Restart a specific service
docker-compose -f docker-compose.dev.yml restart app
```

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

#### Using Docker Compose (Recommended)

**Prerequisites:**

- Docker Desktop (or Docker Engine + Docker Compose) installed and running
- Docker version 20.10 or higher
- Docker Compose version 2.0 or higher

**Step-by-step instructions:**

1. **Set up environment variables (optional):**

   Create a `.env` file in the root directory if you want to override default values:

   ```env
   DATABASE_URL=postgresql://postgres:postgres@postgres:5432/customer_registration
   PORT=2000
   BETTER_AUTH_URL=http://localhost:2000
   NODE_ENV=production
   ```

   Note: The `docker-compose.yml` file already includes these environment variables. You can modify them directly in the compose file or use environment variable substitution.

2. **Build and start the production environment:**

   ```bash
   docker-compose up -d --build
   ```

   This command will:
   - Build the production Docker image using multi-stage build
   - Start PostgreSQL database container
   - Start the NestJS application container
   - Run containers in detached mode (background)

3. **Run database migrations:**

   Execute migrations inside the app container:

   ```bash
   docker-compose exec app pnpm prisma migrate deploy
   ```

   Or if using Prisma migrations:

   ```bash
   docker-compose exec app pnpm prisma migrate dev
   ```

4. **Verify the application is running:**

   ```bash
   # Check container status
   docker-compose ps

   # View application logs
   docker-compose logs -f app

   # Test the API
   curl http://localhost:2000/api-doc
   ```

5. **Access the application:**
   - Application: `http://localhost:2000`
   - API Documentation: `http://localhost:2000/api-doc`
   - Database: `localhost:5432` (credentials: postgres/postgres)

**Production Docker Features:**

- ✅ Multi-stage build for optimized image size
- ✅ Production dependencies only (smaller image)
- ✅ Automatic restart on failure
- ✅ Health checks for database
- ✅ Persistent database volume
- ✅ Isolated network for services

**Useful Production Commands:**

```bash
# Start containers
docker-compose up -d

# Stop containers
docker-compose down

# Stop and remove volumes (⚠️ deletes database data)
docker-compose down -v

# View logs
docker-compose logs -f app
docker-compose logs -f postgres

# View logs for last 100 lines
docker-compose logs --tail=100 app

# Rebuild images
docker-compose build --no-cache

# Restart services
docker-compose restart

# Restart specific service
docker-compose restart app

# Execute commands in container
docker-compose exec app sh
docker-compose exec app pnpm prisma studio

# Update and restart (after code changes)
docker-compose up -d --build

# View resource usage
docker stats

# Inspect container
docker inspect customer-registration-app
```

#### Manual Build (Without Docker)

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

### Docker Files Overview

- **`Dockerfile`**: Production multi-stage build for optimized images
- **`Dockerfile.dev`**: Development image with all dependencies
- **`docker-compose.yml`**: Production environment configuration
- **`docker-compose.dev.yml`**: Development environment configuration

### Development Environment

The `docker-compose.dev.yml` file sets up a development environment with:

- **Hot reload enabled**: Code changes automatically trigger application restart
- **Source code mounted as volumes**: Edit files locally, changes reflect in container
- **PostgreSQL database with health checks**: Ensures database is ready before app starts
- **Development dependencies**: Includes all dev tools and dependencies
- **Separate volumes**: Uses `postgres_data_dev` to avoid conflicts with production

**Container Names:**

- `customer-registration-app-dev`: Application container
- `customer-registration-db-dev`: Database container

### Production Environment

The `Dockerfile` uses a multi-stage build for optimized production images:

- **Builder stage**: Installs all dependencies, generates Prisma Client, builds application
- **Production stage**: Only includes production dependencies and built artifacts
- **Optimized size**: Smaller final image for faster deployments
- **Security**: Minimal attack surface with only production dependencies

**Container Names:**

- `customer-registration-app`: Application container
- `customer-registration-db`: Database container

### Docker Networking

Both compose files create an isolated `app-network` bridge network where:

- Services can communicate using service names (e.g., `postgres` hostname)
- Ports are exposed to host machine for external access
- Internal communication is isolated from other Docker networks

### Database Persistence

- **Development**: Data stored in `postgres_data_dev` volume
- **Production**: Data stored in `postgres_data` volume
- Volumes persist data between container restarts and removals
- To reset database: `docker-compose down -v` (⚠️ deletes all data)

### Troubleshooting

#### Port Already in Use

If you get an error that port 2000 or 5432 is already in use:

```bash
# Check what's using the port
lsof -i :2000
lsof -i :5432

# Stop conflicting containers
docker ps
docker stop <container-id>

# Or change ports in docker-compose.yml
# Edit ports section: "3000:2000" instead of "2000:2000"
```

#### Database Connection Issues

```bash
# Check if database is healthy
docker-compose ps

# View database logs
docker-compose logs postgres

# Test database connection
docker-compose exec postgres psql -U postgres -d customer_registration

# Restart database
docker-compose restart postgres
```

#### Application Won't Start

```bash
# Check application logs
docker-compose logs app

# Check if migrations are needed
docker-compose exec app pnpm prisma migrate status

# Rebuild containers
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

#### Hot Reload Not Working (Development)

```bash
# Ensure volumes are properly mounted
docker-compose -f docker-compose.dev.yml config

# Restart the app container
docker-compose -f docker-compose.dev.yml restart app

# Check file permissions
docker-compose -f docker-compose.dev.yml exec app ls -la /app
```

#### Clean Start (Reset Everything)

```bash
# Stop and remove all containers, networks, and volumes
docker-compose down -v

# Remove images (optional)
docker-compose down --rmi all

# Remove unused Docker resources
docker system prune -a

# Start fresh
docker-compose up -d --build
```

#### View Container Resource Usage

```bash
# Real-time stats
docker stats

# Inspect specific container
docker inspect customer-registration-app

# Check container logs
docker logs customer-registration-app -f
```

#### Database Migrations in Docker

```bash
# Development: Run migrations
docker-compose -f docker-compose.dev.yml exec app pnpm prisma migrate dev

# Production: Deploy migrations
docker-compose exec app pnpm prisma migrate deploy

# Generate Prisma Client
docker-compose exec app pnpm prisma generate

# Open Prisma Studio
docker-compose exec app pnpm prisma studio
# Then access at http://localhost:5555 (if port is exposed)
```

## Environment Variables

| Variable          | Description                  | Default                 | Docker Notes                                                                                      |
| ----------------- | ---------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`    | PostgreSQL connection string | Required                | In Docker, use service name: `postgresql://postgres:postgres@postgres:5432/customer_registration` |
| `PORT`            | Application port             | `2000`                  | Must match the port mapping in docker-compose.yml                                                 |
| `BETTER_AUTH_URL` | Base URL for Better Auth     | `http://localhost:2000` | Use `http://localhost:2000` for local access, or your domain for production                       |
| `NODE_ENV`        | Environment mode             | `development`           | Set to `production` in production Docker setup                                                    |

### Docker Environment Variables

When using Docker Compose, environment variables are set in the `docker-compose.yml` or `docker-compose.dev.yml` files. You can:

1. **Modify directly in compose files**: Edit the `environment` section
2. **Use .env file**: Create a `.env` file in the project root (Docker Compose automatically loads it)
3. **Override at runtime**:
   ```bash
   DATABASE_URL=postgresql://... docker-compose up
   ```

### Important Notes for Docker

- **Database Host**: In Docker, use the service name (`postgres`) as the hostname, not `localhost`
- **Port Mapping**: The `PORT` environment variable should match the internal container port (2000), while the host port can be different
- **Network Isolation**: Services communicate using Docker service names within the `app-network`

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
