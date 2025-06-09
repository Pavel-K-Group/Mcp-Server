import { z } from 'zod';
import type { ToolDefinition } from '../types/tool.js';

/**
 * Безопасное вычисление математических выражений
 * Поддерживает: +, -, *, /, %, **, (), sqrt, abs, sin, cos, tan, log, ln
 */
function safeEvaluate(expression: string): number {
    // Удаляем пробелы
    const cleaned = expression.replace(/\s+/g, '');
    
    // Проверяем на допустимые символы
    const allowedPattern = /^[0-9+\-*/().,\s%^√πe\w]+$/;
    if (!allowedPattern.test(cleaned)) {
        throw new Error('Недопустимые символы в выражении');
    }
    
    // Заменяем математические функции и константы
    let processed = cleaned
        .replace(/π/g, Math.PI.toString())
        .replace(/pi/g, Math.PI.toString())
        .replace(/e\b/g, Math.E.toString())
        .replace(/sqrt\(/g, 'Math.sqrt(')
        .replace(/abs\(/g, 'Math.abs(')
        .replace(/sin\(/g, 'Math.sin(')
        .replace(/cos\(/g, 'Math.cos(')
        .replace(/tan\(/g, 'Math.tan(')
        .replace(/log\(/g, 'Math.log10(')
        .replace(/ln\(/g, 'Math.log(')
        .replace(/\^/g, '**')
        .replace(/√/g, 'Math.sqrt');
    
    try {
        // Используем Function constructor для безопасного вычисления
        const result = new Function('Math', `"use strict"; return (${processed})`)(Math);
        
        if (typeof result !== 'number' || !isFinite(result)) {
            throw new Error('Результат не является действительным числом');
        }
        
        return result;
    } catch (error) {
        throw new Error(`Ошибка вычисления: ${error instanceof Error ? error.message : 'неизвестная ошибка'}`);
    }
}

export const toolDefinition: ToolDefinition = {
    name: 'calculator',
    description: 'Выполняет математические вычисления. Поддерживает основные операции (+, -, *, /, %, **), функции (sqrt, abs, sin, cos, tan, log, ln) и константы (π, e)',
    inputSchema: {
        expression: z.string().describe('Математическое выражение для вычисления (например: "2 + 2", "sqrt(16)", "sin(π/2)")')
    },
    handler: async (input) => {
        try {
            const args = input as { expression: string };
            const { expression } = args;
            
            if (!expression || expression.trim() === '') {
                return {
                    content: [{
                        type: "text" as const,
                        text: "Ошибка: Выражение не может быть пустым"
                    }]
                };
            }
            
            const result = safeEvaluate(expression);
            
            return {
                content: [{
                    type: "text" as const,
                    text: `🧮 Калькулятор\n\nВыражение: ${expression}\nРезультат: ${result}\n\n${expression} = ${result}`
                }]
            };
            
        } catch (error) {
            return {
                content: [{
                    type: "text" as const,
                    text: `❌ Ошибка вычисления: ${error instanceof Error ? error.message : 'неизвестная ошибка'}`
                }]
            };
        }
    }
}; 