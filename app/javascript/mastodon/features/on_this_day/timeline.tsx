import { useCallback } from 'react';
import type { FC } from 'react';

import { useHistory } from 'react-router';

import { useDismissible } from '@/mastodon/hooks/useDismissible';
import { useAppSelector } from '@/mastodon/store';

import { OnThisDayAnnouncement } from './announcement';

export const OnThisDayTimeline: FC = () => {
  const { state, date } = useAppSelector((state) => state.onThisDay);

  const history = useHistory();
  const { wasDismissed, dismiss } = useDismissible('on_this_day_intro');

  const handleShow = useCallback(() => {
    dismiss();
    history.push('/on_this_day');
  }, [dismiss, history]);

  if (
    !date ||
    !state ||
    wasDismissed ||
    state === 'empty' ||
    state === 'disabled'
  ) {
    return null;
  }

  return (
    <OnThisDayAnnouncement
      state={state}
      onShow={handleShow}
      onDismiss={dismiss}
    />
  );
};
