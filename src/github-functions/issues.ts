import { Octokit } from 'octokit'

// Получаем токен из переменной окружения
const githubToken = process.env.GITHUB_TOKEN

if (!githubToken) {
    throw new Error(
        'GITHUB_TOKEN не найден в переменных окружения. Добавьте его в .env файл.',
    )
}

const octokit = new Octokit({ auth: githubToken })

export interface RepositoryInfo {
    owner: string
    repo: string
}

/**
 * Получить issue по номеру
 */
export async function getIssue(repoInfo: RepositoryInfo, issueNumber: number) {
    const response = await octokit.rest.issues.get({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        issue_number: issueNumber,
    })
    return response.data
}

/**
 * Обновить issue
 */
export async function updateIssue(
    repoInfo: RepositoryInfo,
    issueNumber: number,
    updates: { title?: string; body?: string; state?: 'open' | 'closed' },
) {
    const response = await octokit.rest.issues.update({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        issue_number: issueNumber,
        ...updates,
    })
    return response.data
}

/**
 * Получить список issues репозитория
 */
export async function listIssues(
    repoInfo: RepositoryInfo,
    options: { state?: 'open' | 'closed' | 'all'; per_page?: number } = {},
) {
    const response = await octokit.rest.issues.listForRepo({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        state: options.state || 'open',
        per_page: options.per_page || 30,
    })
    return response.data
}
