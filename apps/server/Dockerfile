FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/server/package.json apps/server/package.json
COPY packages packages
RUN npm install

COPY . .
RUN npm run build

EXPOSE 8787
CMD ["npm", "run", "start", "-w", "apps/server"]

