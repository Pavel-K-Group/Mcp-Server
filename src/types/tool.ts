import { z } from 'zod'

export interface ToolDefinition {
    name: string
    config: {
        title?: string
        description: string
        inputSchema: z.ZodRawShape
    }
    handler: (input: unknown) => Promise<{ content: Array<{ type: 'text'; text: string }> }>
} 