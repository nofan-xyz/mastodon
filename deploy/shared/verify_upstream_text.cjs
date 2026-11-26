'use strict';
// Internal rehearsal HTTP only. This helper never follows a production redirect.
const { api, assert, mark } = require('./verify_rehearsal.cjs');
(async () => {
  const fixtures = [
    ['text/plain', '共库回归 https://example.com/路径 #测试'],
    ['text/markdown', '**共库回归** [链接](https://example.com/path)'],
    ['text/html', '<p><strong>共库回归</strong> <a href="https://example.com/path">链接</a><script>alert(1)</script></p>'],
  ];
  for (const node of ['old', 'next']) {
    for (const [content_type, status] of fixtures) {
      const created = await api(node, '/api/v1/statuses', { method: 'POST', user: 'a', data: { status, content_type, visibility: 'public' } });
      try {
        const copy = await api(node === 'old' ? 'next' : 'old', '/api/v1/statuses/' + created.id, { user: 'b' });
        assert(copy.content.includes('共库回归'), 'Cross-version text missing');
        assert(copy.content.includes('example.com'), 'Cross-version link missing');
        assert(!/<script[\s>]/i.test(copy.content), 'Executable markup escaped sanitization');
        if (content_type !== 'text/plain') assert(copy.content.includes('<strong>共库回归</strong>'), 'Rich-text formatting missing');
        mark(node + ' ' + content_type + ' remains readable and sanitized across Webs');
      } finally {
        await api(node, '/api/v1/statuses/' + created.id, { method: 'DELETE', user: 'a' });
      }
    }
  }
})().catch(error => { console.error('FAIL ' + error.message); process.exitCode = 1; });
