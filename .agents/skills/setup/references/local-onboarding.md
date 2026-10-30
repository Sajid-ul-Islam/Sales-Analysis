# Local Vercel CI Onboarding

Use this reference while following the goals and workflow in the parent `SKILL.md`.

Read the current [Vercel CI documentation](https://vercel.com/docs/ci) first. Use it as the source of truth for current product requirements, supported task configuration, and CLI behavior.

## When Vercel CI documentation is unavailable

Continue with this bundled reference when the documentation cannot be fetched or does not specify the required operation. Note in the result that current documentation could not be verified.

- Require Turborepo 2.11.7 or later.
- Add the `ci` task tag using the fallback under [Prepare the combined change](#prepare-the-combined-change).
- Enable Vercel CI using the released CLI or API commands under [Enable Vercel CI](#enable-vercel-ci).
- Verify task configuration and repository enablement before pushing the setup branch.

## Check CLI capabilities

Use dedicated Vercel CLI commands when they support the required operation. Fall back to `vercel api` only for onboarding operations that the installed CLI does not expose.

```bash
vercel api --help
vercel ci list --help
```

If either command is unavailable, stop and ask the user to upgrade Vercel CLI. Do not use operation-ID dispatch or unreleased commands.

## Resolve the repository

If the user supplies a Vercel project, prefer its immutable project ID over its name. Start with the dedicated project command:

```bash
vercel project inspect <project-id-or-name> --scope <team>
```

If the command does not return the canonical GitHub link, fall back to the raw project route:

```bash
vercel api "/v9/projects/<url-encoded-project-id-or-name>" \
  --scope <team> \
  --raw
```

Require the response `accountId` to match the selected team and `link.type` to equal `github`. Read the repository only from `link.org` and `link.repo`; do not infer it from the project name.

Compare the resulting `owner/repo` with the local checkout's GitHub remote. Ask the user to confirm the repository before continuing. A local `.vercel/project.json` can provide a candidate project ID, but does not establish the team or authorize setup.

Read repository settings:

```bash
vercel api "/v1/vercel-ci/repository-settings?provider=github&organizationId=<url-encoded-owner>&repository=<url-encoded-repository>" \
  --scope <team> \
  --raw
```

Record `ciEnabledAt` and the canonical repository identity. Treat `ciEnabled` as the API's derived convenience field: the repository is enabled when `ciEnabledAt` is present. Stop if the repository is public, unlinked, linked only to another team, or does not match the local checkout.

## Discover runnable tasks

Keep discovery read-only:

1. Require a root `turbo.json` or `turbo.jsonc` and a declared `turbo` dependency. Stop and report that this skill supports only Turborepo repositories if either is absent.
2. Detect the package manager from the root `package.json` and lockfile.
3. Read the root `package.json`, workspace definition, root Turborepo configuration, package manifests, and package-level Turborepo configurations.
4. Collect each task declared under `tasks` that has a matching non-empty script in the root or at least one applicable workspace package.
5. Preserve the task's Turborepo config path and full task name. A task name alone is not unique across package-level configurations.
6. Inspect `.github/workflows/**/*.yml` and `.github/workflows/**/*.yaml` for Turborepo tasks already exercised in CI.

Do not install dependencies or invoke `turbo` during discovery. If dependencies are absent, invoking `turbo` can use a different global version or create repository guidance files, violating read-only analysis. Perform runtime validation after selecting tasks, when the repository's declared version is installed.

Use task names as initial recommendation signals:

- lint tasks;
- type-checking tasks such as `typecheck`, `type-check`, `check-types`, or `tsc`;
- formatter-check tasks such as `format:check`, `format-check`, or `prettier:check`;
- unit-test tasks such as `unit-test`, `unittest`, or `test:unit`;
- other focused test tasks.

Task names are only signals. Confirm scripts, dependencies, and environment requirements before recommending them.

## Prefer low-dependency tasks

Prefer focused lint, type-check, formatter-check, and unit-test tasks that require no secrets, environment variables, deployments, or external services.

Treat existing GitHub Actions use as positive evidence.

Do not recommend these by default:

- builds;
- end-to-end, integration, smoke, or deployment tasks;
- tasks that deploy applications or depend on deployment tasks;
- tasks requiring databases, browsers, cloud credentials, or external services;
- tasks whose environment requirements cannot be determined.

Inspect applicable Turborepo definitions for:

- `env`;
- `passThroughEnv`;
- `globalEnv`;
- `globalPassThroughEnv`;
- dependencies on deployment or environment-provisioning tasks.

Also inspect package scripts and existing workflows for environment setup. Do not claim that a task needs no environment variables merely because Turborepo declares none. Describe the available evidence and call uncertainty out explicitly.

Summarize available tasks by config path and task name, counting the package instances covered by each task. Select at most five conservative tasks. Record each selection with:

- task name and config path;
- package count;
- recommendation reason;
- whether GitHub Actions already runs it;
- relevant dependencies;
- declared or observed environment requirements.

Never print every package-level instance by default.

Proceed with the conservative selections and create the onboarding pull request. Ask only when the repository is ambiguous or no safe selection can be determined.

## Prepare the combined change

Require a clean working tree. Fetch the remote default branch and create a new branch from its latest commit. Never discard unrelated local work.

Determine the Turborepo version from the repository's dependency declaration and lockfile. If it is older than the minimum in the current Vercel CI documentation:

1. Record the current and proposed versions in the pull-request summary.
2. Preserve the repository's dependency style and version policy.
3. Update the root Turborepo dependency to a compatible release at or above the documented minimum, and never below 2.11.7.
4. Run the detected package manager's install command to regenerate its lockfile.
5. Never hand-edit the lockfile.

If dependencies are absent and no upgrade is needed, install the lockfile's existing dependency versions so validation uses the repository's declared `turbo` version.

Configure each selected task using the current task opt-in syntax from the Vercel CI documentation. Preserve existing task configuration, formatting, and JSONC comments. Do not add a task that is absent from that configuration.

If the documentation is unavailable or does not state the opt-in syntax, add the `ci` tag to each selected task:

```json
{
  "tasks": {
    "check-types": {
      "tags": ["ci"]
    }
  }
}
```

Preserve every other task property and existing tag, add `ci` only once, and apply the fallback in the Turborepo configuration where the selected task is defined. Do not use this fallback when the current documentation explicitly specifies different syntax.

Validate that:

- the resolved Turborepo version satisfies the current documented minimum and is at least 2.11.7;
- each edited Turborepo configuration parses;
- every selected task still has a matching non-empty package script;
- every selected task uses the current documented Vercel CI opt-in syntax or, when unavailable, the bundled `ci` tag fallback;
- no unselected task was changed.

Review the complete diff and commit it locally using the repository's commit style. Do not push or open the pull request yet.

## Enable Vercel CI

After the local commit is ready, enable Vercel CI before pushing the setup branch. Prefer the dedicated Vercel CLI command:

```bash
vercel ci enable --remote <remote> --scope <team>
```

If `vercel ci enable` is unavailable, use the released repository-settings API:

```bash
printf '%s\n' '{"ciEnabled":true}' |
  vercel api "/v1/vercel-ci/repository-settings?provider=github&organizationId=<url-encoded-owner>&repository=<url-encoded-repository>" \
    --scope <team> \
    --method PATCH \
    --input - \
    --raw
```

Send `ciEnabled: true`; never set `ciEnabledAt` directly because the service manages that timestamp. Read settings again and require `ciEnabledAt` to be present. If enablement fails or cannot be verified, do not create the pull request.

## Push the setup branch

Push the prepared branch only after Vercel CI enablement is verified, then verify that the expected commit exists on the remote branch. This ordering ensures the push can create the initial Vercel CI invocation.

If the push fails, leave Vercel CI enabled and report the failure so a retry or concurrent setup is not disabled. If the push outcome is uncertain, inspect the remote branch before retrying.

## Create the pull request

Create one pull request containing both the Turborepo upgrade, when required, and the selected task configuration:

```bash
gh pr create \
  --base <default-branch> \
  --head <setup-branch> \
  --title "Set up Vercel CI" \
  --body "<summary of selected tasks, Turborepo upgrade, and validation>"
```

If the command outcome is uncertain, look for an open pull request with the same head branch before retrying.

If pull-request creation fails, leave Vercel CI enabled and report the failure so setup can be retried safely. If the outcome is uncertain, check for the pull request before retrying.

## Find the invocation

After the pull request exists, get its head branch and commit SHA. Poll with bounded waits:

```bash
vercel ci list \
  --branch "<setup-branch>" \
  --commit "<commit-sha>" \
  --scope <team> \
  --json
```

When an invocation appears, report its status and construct its dashboard URL:

```text
https://vercel.com/<team-slug>/~/ci/<invocation-id>
```

Return the pull-request URL and, once available, the Vercel CI invocation URL. Do not wait indefinitely. If no invocation appears, report that it is still pending and return the exact lookup command with the pull-request URL.
