FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/dashboard/package.json ./apps/dashboard/
RUN npm ci --workspace=dashboard

COPY apps/dashboard ./apps/dashboard
RUN npm run build --workspace=dashboard

FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/dashboard/package.json ./apps/dashboard/
RUN npm ci --omit=dev --workspace=dashboard
COPY --from=builder /app/apps/dashboard/.next ./apps/dashboard/.next
COPY --from=builder /app/apps/dashboard/public ./apps/dashboard/public
COPY --from=builder /app/apps/dashboard/next.config.mjs ./apps/dashboard/next.config.mjs

ENV PORT=3001
ENV HOST=0.0.0.0
EXPOSE 3001
CMD ["npm", "start", "--workspace=dashboard", "--", "-p", "3001"]
