FROM node:23-alpine
RUN npm install -g pnpm@latest
WORKDIR /api

COPY . .
RUN pnpm install
RUN pnpm -r run build

CMD ['pnpm', 'run', 'start']
