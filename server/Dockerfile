FROM node:20-alpine

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

COPY . .

RUN chmod +x start.sh

ENV NODE_ENV=production

EXPOSE 5000

CMD ["sh", "./start.sh"]