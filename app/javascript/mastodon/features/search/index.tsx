import { useCallback, useEffect } from 'react';

import { useIntl, defineMessages, FormattedMessage } from 'react-intl';

import {
  CirclesFourIcon,
  FileMagnifyingGlassIcon,
  HashIcon,
  UsersIcon,
} from '@phosphor-icons/react';
import { Helmet } from '@unhead/react/helmet';

import { Button } from '@/mastodon/components/button/redesign';
import { Column } from '@/mastodon/components/column';
import { ColumnHeader } from '@/mastodon/components/column_header';
import { submitSearch, expandSearch } from 'mastodon/actions/search';
import type { ApiSearchType } from 'mastodon/api_types/search';
import { Account } from 'mastodon/components/account';
import { CompatibilityHashtag as Hashtag } from 'mastodon/components/hashtag';
import { Icon } from 'mastodon/components/icon';
import ScrollableList from 'mastodon/components/scrollable_list';
import { Status } from 'mastodon/components/status';
import { Search } from 'mastodon/features/compose/components/search';
import { useAccount } from 'mastodon/hooks/useAccount';
import { useSearchParam } from 'mastodon/hooks/useSearchParam';
import { domain, me } from 'mastodon/initial_state';
import type { Hashtag as HashtagType } from 'mastodon/models/tags';
import { useAppDispatch, useAppSelector } from 'mastodon/store';

import { CollectionListItem } from '../collections/components/collection_list_item';

import { SearchFilterBar } from './components/search_filter_bar';
import { SearchSection } from './components/search_section';
import {
  clearSearchFilters,
  getSearchFilters,
  searchNeedsKeywords,
} from './utils/search_query';

const messages = defineMessages({
  keywordsRequired: {
    id: 'search_filters.keywords_required',
    defaultMessage:
      'Add a keyword, or select "My posts and interactions" or "From me" to search using filters only.',
  },
  filteredNoResultsTitle: {
    id: 'search_results.filtered_no_results_title',
    defaultMessage: 'No posts match these filters',
  },
  filteredNoResultsDescription: {
    id: 'search_results.filtered_no_results_description',
    defaultMessage:
      'Remove a filter above, or clear all filters to search again with the same keywords.',
  },
  clearFilters: {
    id: 'search_results.clear_filters',
    defaultMessage: 'Clear filters and search again',
  },
  searchFor: { id: 'search_results.title', defaultMessage: 'Search for "{q}"' },
  search: { id: 'navigation_bar.search', defaultMessage: 'Search' },
});

const INITIAL_PAGE_LIMIT = 10;
const INITIAL_DISPLAY = 4;

const hidePeek = <T,>(list: T[]) => {
  if (
    list.length > INITIAL_PAGE_LIMIT &&
    list.length % INITIAL_PAGE_LIMIT === 1
  ) {
    return list.slice(0, -2);
  } else {
    return list;
  }
};

const renderAccounts = (accountIds: string[]) =>
  hidePeek<string>(accountIds).map((id) => (
    <Account key={id} id={id} reference='search' />
  ));

const renderHashtags = (hashtags: HashtagType[]) =>
  hidePeek<HashtagType>(hashtags).map((hashtag) => (
    <Hashtag key={hashtag.name} hashtag={hashtag} />
  ));

const renderStatuses = (statusIds: string[]) =>
  hidePeek<string>(statusIds).map((id) => (
    <Status contextType='search' key={id} id={id} />
  ));

type SearchType = 'all' | ApiSearchType;

const typeFromParam = (param?: string): SearchType => {
  if (param && ['all', 'accounts', 'statuses', 'hashtags'].includes(param)) {
    return param as SearchType;
  } else {
    return 'all';
  }
};

export const SearchResults: React.FC<{ multiColumn: boolean }> = ({
  multiColumn,
}) => {
  const intl = useIntl();
  const [q, setQuery] = useSearchParam('q');
  const [type, setType] = useSearchParam('type');
  const isLoading = useAppSelector((state) => state.search.loading);
  const storedResults = useAppSelector((state) => state.search.results);
  const dispatch = useAppDispatch();
  const mappedType = typeFromParam(type);
  const trimmedValue = q?.trim() ?? '';
  const ownAccount = useAccount(me);
  const needsKeywords =
    mappedType === 'statuses' &&
    searchNeedsKeywords(trimmedValue, ownAccount?.acct, domain);
  const results = needsKeywords ? undefined : storedResults;
  const searchFilters = getSearchFilters(trimmedValue);
  const hasActiveStatusFilters =
    mappedType === 'statuses' && searchFilters.hasActiveFilters;

  useEffect(() => {
    if (trimmedValue.length > 0 && !needsKeywords) {
      void dispatch(
        submitSearch({
          q: trimmedValue,
          type: mappedType === 'all' ? undefined : mappedType,
        }),
      );
    }
  }, [dispatch, trimmedValue, mappedType, needsKeywords]);

  const handleSelectAll = useCallback(() => {
    setType(null);
  }, [setType]);

  const handleSelectAccounts = useCallback(() => {
    setType('accounts');
  }, [setType]);

  const handleSelectHashtags = useCallback(() => {
    setType('hashtags');
  }, [setType]);

  const handleSelectStatuses = useCallback(() => {
    setType('statuses');
  }, [setType]);

  const handleFilterQueryChange = useCallback(
    (query: string) => {
      setQuery(query);
    },
    [setQuery],
  );

  const handleClearFilters = useCallback(() => {
    setQuery(clearSearchFilters(trimmedValue));
  }, [setQuery, trimmedValue]);

  const handleLoadMore = useCallback(() => {
    if (mappedType !== 'all') {
      void dispatch(expandSearch({ type: mappedType }));
    }
  }, [dispatch, mappedType]);

  // We request 1 more result than we display so we can tell if there'd be a next page
  const hasMore =
    mappedType !== 'all' && results
      ? results[mappedType].length > INITIAL_PAGE_LIMIT &&
        results[mappedType].length % INITIAL_PAGE_LIMIT === 1
      : false;

  let filteredResults;

  if (results) {
    switch (mappedType) {
      case 'all':
        filteredResults =
          results.accounts.length +
            results.hashtags.length +
            results.statuses.length +
            results.collections.length >
          0 ? (
            <>
              {results.accounts.length > 0 && (
                <SearchSection
                  key='accounts'
                  title={
                    <>
                      <Icon id='users' icon={UsersIcon} />
                      <FormattedMessage
                        id='search_results.accounts'
                        defaultMessage='Profiles'
                      />
                    </>
                  }
                  onClickMore={handleSelectAccounts}
                >
                  {results.accounts.slice(0, INITIAL_DISPLAY).map((id) => (
                    <Account key={id} id={id} />
                  ))}
                </SearchSection>
              )}

              {results.collections.length > 0 && (
                <SearchSection
                  key='collections'
                  title={
                    <>
                      <Icon id='collections' icon={CirclesFourIcon} />
                      <FormattedMessage
                        id='search_results.collections'
                        defaultMessage='Collections'
                      />
                    </>
                  }
                >
                  {results.collections
                    .slice(0, INITIAL_DISPLAY)
                    .map((collection, index, array) => (
                      <CollectionListItem
                        key={collection.id}
                        collection={collection}
                        listSize={array.length}
                        positionInList={index + 1}
                      />
                    ))}
                </SearchSection>
              )}

              {results.hashtags.length > 0 && (
                <SearchSection
                  key='hashtags'
                  title={
                    <>
                      <Icon id='hashtag' icon={HashIcon} />
                      <FormattedMessage
                        id='search_results.hashtags'
                        defaultMessage='Hashtags'
                      />
                    </>
                  }
                  onClickMore={handleSelectHashtags}
                >
                  {results.hashtags.slice(0, INITIAL_DISPLAY).map((hashtag) => (
                    <Hashtag key={hashtag.name} hashtag={hashtag} />
                  ))}
                </SearchSection>
              )}

              {results.statuses.length > 0 && (
                <SearchSection
                  key='statuses'
                  title={
                    <>
                      <Icon id='quote-right' icon={FileMagnifyingGlassIcon} />
                      <FormattedMessage
                        id='search_results.statuses'
                        defaultMessage='Posts'
                      />
                    </>
                  }
                  onClickMore={handleSelectStatuses}
                >
                  {results.statuses.slice(0, INITIAL_DISPLAY).map((id) => (
                    <Status contextType='search' key={id} id={id} />
                  ))}
                </SearchSection>
              )}
            </>
          ) : (
            []
          );
        break;
      case 'accounts':
        filteredResults = renderAccounts(results.accounts);
        break;
      case 'hashtags':
        filteredResults = renderHashtags(results.hashtags);
        break;
      case 'statuses':
        filteredResults = renderStatuses(results.statuses);
        break;
    }
  }

  const emptyMessage = needsKeywords ? (
    intl.formatMessage(messages.keywordsRequired)
  ) : trimmedValue.length > 0 ? (
    hasActiveStatusFilters ? (
      <span className='search-filter-empty-state'>
        <strong className='search-filter-empty-state__title'>
          {intl.formatMessage(messages.filteredNoResultsTitle)}
        </strong>
        <span className='search-filter-empty-state__description'>
          {intl.formatMessage(messages.filteredNoResultsDescription)}
        </span>
        <Button onClick={handleClearFilters}>
          {intl.formatMessage(messages.clearFilters)}
        </Button>
      </span>
    ) : (
      <FormattedMessage
        id='search_results.no_results'
        defaultMessage='No results.'
      />
    )
  ) : (
    <FormattedMessage
      id='search_results.no_search_yet'
      defaultMessage='Try searching for posts, profiles or hashtags.'
    />
  );

  const extraStickyHeaderContent = (
    <>
      <div className='explore__search-header'>
        <Search singleColumn initialValue={trimmedValue} key={trimmedValue} />
      </div>

      <div className='account__section-headline'>
        <button
          onClick={handleSelectAll}
          className={mappedType === 'all' ? 'active' : undefined}
          type='button'
        >
          <FormattedMessage id='search_results.all' defaultMessage='All' />
        </button>
        <button
          onClick={handleSelectAccounts}
          className={mappedType === 'accounts' ? 'active' : undefined}
          type='button'
        >
          <FormattedMessage
            id='search_results.accounts'
            defaultMessage='Profiles'
          />
        </button>
        <button
          onClick={handleSelectHashtags}
          className={mappedType === 'hashtags' ? 'active' : undefined}
          type='button'
        >
          <FormattedMessage
            id='search_results.hashtags'
            defaultMessage='Hashtags'
          />
        </button>
        <button
          onClick={handleSelectStatuses}
          className={mappedType === 'statuses' ? 'active' : undefined}
          type='button'
        >
          <FormattedMessage
            id='search_results.statuses'
            defaultMessage='Posts'
          />
        </button>
      </div>
      {mappedType === 'statuses' && (
        <SearchFilterBar
          query={trimmedValue}
          onQueryChange={handleFilterQueryChange}
        />
      )}
    </>
  );

  const pageTitle = q
    ? intl.formatMessage(messages.searchFor, { q })
    : intl.formatMessage(messages.search);

  return (
    <Column bindToDocument={!multiColumn} label={pageTitle}>
      <ColumnHeader
        title={pageTitle}
        extraStickyContent={extraStickyHeaderContent}
      />

      <ScrollableList
        noSnippet
        scrollKey='search-results'
        isLoading={isLoading}
        showLoading={isLoading && !results}
        onLoadMore={handleLoadMore}
        hasMore={hasMore}
        emptyMessage={emptyMessage}
        bindToDocument
      >
        {filteredResults}
      </ScrollableList>

      <Helmet>
        <title>{pageTitle}</title>
        <meta name='robots' content='noindex' />
      </Helmet>
    </Column>
  );
};

// eslint-disable-next-line import/no-default-export
export default SearchResults;
