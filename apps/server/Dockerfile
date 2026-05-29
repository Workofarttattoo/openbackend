FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/server/package.json apps/server/package.json
COPY packages packages
RUN npm install

COPY . .
RUN npm run build

EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:' + (process.env.OPENBACKEND_PORT || 8787) + '/health').then((res) => process.exit(res.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["npm", "run", "start", "-w", "apps/server"]
