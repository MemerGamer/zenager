# Use Bun image as base
FROM oven/bun:1.3.0-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build

# Production image
FROM base AS runner
WORKDIR /app

# Create a non-root user
RUN addgroup --system --gid 1001 bunjs
RUN adduser --system --uid 1001 bunjs

# Copy the built application
COPY --from=builder --chown=bunjs:bunjs /app/.output ./output

# Set the user
USER bunjs

# Expose the port
EXPOSE 2718

# Set environment variables
ENV NODE_ENV=production
ENV PORT=2718

# Start the application
CMD ["bun", "run", "output/server/index.mjs"]
