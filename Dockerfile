FROM node:20-alpine AS base

# 의존성
FROM base AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# 빌드
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# 빌드 시 필요한 더미 (런타임엔 실제 값으로 대체). mongodb.ts가 import 시 검사.
ENV MONGODB_URI=mongodb://localhost:27017/dummy
RUN npm run build

# 런타임 (standalone)
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
