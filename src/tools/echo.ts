import { z } from 'zod'
import type { ToolDefinition } from '../types/tool.js'

const inputSchema = {
    message: z.string().describe('Message to echo back'),
}

export const toolDefinition: ToolDefinition = {
    name: 'echo',
    description: 'Echo back the message. For testing.',
    inputSchema: inputSchema,
    handler: async (input: unknown) => {
        const parsed = z.object(inputSchema).parse(input)
        return {
            content: [
                { type: 'text' as const, text: `ECHO v1: ${parsed.message}` },
            ],
        }
    },
}
