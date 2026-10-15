import { FormattedMessage } from 'react-intl';

import classNames from 'classnames';
import { Link, useLocation } from 'react-router-dom';

import { Icon } from '@/mastodon/components/icon';
import { useAppSelector } from '@/mastodon/store';
import HistoryIcon from '@/material-icons/400-24px/history.svg?react';

export const OnThisDayNavItem: React.FC = () => {
  const { state } = useAppSelector((state) => state.onThisDay);
  const location = useLocation();
  const active = location.pathname.startsWith('/on_this_day');

  if (!state || state === 'disabled') {
    return null;
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
