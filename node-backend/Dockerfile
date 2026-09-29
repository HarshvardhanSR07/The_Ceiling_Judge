FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY . .
RUN npx tsc || true
EXPOSE 8080
CMD ["npx", "tsx", "src/index.ts"]
