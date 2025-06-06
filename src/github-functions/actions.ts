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
 * Получить список workflow runs (действий) репозитория
 */
export async function listWorkflowRuns(
    repoInfo: RepositoryInfo,
    options: {
        status?:
            | 'completed'
            | 'action_required'
            | 'cancelled'
            | 'failure'
            | 'neutral'
            | 'skipped'
            | 'stale'
            | 'success'
            | 'timed_out'
            | 'in_progress'
            | 'queued'
            | 'requested'
            | 'waiting'
            | 'pending'
        per_page?: number
        page?: number
    } = {},
) {
    const response = await octokit.rest.actions.listWorkflowRunsForRepo({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        status: options.status,
        per_page: options.per_page || 30,
        page: options.page || 1,
    })
    return response.data
}

/**
 * Получить статус конкретного workflow run
 */
export async function getWorkflowRun(repoInfo: RepositoryInfo, runId: number) {
    const response = await octokit.rest.actions.getWorkflowRun({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        run_id: runId,
    })
    return response.data
}

/**
 * Получить детали workflow run (включая jobs)
 */
export async function getWorkflowRunDetails(
    repoInfo: RepositoryInfo,
    runId: number,
    options: { per_page?: number; page?: number } = {},
) {
    // Получаем основную информацию о run
    const runResponse = await octokit.rest.actions.getWorkflowRun({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        run_id: runId,
    })

    // Получаем список jobs для этого run
    const jobsResponse = await octokit.rest.actions.listJobsForWorkflowRun({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        run_id: runId,
        per_page: options.per_page || 30,
        page: options.page || 1,
    })

    return {
        run: runResponse.data,
        jobs: jobsResponse.data,
    }
}

/**
 * Отменить workflow run
 */
export async function cancelWorkflowRun(repoInfo: RepositoryInfo, runId: number) {
    const response = await octokit.rest.actions.cancelWorkflowRun({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        run_id: runId,
    })
    return response.data
}

/**
 * Повторить workflow run
 */
export async function rerunWorkflowRun(repoInfo: RepositoryInfo, runId: number) {
    const response = await octokit.rest.actions.reRunWorkflow({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        run_id: runId,
    })
    return response.data
}

/**
 * Повторить неудачные jobs в workflow run
 */
export async function rerunFailedJobs(repoInfo: RepositoryInfo, runId: number) {
    const response = await octokit.rest.actions.reRunWorkflowFailedJobs({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        run_id: runId,
    })
    return response.data
}
