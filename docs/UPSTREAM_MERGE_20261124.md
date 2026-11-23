# Upstream merge — 2026-11-24

## Scope

- Merge upstream `v4.7.6` into the existing nofan customization history, preserving both merge parents.
- Upstream tag: `a593c9420d2ff4664d448a9cb71bf8ed4ff0c29a`.
- Previous fork head: `2b7e61fe702c362d14518d74937ed2ff295a8d9b`.
- Tested checkout: `/home/twoheart/projects/mastodon-476`, branch `codex/v4.7.6-shared-data`.
- The existing `/home/twoheart/projects/mastodon-475` branch is fast-forwarded to the same merge commit after validation.
- Local source integration only. No remote push, container publication, production deployment, service restart, or live database operations.

## Preserved customizations

- Polls: maximum 12 options, maximum 50 grapheme clusters per option, identical limits for single and multiple choice.
- Emoji category icons, per-user order, desktop drag scrolling and click suppression.
- Account switching, On This Day, rich-text compose preferences, custom themes, and existing fork build destinations.
- Existing Service Worker and shared-data protections remain part of the fork history.

## Validation

- Immutable JavaScript dependency installation and frozen Ruby bundle installation passed.
- TypeScript checking and production asset build passed.
- Complete legacy JavaScript suite passed: 4155 tests, using one worker.
- Targeted RSpec suites passed: 163 examples across login/2FA, status API, polls, On This Day, unsubscribe and instance serialization.
- Backend suites used newly created local test databases and a dedicated loopback Redis instance; existing preview and live databases were not used.
- Both full suites first encountered the 200 ms HTML parsing performance threshold while running concurrently. Serial reruns passed without changing the threshold or parser.
- No new files/changes under `db/` between `v4.7.5` and `v4.7.6`.
- Integration file lint passed; unchanged JSX files ignored by the upstream lint configuration may emit warnings.
- No browser/manual acceptance or production deployment was performed for this merge.
- Whitespace checks exclude upstream `.yarn/patches/*`: the upstream UTS58 patch contains whitespace-only patch context lines and remains byte-for-byte intact to preserve its lockfile hash.

## Future deployment notes

- Both target trees require Ruby 4.0.10; Node and Yarn versions remain governed by each tree's package metadata.
- Rebuild assets/container images and install dependencies for the selected checkout before running it.
- Production and Beta share database and Sidekiq: coordinate image and runtime compatibility before deployment even though these two tag increments add no database migrations.
- Preserve the host-mounted private export initializer, B2 environment variables, shared volumes, backup jobs and current media routing when creating deployment candidates.
- Test actual login/account switching, posting, 12-option polls, emoji drag scrolling and the active themes before a live rollout.

Logs and command results: `/mnt/e/codex-projects/operations/nofan-upstream-merge-20261124`.
