// Типы для тудушек на основе существующих в Timelix

export type TaskPriority = 'high' | 'medium' | 'low'

export interface Todo {
    id: string
    userId: string
    title: string
    description?: string
    completed: boolean
    priority: TaskPriority
    dueDate?: string
    tags: string[]
    projectId?: string
    createdAt: string
    updatedAt: string
    deletedAt?: string
}

export interface CreateTodoInput {
    title: string
    description?: string
    priority?: TaskPriority
    dueDate?: string
    tags?: string[]
    projectId?: string
}

export interface UpdateTodoInput {
    title?: string
    description?: string
    completed?: boolean
    priority?: TaskPriority
    dueDate?: string
    tags?: string[]
    projectId?: string
}

export interface TodoSearchInput {
    todoId?: string
    position?: number
    titleSearch?: string
    limit?: number
}
