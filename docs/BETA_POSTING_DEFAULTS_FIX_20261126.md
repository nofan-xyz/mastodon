# Beta posting defaults fix — 2026-11-26

The beta.2 merge retained `default_spoiler_field` in the posting-defaults template after upstream removed that setting from UserSettings. Authenticated GET requests therefore returned 500 with `undefined method 'default_spoiler_field'`.

Removed only the obsolete input. Default content type and the format-selector preference remain available. Added request coverage for rendering the page and saving/reloading Markdown, selector visibility and sensitivity preferences.

- Source: `fc445d2215a26bfa9f591bc31ab0694abbc75740`.
- Four request/system examples passed; Ruby and Haml lint passed.
- Built a minimal derived image from the previously deployed exact Beta image; only the server template and source metadata changed. Frontend resources and dependencies were retained.
- Image: `nofan-local/mastodon:5b2-posting-fc445d2215`, ID `sha256:9406356fbd306990b03aa9405bef9160644b10760527a415d24d354cb2a75e12`.
- Final image passed an authenticated GET → save → redirected GET flow using disposable accounts in an isolated database containing only the live schema. Test containers, network and temporary credentials were removed.
- Deployed at 16:43 Beijing time. Only `web-beta` was recreated; the other eight production containers were unchanged. Nine services healthy, no database migration.
- Live template rendering passed in English and Simplified Chinese using an existing account read-only; no user preferences were changed. Public version includes the fix commit, and unauthenticated access to the settings URL redirects to login.
- Public poll limits remain 12 options and 50 characters per option.

Server evidence and restricted configuration backups: `/home/mastodon/shared-rollout/20261126-beta-posting-defaults/`.

Rollback, provided no later Compose change has occurred: `python3 /home/mastodon/shared-rollout/20261126-beta-posting-defaults/rollback.py`. This restores only the previous Beta image and checks health; no database restore is performed.

This documentation-only commit does not change the deployed application image.
