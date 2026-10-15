import { useEffect } from 'react';

import { checkOnThisDay } from '@/mastodon/reducers/slices/on_this_day';
import { useAppDispatch, useAppSelector } from '@/mastodon/store';
import { millisecondsUntilOnThisDayMidnight } from '@/mastodon/utils/on_this_day';

// Mounted once in the signed-in UI, including mobile and advanced layouts.
export const OnThisDayController: React.FC = () => {
  const dispatch = useAppDispatch();
  const { state, stateRequestId, checkedAt, failures, date } = useAppSelector(
    (s) => s.onThisDay,
  );

  useEffect(() => {
    dispatch(checkOnThisDay(false));
    const refresh = () => {
      if (!document.hidden) dispatch(checkOnThisDay(true));
    };
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [dispatch]);

  useEffect(() => {
    const retryDelay = Math.min(3_000 * 2 ** Math.min(failures, 5), 60_000);
    const delay =
      !stateRequestId && (!state || state === 'pending' || failures > 0)
        ? Math.min(retryDelay, millisecondsUntilOnThisDayMidnight())
        : millisecondsUntilOnThisDayMidnight();
    const timer = window.setTimeout(() => {
      if (!document.hidden) dispatch(checkOnThisDay(false));
    }, delay);
    return () => {
      window.clearTimeout(timer);
    };
  }, [dispatch, state, stateRequestId, checkedAt, failures, date]);

  return null;
};
