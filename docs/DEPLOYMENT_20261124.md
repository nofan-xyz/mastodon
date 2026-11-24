# nofan production release — 2026-11-24

Public verification completed: 2026-11-24T14:09:25.829862+08:00 (Asia/Shanghai).

| Site | Release | Source commit |
| --- | --- | --- |
| https://nofan.xyz | v4.7.6 | `953382948c7b9f0d0c0049c4a2068f268788a61c` |
| https://beta.nofan.xyz | v5.0.0-beta.2 | `34584272c6ab0da977f45d620f91345b28cef307` |

## Runtime

- Main Web runs 4.7.6; Beta Web and the three Sidekiq consumers run beta.2. Streaming is built from the same beta.2 source.
- Nine production services are healthy. The three Sidekiq processes were registered and all reported queues were empty at verification.
- PostgreSQL, Redis and Elasticsearch containers retained their original IDs. No database migration was executed.
- Both public instance APIs retain 5,000 post characters and polls with at most 12 options / 50 characters per option.
- Database/Redis credentials, B2 media settings, private account-export credentials and the read-only private-export initializer mount were preserved.
- Runtime `SOURCE_TAG` is pinned to the exact source commit, preserving accurate source links and avoiding prerelease tag components being interpreted as a fork revision.

## Images and build provenance

| Component | Local release tag | Image ID |
| --- | --- | --- |
| Main | `nofan-local/mastodon:476-953382948c` | `sha256:38aa2e5ac8555ed105981866fcd217a0a634c10ccc462de860305643b5d79992` |
| Beta / Sidekiq | `nofan-local/mastodon:5b2-34584272c6` | `sha256:8f566e9f64cdbb8dd68e8893a3033449fa26b0ef66ef18936eb56ffb7e13df50` |
| Streaming | `nofan-local/mastodon-streaming:5b2-34584272c6` | `sha256:1e103b50fe52c05ccc0fbb42a80266e0652cd428edd7a856e2ab37634877ecb0` |

GitHub rejected workflow dispatch with HTTP 422, "Actions has been disabled for this repository", despite the API reporting enabled/active settings. GitHub permission settings were not changed. Exact committed Git archives were built on the server with a dedicated builder limited to four CPU cores, 10 GiB memory and two concurrent build steps. The builder is now stopped. These new images are stored locally on the server and were not published to GHCR; the source commits are pushed to GitHub. A replacement host can rebuild from those commits.

## Validation

- Merge-time checks: immutable dependencies, type checking, production builds, 8,422 legacy JavaScript tests and 355 targeted RSpec examples passed.
- Final images booted against an isolated copy of the production schema and its 635 migration IDs. Production account/post rows were not copied.
- Isolated API checks covered both directions of status reading/editing, Markdown, single/multiple 12-option polls, rejection of option 13 and of 51-character options.
- Both final images published 12-option polls through the actual browser composer.
- Twenty-four browser combinations covered native, Bird/X and Tangerine, light/dark and 1440/390-pixel viewports on both versions. Composer visibility and horizontal bounds were checked. Static assets served locally during tunnel tests were verified against SHA-256 manifests taken from the final server images.
- Actual account menus added a second account and switched back on both versions, including the new beta.2 native account menu. Desktop emoji anchor dragging and click suppression passed.
- Authenticated Streaming subscription received an event from the isolated Redis. Isolated worker retry/dead sets were empty.
- Both images passed ordinary B2 media upload/read/delete and private-export signed-download checks. Temporary object versions were removed; no database backup/export record was saved by these probes.
- Public Chromium checks passed login pages, their requested resources and About pages on both sites without page errors or failed HTTP resources. ban.fan reports the new main version. Three public media samples and Streaming health returned 200.
- Post-release runtime logs contained no matched missing-column/table/attribute or missing-method/constant compatibility errors.

Browser coverage used Chromium desktop/mobile viewport emulation; physical devices, Safari and the remaining theme variants were not manually verified. The remaining theme assets were included in the successful builds.

## Shared update notice

The stable runtime's shared update table lists `5.0.0-beta.2` as a non-urgent available upgrade; Beta reports no pending upgrade. The update-check setting and database rows were preserved.

## Operations and rollback

- Server receipts and private configuration backups: `/home/mastodon/shared-rollout/20261124-upstream-release/` (restricted permissions).
- Main old/new immutable assets and old Beta assets were retained for open tabs and rollback. Nginx, media DNS/CDN routing and scheduled backup jobs were preserved.
- To restore this release's previous application images, run `python3 /home/mastodon/shared-rollout/20261124-upstream-release/rollback-release.py` on the server, then verify all nine services and public versions. The script refuses to overwrite configuration changed after this release and performs no database restore.
- Six temporary acceptance containers, their two networks and disposable credential files were removed. The earlier B2 preview stack remains available.

Source code was built from the commits above. This documentation-only follow-up commit is not a new application build.
