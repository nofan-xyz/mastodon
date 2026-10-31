import { useEffect, useState } from 'react';

import {
  getHolidayEmoji,
  millisecondsUntilBeijingMidnight,
} from 'mastodon/utils/holiday';

export function useHolidayEmoji() {
  const [emoji, setEmoji] = useState(() => getHolidayEmoji(new Date()));

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const refresh = () => {
      clearTimeout(timer);
      const now = new Date();
      setEmoji(getHolidayEmoji(now));
      timer = setTimeout(refresh, millisecondsUntilBeijingMidnight(now));
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  return emoji;
}
