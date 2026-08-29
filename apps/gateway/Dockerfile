FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/gateway/package.json ./apps/gateway/
RUN npm ci --workspace=@controlplane/gateway

COPY apps/gateway ./apps/gateway
RUN npm run build --workspace=@controlplane/gateway

FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/gateway/package.json ./apps/gateway/
RUN npm ci --omit=dev --workspace=@controlplane/gateway
COPY --from=builder /app/apps/gateway/dist ./apps/gateway/dist

ENV PORT=3000
ENV HOST=0.0.0.0
EXPOSE 3000
CMD ["node", "apps/gateway/dist/server.js"]
