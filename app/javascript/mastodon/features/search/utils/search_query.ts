export type SearchTimeFilter = 'all' | 'week' | 'month' | 'year' | 'custom';

export type SearchScopeFilter = 'all' | 'library' | 'public' | 'custom';

export type SearchAuthorFilter = 'all' | 'me' | 'custom';

export type SearchContentFilter =
  | 'all'
  | 'media'
  | 'poll'
  | 'link'
  | 'no-replies'
  | 'custom';

type SearchQueryOperator = '' | '+' | '-';

export interface SearchQueryToken {
  raw: string;
  operator: SearchQueryOperator;
  prefix?: string;
  value?: string;
}

export interface SearchContentClause {
  tokenIndex: number;
  value: Exclude<SearchContentFilter, 'all' | 'custom'>;
}

export interface SearchDateRange {
  start?: string;
  end?: string;
}

export interface SearchFilters {
  time: SearchTimeFilter;
  dateRange?: SearchDateRange;
  scope: SearchScopeFilter;
  author: SearchAuthorFilter;
  authorAccount?: string;
  content: SearchContentFilter;
  hasTimeFilter: boolean;
  hasScopeFilter: boolean;
  hasAuthorFilter: boolean;
  contentClauses: SearchContentClause[];
  hasActiveFilters: boolean;
}

const DATE_PREFIXES = new Set(['after', 'before', 'during']);
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SCOPE_VALUES = new Set(['all', 'library', 'public']);
const CONTENT_VALUES = new Set(['media', 'poll', 'link']);

const tokenizeSearchQuery = (query: string) => {
  const tokens: string[] = [];
  let current = '';
  let insideQuote = false;

  for (const character of query.trim()) {
    if (/\s/.test(character) && !insideQuote) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += character;

      if (character === '"') {
        insideQuote = !insideQuote;
      }
    }
  }

  if (current.length > 0) {
    tokens.push(current);
  }

  return tokens;
};

const parseSearchQueryToken = (raw: string): SearchQueryToken => {
  let operator: SearchQueryOperator = '';
  let body = raw;

  if (body.startsWith('+') || body.startsWith('-')) {
    operator = body[0] as SearchQueryOperator;
    body = body.slice(1);
  }

  const colonIndex = body.indexOf(':');

  if (colonIndex <= 0) {
    return { raw, operator };
  }

  const prefix = body.slice(0, colonIndex).toLowerCase();
  const rawValue = body.slice(colonIndex + 1);
  const value =
    rawValue.length >= 2 && rawValue.startsWith('"') && rawValue.endsWith('"')
      ? rawValue.slice(1, -1)
      : rawValue;

  return { raw, operator, prefix, value };
};

export const parseSearchQuery = (query: string): SearchQueryToken[] =>
  tokenizeSearchQuery(query).map(parseSearchQueryToken);

export const serializeSearchQuery = (tokens: SearchQueryToken[]) =>
  tokens.map(({ raw }) => raw).join(' ');

const formatLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const dateBefore = (now: Date, days: number) => {
  const date = new Date(now);
  date.setDate(date.getDate() - days);
  return formatLocalDate(date);
};

const shiftISODate = (value: string, days: number) => {
  if (!ISO_DATE_PATTERN.test(value)) {
    return undefined;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year ?? 0, (month ?? 1) - 1, day, 12);

  if (formatLocalDate(date) !== value) {
    return undefined;
  }

  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
};

const dateForTimeFilter = (
  filter: Exclude<SearchTimeFilter, 'all' | 'custom'>,
  now: Date,
) => {
  switch (filter) {
    case 'week':
      return dateBefore(now, 7);
    case 'month':
      return dateBefore(now, 30);
    case 'year':
      return dateBefore(now, 365);
  }
};

const isDateClause = ({ prefix }: SearchQueryToken) =>
  Boolean(prefix && DATE_PREFIXES.has(prefix));

const dateRangeForClauses = (
  clauses: SearchQueryToken[],
): SearchDateRange | undefined => {
  if (
    clauses.some(
      ({ operator, prefix, value }) =>
        operator === '-' ||
        (prefix !== 'after' && prefix !== 'before') ||
        !value ||
        !shiftISODate(value, 0),
    )
  ) {
    return undefined;
  }

  const afterClauses = clauses.filter(({ prefix }) => prefix === 'after');
  const beforeClauses = clauses.filter(({ prefix }) => prefix === 'before');

  if (afterClauses.length > 1 || beforeClauses.length > 1) {
    return undefined;
  }

  // Elasticsearch rounds a date-only `gt` value up to the end of that day.
  // Therefore `after:2026-08-01` starts on August 2. Convert that exclusive
  // boundary back to the first date shown by the inclusive UI range.
  const start = afterClauses[0]?.value
    ? shiftISODate(afterClauses[0].value, 1)
    : undefined;
  const end = beforeClauses[0]?.value
    ? shiftISODate(beforeClauses[0].value, -1)
    : undefined;

  return start || end ? { start, end } : undefined;
};

const isScopeClause = ({ prefix }: SearchQueryToken) => prefix === 'in';

const isAuthorClause = ({ prefix }: SearchQueryToken) => prefix === 'from';

const contentFilterForToken = (
  token: SearchQueryToken,
): SearchContentClause['value'] | undefined => {
  const value = token.value?.toLowerCase();

  if (
    token.operator !== '-' &&
    token.prefix === 'has' &&
    value &&
    CONTENT_VALUES.has(value)
  ) {
    return value as SearchContentClause['value'];
  }

  if (token.operator === '-' && token.prefix === 'is' && value === 'reply') {
    return 'no-replies';
  }

  return undefined;
};

const isManagedContentClause = (token: SearchQueryToken) =>
  contentFilterForToken(token) !== undefined;

export const getSearchFilters = (
  query: string,
  now = new Date(),
): SearchFilters => {
  const tokens = parseSearchQuery(query);
  const dateClauses = tokens.filter(isDateClause);
  const scopeClauses = tokens.filter(isScopeClause);
  const authorClauses = tokens.filter(isAuthorClause);
  const contentClauses = tokens.flatMap((token, tokenIndex) => {
    const value = contentFilterForToken(token);

    return value ? [{ tokenIndex, value }] : [];
  });
  const dateRange = dateRangeForClauses(dateClauses);

  let time: SearchTimeFilter = 'all';

  if (dateClauses.length === 1) {
    const [dateClause] = dateClauses;

    if (dateClause?.prefix === 'after' && dateClause.operator !== '-') {
      const matchingPreset = (['week', 'month', 'year'] as const).find(
        (preset) => dateClause.value === dateForTimeFilter(preset, now),
      );

      time = matchingPreset ?? 'custom';
    } else {
      time = 'custom';
    }
  } else if (dateClauses.length > 1) {
    time = 'custom';
  }

  let scope: SearchScopeFilter = 'all';
  const lastScopeClause = scopeClauses.at(-1);
  const scopeValue = lastScopeClause?.value?.toLowerCase();

  if (scopeValue) {
    scope = SCOPE_VALUES.has(scopeValue)
      ? (scopeValue as SearchScopeFilter)
      : 'custom';
  }

  let author: SearchAuthorFilter = 'all';
  let authorAccount: string | undefined;

  if (authorClauses.length === 1) {
    const [authorClause] = authorClauses;
    const authorValue = authorClause?.value?.replace(/^@/, '');

    author =
      authorClause?.operator !== '-' && authorValue?.toLowerCase() === 'me'
        ? 'me'
        : 'custom';

    if (
      authorClause?.operator !== '-' &&
      authorValue &&
      authorValue.toLowerCase() !== 'me'
    ) {
      authorAccount = authorValue;
    }
  } else if (authorClauses.length > 1) {
    author = 'custom';
  }

  const content =
    contentClauses.length === 0
      ? 'all'
      : contentClauses.length === 1
        ? (contentClauses[0]?.value ?? 'all')
        : 'custom';
  const hasTimeFilter = dateClauses.length > 0;
  const hasScopeFilter = scopeClauses.length > 0 && scope !== 'all';
  const hasAuthorFilter = authorClauses.length > 0;

  return {
    time,
    dateRange,
    scope,
    author,
    authorAccount,
    content,
    hasTimeFilter,
    hasScopeFilter,
    hasAuthorFilter,
    contentClauses,
    hasActiveFilters:
      hasTimeFilter ||
      hasScopeFilter ||
      hasAuthorFilter ||
      contentClauses.length > 0,
  };
};

const replaceTokens = (
  query: string,
  shouldRemove: (token: SearchQueryToken) => boolean,
  replacement?: string,
) => {
  const tokens = parseSearchQuery(query).filter(
    (token) => !shouldRemove(token),
  );

  if (replacement) {
    tokens.push(parseSearchQueryToken(replacement));
  }

  return serializeSearchQuery(tokens);
};

export const setSearchTimeFilter = (
  query: string,
  filter: Exclude<SearchTimeFilter, 'custom'>,
  now = new Date(),
) =>
  replaceTokens(
    query,
    isDateClause,
    filter === 'all' ? undefined : `after:${dateForTimeFilter(filter, now)}`,
  );

export const isSearchDateRangeValid = ({ start, end }: SearchDateRange) =>
  (Boolean(start) || Boolean(end)) &&
  (!start || Boolean(shiftISODate(start, 0))) &&
  (!end || Boolean(shiftISODate(end, 0))) &&
  (!start || !end || start <= end);

export const setSearchDateRange = (query: string, range: SearchDateRange) => {
  if (!isSearchDateRangeValid(range)) {
    throw new RangeError('Invalid search date range');
  }

  const tokens = parseSearchQuery(query).filter(
    (token) => !isDateClause(token),
  );

  if (range.start) {
    const exclusiveStart = shiftISODate(range.start, -1);

    if (exclusiveStart) {
      tokens.push(parseSearchQueryToken(`after:${exclusiveStart}`));
    }
  }

  if (range.end) {
    const exclusiveEnd = shiftISODate(range.end, 1);

    if (exclusiveEnd) {
      tokens.push(parseSearchQueryToken(`before:${exclusiveEnd}`));
    }
  }

  return serializeSearchQuery(tokens);
};

export const setSearchScopeFilter = (
  query: string,
  filter: Exclude<SearchScopeFilter, 'custom'>,
) =>
  replaceTokens(
    query,
    isScopeClause,
    filter === 'all' ? undefined : `in:${filter}`,
  );

export const setSearchAuthorFilter = (
  query: string,
  filter: Exclude<SearchAuthorFilter, 'custom'>,
) =>
  replaceTokens(
    query,
    isAuthorClause,
    filter === 'all' ? undefined : 'from:me',
  );

export const setSearchAuthorAccount = (query: string, account: string) => {
  const normalizedAccount = account.trim().replace(/^@+/, '');

  if (!normalizedAccount || /\s/.test(normalizedAccount)) {
    throw new RangeError('Invalid search author account');
  }

  return replaceTokens(query, isAuthorClause, `from:@${normalizedAccount}`);
};

export const setSearchContentFilter = (
  query: string,
  filter: Exclude<SearchContentFilter, 'custom'>,
) =>
  replaceTokens(
    query,
    isManagedContentClause,
    filter === 'all'
      ? undefined
      : filter === 'no-replies'
        ? '-is:reply'
        : `has:${filter}`,
  );

export const toggleSearchContentFilter = (
  query: string,
  filter: Exclude<SearchContentFilter, 'all' | 'custom'>,
) => {
  const tokens = parseSearchQuery(query);
  const hasFilter = tokens.some(
    (token) => contentFilterForToken(token) === filter,
  );

  if (hasFilter) {
    return serializeSearchQuery(
      tokens.filter((token) => contentFilterForToken(token) !== filter),
    );
  }

  const token = filter === 'no-replies' ? '-is:reply' : `has:${filter}`;

  return serializeSearchQuery([...tokens, parseSearchQueryToken(token)]);
};

export const removeSearchQueryToken = (query: string, tokenIndex: number) =>
  serializeSearchQuery(
    parseSearchQuery(query).filter((_token, index) => index !== tokenIndex),
  );

export const clearSearchFilters = (query: string) =>
  serializeSearchQuery(
    parseSearchQuery(query).filter(
      (token) =>
        !isDateClause(token) &&
        !isScopeClause(token) &&
        !isAuthorClause(token) &&
        !isManagedContentClause(token),
    ),
  );

// 5.0 requires positive text for a public search. Library/self queries can
// still consist entirely of the filters exposed by SearchFilterBar.
export const searchNeedsKeywords = (
  query: string,
  ownAcct?: string,
  localDomain?: string,
) => {
  const tokens = parseSearchQuery(query);
  if (!tokens.length) return false;
  const scope = tokens.filter(({ prefix }) => prefix === 'in').at(-1);
  if (scope?.value === 'library') return false;
  if (
    tokens.some(
      ({ prefix, operator, value }) =>
        prefix === 'from' &&
        operator !== '-' &&
        (value === 'me' ||
          (ownAcct &&
            [ownAcct, `${ownAcct}@${localDomain}`].some(
              (acct) =>
                value?.replace(/^@/, '').toLowerCase() === acct.toLowerCase(),
            ))),
    )
  )
    return false;
  const prefixes = new Set([
    'has',
    'is',
    'language',
    'from',
    'before',
    'after',
    'during',
    'in',
  ]);
  return !tokens.some(
    ({ prefix, operator, raw }) =>
      operator !== '-' &&
      (!prefix || !prefixes.has(prefix)) &&
      raw.replace(/^\+/, '').replaceAll('"', '').trim().length > 0,
  );
};
