'use strict';
// Exercise an authenticated local rehearsal only; never aim this at a public site.
const fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const { chromium } = require(process.env.UI_PLAYWRIGHT_MODULE || 'playwright');
const target = new URL(process.env.UI_BASE_URL || 'http://localhost:3105');
assert(
  ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) &&
    !target.username &&
    !target.password,
  'Only a local rehearsal URL is allowed',
);
const base = target.origin;
const resultRoot = process.env.UI_RESULT_DIR || 'tmp/composer-ui';
fs.mkdirSync(resultRoot, { recursive: true });
const label = (process.env.UI_BROWSER_LABEL || 'current').replace(
  /[^\w-]/g,
  '_',
);
(async () => {
  const rows = [];
  for (const [engine, executablePath] of [
    [label, process.env.UI_BROWSER_PATH || chromium.executablePath()],
  ]) {
    const b = await chromium.launch({
      headless: true,
      executablePath,
      args: ['--no-sandbox', '--no-proxy-server'],
    });
    const c = await b.newContext({
      storageState: process.env.UI_AUTH_STATE || 'tmp/preview-auth.json',
      viewport: { width: 1440, height: 900 },
    });
    await c.route('**/*', (route) => {
      const host = new URL(route.request().url()).hostname;
      return ['localhost', '127.0.0.1', '[::1]'].includes(host)
        ? route.continue()
        : route.abort();
    });
    const p = await c.newPage();
    const errors = [];
    p.on('pageerror', (e) => errors.push(e.message));
    try {
      for (const skin of [
        'mastodon-ui/default',
        'bird-ui/mastodon-bird-ui-auto',
        'tangerine-ui/tangerine',
      ])
        for (const mode of ['light', 'dark'])
          for (const width of [1440, 390]) {
            await p.setViewportSize({ width, height: 900 });
            await p.goto(base + '/settings/preferences/appearance', {
              waitUntil: 'domcontentloaded',
            });
            assert(
              await p.locator('#edit_user').isVisible(),
              'Local authentication expired',
            );
            await p
              .locator(
                'select[name="user[settings_attributes][flavour_and_skin]"]',
              )
              .selectOption(skin);
            await p
              .locator(
                'input[name="user[settings_attributes][web.color_scheme]"][value="' +
                  mode +
                  '"]',
              )
              .check();
            await Promise.all([
              p.waitForNavigation({ waitUntil: 'domcontentloaded' }),
              p.locator('button[form="edit_user"]').click(),
            ]);
            await p.goto(base + '/home', { waitUntil: 'domcontentloaded' });
            await p
              .getByRole('button', { name: /^(New Post|新嘟文)$/ })
              .first()
              .click();
            const form = p.locator('form[role=dialog]');
            await p.locator('#composer-text').fill('浮层兼容性检查草稿');
            await p.waitForTimeout(1200);
            const labels = [
              /^(ZH-CN|EN)/,
              /Change advanced formatting|高级格式/,
              /^Settings$|^设置$/,
              /Insert emoji|插入表情符号/,
            ];
            const checks = [];
            for (const name of labels) {
              const button = form.getByRole('button', { name });
              const before = await form.boundingBox();
              const beforeScroll = await form.evaluate((e) => ({
                scroll: e.scrollTop,
                header: e.querySelector('header').getBoundingClientRect().top,
              }));
              await button.click();
              await p.waitForTimeout(450);
              const nativeSheet = p.locator('dialog[open]');
              const sheet = (await nativeSheet.count()) > 0;
              const overlay = sheet
                ? nativeSheet
                : p
                    .locator('[data-popover-placement]:not([class*="tooltip"])')
                    .last();
              await overlay.waitFor({ state: 'visible' });
              const geo = await overlay.evaluate((e) => {
                const r = e.getBoundingClientRect();
                const hit = document.elementFromPoint(
                  Math.max(1, r.x + r.width / 2),
                  Math.max(1, r.y + Math.min(40, r.height / 2)),
                );
                return {
                  x: r.x,
                  y: r.y,
                  w: r.width,
                  h: r.height,
                  vw: innerWidth,
                  vh: innerHeight,
                  hit: !!hit && e.contains(hit),
                  hitName: hit?.tagName,
                  hitClass: hit?.className,
                };
              });
              assert(
                geo.x >= -2 &&
                  geo.y >= -2 &&
                  geo.x + geo.w <= geo.vw + 2 &&
                  geo.y + geo.h <= geo.vh + 2,
                'Overlay outside viewport ' + JSON.stringify(geo),
              );
              assert(
                geo.hit,
                'Overlay hidden ' +
                  JSON.stringify({
                    engine,
                    skin,
                    mode,
                    width,
                    name: name.source,
                    geo,
                  }),
              );
              if (name.source.includes('emoji')) {
                await p
                  .locator('.emoji-mart-scroll')
                  .waitFor({ state: 'visible' });
                assert(
                  (await p
                    .locator('.emoji-mart-scroll')
                    .evaluate((e) => e.clientHeight)) > 120,
                  'Emoji rows clipped',
                );
                assert(
                  await p.locator('.emoji-mart-scroll').evaluate((e) => {
                    const r = e.getBoundingClientRect();
                    const hit = document.elementFromPoint(
                      r.x + r.width / 2,
                      r.y + r.height / 2,
                    );
                    return !!hit && e.contains(hit);
                  }),
                  'Emoji rows cannot receive pointer events',
                );
              }
              if (width >= 760) {
                const afterScroll = await form.evaluate((e) => ({
                  scroll: e.scrollTop,
                  header: e.querySelector('header').getBoundingClientRect().top,
                }));
                assert.deepEqual(
                  afterScroll,
                  beforeScroll,
                  'Menu scrolled composer contents',
                );
                const after = await form.boundingBox();
                assert(
                  Math.abs(before.y - after.y) < 2 &&
                    Math.abs(before.height - after.height) < 2,
                  'Menu moved composer ' +
                    JSON.stringify({
                      engine,
                      skin,
                      mode,
                      width,
                      name: name.source,
                      before,
                      after,
                    }),
                );
              }
              await p.mouse.click(5, 5);
              await p.waitForTimeout(150);
              assert.equal(
                await p.locator('dialog[open]').count(),
                0,
                'Bottom sheet did not close',
              );
              checks.push(name.source);
            }
            const publish = form.getByRole('button', {
              name: /^(Publish|发布)$/,
            });
            await publish.hover();
            await p.waitForTimeout(250);
            const colors = await publish.evaluate((e) => ({
              bg: getComputedStyle(e).backgroundColor,
              fg: getComputedStyle(e).color,
            }));
            assert(
              colors.bg !== 'rgba(0, 0, 0, 0)' && colors.bg !== colors.fg,
              'Publish button lost contrast',
            );
            await p.evaluate(() => {
              const e = document.createElement('button');
              e.id = 'legacy-probe';
              e.className = 'button';
              e.textContent = 'Legacy Publish';
              Object.assign(e.style, {
                position: 'fixed',
                top: '300px',
                left: '100px',
                zIndex: '99999',
              });
              document.body.append(e);
            });
            await p.locator('#legacy-probe').hover();
            await p.waitForTimeout(250);
            const legacy = await p
              .locator('#legacy-probe')
              .evaluate((e) => ({
                bg: getComputedStyle(e).backgroundColor,
                fg: getComputedStyle(e).color,
              }));
            assert(
              legacy.bg !== 'rgba(0, 0, 0, 0)' && legacy.bg !== legacy.fg,
              'Confirmation button lost contrast',
            );
            await p.locator('#legacy-probe').evaluate((e) => e.remove());
            rows.push({ engine, skin, mode, width, checks, colors, legacy });
            console.log('PASS', engine, skin, mode, width);
          }
      assert.deepEqual(errors, [], 'JavaScript errors');
    } catch (e) {
      await p.screenshot({
        path: path.join(resultRoot, label + '-failure.png'),
      });
      throw e;
    } finally {
      await b.close();
    }
  }
  fs.writeFileSync(
    path.join(resultRoot, label + '.json'),
    JSON.stringify(rows, null, 2),
  );
  console.log('PASS 12 composer/menu/emoji/hover cases');
})().catch((e) => {
  console.error(e.stack);
  process.exit(1);
});
