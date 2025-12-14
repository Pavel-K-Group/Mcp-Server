import { z } from 'zod'
import type { ToolDefinition } from '../types/tool.js'

/**
 * Безопасная оценка математического выражения
 * Поддерживает: +, -, *, /, скобки, числа (включая десятичные)
 */
function safeEvaluate(expression: string): number {
    // Убираем пробелы
    const cleaned = expression.replace(/\s+/g, '')
    
    // Проверяем, что выражение содержит только разрешённые символы
    if (!/^[0-9+\-*/().\s]+$/.test(cleaned)) {
        throw new Error('Expression contains invalid characters. Only numbers, +, -, *, /, and parentheses are allowed.')
    }
    
    // Проверяем баланс скобок
    const openParens = (cleaned.match(/\(/g) || []).length
    const closeParens = (cleaned.match(/\)/g) || []).length
    if (openParens !== closeParens) {
        throw new Error('Unbalanced parentheses')
    }
    
    try {
        // Используем Function constructor для безопасной оценки
        // Это безопаснее чем eval, так как мы уже проверили входные данные
        const result = Function(`"use strict"; return (${cleaned})`)()
        
        if (typeof result !== 'number' || !isFinite(result)) {
            throw new Error('Result is not a finite number')
        }
        
        return result
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Invalid expression: ${error.message}`)
        }
        throw new Error('Failed to evaluate expression')
    }
}

/**
 * Калькулятор - вычисляет математические выражения
 */
async function calculate(input: { expression: string }) {
    const { expression } = input
    
    if (!expression || expression.trim().length === 0) {
        throw new Error('Expression is required')
    }
    
    try {
        const result = safeEvaluate(expression)
        
        return {
            success: true,
            operation: 'calculate',
            data: {
                expression: expression.trim(),
                result: result,
            },
            message: `${expression.trim()} = ${result}`,
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        return {
            success: false,
            operation: 'calculate',
            error: errorMessage,
            message: `Calculation failed: ${errorMessage}`,
        }
    }
}

// Схема для валидации входных данных
const inputSchema = {
    expression: z
        .string()
        .min(1)
        .describe('Mathematical expression to calculate (e.g., "2 + 2", "10 * 5", "(3 + 4) * 2")'),
}

// Экспортируем определение инструмента
export const toolDefinition: ToolDefinition = {
    name: 'calculator',
    description: 'Calculate mathematical expressions. Supports basic operations: +, -, *, /, parentheses, and decimal numbers. Example: "2 + 2", "(10 + 5) * 3"',
    inputSchema: inputSchema,
    handler: async (input: unknown) => {
        try {
            const parsed = z.object(inputSchema).parse(input)
            const result = await calculate(parsed)
            return {
                content: [
                    { type: 'text' as const, text: JSON.stringify(result, null, 2) },
                ],
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            const result = {
                success: false,
                operation: 'calculate',
                error: errorMessage,
                message: `Failed to calculate: ${errorMessage}`,
            }
            return {
                content: [
                    { type: 'text' as const, text: JSON.stringify(result, null, 2) },
                ],
            }
        }
    },
}
