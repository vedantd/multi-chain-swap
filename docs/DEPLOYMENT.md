# Deployment Guide

## Prerequisites

- **Node.js**: Version 18 or higher
- **Package Manager**: npm, pnpm, or yarn
- **Build Tools**: Standard Next.js build process

## Build Process

### Local Build

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Test production build locally
npm run start
```

The production build will be created in the `.next` directory.

### Build Output

- **Static Assets**: Optimized and minified JavaScript, CSS, and images
- **Server Components**: Pre-rendered React components
- **API Routes**: Server-side API endpoints

## Deployment Options

### Option 1: Vercel (Recommended)

Vercel is the recommended deployment platform for Next.js applications, offering zero-configuration deployments and excellent performance.

#### Setup Steps

1. **Connect Repository**:
   - Sign up/login to [Vercel](https://vercel.com)
   - Click "New Project"
   - Import your GitHub/GitLab/Bitbucket repository
   - Vercel will auto-detect Next.js configuration

2. **Configure Environment Variables**:
   - Go to Project Settings → Environment Variables
   - Add all required variables (see [Environment Variables](./ENVIRONMENT_VARIABLES.md))
   - Set values for Production, Preview, and Development environments
   - Example variables:
     ```
     NEXT_PUBLIC_SOLANA_RPC_URL=https://solana-mainnet.g.alchemy.com/v2/YOUR_KEY
     RELAY_DEPOSIT_FEE_PAYER=YourSolanaAddress
     ```

3. **Deploy**:
   - Click "Deploy" (or push to main branch for auto-deploy)
   - Vercel will build and deploy automatically
   - Deployment URL will be provided (e.g., `your-app.vercel.app`)

#### Vercel Features

- **Automatic Deployments**: Deploys on every push to main branch
- **Preview Deployments**: Creates preview URLs for pull requests
- **Edge Network**: Global CDN for fast asset delivery
- **Analytics**: Built-in performance monitoring
- **Custom Domains**: Easy domain configuration

#### Vercel Configuration

Create `vercel.json` (optional) for custom configuration:

```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "regions": ["iad1"]
}
```

---

### Option 2: Docker

Deploy using Docker for containerized environments (Kubernetes, Docker Swarm, etc.).

#### Create Dockerfile

Create `Dockerfile` in project root:

```dockerfile
# Use Node.js 18 Alpine for smaller image size
FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

**Note**: For standalone output, update `next.config.ts`:

```typescript
const nextConfig: NextConfig = {
  output: 'standalone',
  // ... rest of config
};
```

#### Build Docker Image

```bash
# Build image
docker build -t multi-chain-swap .

# Tag for registry (optional)
docker tag multi-chain-swap your-registry/multi-chain-swap:latest
```

#### Run Docker Container

```bash
# Run with environment file
docker run -p 3000:3000 --env-file .env.production multi-chain-swap

# Or set variables directly
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SOLANA_RPC_URL=https://solana-mainnet.g.alchemy.com/v2/YOUR_KEY \
  -e RELAY_DEPOSIT_FEE_PAYER=YourAddress \
  multi-chain-swap
```

#### Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env.production
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:3000/api/quotes"]
      interval: 30s
      timeout: 10s
      retries: 3
```

Run with:

```bash
docker-compose up -d
```

---

### Option 3: Self-Hosted

Deploy on your own server (VPS, dedicated server, etc.).

#### Prerequisites

- Linux server (Ubuntu 20.04+ recommended)
- Node.js 18+ installed
- Process manager (PM2 recommended)
- Reverse proxy (Nginx recommended)

#### Setup Steps

1. **Clone Repository**:
   ```bash
   git clone your-repo-url
   cd multi-chain-swap
   ```

2. **Install Dependencies**:
   ```bash
   npm install --production
   ```

3. **Build Application**:
   ```bash
   npm run build
   ```

4. **Set Environment Variables**:
   ```bash
   # Create production env file
   nano .env.production
   
   # Add your variables (see Environment Variables docs)
   ```

5. **Install PM2**:
   ```bash
   npm install -g pm2
   ```

6. **Create PM2 Config** (`ecosystem.config.js`):
   ```javascript
   module.exports = {
     apps: [{
       name: 'multi-chain-swap',
       script: 'npm',
       args: 'start',
       cwd: '/path/to/multi-chain-swap',
       instances: 2,
       exec_mode: 'cluster',
       env: {
         NODE_ENV: 'production',
         PORT: 3000
       },
       env_file: '.env.production',
       error_file: './logs/pm2-error.log',
       out_file: './logs/pm2-out.log',
       log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
       merge_logs: true,
       autorestart: true,
       max_memory_restart: '1G'
     }]
   };
   ```

7. **Start Application**:
   ```bash
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup  # Follow instructions to enable auto-start on boot
   ```

8. **Setup Nginx Reverse Proxy**:

   Create `/etc/nginx/sites-available/multi-chain-swap`:

   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

   Enable site:
   ```bash
   sudo ln -s /etc/nginx/sites-available/multi-chain-swap /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

9. **Setup SSL with Let's Encrypt** (optional but recommended):

   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

#### Monitoring

**PM2 Monitoring**:
```bash
pm2 status
pm2 logs multi-chain-swap
pm2 monit
```

**System Monitoring**:
```bash
# Check application logs
tail -f logs/pm2-out.log

# Check system resources
htop
```

---

## Environment Variables Setup

For all deployment methods, ensure environment variables are configured. See [Environment Variables Documentation](./ENVIRONMENT_VARIABLES.md) for complete details.

**Required for Production**:
- `NEXT_PUBLIC_SOLANA_RPC_URL` (recommended: use dedicated RPC provider)

**Optional**:
- `RELAY_DEPOSIT_FEE_PAYER` (if using fee sponsorship)
- `QUOTE_ACCOUNTING_LOG_PATH` (for logging)

---

## Health Checks

### API Health Check

The `/api/quotes` endpoint can be used for health monitoring:

```bash
# Basic health check
curl -X POST http://localhost:3000/api/quotes \
  -H "Content-Type: application/json" \
  -d '{
    "originChainId": 7565164,
    "destinationChainId": 8453,
    "originToken": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    "destinationToken": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "amount": "1000000",
    "userAddress": "9aUn5swQzUTRanaaTwmszxiv89cvFwUCjEBv1vZCoT1u"
  }'
```

**Expected Response**: `200 OK` with quotes or empty array (not an error)

### Monitoring Endpoints

Consider adding a simple health endpoint (`/api/health`) for monitoring:

```typescript
// src/app/api/health/route.ts
export async function GET() {
  return Response.json({ status: 'ok', timestamp: Date.now() });
}
```

---

## Troubleshooting

### Build Failures

**Issue**: Build fails with TypeScript errors
- **Solution**: Run `npm run lint` locally and fix errors before deploying

**Issue**: Build fails with memory errors
- **Solution**: Increase Node.js memory limit: `NODE_OPTIONS="--max-old-space-size=4096" npm run build`

### Runtime Errors

**Issue**: Application crashes on startup
- **Solution**: Check environment variables are set correctly
- **Solution**: Check logs for specific error messages
- **Solution**: Verify Node.js version is 18+

**Issue**: API endpoints return 500 errors
- **Solution**: Check server logs for provider API failures
- **Solution**: Verify RPC endpoints are accessible
- **Solution**: Check rate limits on external APIs

### Performance Issues

**Issue**: Slow quote fetching
- **Solution**: Use dedicated RPC provider (Alchemy, QuickNode)
- **Solution**: Enable caching for supported tokens
- **Solution**: Monitor provider API response times

**Issue**: High memory usage
- **Solution**: Use PM2 cluster mode (multiple instances)
- **Solution**: Monitor and restart if memory exceeds limits
- **Solution**: Check for memory leaks in logs

### Network Issues

**Issue**: Cannot connect to Solana RPC
- **Solution**: Verify `NEXT_PUBLIC_SOLANA_RPC_URL` is correct
- **Solution**: Check firewall rules allow outbound connections
- **Solution**: Test RPC endpoint directly with curl

**Issue**: Provider APIs timeout
- **Solution**: Check network connectivity
- **Solution**: Verify API URLs are correct
- **Solution**: Check rate limits and quotas

---

## Post-Deployment Checklist

- [ ] Environment variables configured correctly
- [ ] Application builds successfully
- [ ] Health check endpoint responds
- [ ] Quote API returns valid responses
- [ ] Wallet connection works (test with Phantom/Solflare)
- [ ] Transaction execution works (test with small amount)
- [ ] Logs are being written (if logging enabled)
- [ ] Monitoring alerts configured
- [ ] SSL certificate installed (if using custom domain)
- [ ] Backup strategy in place

---

## Scaling Considerations

### Horizontal Scaling

- **Vercel**: Automatically scales based on traffic
- **Docker**: Use Kubernetes or Docker Swarm for multiple instances
- **Self-Hosted**: Use PM2 cluster mode or load balancer with multiple instances

### Vertical Scaling

- Increase server resources (CPU, RAM) if needed
- Monitor resource usage and adjust accordingly

### Database Considerations

Currently, the application is stateless. If adding transaction history (Prisma), consider:
- Database connection pooling
- Read replicas for scaling reads
- Caching layer (Redis) for frequently accessed data

---

## Security Checklist

- [ ] Environment variables secured (not exposed in client)
- [ ] HTTPS enabled (SSL certificate)
- [ ] Rate limiting configured (if needed)
- [ ] CORS configured correctly
- [ ] API keys rotated regularly
- [ ] Logs don't contain sensitive data
- [ ] Dependencies updated regularly (`npm audit`)
- [ ] Firewall rules configured
- [ ] Access logs monitored

---

## Support

For deployment issues:
1. Check application logs
2. Review [Troubleshooting](#troubleshooting) section
3. Check [Environment Variables](./ENVIRONMENT_VARIABLES.md) documentation
4. Review [Architecture](./ARCHITECTURE.md) documentation for system understanding
