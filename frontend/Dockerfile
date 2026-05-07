FROM node:20-alpine AS base
WORKDIR /app
ENV CI=1

# --- dev: используется в docker-compose для горячей перезагрузки ---
FROM base AS dev
COPY package.json ./
RUN npm install
COPY . ./
EXPOSE 5173
CMD ["npm", "run", "dev"]

# --- build: собираем статический бандл ---
FROM base AS build
COPY package.json ./
RUN npm install
COPY . ./
RUN npm run build

# --- prod: отдаём билд через nginx ---
FROM nginx:1.27-alpine AS prod
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
