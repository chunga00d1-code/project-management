# Repository-Based Task Assignment Design

## Goal

Make GitHub repositories installed through the GitHub App the only source of projects and task assignees. Update task creation to schedule work with precise start and deadline times.

## Product Rules

- Users do not create projects manually.
- Installing the GitHub App on a repository creates or updates its repository record in ReviewGrid.
- The create-task popup selects a synced repository rather than a manually maintained project.
- Assignees come from the selected repository's GitHub collaborators.
- A task may remain unassigned if collaborators cannot be loaded or no collaborator is selected.
- New tasks do not use `sprint` or `team` overrides.
- New tasks use a start datetime and deadline datetime, stored as UTC ISO strings.
- A deadline must be later than the start datetime.

## User Interface

### Create-task popup

The form contains:

1. Task title.
2. Repository, populated from GitHub App-synced project records.
3. Assignee, populated after selecting a repository.
4. Priority.
5. Start time using `datetime-local`.
6. Deadline using `datetime-local`.
7. Labels.

The Sprint and Team override inputs are removed. Selecting a repository clears any previously selected assignee and loads collaborators. While loading, the assignee control displays a loading state. Each option shows the collaborator's avatar, display name when available, and GitHub username. An explicit `Chưa giao` option remains available.

The submit button is disabled when no repository is selected, required fields are missing, collaborators are loading, or the deadline is not later than the start time. A collaborator-loading failure is shown inline but does not prevent creation of an unassigned task.

### Repository page

The existing Projects page becomes a read-only repository list. Manual create, update, membership, and unlink controls are removed from the UI. Each row shows repository identity and GitHub App synchronization information. Repository records continue to be created and updated only through the existing GitHub App installation flow.

## Backend Architecture

### Collaborator endpoint

Add `GET /projects/:id/collaborators`.

The endpoint:

1. Authenticates the ReviewGrid user and checks access to the project record.
2. Reads `repositoryFullName` and `installationId` from the selected record.
3. Creates an installation token server-side.
4. Calls GitHub's repository collaborators API.
5. Returns normalized collaborators as `{ login, name, avatarUrl }[]`.

GitHub credentials never reach the browser. Results are cached in process for five minutes per repository. GitHub pagination is followed until all collaborators are collected. Duplicate logins are removed and results are sorted by display name or login.

If the record is not linked to GitHub, return a validation error. If GitHub rejects the request or is unavailable, return a gateway-style error that the popup renders inline.

### Task data

Add optional ISO UTC fields:

- `startAt?: string`
- `dueAt?: string`

For new task requests, validate that supplied values are complete ISO timestamps and that `dueAt` is strictly later than `startAt`. The task creation payload accepts `repository`, `assignee`, `startAt`, `dueAt`, priority, title, and labels. It no longer accepts `sprint` or `team` from the create-task UI.

Before accepting a non-empty assignee, the backend verifies that the login is in the selected repository's collaborator list. This prevents clients from assigning arbitrary usernames.

Existing records remain backward compatible: legacy `dueDate`, `sprint`, and `team` values stay in storage and types where required for migration-safe reads, but the create/edit interfaces no longer display or write them. Displays prefer `dueAt` and fall back to `dueDate` for legacy tasks.

## Data Flow

1. GitHub App installation synchronizes a repository project record.
2. Create-task popup loads synchronized records from `/projects`.
3. User selects a repository record.
4. Popup requests `/projects/:id/collaborators`.
5. Backend fetches collaborators using the repository installation token and returns normalized data.
6. User selects an assignee and local datetimes.
7. Browser converts local datetime values to UTC ISO strings.
8. Backend validates repository, collaborator membership, and datetime ordering.
9. Task is stored and the task board refreshes.

## Error Handling

- Missing repository: block submission and show a required-field message.
- Collaborators loading: disable the assignee control and submission.
- Collaborators unavailable: show an inline GitHub error, reset assignee to unassigned, and allow unassigned submission.
- Invalid start or deadline: show the validation message beside the datetime controls and block submission.
- Assignee no longer belongs to the repository: backend rejects the request and the popup asks the user to refresh the collaborator list.
- GitHub App lacks permission: backend logs the GitHub status without exposing credentials and returns a safe error message.

## Testing

- Unit-test GitHub collaborator pagination, normalization, sorting, deduplication, and error mapping.
- Route-test authentication, repository access, missing GitHub linkage, and normalized responses.
- Validation-test ISO datetime parsing and the strict `dueAt > startAt` rule.
- Service-test rejection of an assignee outside the selected repository.
- Frontend source/component tests verify removal of Sprint and Team override, repository-driven collaborator loading, unassigned fallback, datetime-local controls, UTC conversion, and payload field names.
- Regression tests verify legacy `dueDate` tasks still render while new tasks render start and deadline times.

## Out of Scope

- Persisting collaborator profiles in MongoDB.
- Receiving collaborator-change webhooks.
- Inviting or removing GitHub collaborators from ReviewGrid.
- Manual repository creation or manual repository-to-project linking.
- Migrating or deleting legacy Sprint, Team, and due-date data.
