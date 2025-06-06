import { Octokit } from 'octokit'
import type { RepositoryInfo } from './issues.js'

// Получаем токен из переменной окружения
const githubToken = process.env.GITHUB_TOKEN

if (!githubToken) {
    throw new Error(
        'GITHUB_TOKEN не найден в переменных окружения. Добавьте его в .env файл.',
    )
}

const octokit = new Octokit({ auth: githubToken })

/**
 * Получить pull request по номеру
 */
export async function getPullRequest(repoInfo: RepositoryInfo, pullNumber: number) {
    const response = await octokit.rest.pulls.get({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        pull_number: pullNumber,
    })
    return response.data
}

/**
 * Обновить pull request
 */
export async function updatePullRequest(
    repoInfo: RepositoryInfo,
    pullNumber: number,
    updates: { title?: string; body?: string; state?: 'open' | 'closed' },
) {
    const response = await octokit.rest.pulls.update({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        pull_number: pullNumber,
        ...updates,
    })
    return response.data
}

/**
 * Получить список pull requests репозитория
 */
export async function listPullRequests(
    repoInfo: RepositoryInfo,
    options: { state?: 'open' | 'closed' | 'all'; per_page?: number } = {},
) {
    const response = await octokit.rest.pulls.list({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        state: options.state || 'open',
        per_page: options.per_page || 30,
    })
    return response.data
}
