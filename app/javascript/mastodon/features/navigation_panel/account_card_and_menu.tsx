import { FormattedMessage } from 'react-intl';

import { CaretDownIcon, DotsThreeIcon } from '@phosphor-icons/react';

import { AccountSwitcher } from '@/mastodon/components/account_switcher';
import type { AccountSwitcherHeaderProps } from '@/mastodon/components/account_switcher';
import { Avatar } from '@/mastodon/components/avatar';
import { IconButton } from '@/mastodon/components/button';
import { DisplayName } from '@/mastodon/components/display_name';
import { useAccountHandle } from '@/mastodon/components/display_name/default';
import { LockupLink, LockupWrapper } from '@/mastodon/components/lockup';
import { Menu, MenuList, MenuTrigger } from '@/mastodon/components/menu';
import { useAccount } from '@/mastodon/hooks/useAccount';
import { useIdentity } from '@/mastodon/identity_context';

import classes from './account_card_and_menu.module.scss';
import { AccountMenuItems } from './account_menu_items';

export { AccountMenuItems } from './account_menu_items';

export const NavigationAccountCardAndMenu: React.FC = () => (
  <AccountSwitcher header={NavigationAccountCard} />
);

const NavigationAccountCard: React.FC<AccountSwitcherHeaderProps> = ({
  profileProps,
  toggleProps,
}) => {
  const { accountId } = useIdentity();
  const account = useAccount(accountId);
  const handle = useAccountHandle(account);

  if (!accountId) return null;

  return (
    <LockupWrapper
      icon={<Avatar account={account} size={32} />}
      sideContent={
        <>
          <IconButton
            {...toggleProps}
            icon={CaretDownIcon}
            size='sm'
            variant='ghost'
            className={classes.switchButton}
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
              variant='ghost'
            >
              <FormattedMessage
                id='tabs_bar.account_settings'
                defaultMessage='Account settings'
              />
            </MenuTrigger>
            <MenuList
              placement='top'
              offset={12}
              strategy='fixed'
              minWidth={220}
            >
              <AccountMenuItems />
            </MenuList>
          </Menu>
        </>
      }
      className={classes.root}
    >
      <LockupLink
        {...profileProps}
        subtitle={handle}
        className={classes.accountLink}
      >
        <DisplayName variant='simple' account={account} />
      </LockupLink>
    </LockupWrapper>
  );
};
