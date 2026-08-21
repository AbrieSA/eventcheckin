[CmdletBinding()]
param(
  [string]$RepoRoot,
  [switch]$SkipFetch,
  [switch]$SkipBuild,
  [switch]$IncludeDependencyAudit
)

$ErrorActionPreference = 'Stop'

if (-not $RepoRoot) {
  $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')).Path
}

function Write-Section([string]$Title) {
  Write-Output ""
  Write-Output "## $Title"
}

function Invoke-Native([string]$Command, [string[]]$Arguments, [switch]$AllowFailure) {
  & $Command @Arguments
  $exitCode = $LASTEXITCODE
  if ($exitCode -ne 0 -and -not $AllowFailure) {
    throw "$Command exited with code $exitCode"
  }
}

Push-Location $RepoRoot
try {
  if (-not (Test-Path 'package.json') -or -not (Test-Path 'src') -or -not (Test-Path 'supabase')) {
    throw "RepoRoot is not the EventMe repository: $RepoRoot"
  }

  Write-Section 'Repository identity'
  Write-Output "repo_root=$RepoRoot"
  Invoke-Native git @('status', '--short', '--branch')
  Invoke-Native git @('remote', '-v')

  if (-not $SkipFetch) {
    Write-Section 'Remote refresh'
    Invoke-Native git @('fetch', '--prune', 'origin')
  }

  $originHead = (& git symbolic-ref --quiet --short refs/remotes/origin/HEAD 2>$null)
  $defaultBranch = if ($originHead) { $originHead -replace '^origin/', '' } else { 'main' }
  $localSha = (& git rev-parse HEAD).Trim()
  $remoteRef = "origin/$defaultBranch"
  $remoteSha = (& git rev-parse $remoteRef).Trim()

  Write-Section 'Branch alignment'
  Write-Output 'expected_default_branch=main'
  Write-Output "detected_default_branch=$defaultBranch"
  Write-Output "current_branch=$((& git branch --show-current).Trim())"
  Write-Output "local_head=$localSha"
  Write-Output "remote_default_head=$remoteSha"
  Invoke-Native git @('branch', '-a', '-vv')
  Write-Output 'local_main_vs_remote_main_left_right='
  Invoke-Native git @('rev-list', '--left-right', '--count', 'main...origin/main') -AllowFailure
  Write-Output 'remote_branches='
  Invoke-Native git @('for-each-ref', '--format=%(refname:short) %(objectname:short)', 'refs/remotes/origin')

  Write-Section 'Working-tree hygiene'
  Invoke-Native git @('status', '--short')
  Write-Output 'tracked_sensitive_or_generated_paths='
  $trackedPaths = & git ls-files -- '.env' 'build/**' '.codex-artifacts/**' '.codex-local-server*.log' 'supabase/.temp/**'
  if ($trackedPaths) { $trackedPaths } else { Write-Output 'none' }
  Invoke-Native git @('diff', '--check')
  Invoke-Native git @('diff', '--cached', '--check')

  Write-Section 'Supabase migrations'
  $migrationFiles = & git ls-files -- 'supabase/migrations/*.sql'
  Write-Output "tracked_migration_count=$(@($migrationFiles).Count)"
  $migrationFiles | Select-Object -Last 10

  Write-Section 'Browser-storage privacy search'
  if (Get-Command rg -ErrorAction SilentlyContinue) {
    & rg -n --glob 'src/**' 'localStorage|sessionStorage'
    if ($LASTEXITCODE -eq 1) { Write-Output 'none' }
  } else {
    Write-Output 'rg_unavailable'
  }

  Write-Section 'Build verification'
  if ($SkipBuild) {
    Write-Output 'build=skipped'
  } else {
    $npmCommand = if (Get-Command npm.cmd -ErrorAction SilentlyContinue) { 'npm.cmd' } else { 'npm' }
    & $npmCommand run build
    Write-Output "build_exit_code=$LASTEXITCODE"
  }

  Write-Section 'Test and CI availability'
  $packageJson = Get-Content -Raw 'package.json' | ConvertFrom-Json
  $scriptNames = @($packageJson.scripts.PSObject.Properties.Name)
  Write-Output "package_scripts=$($scriptNames -join ',')"
  $workflowFiles = @(Get-ChildItem '.github/workflows' -File -ErrorAction SilentlyContinue)
  Write-Output "github_workflow_count=$($workflowFiles.Count)"

  if ($IncludeDependencyAudit) {
    Write-Section 'Dependency audit'
    $npmCommand = if (Get-Command npm.cmd -ErrorAction SilentlyContinue) { 'npm.cmd' } else { 'npm' }
    & $npmCommand audit --omit=dev
    Write-Output "dependency_audit_exit_code=$LASTEXITCODE"
  }

  Write-Section 'GitHub and deployment status'
  if (Get-Command gh -ErrorAction SilentlyContinue) {
    & gh auth status 1>$null 2>$null
    if ($LASTEXITCODE -eq 0) {
      $repoName = (& gh repo view --json nameWithOwner --jq '.nameWithOwner').Trim()
      Write-Output "github_repository=$repoName"
      & gh repo view --json defaultBranchRef,url,isPrivate
      & gh pr list --state open --limit 50 --json number,title,isDraft,headRefName,baseRefName,url
      & gh api "repos/$repoName/commits/$remoteSha/status" --jq '{state,total_count,statuses:[.statuses[]|{context,state,target_url,description,updated_at}]}'
      & gh api "repos/$repoName/deployments?sha=$remoteSha&per_page=20" --jq '[.[]|{id,sha,ref,environment,created_at}]'
    } else {
      Write-Output 'github_status=authentication_unavailable'
    }
  } else {
    Write-Output 'github_status=gh_unavailable'
  }
} finally {
  Pop-Location
}
