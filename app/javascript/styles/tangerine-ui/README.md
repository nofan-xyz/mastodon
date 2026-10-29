# Tangerine Neue source

- Upstream: https://github.com/mattbirchler/Tangerine-Neue-for-Mastodon
- Release: `3.0.0-beta.3`
- Commit: `7f8b3d72b2b102aee4f6b86e9694965b467e9246`
- License: MIT, preserved in `LICENSE` beside this file.
- Font: bundled Fredoka WOFF2 files in `../tangerineui-fonts/`, with their SIL Open Font License in `OFL.txt`.

The five `styles/tangerineui*/tangerineui*.scss` overlays come from this
release's `mastodon/app/javascript/styles/` tree, normalized with the repository's
oxfmt and Stylelint rules. The entrypoints and `skins/tangerine-ui/*/common.scss`
retain nofan's existing theme identifiers and load the shared application first.

Normalization removes the earlier duplicate `30%` rotation keyframe (the later
declaration already wins in CSS), and exempts formatted upstream CSS math from
the SCSS newline-after-operator rule. No theme behavior is changed by these fixes.

Local history-icon and legacy compose-toolbar fixes live in `_nofan-fixes.scss`.
The upstream beta now supplies Mastodon 5.0 design tokens, so these skins no
longer load the temporary `nofan-redesign` palette bridge used by other skins.

For an update, compare against the pinned release, replace all five overlays,
format/lint them, and check desktop/mobile, light/dark, system colour scheme,
high contrast, post/media actions, composer, and account switching. The upstream
installer is not used because it also rewrites theme configuration.
