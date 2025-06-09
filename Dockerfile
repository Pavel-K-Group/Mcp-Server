# Используем официальный Node.js образ
FROM node:20-alpine

# Устанавливаем рабочую директорию
WORKDIR /app

# Копируем package.json для установки зависимостей
COPY package*.json ./

# Устанавливаем все зависимости (включая dev для сборки)
RUN npm install

# Копируем исходный код
COPY . .

# Собираем проект
RUN npm run build

# Устанавливаем только production зависимости
RUN npm ci --only=production && npm cache clean --force

# Открываем порт (по умолчанию 8080, но может быть переопределен)
EXPOSE ${PORT:-8080}

# Устанавливаем переменные окружения
ENV NODE_ENV=production
ENV PORT=${PORT:-8080}

# Команда запуска
CMD ["npm", "start"] 