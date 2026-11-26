# Beta compact footer — 2026-11-26

The navigation footer displayed the complete build hash, producing horizontal overflow in narrow sidebars. Match the stable footer's compact version format: remove build metadata and the redundant fourth `.0` component, retain prerelease information, and expose the full version in the heading's title. Add `min-width: 0`, `max-width: 100%` and heading wrapping. Existing links remain intact.

- Application source: `eb0c534daea25e46f3180dc05124bd70eb1744ee`.
- Type checking, ESLint, Stylelint, formatting and the production asset build passed.
- Browser layout checks on the actual component passed at 160, 180, 240 and 320 pixel container widths.
- Deployed Beta Web at 16:53 Beijing time; all other eight production containers unchanged. No database migration.
- Public Chromium verified the actual new footer on `/about` at 1440 and 1024 pixel viewports: `Mastodon v5.0.0-beta.2`, full build in the title, footer width/scrollWidth both 224px and parent width/scrollWidth both 288px, no page errors.
- The preceding posting-defaults server-template fix is retained in the base image. Only the rebuilt packs, two footer source files and version metadata were added to that image; backend dependencies and storage configuration were preserved.
- Image: `nofan-local/mastodon:5b2-footer-eb0c534dae`, ID `sha256:01fe8b39246f259503d7b10e457175eb025f4803ca0d01ec0a34be22cb9b828e`.
- Preserved 686 additional old hashed assets for open tabs/rollback; API poll limits remain 12 options / 50 characters.

Evidence and restricted configuration backup: `/home/mastodon/shared-rollout/20261126-beta-footer/`. Rollback to the preceding Beta image: `python3 /home/mastodon/shared-rollout/20261126-beta-footer/rollback.py`, provided no later Compose change has occurred. Main remains v4.7.6.

This documentation-only follow-up commit is not a new application image build.
