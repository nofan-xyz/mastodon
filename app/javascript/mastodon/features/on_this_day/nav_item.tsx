import { FormattedMessage } from 'react-intl';

import classNames from 'classnames';
import { Link, useLocation } from 'react-router-dom';

import { ClockCounterClockwiseIcon } from '@phosphor-icons/react';

import { Icon } from '@/mastodon/components/icon';
import { NavigationLink } from '@/mastodon/features/navigation_panel/redesign/navigation_link';
import { useAppSelector } from '@/mastodon/store';
import HistoryIcon from '@/material-icons/400-24px/history.svg?react';

export const OnThisDayNavItem: React.FC<{ redesigned?: boolean }> = ({
  redesigned = false,
}) => {
  const { state } = useAppSelector((state) => state.onThisDay);
  const location = useLocation();
  const active = location.pathname.startsWith('/on_this_day');

  if (!state || state === 'disabled') {
    return null;
  }

  if (redesigned) {
    return (
      <NavigationLink
        to='/on_this_day'
        iconComponent={ClockCounterClockwiseIcon}
      >
        <FormattedMessage
          id='on_this_day.nav_item.title'
          defaultMessage='On This Day'
        />
      </NavigationLink>
    );
  }

  return (
    <Link
      to='/on_this_day'
      className={classNames('column-link column-link--transparent', { active })}
    >
      <Icon
        id='history'
        icon={HistoryIcon}
        className='column-link__icon'
        width='24'
        height='24'
      />
      <span>
        <FormattedMessage
          id='on_this_day.nav_item.title'
          defaultMessage='On This Day'
        />
      </span>
    </Link>
  );
};
