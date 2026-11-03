import { FormattedMessage } from 'react-intl';

import classNames from 'classnames';
import { Link } from 'react-router-dom';

import { IconLogo } from '@/mastodon/components/logo';
import { customAppIcon, domain, isXUi, title } from '@/mastodon/initial_state';

import { getNavigationSkipLinkId } from '../../ui/components/skip_links';

import classes from './header.module.scss';

export const NavigationHeader: React.FC<{
  siteName?: string;
  isStuck: boolean;
}> = ({ siteName, isStuck }) => {
  return (
    <header className={classes.root} data-stuck={isStuck}>
      <LogoLockup siteName={siteName} />
    </header>
  );
};

export const LogoLockup: React.FC<{
  siteName?: string;
  className?: string;
}> = ({ siteName, className }) => {
  if (isXUi) {
    return (
      <Link
        to='/home'
        className={classNames(classes.xBrand, className)}
        id={getNavigationSkipLinkId()}
        aria-label={siteName ?? title ?? domain ?? 'Mastodon'}
        title={siteName ?? title ?? domain}
      >
        {customAppIcon ? (
          <img src={customAppIcon} alt='' />
        ) : (
          <IconLogo role='presentation' />
        )}
      </Link>
    );
  }

  return (
    <Link
      to='/'
      className={classNames(classes.siteNameLink, className)}
      id={getNavigationSkipLinkId()}
    >
      {customAppIcon && (
        <img src={customAppIcon} alt='' className={classes.appIcon} />
      )}
      <span className={classes.content}>
        <span className={classes.serverName}>
          {siteName ?? title ?? domain}
        </span>
        <span className={classes.poweredBy}>
          <FormattedMessage
            id='navigation_bar.powered_by_mastodon'
            defaultMessage='powered by {logo}Mastodon'
            values={{
              logo: <IconLogo role='presentation' />,
            }}
          />
        </span>
      </span>
    </Link>
  );
};
