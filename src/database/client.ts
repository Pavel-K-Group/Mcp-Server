import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.js'

// Создаем подключение к PostgreSQL
const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/timelix'

// Создаем клиент PostgreSQL
const client = postgres(connectionString, {
    max: 10, // максимальное количество соединений в пуле
    idle_timeout: 20, // время ожидания неактивного соединения
    connect_timeout: 10, // время ожидания подключения
})

// Создаем экземпляр Drizzle
export const db = drizzle(client, { schema })

// Функция для проверки подключения к базе данных
export async function testConnection() {
    try {
        await client`SELECT 1`
        console.log('✅ Database connection successful')
        return true
    } catch (error) {
        console.error('❌ Database connection failed:', error)
        return false
    }
}

// Экспортируем схему для использования в инструментах
export { schema }
