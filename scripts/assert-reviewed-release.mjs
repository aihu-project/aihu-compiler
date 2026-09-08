import { execFileSync } from 'node:child_process'

const repository = process.env.GITHUB_REPOSITORY
const releaseSha = process.env.RELEASE_SHA
const defaultBranch = process.env.DEFAULT_BRANCH
if (!repository || !releaseSha || !defaultBranch)
  throw new Error('reviewed release check requires repository, release SHA, and default branch')

let pulls
try {
  pulls = JSON.parse(
    execFileSync(
      'gh',
      [
        'api',
        `repos/${repository}/commits/${releaseSha}/pulls`,
        '--header',
        'Accept: application/vnd.github+json',
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ),
  )
} catch {
  throw new Error('GitHub could not verify merged pull requests for the release commit')
}

if (
  !Array.isArray(pulls) ||
  !pulls.some(
    (pull) =>
      pull?.merged_at &&
      pull.base?.ref === defaultBranch &&
      pull.base?.repo?.full_name === repository &&
      pull.merge_commit_sha === releaseSha,
  )
)
  throw new Error('release commit is not the merge commit of a merged PR into the default branch')

console.log(`verified reviewed merged release commit ${releaseSha}`)
