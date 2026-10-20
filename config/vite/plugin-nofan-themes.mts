/* This plugin registers glitch-style flavour and skin stylesheets as
 * build entrypoints: skins from app/javascript/skins/<flavour>/<skin>,
 * plus one entry per script for flavours with their own entrypoints
 * directory (pack_directory pointing outside app/javascript/entrypoints).
 */

import fs from 'node:fs/promises';
import path from 'node:path';

import type { Plugin } from 'vite';

const SKIN_EXTENSIONS = ['scss', 'css'] as const;
const SKIN_ENTRY_NAMES = ['common', 'index', 'application'] as const;

export function NofanThemes(): Plugin {
  const entrypoints: Record<string, string> = {};

  return {
    name: 'nofan-themes',
    async config(userConfig) {
      const existingInputs = userConfig.build?.rolldownOptions?.input;

      if (typeof existingInputs === 'string') {
        entrypoints[path.basename(existingInputs)] = existingInputs;
      } else if (Array.isArray(existingInputs)) {
        for (const input of existingInputs) {
          if (typeof input === 'string') {
            entrypoints[path.basename(input)] = input;
          }
        }
      } else if (typeof existingInputs === 'object') {
        Object.assign(entrypoints, existingInputs);
      }

      if (!userConfig.root) {
        throw new Error('Unknown project directory');
      }
      const jsRoot = userConfig.root;

      await loadSkinEntrypoints(jsRoot, entrypoints);
      await loadFlavourEntrypoints(jsRoot, entrypoints);

      return {
        build: {
          rolldownOptions: {
            input: entrypoints,
          },
        },
      };
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/packs-dev/skins/')) {
          next();
          return;
        }

        // Resolve lazily on each request so skins and flavours added
        // while the dev server is running work without a restart. The
        // config() scan remains the source of build-time entrypoints.
        const name = req.url.slice('/packs-dev/'.length).split(/[.?]/)[0] ?? '';
        resolveSkinEntrypoint(server.config.root, name)
          .then((entry) => {
            if (entry) {
              req.url = `/packs-dev/${entry}`;
            }
            next();
          })
          .catch(next);
      });
    },
    handleHotUpdate({ modules, server }) {
      if (modules.length === 0 || !server.config.root) {
        return;
      }

      // The theme name can be deduced solely from the path relative to the
      // skins root: <flavour>/<skin>(/common).<ext>
      const baseRoot = path.join(server.config.root, 'skins');
      const themeNames = new Set<string>();

      const addIfMatches = (file: string | null) => {
        if (!file) {
          return false;
        }
        const segments = path.relative(baseRoot, file).split(path.sep);
        if (
          segments.length >= 2 &&
          segments.length <= 3 &&
          segments[0] !== '..' &&
          segments[1]
        ) {
          const themeName = `skins/${segments[0]}/${path.basename(segments[1], path.extname(segments[1]))}`;
          themeNames.add(themeName);
          return true;
        }
        return false;
      };

      for (const module of modules) {
        if (!addIfMatches(module.file)) {
          for (const importer of module.importers) {
            addIfMatches(importer.file);
          }
        }
      }

      if (themeNames.size > 0) {
        server.ws.send({
          type: 'update',
          updates: Array.from(themeNames).map((themeName) => ({
            type: 'css-update',
            path: themeName,
            acceptedPath: themeName,
            timestamp: Date.now(),
          })),
        });
      }
    },
  };
}

async function loadSkinEntrypoints(
  jsRoot: string,
  entrypoints: Record<string, string>,
) {
  const skinsRoot = path.join(jsRoot, 'skins');
  let flavourNames: string[];
  try {
    flavourNames = await readdirIfDirectory(skinsRoot);
  } catch {
    return; // No skins directory yet.
  }

  for (const flavour of flavourNames) {
    const flavourRoot = path.join(skinsRoot, flavour);
    for (const name of await readdirIfDirectory(flavourRoot)) {
      const location = path.join(flavourRoot, name);

      if ((await fs.stat(location)).isDirectory()) {
        const entry = await findSkinEntry(location);
        if (entry) {
          entrypoints[`skins/${flavour}/${name}`] = entry;
        }
      } else if (SKIN_EXTENSIONS.some((ext) => name.endsWith(`.${ext}`))) {
        entrypoints[`skins/${flavour}/${stripExtension(name)}`] = location;
      }
    }
  }
}

/** Flavours live one level below the skins root; anything else is ignored. */
async function readdirIfDirectory(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

/**
 * Flavours with their own entrypoints directory (pack_directory pointing
 * outside app/javascript/entrypoints) get one build entry per script,
 * named after its root-relative path so manifest lookups from
 * flavoured_vite_typescript_tag resolve.
 */
async function loadFlavourEntrypoints(
  jsRoot: string,
  entrypoints: Record<string, string>,
) {
  const flavoursRoot = path.join(jsRoot, 'flavours');
  const scriptTest = /\.[jt]sx?$/;

  for (const flavour of await readdirIfDirectory(flavoursRoot)) {
    const packDir = path.join(flavoursRoot, flavour, 'entrypoints');
    let files: string[];
    try {
      files = (await fs.readdir(packDir)).filter((name) =>
        scriptTest.test(name),
      );
    } catch {
      continue; // Flavour without its own entrypoints (shared pack).
    }

    for (const name of files) {
      const relative = path
        .join('flavours', flavour, 'entrypoints', name.replace(scriptTest, ''))
        .replaceAll(path.sep, '/');
      entrypoints[relative] = path.join(packDir, name);
    }
  }
}

async function findSkinEntry(dir: string): Promise<string | undefined> {
  for (const base of SKIN_ENTRY_NAMES) {
    for (const ext of SKIN_EXTENSIONS) {
      const candidate = path.join(dir, `${base}.${ext}`);
      try {
        await fs.access(candidate);
        return candidate;
      } catch {
        // Try the next candidate.
      }
    }
  }
  return undefined;
}

function stripExtension(filename: string): string {
  return filename.replace(/\.(?:scss|css)$/i, '');
}

/**
 * Locates the source file backing a `skins/<flavour>/<skin>` URL: either
 * a directory skin (common/index/application entry) or a bare stylesheet.
 */
async function resolveSkinEntrypoint(
  jsRoot: string,
  name: string,
): Promise<string | undefined> {
  const segments = name.split('/').filter(Boolean);
  if (segments.length !== 3 || segments.some((segment) => segment === '..')) {
    return undefined;
  }
  const [, flavour, skin] = segments as [string, string, string];
  const base = path.join(jsRoot, 'skins', flavour, skin);

  const candidates = [
    ...SKIN_ENTRY_NAMES.flatMap((entry) => [
      `${base}/${entry}.scss`,
      `${base}/${entry}.css`,
    ]),
    `${base}.scss`,
    `${base}.css`,
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(path.resolve(candidate));
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }
  return undefined;
}
