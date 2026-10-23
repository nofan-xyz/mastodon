import { useRouteMatch } from 'react-router';

import { Search } from '@/mastodon/features/compose/components/search';
import { Trends } from '@/mastodon/features/navigation_panel/components/trends';
import { useBreakpoint } from '@/mastodon/features/ui/hooks/useBreakpoint';
import { useIdentity } from '@/mastodon/identity_context';
import { isXUi } from '@/mastodon/initial_state';
import { includeMultiColumnPaths } from '@/mastodon/utils/react_router';

import { FooterLinks } from './footer_links';
import classes from './styles.module.scss';

/**
 * Don't display the search on editing flows and the search/explore
 * pages that have their own search field.
 */
const ROUTES_WITHOUT_SEARCH_BAR = includeMultiColumnPaths([
  '/explore',
  '/explore/tags',
  '/explore/suggestions',
  '/explore/links',
  '/search',
  '/start',
  '/start/profile',
  '/profile/edit',
  '/lists/new',
  '/lists/:id/edit',
  '/collections/new',
  '/collections/:id/edit',
  '/collections/:id/edit/details',
]);

export const DiscoveryPanel: React.FC = () => {
  const { signedIn } = useIdentity();
  const isNarrow = useBreakpoint('full');

  const isRouteWithSearchBar = !useRouteMatch({
    path: ROUTES_WITHOUT_SEARCH_BAR,
    exact: true,
  });

  return (
    <div className={classes.root}>
      {signedIn && isRouteWithSearchBar && (
        <Search singleColumn context='sidebar' />
      )}

      {isXUi && signedIn && !isNarrow && <Trends />}

      <footer className={classes.footer}>
        <FooterLinks context='search' />
      </footer>
    </div>
  );
};
