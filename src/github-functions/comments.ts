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
 * Создать комментарий к issue
 */
export async function createIssueComment(
    repoInfo: RepositoryInfo,
    issueNumber: number,
    body: string,
) {
    const response = await octokit.rest.issues.createComment({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        issue_number: issueNumber,
        body,
    })
    return response.data
}

/**
 * Создать комментарий к pull request
 */
export async function createPullRequestComment(
    repoInfo: RepositoryInfo,
    pullNumber: number,
    body: string,
) {
    const response = await octokit.rest.issues.createComment({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        issue_number: pullNumber,
        body,
    })
    return response.data
}
