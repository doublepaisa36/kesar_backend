# Stage 1: Build
FROM node:18-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
COPY packages/worker ./packages/worker
WORKDIR /app/packages/worker
RUN npx prisma generate --schema=../../prisma/schema.prisma
RUN npm run build

# Stage 2: Production
FROM node:18-alpine
WORKDIR /app
COPY --from=build /app/packages/worker/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
ENV NODE_ENV=production
CMD ["node", "dist/index.js"]
