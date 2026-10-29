'use strict';
const fs = require('fs'),
  assert = require('assert/strict');
const pw = require(process.env.UI_PLAYWRIGHT_MODULE || 'playwright'),
  kind = process.env.UI_BROWSER_KIND || 'chromium',
  label = process.env.UI_BROWSER_LABEL || 'edge';
(async () => {
  const b = await pw[kind].launch({
      headless: true,
      ...(process.env.UI_BROWSER_PATH
        ? { executablePath: process.env.UI_BROWSER_PATH }
        : {}),
      ...(kind === 'chromium' ? { args: ['--no-proxy-server'] } : {}),
    }),
    c = await b.newContext({
      storageState: 'tmp/preview-auth.json',
      viewport: { width: 390, height: 844 },
    });
  await c.route('**/*', (r) =>
    ['localhost', '127.0.0.1'].includes(new URL(r.request().url()).hostname)
      ? r.continue()
      : r.abort(),
  );
  const p = await c.newPage(),
    errors = [],
    rows = [],
    f = JSON.parse(fs.readFileSync('tmp/compose-private-fixture.json'));
  p.on('pageerror', (e) => errors.push(e.message));
  const accountResponse = await c.request.get(
    'http://localhost:3107/api/v1/accounts/' + f.account_id,
  );
  assert(accountResponse.ok());
  const account = await accountResponse.json();
  let phase = 'normal',
    release = null,
    requests = [];
  await p.route('**/api/v1/accounts/search*', async (route) => {
    requests.push(new URL(route.request().url()).searchParams.get('q'));
    if (phase === 'hold')
      await new Promise((done) => {
        release = done;
      });
    try {
      await route.fulfill({ json: [account] });
    } catch {}
  });
  try {
    for (const skin of [
      'mastodon-ui/default',
      'bird-ui/mastodon-bird-ui-auto',
      'tangerine-ui/tangerine',
    ])
      for (const mode of ['light', 'dark']) {
        await p.goto('http://localhost:3107/settings/preferences/appearance');
        assert(await p.locator('#edit_user').isVisible());
        await p
          .locator('select[name="user[settings_attributes][flavour_and_skin]"]')
          .selectOption(skin);
        await p
          .locator(
            'input[name="user[settings_attributes][web.color_scheme]"][value="' +
              mode +
              '"]',
          )
          .check();
        await Promise.all([
          p.waitForNavigation(),
          p.locator('button[form="edit_user"]').click(),
        ]);
        await p.goto('http://localhost:3107' + f.path);
        await p
          .getByRole('button', { name: /^Reply$|^回复$/ })
          .first()
          .click();
        const t = p.locator('#composer-text');
        await t.waitFor();
        requests = [];
        await t.type('hello');
        await p.waitForTimeout(350);
        assert.equal(
          requests.length,
          0,
          'English reply triggered account search',
        );
        assert.equal(await p.locator('[data-type=account]').count(), 0);
        const draft = await t.inputValue();
        for (const height of [360, 320, 280]) {
          await p.evaluate((height) => {
            Object.defineProperty(visualViewport, 'height', {
              configurable: true,
              get: () => height,
            });
            visualViewport.dispatchEvent(new Event('resize'));
          }, height);
          await p.waitForTimeout(300);
          const box = await t.evaluate((e) => {
            const w = e.closest('._compose_redesign__textareaWrapper'),
              h = document.querySelector('._compose_redesign__calloutWrapper'),
              a = e.getBoundingClientRect(),
              v = w.getBoundingClientRect();
            return {
              top: a.top,
              bottom: a.bottom,
              visibleTop: v.top,
              visibleBottom: v.bottom,
              height: a.height,
              scrollTop: w.scrollTop,
              warningRetained: w.contains(h) && h.textContent.includes('@bob'),
              pageScroll: document.scrollingElement.scrollTop,
            };
          });
          assert(box.warningRetained, 'Privacy reminder lost');
          assert(
            box.top >= box.visibleTop - 1 &&
              box.bottom <= box.visibleBottom + 1,
            'Focused field clipped: ' + JSON.stringify(box),
          );
          assert.equal(await t.inputValue(), draft);
          rows.push({ skin, mode, height, ...box });
        }
        await p.evaluate(() => {
          const w = document.querySelector(
            '._compose_redesign__textareaWrapper',
          );
          w.scrollTop = w.scrollHeight;
        });
        assert(
          await p.locator('._compose_redesign__calloutWrapper').isVisible(),
        );
        await t.fill('');
        await t.type('@bo', { delay: 120 });
        await p.waitForTimeout(500);
        console.log(
          'NORMAL',
          requests,
          await p.locator('[data-type=account]').count(),
        );
        await p
          .locator('[data-type=account]')
          .first()
          .waitFor({ state: 'visible' });
        await p.locator('[data-type=account]').first().click();
        assert(
          (await t.inputValue()).includes('@bob'),
          'Normal account selection failed',
        );
        await t.fill('正文');
        phase = 'hold';
        release = null;
        await t.fill('@bo');
        await p.waitForFunction(() => true);
        for (let n = 0; n < 30 && !release; n++) await p.waitForTimeout(50);
        assert(release, 'Delayed search did not start');
        await t.fill('@bob English body');
        release();
        phase = 'normal';
        await p.waitForTimeout(450);
        assert.equal(
          await p.locator('[data-type=account]').count(),
          0,
          'Dismissed suggestions reappeared',
        );
        assert.equal(await t.inputValue(), '@bob English body');
        console.log(
          'PASS',
          label,
          skin,
          mode,
          '3 keyboard heights, warning, English, normal selection and delayed result',
        );
      }
    assert.deepEqual(errors, []);
    fs.mkdirSync('tmp/compose-interaction-ui', { recursive: true });
    fs.writeFileSync(
      'tmp/compose-interaction-ui/' + label + '-reply.json',
      JSON.stringify({ browser: await b.version(), rows, errors }, null, 2),
    );
    console.log('PASS', label, rows.length, 'mobile private-reply layouts');
  } catch (e) {
    await p.screenshot({
      path: 'tmp/compose-private-' + label + '-failure.png',
    });
    throw e;
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e.stack);
  process.exitCode = 1;
});
