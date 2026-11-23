import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';

import { defineMessages, useIntl } from 'react-intl';

import classNames from 'classnames';

import ArrowDropDownIcon from '@/material-icons/400-24px/arrow_drop_down.svg?react';
import CheckIcon from '@/material-icons/400-24px/check.svg?react';
import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import FilterIcon from '@/material-icons/400-24px/filter_alt.svg?react';
import type { ApiAccountJSON } from 'mastodon/api_types/accounts';
import { Avatar } from 'mastodon/components/avatar';
import { Button } from 'mastodon/components/button';
import { Dropdown } from 'mastodon/components/dropdown_menu';
import { ComboboxField } from 'mastodon/components/form_fields';
import { ComboboxMenuItem } from 'mastodon/components/form_fields/combobox_field';
import { Icon } from 'mastodon/components/icon';
import { useSearchAccounts } from 'mastodon/hooks/useSearchAccounts';
import type { MenuItem } from 'mastodon/models/dropdown_menu';

import {
  clearSearchFilters,
  getSearchFilters,
  isSearchDateRangeValid,
  removeSearchQueryToken,
  setSearchAuthorAccount,
  setSearchAuthorFilter,
  setSearchContentFilter,
  setSearchDateRange,
  setSearchScopeFilter,
  setSearchTimeFilter,
  toggleSearchContentFilter,
} from '../utils/search_query';
import type {
  SearchAuthorFilter,
  SearchContentClause,
  SearchContentFilter,
  SearchDateRange,
  SearchScopeFilter,
  SearchTimeFilter,
} from '../utils/search_query';

const messages = defineMessages({
  label: { id: 'search_filters.label', defaultMessage: 'Filters' },
  time: { id: 'search_filters.time', defaultMessage: 'Time' },
  timeAll: { id: 'search_filters.time_all', defaultMessage: 'Any time' },
  timeWeek: { id: 'search_filters.time_week', defaultMessage: 'Past week' },
  timeMonth: { id: 'search_filters.time_month', defaultMessage: 'Past month' },
  timeYear: { id: 'search_filters.time_year', defaultMessage: 'Past year' },
  timeCustom: {
    id: 'search_filters.time_custom',
    defaultMessage: 'Custom time',
  },
  timeCustomRange: {
    id: 'search_filters.time_custom_range',
    defaultMessage: 'Custom date range…',
  },
  timeRange: {
    id: 'search_filters.time_range',
    defaultMessage: '{start} – {end}',
  },
  timeStarting: {
    id: 'search_filters.time_starting',
    defaultMessage: 'From {date}',
  },
  timeEnding: {
    id: 'search_filters.time_ending',
    defaultMessage: 'Through {date}',
  },
  dateRangeTitle: {
    id: 'search_filters.date_range_title',
    defaultMessage: 'Custom date range',
  },
  dateStart: {
    id: 'search_filters.date_start',
    defaultMessage: 'Start date',
  },
  dateEnd: {
    id: 'search_filters.date_end',
    defaultMessage: 'End date',
  },
  dateHint: {
    id: 'search_filters.date_hint',
    defaultMessage: 'You can enter just one date.',
  },
  dateOrderError: {
    id: 'search_filters.date_order_error',
    defaultMessage: 'The start date must not be after the end date.',
  },
  dateApply: {
    id: 'search_filters.date_apply',
    defaultMessage: 'Apply',
  },
  dateCancel: {
    id: 'search_filters.date_cancel',
    defaultMessage: 'Cancel',
  },
  dateClear: {
    id: 'search_filters.date_clear',
    defaultMessage: 'Clear dates',
  },
  scope: { id: 'search_filters.scope', defaultMessage: 'Scope' },
  scopeAll: {
    id: 'search_filters.scope_all',
    defaultMessage: 'All',
  },
  scopeLibrary: {
    id: 'search_filters.scope_library',
    defaultMessage: 'My posts and interactions',
  },
  scopeLibraryDescription: {
    id: 'search_filters.scope_library_description',
    defaultMessage: 'Posts you authored or interacted with',
  },
  scopePublic: {
    id: 'search_filters.scope_public',
    defaultMessage: 'Public search',
  },
  scopePublicDescription: {
    id: 'search_filters.scope_public_description',
    defaultMessage: 'Public posts from accounts that allow public search',
  },
  scopeCustom: {
    id: 'search_filters.scope_custom',
    defaultMessage: 'Custom scope',
  },
  author: { id: 'search_filters.author', defaultMessage: 'Author' },
  authorAll: {
    id: 'search_filters.author_all',
    defaultMessage: 'Anyone',
  },
  authorMe: {
    id: 'search_filters.author_me',
    defaultMessage: 'From me',
  },
  authorCustom: {
    id: 'search_filters.author_custom',
    defaultMessage: 'Custom author',
  },
  authorSelect: {
    id: 'search_filters.author_select',
    defaultMessage: 'Select a user…',
  },
  authorPickerTitle: {
    id: 'search_filters.author_picker_title',
    defaultMessage: 'Choose an author',
  },
  authorSearchLabel: {
    id: 'search_filters.author_search_label',
    defaultMessage: 'Search accounts',
  },
  authorSearchHint: {
    id: 'search_filters.author_search_hint',
    defaultMessage: 'Enter a name or @username, then choose an account.',
  },
  authorSearchError: {
    id: 'search_filters.author_search_error',
    defaultMessage: 'Accounts could not be loaded. Try again.',
  },
  authorCancel: {
    id: 'search_filters.author_cancel',
    defaultMessage: 'Cancel',
  },
  content: { id: 'search_filters.content', defaultMessage: 'Content' },
  contentAll: {
    id: 'search_filters.content_all',
    defaultMessage: 'Any content',
  },
  contentMedia: {
    id: 'search_filters.content_media',
    defaultMessage: 'With media',
  },
  contentPoll: {
    id: 'search_filters.content_poll',
    defaultMessage: 'With a poll',
  },
  contentLink: {
    id: 'search_filters.content_link',
    defaultMessage: 'With a link',
  },
  contentNoReplies: {
    id: 'search_filters.content_no_replies',
    defaultMessage: 'Without replies',
  },
  contentSelected: {
    id: 'search_filters.content_selected',
    defaultMessage: '{count, plural, one {# condition} other {# conditions}}',
  },
  activeFilters: {
    id: 'search_filters.active_filters',
    defaultMessage: 'Active search filters',
  },
  clear: {
    id: 'search_filters.clear',
    defaultMessage: 'Clear filters',
  },
  remove: {
    id: 'search_filters.remove',
    defaultMessage: 'Remove {filter} filter',
  },
});

interface FilterOption<Value extends string> {
  value: Value;
  label: string;
  description?: string;
}

const SearchFilterDropdown = <Value extends string>({
  label,
  value,
  displayValue,
  options,
  active,
  selectedValues,
  closeOnSelect = true,
  buttonRef,
  onSelect,
}: {
  label: string;
  value: string;
  displayValue: string;
  options: FilterOption<Value>[];
  active: boolean;
  selectedValues?: ReadonlySet<Value>;
  closeOnSelect?: boolean;
  buttonRef?: React.Ref<HTMLButtonElement>;
  onSelect: (value: Value) => void;
}) => {
  const items: MenuItem[] = options.map((option) => {
    const selected = selectedValues
      ? selectedValues.has(option.value)
      : option.value === value;

    return {
      text: option.label,
      description: option.description,
      highlighted: selected,
      checked: selectedValues ? selected : undefined,
      icon: selectedValues ? CheckIcon : undefined,
      iconId: selectedValues ? 'check' : undefined,
      action: () => {
        onSelect(option.value);
      },
    };
  });
  const accessibleLabel = `${label}: ${displayValue}`;

  return (
    <Dropdown
      items={items}
      placement='bottom-start'
      title={accessibleLabel}
      closeOnSelect={closeOnSelect}
      forceDropdown={!closeOnSelect}
    >
      <button
        ref={buttonRef}
        type='button'
        className={classNames('search-filter-bar__control', { active })}
        aria-label={accessibleLabel}
      >
        <span className='search-filter-bar__control-label'>{label}:</span>{' '}
        <span className='search-filter-bar__control-value'>{displayValue}</span>
        <Icon id='caret-down' icon={ArrowDropDownIcon} />
      </button>
    </Dropdown>
  );
};

const SearchDateRangeForm: React.FC<{
  initialRange?: SearchDateRange;
  onApply: (range: SearchDateRange) => void;
  onClear: () => void;
  onCancel: () => void;
}> = ({ initialRange, onApply, onClear, onCancel }) => {
  const intl = useIntl();
  const [start, setStart] = useState(initialRange?.start ?? '');
  const [end, setEnd] = useState(initialRange?.end ?? '');
  const startInputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const startId = useId();
  const endId = useId();
  const hintId = useId();
  const errorId = useId();
  const range = useMemo(
    () => ({
      start: start || undefined,
      end: end || undefined,
    }),
    [end, start],
  );
  const dateOrderInvalid = Boolean(start && end && start > end);
  const isValid = isSearchDateRangeValid(range);
  const describedBy = dateOrderInvalid ? `${hintId} ${errorId}` : hintId;

  useEffect(() => {
    startInputRef.current?.focus({ preventScroll: true });
  }, []);

  const handleSubmit = useCallback(
    (event: React.SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();

      if (isValid) {
        onApply(range);
      }
    },
    [isValid, onApply, range],
  );
  const handleStartChange: React.ChangeEventHandler<HTMLInputElement> =
    useCallback((event) => {
      setStart(event.target.value);
    }, []);
  const handleEndChange: React.ChangeEventHandler<HTMLInputElement> =
    useCallback((event) => {
      setEnd(event.target.value);
    }, []);

  return (
    <form
      className='search-filter-bar__date-range'
      aria-labelledby={titleId}
      onSubmit={handleSubmit}
    >
      <h3 id={titleId} className='search-filter-bar__date-range-title'>
        {intl.formatMessage(messages.dateRangeTitle)}
      </h3>

      <div className='search-filter-bar__date-range-fields'>
        <label className='search-filter-bar__date-field' htmlFor={startId}>
          <span>{intl.formatMessage(messages.dateStart)}</span>
          <input
            ref={startInputRef}
            id={startId}
            type='date'
            value={start}
            max={end || undefined}
            aria-describedby={describedBy}
            aria-invalid={dateOrderInvalid || undefined}
            onChange={handleStartChange}
          />
        </label>

        <label className='search-filter-bar__date-field' htmlFor={endId}>
          <span>{intl.formatMessage(messages.dateEnd)}</span>
          <input
            id={endId}
            type='date'
            value={end}
            min={start || undefined}
            aria-describedby={describedBy}
            aria-invalid={dateOrderInvalid || undefined}
            onChange={handleEndChange}
          />
        </label>
      </div>

      <p id={hintId} className='search-filter-bar__date-range-hint'>
        {intl.formatMessage(messages.dateHint)}
      </p>

      {dateOrderInvalid && (
        <p
          id={errorId}
          className='search-filter-bar__date-range-error'
          role='alert'
        >
          {intl.formatMessage(messages.dateOrderError)}
        </p>
      )}

      <div className='search-filter-bar__date-range-actions'>
        <Button
          className='search-filter-bar__date-range-clear'
          variant='tonal'
          onClick={onClear}
        >
          {intl.formatMessage(messages.dateClear)}
        </Button>
        <Button variant='tonal' onClick={onCancel}>
          {intl.formatMessage(messages.dateCancel)}
        </Button>
        <Button type='submit' disabled={!isValid}>
          {intl.formatMessage(messages.dateApply)}
        </Button>
      </div>
    </form>
  );
};

const renderAuthorAccount = (account: ApiAccountJSON) => (
  <ComboboxMenuItem className='search-filter-bar__author-result'>
    <Avatar account={account} size={32} />
    <span className='search-filter-bar__author-result-name'>
      <strong>{account.display_name || account.username}</strong>
      <span>@{account.acct}</span>
    </span>
  </ComboboxMenuItem>
);

const SearchAuthorPicker: React.FC<{
  onSelect: (account: string) => void;
  onCancel: () => void;
}> = ({ onSelect, onCancel }) => {
  const intl = useIntl();
  const [searchValue, setSearchValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const inputId = useId();
  const { accounts, isLoading, isError, searchAccounts, resetAccounts } =
    useSearchAccounts();

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  const handleChange: React.ChangeEventHandler<HTMLInputElement> = useCallback(
    (event) => {
      const value = event.target.value;

      setSearchValue(value);
      searchAccounts(value);
    },
    [searchAccounts],
  );
  const handleSelect = useCallback(
    (account: ApiAccountJSON) => {
      onSelect(account.acct);
      setSearchValue('');
      resetAccounts();
    },
    [onSelect, resetAccounts],
  );

  return (
    <div className='search-filter-bar__author-picker' aria-labelledby={titleId}>
      <h3 id={titleId} className='search-filter-bar__author-picker-title'>
        {intl.formatMessage(messages.authorPickerTitle)}
      </h3>

      <ComboboxField
        ref={inputRef}
        id={inputId}
        label={intl.formatMessage(messages.authorSearchLabel)}
        hint={intl.formatMessage(messages.authorSearchHint)}
        value={searchValue}
        items={accounts}
        isLoading={isLoading}
        suppressMenu={!searchValue.trim()}
        renderItem={renderAuthorAccount}
        onChange={handleChange}
        onSelectItem={handleSelect}
        status={
          isError
            ? {
                variant: 'error',
                message: intl.formatMessage(messages.authorSearchError),
              }
            : null
        }
      />

      <div className='search-filter-bar__author-picker-actions'>
        <Button variant='tonal' onClick={onCancel}>
          {intl.formatMessage(messages.authorCancel)}
        </Button>
      </div>
    </div>
  );
};

const SearchFilterChip: React.FC<{
  label: string;
  query: string;
  kind: 'time' | 'scope' | 'author' | 'token';
  tokenIndex?: number;
  onQueryChange: (query: string) => void;
  accessibleLabel: string;
}> = ({ label, query, kind, tokenIndex, onQueryChange, accessibleLabel }) => {
  const handleClick = useCallback(() => {
    switch (kind) {
      case 'time':
        onQueryChange(setSearchTimeFilter(query, 'all'));
        break;
      case 'scope':
        onQueryChange(setSearchScopeFilter(query, 'all'));
        break;
      case 'author':
        onQueryChange(setSearchAuthorFilter(query, 'all'));
        break;
      case 'token':
        if (tokenIndex !== undefined) {
          onQueryChange(removeSearchQueryToken(query, tokenIndex));
        }
        break;
    }
  }, [kind, onQueryChange, query, tokenIndex]);

  return (
    <button
      type='button'
      className='search-filter-bar__chip'
      onClick={handleClick}
      aria-label={accessibleLabel}
    >
      <span>{label}</span>
      <Icon id='close' icon={CloseIcon} />
    </button>
  );
};

export const SearchFilterBar: React.FC<{
  query: string;
  onQueryChange: (query: string) => void;
}> = ({ query, onQueryChange }) => {
  const intl = useIntl();
  const filters = getSearchFilters(query);
  const [dateRangeOpen, setDateRangeOpen] = useState(false);
  const [authorPickerOpen, setAuthorPickerOpen] = useState(false);
  const timeControlRef = useRef<HTMLButtonElement>(null);
  const authorControlRef = useRef<HTMLButtonElement>(null);

  const restoreTimeControlFocus = useCallback(() => {
    window.setTimeout(() => {
      timeControlRef.current?.focus({ preventScroll: true });
    }, 0);
  }, []);
  const restoreAuthorControlFocus = useCallback(() => {
    window.setTimeout(() => {
      authorControlRef.current?.focus({ preventScroll: true });
    }, 0);
  }, []);

  type TimeOption = SearchTimeFilter;
  type ScopeOption = Exclude<SearchScopeFilter, 'custom'>;
  type AuthorOption = Exclude<SearchAuthorFilter, 'custom'> | 'select';
  type ContentOption = Exclude<SearchContentFilter, 'custom'>;

  const timeOptions: FilterOption<TimeOption>[] = [
    { value: 'all', label: intl.formatMessage(messages.timeAll) },
    { value: 'week', label: intl.formatMessage(messages.timeWeek) },
    { value: 'month', label: intl.formatMessage(messages.timeMonth) },
    { value: 'year', label: intl.formatMessage(messages.timeYear) },
    { value: 'custom', label: intl.formatMessage(messages.timeCustomRange) },
  ];
  const scopeOptions: FilterOption<ScopeOption>[] = [
    { value: 'all', label: intl.formatMessage(messages.scopeAll) },
    {
      value: 'library',
      label: intl.formatMessage(messages.scopeLibrary),
      description: intl.formatMessage(messages.scopeLibraryDescription),
    },
    {
      value: 'public',
      label: intl.formatMessage(messages.scopePublic),
      description: intl.formatMessage(messages.scopePublicDescription),
    },
  ];
  const authorOptions: FilterOption<AuthorOption>[] = [
    { value: 'all', label: intl.formatMessage(messages.authorAll) },
    { value: 'me', label: intl.formatMessage(messages.authorMe) },
    { value: 'select', label: intl.formatMessage(messages.authorSelect) },
  ];
  const contentOptions: FilterOption<ContentOption>[] = [
    { value: 'all', label: intl.formatMessage(messages.contentAll) },
    { value: 'media', label: intl.formatMessage(messages.contentMedia) },
    { value: 'poll', label: intl.formatMessage(messages.contentPoll) },
    { value: 'link', label: intl.formatMessage(messages.contentLink) },
    {
      value: 'no-replies',
      label: intl.formatMessage(messages.contentNoReplies),
    },
  ];
  const selectedContentValues = new Set<ContentOption>(
    filters.contentClauses.map(({ value }) => value),
  );

  if (selectedContentValues.size === 0) {
    selectedContentValues.add('all');
  }

  const formatFilterDate = (value: string) =>
    intl.formatDate(new Date(`${value}T12:00:00`), {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  const formattedStart = filters.dateRange?.start
    ? formatFilterDate(filters.dateRange.start)
    : undefined;
  const formattedEnd = filters.dateRange?.end
    ? formatFilterDate(filters.dateRange.end)
    : undefined;
  let timeLabel: string;

  if (filters.time !== 'custom') {
    timeLabel =
      timeOptions.find(({ value }) => value === filters.time)?.label ??
      intl.formatMessage(messages.timeAll);
  } else if (formattedStart && formattedEnd) {
    timeLabel = intl.formatMessage(messages.timeRange, {
      start: formattedStart,
      end: formattedEnd,
    });
  } else if (formattedStart) {
    timeLabel = intl.formatMessage(messages.timeStarting, {
      date: formattedStart,
    });
  } else if (formattedEnd) {
    timeLabel = intl.formatMessage(messages.timeEnding, {
      date: formattedEnd,
    });
  } else {
    timeLabel = intl.formatMessage(messages.timeCustom);
  }
  const scopeLabel =
    filters.scope === 'custom'
      ? intl.formatMessage(messages.scopeCustom)
      : (scopeOptions.find(({ value }) => value === filters.scope)?.label ??
        intl.formatMessage(messages.scopeAll));
  const authorLabel =
    filters.author === 'custom'
      ? filters.authorAccount
        ? `@${filters.authorAccount}`
        : intl.formatMessage(messages.authorCustom)
      : (authorOptions.find(({ value }) => value === filters.author)?.label ??
        intl.formatMessage(messages.authorAll));
  const contentLabel =
    filters.content === 'custom'
      ? intl.formatMessage(messages.contentSelected, {
          count: filters.contentClauses.length,
        })
      : (contentOptions.find(({ value }) => value === filters.content)?.label ??
        intl.formatMessage(messages.contentAll));

  const handleTimeSelect = useCallback(
    (value: TimeOption) => {
      if (value === 'custom') {
        setDateRangeOpen(true);
        setAuthorPickerOpen(false);
        return;
      }

      setDateRangeOpen(false);
      setAuthorPickerOpen(false);
      onQueryChange(setSearchTimeFilter(query, value));
    },
    [onQueryChange, query],
  );
  const handleScopeSelect = useCallback(
    (value: ScopeOption) => {
      setDateRangeOpen(false);
      setAuthorPickerOpen(false);
      onQueryChange(setSearchScopeFilter(query, value));
    },
    [onQueryChange, query],
  );
  const handleAuthorSelect = useCallback(
    (value: AuthorOption) => {
      setDateRangeOpen(false);

      if (value === 'select') {
        setAuthorPickerOpen(true);
        return;
      }

      setAuthorPickerOpen(false);
      onQueryChange(setSearchAuthorFilter(query, value));
    },
    [onQueryChange, query],
  );
  const handleContentSelect = useCallback(
    (value: ContentOption) => {
      setDateRangeOpen(false);
      setAuthorPickerOpen(false);
      onQueryChange(
        value === 'all'
          ? setSearchContentFilter(query, value)
          : toggleSearchContentFilter(query, value),
      );
    },
    [onQueryChange, query],
  );
  const handleDateApply = useCallback(
    (range: SearchDateRange) => {
      onQueryChange(setSearchDateRange(query, range));
      setDateRangeOpen(false);
      restoreTimeControlFocus();
    },
    [onQueryChange, query, restoreTimeControlFocus],
  );
  const handleDateClear = useCallback(() => {
    onQueryChange(setSearchTimeFilter(query, 'all'));
    setDateRangeOpen(false);
    restoreTimeControlFocus();
  }, [onQueryChange, query, restoreTimeControlFocus]);
  const handleDateCancel = useCallback(() => {
    setDateRangeOpen(false);
    restoreTimeControlFocus();
  }, [restoreTimeControlFocus]);
  const handleAuthorAccountSelect = useCallback(
    (account: string) => {
      onQueryChange(setSearchAuthorAccount(query, account));
      setAuthorPickerOpen(false);
      restoreAuthorControlFocus();
    },
    [onQueryChange, query, restoreAuthorControlFocus],
  );
  const handleAuthorCancel = useCallback(() => {
    setAuthorPickerOpen(false);
    restoreAuthorControlFocus();
  }, [restoreAuthorControlFocus]);
  const handleClear = useCallback(() => {
    onQueryChange(clearSearchFilters(query));
    setDateRangeOpen(false);
    setAuthorPickerOpen(false);
  }, [onQueryChange, query]);

  const contentClauseLabel = ({ value }: SearchContentClause) =>
    contentOptions.find((option) => option.value === value)?.label ?? value;

  return (
    <section
      className='search-filter-bar'
      aria-label={intl.formatMessage(messages.label)}
    >
      <div className='search-filter-bar__header'>
        <span className='search-filter-bar__heading'>
          <Icon id='filter' icon={FilterIcon} />
          {intl.formatMessage(messages.label)}
        </span>

        {filters.hasActiveFilters && (
          <button
            type='button'
            className='search-filter-bar__clear'
            onClick={handleClear}
          >
            {intl.formatMessage(messages.clear)}
          </button>
        )}
      </div>

      <div className='search-filter-bar__controls'>
        <SearchFilterDropdown
          label={intl.formatMessage(messages.time)}
          value={filters.time}
          displayValue={timeLabel}
          options={timeOptions}
          active={filters.hasTimeFilter}
          buttonRef={timeControlRef}
          onSelect={handleTimeSelect}
        />
        <SearchFilterDropdown
          label={intl.formatMessage(messages.scope)}
          value={filters.scope}
          displayValue={scopeLabel}
          options={scopeOptions}
          active={filters.hasScopeFilter}
          onSelect={handleScopeSelect}
        />
        <SearchFilterDropdown
          label={intl.formatMessage(messages.author)}
          value={filters.author}
          displayValue={authorLabel}
          options={authorOptions}
          active={filters.hasAuthorFilter}
          buttonRef={authorControlRef}
          onSelect={handleAuthorSelect}
        />
        <SearchFilterDropdown
          label={intl.formatMessage(messages.content)}
          value={filters.content}
          displayValue={contentLabel}
          options={contentOptions}
          active={filters.contentClauses.length > 0}
          selectedValues={selectedContentValues}
          closeOnSelect={false}
          onSelect={handleContentSelect}
        />
      </div>

      {dateRangeOpen && (
        <SearchDateRangeForm
          key={`${filters.dateRange?.start ?? ''}:${filters.dateRange?.end ?? ''}`}
          initialRange={filters.dateRange}
          onApply={handleDateApply}
          onClear={handleDateClear}
          onCancel={handleDateCancel}
        />
      )}

      {authorPickerOpen && (
        <SearchAuthorPicker
          onSelect={handleAuthorAccountSelect}
          onCancel={handleAuthorCancel}
        />
      )}

      {filters.hasActiveFilters && (
        <div
          className='search-filter-bar__chips'
          aria-label={intl.formatMessage(messages.activeFilters)}
        >
          {filters.hasTimeFilter && (
            <SearchFilterChip
              label={timeLabel}
              query={query}
              kind='time'
              onQueryChange={onQueryChange}
              accessibleLabel={intl.formatMessage(messages.remove, {
                filter: timeLabel,
              })}
            />
          )}

          {filters.hasScopeFilter && (
            <SearchFilterChip
              label={scopeLabel}
              query={query}
              kind='scope'
              onQueryChange={onQueryChange}
              accessibleLabel={intl.formatMessage(messages.remove, {
                filter: scopeLabel,
              })}
            />
          )}

          {filters.hasAuthorFilter && (
            <SearchFilterChip
              label={authorLabel}
              query={query}
              kind='author'
              onQueryChange={onQueryChange}
              accessibleLabel={intl.formatMessage(messages.remove, {
                filter: authorLabel,
              })}
            />
          )}

          {filters.contentClauses.map((clause) => {
            const label = contentClauseLabel(clause);

            return (
              <SearchFilterChip
                label={label}
                query={query}
                kind='token'
                tokenIndex={clause.tokenIndex}
                onQueryChange={onQueryChange}
                key={clause.tokenIndex}
                accessibleLabel={intl.formatMessage(messages.remove, {
                  filter: label,
                })}
              />
            );
          })}
        </div>
      )}
    </section>
  );
};
