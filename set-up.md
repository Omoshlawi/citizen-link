## Requirements
- Node.js 22+
- pnpm
- PostgreSQL with pgvector extension (for local setup)
- MinIO (for local S3-like storage)
- Docker and Docker Compose (for containerized setup)

## Quick Start

### Option 1: Docker Setup (Recommended)

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd citizen-link
   ```

2. **Copy environment file**
   ```bash
   cp .env.example .env
   ```

3. **Edit .env file**
   - Update API keys for your preferred AI providers
   - Adjust database and MinIO settings if needed
   - Generate a secure BETTER_AUTH_SECRET

4. **Start the application**
   ```bash
   docker-compose up --build
   ```

   The application will be available at:
   - API: http://localhost:2000
   - MinIO Console: http://localhost:9001 (admin/Admin123)

5. **Stop the application**
   ```bash
   docker-compose down
   ```

### Option 2: Local Development Setup

1. **Install dependencies**
   ```bash
   pnpm install
   ```

2. **Set up PostgreSQL with pgvector**
   - Install PostgreSQL 16+
   - Enable pgvector extension:
     ```sql
     CREATE EXTENSION IF NOT EXISTS vector;
     ```
   - Create database: `citizen-link`

3. **Set up MinIO**
   - Download and install MinIO
   - Start MinIO server:
     ```bash
     minio server /path/to/data
     ```
   - Access console at http://localhost:9001

4. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your local database and MinIO URLs
   ```

5. **Run database migrations**
   ```bash
   pnpm prisma migrate dev
   ```

6. **Seed the database**
   ```bash
   pnpm db:seed
   ```

7. **Start the application**
   ```bash
   pnpm start:dev
   ```

   The application will be available at http://localhost:2000

## Environment Configuration

Copy `.env.example` to `.env` and configure the following:

- **Database**: Set DATABASE_URL for your PostgreSQL instance
- **AI Services**: Configure API keys and endpoints for OpenAI, Ollama, or other providers
- **MinIO**: Set S3 credentials and endpoints
- **Authentication**: Generate a secure BETTER_AUTH_SECRET

## Development Commands

- `pnpm start:dev` - Start development server with hot reload
- `pnpm build` - Build the application
- `pnpm test` - Run tests
- `pnpm lint` - Run ESLint
- `pnpm prisma studio` - Open Prisma Studio for database management

## Docker Commands

- `docker-compose up` - Start all services
- `docker-compose up --build` - Rebuild and start services
- `docker-compose down` - Stop all services
- `docker-compose logs` - View logs
- `docker-compose logs app` - View app-specific logs

## Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL is running and accessible
- Verify DATABASE_URL in .env
- For Docker: Check that the db service is healthy

### MinIO Issues
- Ensure MinIO is running on the configured port
- Verify S3 credentials in .env
- For Docker: Check minio service logs

### AI Service Issues
- Verify API keys and endpoints
- For Ollama: Ensure Ollama is running locally
- Check network connectivity to AI providers 