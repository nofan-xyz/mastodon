'use strict';
const fs = require('node:fs'),
  http = require('node:http'),
  assert = require('node:assert/strict');
const users = JSON.parse(fs.readFileSync('/results/users.json'));
const nodes = {
  old: ['web47', 'nofan.xyz'],
  next: ['web50', 'beta.nofan.xyz'],
};
function api(node, path, user, method = 'GET', data) {
  const [hostname, host] = nodes[node],
    body = data === undefined ? undefined : JSON.stringify(data);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname,
        port: 3000,
        path,
        method,
        headers: {
          Host: host,
          'X-Forwarded-Proto': 'https',
          Authorization: 'Bearer ' + users[user].token,
          ...(body
            ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body),
              }
            : {}),
        },
      },
      (res) => {
        let text = '';
        res.on('data', (c) => (text += c));
        res.on('end', () => {
          try {
            assert(
              res.statusCode >= 200 && res.statusCode < 300,
              'HTTP ' + res.statusCode + ' ' + node + ' ' + path,
            );
            resolve(JSON.parse(text));
          } catch (e) {
            reject(e);
          }
        });
      },
    );
    req.setTimeout(20000, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}
(async () => {
  const a = await api('old', '/api/v1/accounts/verify_credentials', 'a'),
    b = await api('next', '/api/v1/accounts/verify_credentials', 'b');
  assert.equal(a.id, users.a.account_id);
  assert.equal(b.id, users.b.account_id);
  const rel = await api(
    'old',
    '/api/v1/accounts/relationships?id[]=' + b.id,
    'a',
  );
  let pending = false;
  try {
    await api('old', '/api/v1/accounts/' + b.id + '/unfollow', 'a', 'POST');
    await api('next', '/api/v1/accounts/update_credentials', 'b', 'PATCH', {
      locked: true,
    });
    const requested = await api(
      'old',
      '/api/v1/accounts/' + b.id + '/follow',
      'a',
      'POST',
    );
    pending = true;
    assert(requested.requested);
    for (const node of ['old', 'next']) {
      const list = await api(node, '/api/v1/follow_requests', 'b');
      assert(list.some((x) => x.id === a.id));
      const notifs = await api(
        node,
        '/api/v1/notifications?types[]=follow_request',
        'b',
      );
      assert(
        notifs.some(
          (x) => x.type === 'follow_request' && x.account.id === a.id,
        ),
      );
    }
    await api(
      'next',
      '/api/v1/follow_requests/' + a.id + '/authorize',
      'b',
      'POST',
    );
    pending = false;
    const after = await api(
      'old',
      '/api/v1/accounts/relationships?id[]=' + b.id,
      'a',
    );
    assert(after[0].following);
    console.log(
      'PASS follow request created in 4.7.4, pending list/notification readable in both Webs, approved in alpha.2',
    );
  } finally {
    if (pending)
      await api(
        'next',
        '/api/v1/follow_requests/' + a.id + '/reject',
        'b',
        'POST',
      );
    await api('next', '/api/v1/accounts/update_credentials', 'b', 'PATCH', {
      locked: b.locked,
    });
    if (!rel[0].following)
      await api('old', '/api/v1/accounts/' + b.id + '/unfollow', 'a', 'POST');
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
