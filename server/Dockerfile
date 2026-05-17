FROM node:20-alpine
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Install dependencies (separate layer for caching)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source
COPY . .

EXPOSE 5000
CMD ["node", "server.js"]
