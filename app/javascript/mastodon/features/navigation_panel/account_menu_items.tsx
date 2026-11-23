import { useCallback } from 'react';

import { FormattedMessage } from 'react-intl';

import {
  UserIcon,
  GearIcon,
  CirclesFourIcon,
  HeartIcon,
  BookmarkSimpleIcon,
  UsersThreeIcon,
  ProhibitIcon,
  SignOutIcon,
  BellSlashIcon,
  HandWavingIcon,
} from '@phosphor-icons/react';

import { openModal } from '@/mastodon/actions/modal';
import { AccountSwitcher } from '@/mastodon/components/account_switcher';
import {
  MenuItem,
  MenuItemDivider,
  MenuItemGroup,
  MenuItemLink,
} from '@/mastodon/components/menu';
import { useAccount } from '@/mastodon/hooks/useAccount';
import { useIdentity } from '@/mastodon/identity_context';
import { isXUi } from '@/mastodon/initial_state';
import { useAppDispatch } from '@/mastodon/store';

export const AccountMenuItems: React.FC<{
  context?: 'default' | 'mobile';
}> = ({ context = 'default' }) => {
  const dispatch = useAppDispatch();
  const { accountId } = useIdentity();
  const account = useAccount(accountId);

  const confirmLogout = useCallback(() => {
    dispatch(openModal({ modalType: 'CONFIRM_LOG_OUT', modalProps: {} }));
  }, [dispatch]);

  if (!accountId) {
    return null;
  }

  const accountBasePath = `/@${account?.acct}`;

  return (
    <>
      {(!isXUi || context === 'mobile') && (
        <MenuItemGroup
          label={
            <FormattedMessage
              id='account_switcher.switch'
              defaultMessage='Switch account'
            />
          }
        >
          <AccountSwitcher />
        </MenuItemGroup>
      )}

      <MenuItemLink to={accountBasePath} exact icon={UserIcon}>
        <FormattedMessage
          id='account.view_profile'
          defaultMessage='View Profile'
        />
      </MenuItemLink>

      <MenuItemLink as='a' href='/settings/preferences' icon={GearIcon}>
        <FormattedMessage id='tabs_bar.settings' defaultMessage='Settings' />
      </MenuItemLink>

      <MenuItemDivider />

      <MenuItemLink
        to={`${accountBasePath}/collections`}
        icon={CirclesFourIcon}
      >
        <FormattedMessage
          id='navigation_bar.collections'
          defaultMessage='Collections'
        />
      </MenuItemLink>

      <MenuItemLink to='/favourites' icon={HeartIcon}>
        <FormattedMessage
          id='navigation_bar.liked_posts'
          defaultMessage='Liked Posts'
        />
      </MenuItemLink>

      {context === 'mobile' && (
        <MenuItemLink to='/bookmarks' icon={BookmarkSimpleIcon}>
          <FormattedMessage
            id='navigation_bar.saved_posts'
            defaultMessage='Saved Posts'
          />
        </MenuItemLink>
      )}

      <MenuItemDivider />

      <MenuItemGroup
        label={
          <FormattedMessage
            id='navigation_bar.relationships'
            defaultMessage='Relationships'
          />
        }
      >
        <MenuItemLink to={`${accountBasePath}/followers`} icon={HandWavingIcon}>
          <FormattedMessage
            id='navigation_bar.followers'
            defaultMessage='Followers'
          />
        </MenuItemLink>

        <MenuItemLink to={`${accountBasePath}/following`} icon={UsersThreeIcon}>
          <FormattedMessage
            id='navigation_bar.following'
            defaultMessage='Following'
          />
        </MenuItemLink>

        <MenuItemLink to='/mutes' icon={BellSlashIcon}>
          <FormattedMessage id='navigation_bar.muted' defaultMessage='Muted' />
        </MenuItemLink>

        <MenuItemLink to='/blocks' icon={ProhibitIcon}>
          <FormattedMessage
            id='navigation_bar.blocked'
            defaultMessage='Blocked'
          />
        </MenuItemLink>
      </MenuItemGroup>

      <MenuItemDivider />

      <MenuItem onClick={confirmLogout} icon={SignOutIcon}>
        <FormattedMessage
          id='navigation_bar.sign_out'
          defaultMessage='Sign Out'
        />
      </MenuItem>
    </>
  );
};
