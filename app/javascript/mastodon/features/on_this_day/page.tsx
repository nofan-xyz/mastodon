import { useCallback, useEffect, useMemo } from 'react';
import type { CSSProperties, FC } from 'react';

import { FormattedMessage, useIntl } from 'react-intl';

import { useHistory } from 'react-router';

import { Helmet } from '@unhead/react/helmet';

import { Button } from '@/mastodon/components/button';
import { Column } from '@/mastodon/components/column';
import { ColumnHeader } from '@/mastodon/components/column_header';
import { Icon } from '@/mastodon/components/icon';
import { Status } from '@/mastodon/components/status';
import { openNewComposer } from '@/mastodon/reducers/slices/composer';
import {
  fetchOnThisDayData,
  fetchOnThisDayState,
} from '@/mastodon/reducers/slices/on_this_day';
import { useAppDispatch, useAppSelector } from '@/mastodon/store';
import HistoryIcon from '@/material-icons/400-24px/history.svg?react';

import styles from './page.module.scss';

const skeletonRows = [0, 1, 2];

export const OnThisDayPage: FC = () => {
  const intl = useIntl();
  const history = useHistory();
  const dispatch = useAppDispatch();
  const { state, date, data, error } = useAppSelector((s) => s.onThisDay);

  // Fetch full data when state becomes ready
  useEffect(() => {
    if (!data && !error && state === 'ready') {
      void dispatch(fetchOnThisDayData());
    }
  }, [dispatch, data, state, error]);

  const years = useMemo(() => {
    if (!data?.years) return [];
    return Object.keys(data.years).sort((a, b) => Number(b) - Number(a));
  }, [data]);

  const totalCount = useMemo(() => {
    if (!data?.years) return 0;
    return Object.values(data.years).reduce(
      (sum, statusIds) => sum + statusIds.length,
      0,
    );
  }, [data]);

  const formattedDate = useMemo(() => {
    if (!date) return null;
    // Parse as local noon to avoid timezone boundary issues with ISO dates
    return intl.formatDate(new Date(`${date}T12:00:00`), {
      month: 'long',
      day: 'numeric',
    });
  }, [date, intl]);

  const isLoading =
    !data && !error && state !== 'empty' && state !== 'disabled';

  const showError = error && !data;

  const showDisabled = state === 'disabled' && !data && !error;

  const handleRetry = useCallback(() => {
    void dispatch(fetchOnThisDayState()).then((action) => {
      if (
        fetchOnThisDayState.fulfilled.match(action) &&
        action.payload.state === 'ready'
      ) {
        void dispatch(fetchOnThisDayData());
      }
    });
  }, [dispatch]);

  const handleEnable = useCallback(() => {
    history.push('/settings/preferences');
  }, [history]);

  const handleWrite = useCallback(() => {
    history.push('/home');
    dispatch(openNewComposer({}));
  }, [dispatch, history]);

  const pageTitle = intl.formatMessage({
    id: 'on_this_day.page.title',
    defaultMessage: 'On This Day',
  });

  return (
    <Column>
      <ColumnHeader title={pageTitle} withBackButton='auto' />

      {isLoading ? (
        <div className={styles.wrapper} role='status' aria-label='Loading'>
          <div className={styles.skeletonHeader} />
          <div className={styles.skeletonSummary} />
          {skeletonRows.map((row) => (
            <div key={row} className={styles.skeletonRow}>
              <div className={styles.skeletonDivider} />
              <div className={styles.skeletonCard} />
              <div className={styles.skeletonCard} />
            </div>
          ))}
        </div>
      ) : showError ? (
        <div className={styles.wrapper}>
          <Helmet>
            <title>{pageTitle}</title>
          </Helmet>
          <div className={styles.emptyState}>
            <Icon
              id='history'
              icon={HistoryIcon}
              className={styles.emptyIcon}
            />
            <h1 className={styles.heading}>
              <FormattedMessage
                id='on_this_day.page.heading'
                defaultMessage='On This Day'
              />
            </h1>
            <p className={styles.emptyMessage}>
              <FormattedMessage
                id='on_this_day.page.error'
                defaultMessage="Couldn't find this day's memories. Try again?"
              />
            </p>
            <div className={styles.emptyAction}>
              <Button
                text={intl.formatMessage({
                  id: 'on_this_day.page.retry',
                  defaultMessage: 'Retry',
                })}
                onClick={handleRetry}
              />
            </div>
          </div>
        </div>
      ) : showDisabled ? (
        <div className={styles.wrapper}>
          <Helmet>
            <title>{pageTitle}</title>
          </Helmet>
          <div className={styles.emptyState}>
            <Icon
              id='history'
              icon={HistoryIcon}
              className={styles.emptyIcon}
            />
            <h1 className={styles.heading}>
              <FormattedMessage
                id='on_this_day.page.heading'
                defaultMessage='On This Day'
              />
            </h1>
            <p className={styles.emptyMessage}>
              <FormattedMessage
                id='on_this_day.page.disabled'
                defaultMessage="On This Day isn't on yet. Once enabled, you'll be reminded of this day's posts every year."
              />
            </p>
            <div className={styles.emptyAction}>
              <Button
                text={intl.formatMessage({
                  id: 'on_this_day.page.enable',
                  defaultMessage: 'Enable in preferences',
                })}
                onClick={handleEnable}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.wrapper}>
          <Helmet>
            <title>{pageTitle}</title>
          </Helmet>

          <header className={styles.hero}>
            {formattedDate ? (
              <h1 className={styles.heroDate}>{formattedDate}</h1>
            ) : (
              <h1 className={styles.heroDate}>
                <FormattedMessage
                  id='on_this_day.page.heading'
                  defaultMessage='On This Day'
                />
              </h1>
            )}
            {totalCount > 0 && (
              <p className={styles.heroSummary}>
                <FormattedMessage
                  id='on_this_day.page.summary'
                  defaultMessage='On this day, you left {count, plural, one {# memory} other {# memories}} on <brand>Mastodon</brand>'
                  values={{
                    count: totalCount,
                    brand: (chunks) => <span translate='no'>{chunks}</span>,
                  }}
                />
              </p>
            )}
          </header>

          {years.length === 0 ? (
            <div className={styles.emptyState}>
              <p className={styles.emptyMessage}>
                <FormattedMessage
                  id='on_this_day.page.empty'
                  defaultMessage='You left no trace on nofan this day. Why not write something now?'
                />
              </p>
              <div className={styles.emptyAction}>
                <Button
                  text={intl.formatMessage({
                    id: 'on_this_day.page.write',
                    defaultMessage: 'Post something',
                  })}
                  onClick={handleWrite}
                />
              </div>
            </div>
          ) : (
            years.map((year, index) => (
              <section
                key={year}
                className={styles.yearSection}
                style={{ '--reveal-delay': `${index * 60}ms` } as CSSProperties}
              >
                <h2 className={styles.yearDivider}>{year}</h2>
                <div className={styles.statusList}>
                  {data?.years[year]?.map((statusId) => (
                    <Status key={statusId} id={statusId} showActions />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      )}
    </Column>
  );
};

// eslint-disable-next-line import/no-default-export -- Used by async components.
export default OnThisDayPage;
