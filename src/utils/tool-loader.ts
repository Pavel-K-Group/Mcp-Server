import { readdir } from 'fs/promises'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import type { ToolDefinition } from '../types/tool.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Автоматически загружает все инструменты из папки tools
 */
export async function loadAllTools(): Promise<ToolDefinition[]> {
    const tools: ToolDefinition[] = []
    const toolsDir = join(__dirname, '../tools')
    
    try {
        const files = await readdir(toolsDir)
        const tsFiles = files.filter(file => file.endsWith('.ts') || file.endsWith('.js'))
        
        for (const file of tsFiles) {
            try {
                const modulePath = join(toolsDir, file)
                const module = await import(modulePath)
                
                if (module.toolDefinition && typeof module.toolDefinition === 'object') {
                    tools.push(module.toolDefinition)
                    console.log(`✅ Загружен инструмент: ${module.toolDefinition.name}`)
                }
            } catch (error) {
                console.warn(`⚠️ Не удалось загрузить инструмент из ${file}:`, error)
            }
        }
    } catch (error) {
        console.error('❌ Ошибка при сканировании папки с инструментами:', error)
    }
    
    return tools
} 