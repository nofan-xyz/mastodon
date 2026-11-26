import {
  searchNeedsKeywords,
  clearSearchFilters,
  getSearchFilters,
  isSearchDateRangeValid,
  parseSearchQuery,
  removeSearchQueryToken,
  serializeSearchQuery,
  setSearchAuthorAccount,
  setSearchAuthorFilter,
  setSearchContentFilter,
  setSearchDateRange,
  setSearchScopeFilter,
  setSearchTimeFilter,
  toggleSearchContentFilter,
} from './search_query';

const now = new Date(2026, 7, 19, 12, 0, 0);

describe('search query filters', () => {
  test('keeps quoted phrases and unknown clauses intact', () => {
    const query = '  "hello world"   from:@alice@example.com foo:bar  ';
    const tokens = parseSearchQuery(query);

    expect(serializeSearchQuery(tokens)).toBe(
      '"hello world" from:@alice@example.com foo:bar',
    );
    expect(tokens[1]).toMatchObject({
      prefix: 'from',
      value: '@alice@example.com',
    });
  });

  test('recognizes preset, scope, author, and content filters', () => {
    expect(
      getSearchFilters(
        '今日回忆 after:2026-08-12 in:library from:me has:media',
        now,
      ),
    ).toMatchObject({
      time: 'week',
      scope: 'library',
      author: 'me',
      content: 'media',
      hasTimeFilter: true,
      hasScopeFilter: true,
      hasAuthorFilter: true,
      hasActiveFilters: true,
    });
  });

  test('treats manually entered account filters as a custom author', () => {
    expect(getSearchFilters('摄影 from:@alice@example.com')).toMatchObject({
      author: 'custom',
      authorAccount: 'alice@example.com',
      hasAuthorFilter: true,
    });
  });

  test('does not expose an account for unsupported author syntax', () => {
    expect(getSearchFilters('摄影 -from:@alice@example.com')).toMatchObject({
      author: 'custom',
      authorAccount: undefined,
      hasAuthorFilter: true,
    });
    expect(
      getSearchFilters('摄影 from:@alice@example.com from:@bob@example.com'),
    ).toMatchObject({
      author: 'custom',
      authorAccount: undefined,
      hasAuthorFilter: true,
    });
  });

  test('treats arbitrary dates and multiple content clauses as custom', () => {
    const filters = getSearchFilters(
      'before:2024-01-01 has:media has:poll',
      now,
    );

    expect(filters.time).toBe('custom');
    expect(filters.content).toBe('custom');
    expect(filters.contentClauses.map(({ value }) => value)).toEqual([
      'media',
      'poll',
    ]);
  });

  test('parses an inclusive UI date range from exclusive search boundaries', () => {
    expect(
      getSearchFilters(
        '摄影 after:2026-07-31 before:2026-09-01 has:media',
        now,
      ),
    ).toMatchObject({
      time: 'custom',
      dateRange: { start: '2026-08-01', end: '2026-08-31' },
    });
  });

  test('does not map unsupported date syntax into the date range form', () => {
    expect(getSearchFilters('摄影 during:2026-08-01', now)).toMatchObject({
      time: 'custom',
      dateRange: undefined,
    });
  });

  test('replaces date filters without changing other syntax', () => {
    expect(
      setSearchTimeFilter(
        '"hello world" before:2020-01-01 language:zh',
        'month',
        now,
      ),
    ).toBe('"hello world" language:zh after:2026-07-20');
  });

  test('sets an inclusive date range without changing other syntax', () => {
    expect(
      setSearchDateRange('摄影 before:2020-01-01 language:zh has:media', {
        start: '2026-08-01',
        end: '2026-08-31',
      }),
    ).toBe('摄影 language:zh has:media after:2026-07-31 before:2026-09-01');
  });

  test('supports one-sided date ranges', () => {
    expect(setSearchDateRange('摄影', { start: '2026-08-01' })).toBe(
      '摄影 after:2026-07-31',
    );
    expect(setSearchDateRange('摄影', { end: '2026-08-31' })).toBe(
      '摄影 before:2026-09-01',
    );
  });

  test('rejects empty, reversed, and invalid date ranges', () => {
    expect(isSearchDateRangeValid({})).toBe(false);
    expect(
      isSearchDateRangeValid({
        start: '2026-09-01',
        end: '2026-08-01',
      }),
    ).toBe(false);
    expect(isSearchDateRangeValid({ start: '2026-02-30' })).toBe(false);
    expect(() => setSearchDateRange('摄影', {})).toThrow(RangeError);
  });

  test('replaces all scope flags because only the last one is effective', () => {
    expect(setSearchScopeFilter('hello in:public -in:library', 'library')).toBe(
      'hello in:library',
    );
  });

  test('adds the current author without changing scope or other syntax', () => {
    expect(setSearchAuthorFilter('摄影 in:public has:media', 'me')).toBe(
      '摄影 in:public has:media from:me',
    );
  });

  test('replaces a manually entered author and can remove the author filter', () => {
    const fromMe = setSearchAuthorFilter(
      '摄影 from:@alice@example.com in:public',
      'me',
    );

    expect(fromMe).toBe('摄影 in:public from:me');
    expect(setSearchAuthorFilter(fromMe, 'all')).toBe('摄影 in:public');
  });

  test('sets an exact account author without changing other syntax', () => {
    expect(
      setSearchAuthorAccount(
        '摄影 from:me in:public has:media',
        '@alice@example.com',
      ),
    ).toBe('摄影 in:public has:media from:@alice@example.com');
  });

  test('rejects an empty or malformed account author', () => {
    expect(() => setSearchAuthorAccount('摄影', '   ')).toThrow(RangeError);
    expect(() => setSearchAuthorAccount('摄影', 'alice example.com')).toThrow(
      RangeError,
    );
  });

  test('only replaces content clauses managed by the quick filter', () => {
    expect(
      setSearchContentFilter(
        'hello has:image has:media -has:poll is:sensitive',
        'no-replies',
      ),
    ).toBe('hello has:image -has:poll is:sensitive -is:reply');
  });

  test('toggles multiple content filters independently', () => {
    const withMedia = toggleSearchContentFilter('摄影 in:public', 'media');
    const withoutReplies = toggleSearchContentFilter(withMedia, 'no-replies');

    expect(withoutReplies).toBe('摄影 in:public has:media -is:reply');
    expect(toggleSearchContentFilter(withoutReplies, 'media')).toBe(
      '摄影 in:public -is:reply',
    );
  });

  test('removes duplicate clauses for only the toggled content filter', () => {
    expect(
      toggleSearchContentFilter(
        'hello has:media has:poll has:media has:image',
        'media',
      ),
    ).toBe('hello has:poll has:image');
  });

  test('removes one content chip without removing repeated clauses', () => {
    expect(removeSearchQueryToken('hello has:media has:poll', 1)).toBe(
      'hello has:poll',
    );
  });

  test('clears only filters represented by the quick filter bar', () => {
    expect(
      clearSearchFilters(
        'hello from:me after:2026-08-12 in:library has:media has:image',
      ),
    ).toBe('hello has:image');
  });

  test('preserves keywords, phrases, and advanced syntax when recovering from filtered results', () => {
    expect(
      clearSearchFilters(
        '摄影 "夜间 街景" language:zh after:2026-08-12 before:2026-08-20 in:public from:@searchmock has:poll -is:reply',
      ),
    ).toBe('摄影 "夜间 街景" language:zh');
  });
});

describe('5.0 status search requirements', () => {
  test.each(['has:media', 'after:2026-01-01 -spam', 'from:someone has:poll'])(
    'requires positive text for %s',
    (query) => {
      expect(searchNeedsKeywords(query, 'alice', 'example.com')).toBe(true);
    },
  );
  test.each([
    '中文 has:media',
    '"中文 词组" has:media',
    'in:library has:media',
    'from:me has:poll',
    'from:@alice after:2026-01-01',
    'from:Alice@example.com has:media',
    '',
  ])('accepts %s', (query) => {
    expect(searchNeedsKeywords(query, 'alice', 'example.com')).toBe(false);
  });
});
