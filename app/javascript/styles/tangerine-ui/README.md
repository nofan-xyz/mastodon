# Tangerine Neue source

- Upstream: https://github.com/mattbirchler/Tangerine-Neue-for-Mastodon
- Release: `3.0.0-beta.1`
- Commit: `c35fcc2e8c156610cea69e30148265076ee92e72`
- License: MIT, preserved in `LICENSE` beside this file.

The five `styles/tangerineui*/tangerineui*.scss` overlays come from this
release's `mastodon/app/javascript/styles/` tree, normalized with the repository's
oxfmt and Stylelint rules. The entrypoints and `skins/tangerine-ui/*/common.scss`
retain nofan's existing theme identifiers and load the shared application first.

Local history-icon and legacy compose-toolbar fixes live in `_nofan-fixes.scss`.
The upstream beta now supplies Mastodon 5.0 design tokens, so these skins no
longer load the temporary `nofan-redesign` palette bridge used by other skins.

For an update, compare against the pinned release, replace all five overlays,
format/lint them, and check desktop/mobile, light/dark, system colour scheme,
high contrast, post/media actions, composer, and account switching. The upstream
installer is not used because it also rewrites theme configuration.
