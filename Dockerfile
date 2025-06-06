# Используем официальный Node.js образ
FROM node:18-alpine

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

# Открываем порт
EXPOSE 8080

# Устанавливаем переменную окружения
ENV NODE_ENV=production

# Команда запуска
CMD ["npm", "start"] 