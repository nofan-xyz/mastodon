import { useCallback, useRef } from 'react';
import type { ReactNode } from 'react';

import { FormattedMessage, useIntl } from 'react-intl';

import { Link } from 'react-router-dom';

import type { Map as ImmutableMap } from 'immutable';

import {
  HouseIcon,
  BellIcon,
  ChatCircleDotsIcon,
  BookmarkSimpleIcon,
  UserIcon,
  DotsThreeCircleIcon,
  DotsThreeIcon,
  CaretDownIcon,
  PenNibIcon,
  UsersThreeIcon,
} from '@phosphor-icons/react';

import { AccountSwitcher } from '@/mastodon/components/account_switcher';
import type { AccountSwitcherHeaderProps } from '@/mastodon/components/account_switcher';
import { Avatar } from '@/mastodon/components/avatar';
import { Button, IconButton } from '@/mastodon/components/button/redesign';
import { DisplayName } from '@/mastodon/components/display_name';
import { useAccountHandle } from '@/mastodon/components/display_name/default';
import {
  Menu,
  MenuTrigger,
  MenuList,
  MenuItemLink,
  MenuItemDivider,
  MenuItemGroup,
} from '@/mastodon/components/menu';
import { FooterLinks } from '@/mastodon/features/discovery_panel/footer_links';
import { OnThisDayNavItem } from '@/mastodon/features/on_this_day/nav_item';
import { useAccount } from '@/mastodon/hooks/useAccount';
import { useIdentity } from '@/mastodon/identity_context';
import { useAppSelector } from '@/mastodon/store';

import { AccountMenuItems } from './account_card_and_menu';
import { NavigationHeader } from './header';
import { NavigationLink } from './navigation_link';
import classes from './x_navigation.module.scss';

interface Props {
  siteName?: string;
  mode: 'static' | 'slide-out';
  multiColumn?: boolean;
  layoutNotice?: ReactNode;
  notificationsCount: number;
  onCompose: () => void;
  topSensor: ReactNode;
  bottomSensor: ReactNode;
  isScrolledToTop: boolean;
  exploreLink: ReactNode;
  publicFeedLink: ReactNode;
  customFeeds: { id: string; title: string }[];
  followedHashtags: { name: string }[];
}

export const XNavigationPanel: React.FC<Props> = ({
  siteName,
  mode,
  multiColumn,
  layoutNotice,
  notificationsCount,
  onCompose,
  topSensor,
  bottomSensor,
  isScrolledToTop,
  exploreLink,
  publicFeedLink,
  customFeeds,
  followedHashtags,
}) => {
  const intl = useIntl();
  const escapeFromMenu = useRef(false);
  const handleMenuKeyDown = useCallback<
    React.KeyboardEventHandler<HTMLElement>
  >((event) => {
    if (event.key === 'Escape') {
      escapeFromMenu.current = !!event.currentTarget.querySelector(
        'button[aria-expanded="true"]',
      );
    }
  }, []);
  const handleMenuKeyUp = useCallback<React.KeyboardEventHandler<HTMLElement>>(
    (event) => {
      // The drawer closes on keyup; let this Escape dismiss its submenu only.
      if (event.key === 'Escape' && escapeFromMenu.current) {
        event.stopPropagation();
        escapeFromMenu.current = false;
      }
    },
    [],
  );
  const { accountId } = useIdentity();
  const account = useAccount(accountId);
  const followRequests = useAppSelector(
    (state) =>
      (
        state.user_lists.getIn(['follow_requests', 'items']) as
          | ImmutableMap<string, unknown>
          | undefined
      )?.size ?? 0,
  );

  return (
    <nav
      className={classes.root}
      data-mode={mode}
      data-multi-column={multiColumn}
      onKeyDownCapture={handleMenuKeyDown}
      onKeyUpCapture={handleMenuKeyUp}
      aria-label={intl.formatMessage({
        id: 'navigation_bar.main',
        defaultMessage: 'Main',
      })}
    >
      {topSensor}
      <NavigationHeader siteName={siteName} isStuck={!isScrolledToTop} />
      {mode === 'slide-out' && <XNavigationAccount />}
      <ul className={classes.list}>
        <NavigationLink to='/home' iconComponent={HouseIcon}>
          <FormattedMessage id='tabs_bar.home' defaultMessage='Home' />
        </NavigationLink>
        {exploreLink}
        <NavigationLink
          to='/notifications'
          iconComponent={BellIcon}
          badgeCount={notificationsCount}
        >
          <FormattedMessage
            id='tabs_bar.notifications'
            defaultMessage='Notifications'
          />
        </NavigationLink>
        <NavigationLink to='/conversations' iconComponent={ChatCircleDotsIcon}>
          <FormattedMessage id='tabs_bar.messages' defaultMessage='Messages' />
        </NavigationLink>
        <NavigationLink to='/bookmarks' iconComponent={BookmarkSimpleIcon}>
          <FormattedMessage id='tabs_bar.saved' defaultMessage='Saved' />
        </NavigationLink>
        <OnThisDayNavItem redesigned />
        {publicFeedLink}
        {(account?.locked || followRequests > 0) && (
          <NavigationLink
            to='/follow_requests'
            iconComponent={UsersThreeIcon}
            badgeCount={followRequests}
          >
            <FormattedMessage
              id='navigation_bar.follow_requests'
              defaultMessage='Follow requests'
            />
          </NavigationLink>
        )}
        <NavigationLink
          to={`/@${account?.acct}`}
          exact
          iconComponent={UserIcon}
        >
          <FormattedMessage
            id='navigation_bar.profile'
            defaultMessage='Profile'
          />
        </NavigationLink>
        <li>
          <Menu type='navigation'>
            <MenuTrigger
              as={Button}
              variant='ghost'
              leadingIcon={DotsThreeCircleIcon}
              className={classes.more}
            >
              <FormattedMessage
                id='navigation_bar.more'
                defaultMessage='More'
              />
            </MenuTrigger>
            <MenuList placement='right-end' minWidth={260}>
              {layoutNotice}
              <AccountMenuItems />
              <MenuItemDivider />
              <MenuItemGroup
                label={
                  <FormattedMessage
                    id='tabs_bar.custom_feeds'
                    defaultMessage='Custom Feeds'
                  />
                }
              >
                {customFeeds.map((feed) => (
                  <MenuItemLink key={feed.id} to={`/lists/${feed.id}`}>
                    {feed.title}
                  </MenuItemLink>
                ))}
                <MenuItemLink to='/lists/new'>
                  <FormattedMessage
                    id='tabs_bar.create_custom_feed'
                    defaultMessage='Create Feed'
                  />
                </MenuItemLink>
              </MenuItemGroup>
              {followedHashtags.length > 0 && (
                <MenuItemGroup
                  label={
                    <FormattedMessage
                      id='tabs_bar.followed_hashtags'
                      defaultMessage='Followed Hashtags'
                    />
                  }
                >
                  {followedHashtags.map((tag) => (
                    <MenuItemLink key={tag.name} to={`/tags/${tag.name}`}>
                      #{tag.name}
                    </MenuItemLink>
                  ))}
                </MenuItemGroup>
              )}
            </MenuList>
          </Menu>
        </li>
      </ul>
      <Button
        leadingIcon={PenNibIcon}
        onClick={onCompose}
        className={classes.post}
        size='lg'
        variant='solid'
      >
        <FormattedMessage id='tabs_bar.publish' defaultMessage='New Post' />
      </Button>
      <footer className={classes.footer}>
        {mode !== 'slide-out' && <XNavigationAccount />}
        <FooterLinks context='navigation' multiColumn={multiColumn} />
      </footer>
      {bottomSensor}
    </nav>
  );
};

export const XNavigationAccount: React.FC = () => (
  <AccountSwitcher header={XAccountHeader} />
);

const XAccountHeader: React.FC<AccountSwitcherHeaderProps> = ({
  profileProps,
  toggleProps,
}) => {
  const { accountId } = useIdentity();
  const account = useAccount(accountId);
  const handle = useAccountHandle(account);
  if (!account) return null;

  return (
    <div className={classes.account}>
      <Link
        {...profileProps}
        className={classes.profile}
        aria-label={`${account.display_name || account.username} (@${account.acct})`}
      >
        <Avatar account={account} size={40} />
        <span className={classes.identity}>
          <strong>
            <DisplayName variant='simple' account={account} />
          </strong>
          <span>{handle}</span>
        </span>
      </Link>
      <IconButton
        {...toggleProps}
        icon={CaretDownIcon}
        variant='ghost'
        className={classes.switch}
        size='sm'
      >
        <FormattedMessage
          id='account_switcher.switch'
          defaultMessage='Switch account'
        />
      </IconButton>
      <Menu type='navigation'>
        <MenuTrigger
          as={IconButton}
          icon={DotsThreeIcon}
          size='sm'
          className={classes.accountMore}
          variant='ghost'
        >
          <FormattedMessage
            id='tabs_bar.account_settings'
            defaultMessage='Account settings'
          />
        </MenuTrigger>
        <MenuList placement='top' minWidth={220}>
          <AccountMenuItems />
        </MenuList>
      </Menu>
    </div>
  );
};
