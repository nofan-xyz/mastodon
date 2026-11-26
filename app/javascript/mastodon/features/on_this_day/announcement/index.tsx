import { FormattedMessage } from 'react-intl';

import type { ApiOnThisDayState } from '@/mastodon/api/on_this_day';
import { Button } from '@/mastodon/components/button';

import styles from './styles.module.scss';

export interface OnThisDayAnnouncementProps {
  state: Exclude<ApiOnThisDayState, 'empty'>;
  onShow: () => void;
  onDismiss: () => void;
}

export const OnThisDayAnnouncement: React.FC<OnThisDayAnnouncementProps> = ({
  state,
  onShow,
  onDismiss,
}) => (
  <div className={styles.wrapper} role='status' aria-live='polite'>
    <span className={styles.newBadge}>
      <FormattedMessage
        id='on_this_day.announcement.badge'
        defaultMessage='New'
      />
    </span>
    <h2>
      <FormattedMessage
        id='on_this_day.announcement.title'
        defaultMessage='On This Day'
      />
    </h2>
    <p>
      <FormattedMessage
        id='on_this_day.announcement.description'
        defaultMessage='Look back at your posts from this day in previous years. Accessible anytime from the sidebar.'
      />
    </p>
    {state === 'ready' ? (
      <Button onClick={onShow}>
        <FormattedMessage
          id='on_this_day.announcement.action_view'
          defaultMessage='View memories'
        />
      </Button>
    ) : (
      <Button disabled>
        <FormattedMessage
          id='on_this_day.announcement.action_loading'
          defaultMessage='Loading…'
        />
      </Button>
    )}
    <Button onClick={onDismiss} variant='ghost' className={styles.closeButton}>
      <FormattedMessage
        id='on_this_day.announcement.action_dismiss'
        defaultMessage='Dismiss'
      />
    </Button>
  </div>
);
