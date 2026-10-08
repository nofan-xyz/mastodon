import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { defineMessages, useIntl } from 'react-intl';

import { List as ImmutableList } from 'immutable';

import CloseIcon from '@/material-icons/400-24px/close.svg?react';
import api from 'mastodon/api';
import { useAccount } from 'mastodon/hooks/useAccount';
import { me } from 'mastodon/initial_state';
import { useAppSelector } from 'mastodon/store';
import { accountSwitchNavigation } from 'mastodon/utils/account_switch';

import { Avatar } from './avatar';

import './account_switcher.scss';

const messages = defineMessages({
  switch: { id: 'account_switcher.switch', defaultMessage: 'Switch account' },
  add: {
    id: 'account_switcher.add',
    defaultMessage: 'Log in to another account',
  },
  current: {
    id: 'account_switcher.current',
    defaultMessage: 'Current account',
  },
  loading: { id: 'account_switcher.loading', defaultMessage: 'Loading…' },
  error: {
    id: 'account_switcher.error',
    defaultMessage: 'Unable to switch accounts. Please refresh and try again.',
  },
  draft: {
    id: 'account_switcher.draft',
    defaultMessage: 'Switch accounts? Your unpublished draft will be lost.',
  },
  changed: {
    id: 'account_switcher.changed',
    defaultMessage:
      'The active account changed in another tab. Reload this page before continuing.',
  },
  reload: { id: 'account_switcher.reload', defaultMessage: 'Reload page' },
  remove: {
    id: 'account_switcher.remove',
    defaultMessage: 'Remove @{username}',
  },
  removeError: {
    id: 'account_switcher.remove_error',
    defaultMessage: 'Unable to remove this saved account. Please try again.',
  },
});

interface SavedAccount {
  id: string;
  username: string;
  display_name: string;
  avatar: string;
}

interface AccountList {
  current_account_id: string | null;
  accounts: SavedAccount[];
}

// Only a change notification is shared between tabs, never login credentials.
const changeKey = 'mastodon:account-changed';

export const AccountSwitcher: React.FC<{ size?: number }> = ({ size = 46 }) => {
  const intl = useIntl();
  const account = useAccount(me);
  const details = useRef<HTMLDetailsElement>(null);
  const [accounts, setAccounts] = useState<SavedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<'switch' | 'remove' | null>(null);
  const [stale, setStale] = useState(false);
  const hasDraft = useAppSelector((state) => {
    const text = state.compose.get('text');
    const attachments = state.compose.get('media_attachments');
    return (
      (typeof text === 'string' && !!text.trim()) ||
      (ImmutableList.isList(attachments) && attachments.size > 0) ||
      state.compose.get('poll') != null ||
      state.compose.get('quoted_status_id') != null
    );
  });

  useEffect(() => {
    const refresh = () => {
      void api(false)
        .get<AccountList>('/auth/accounts')
        .then(({ data }) => {
          if (data.current_account_id !== me) {
            setStale(true);
            return;
          }
          setAccounts(data.accounts);
          setLoading(false);
        })
        .catch(() => {
          setError('switch');
          setLoading(false);
        });
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === changeKey) refresh();
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (details.current && !details.current.contains(event.target as Node)) {
        details.current.open = false;
      }
    };
    refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', handleStorage);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, []);

  const changeAccount = useCallback(
    async (target?: string) => {
      if (
        busy ||
        (hasDraft && !window.confirm(intl.formatMessage(messages.draft)))
      )
        return;
      setBusy(true);
      setError(null);
      try {
        const { data } = await api(false).post<{ redirect_to: string }>(
          target ? '/auth/accounts/switch' : '/auth/accounts/add',
          { account_id: target, current_account_id: me },
          { headers: { Accept: 'application/json' } },
        );
        try {
          localStorage.setItem(changeKey, target ?? 'signed-out');
          localStorage.removeItem(changeKey);
        } catch {
          // Other tabs also check the active account when focused.
        }
        accountSwitchNavigation.pending = true;
        window.location.assign(data.redirect_to);
      } catch {
        setError('switch');
        setBusy(false);
      }
    },
    [busy, hasDraft, intl],
  );

  const handleSwitch = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      void changeAccount(event.currentTarget.dataset.accountId);
    },
    [changeAccount],
  );

  const handleAdd = useCallback(() => {
    void changeAccount();
  }, [changeAccount]);

  const removeAccount = useCallback(
    async (id?: string) => {
      if (busy || !id) return;
      setBusy(true);
      setError(null);
      try {
        await api(false).delete(`/auth/accounts/${id}`, {
          data: { current_account_id: me },
        });
        setAccounts((saved) => saved.filter((item) => item.id !== id));
        details.current?.querySelector('summary')?.focus();
        try {
          localStorage.setItem(changeKey, 'removed');
          localStorage.removeItem(changeKey);
        } catch {
          // The account list is also refreshed when another tab gains focus.
        }
      } catch {
        setError('remove');
      } finally {
        setBusy(false);
      }
    },
    [busy],
  );

  const handleRemove = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      void removeAccount(event.currentTarget.dataset.accountId);
    },
    [removeAccount],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key === 'Escape' && details.current) {
        details.current.open = false;
        details.current.querySelector('summary')?.focus();
      }
    },
    [],
  );

  if (!account) return null;

  if (stale) {
    return <AccountChangedNotice />;
  }

  return (
    <details
      className='account-switcher account account--minimal account--without-border'
      ref={details}
    >
      <summary
        className='account__display-name'
        aria-label={intl.formatMessage(messages.switch)}
        onKeyDown={handleKeyDown}
      >
        <Avatar account={account} size={size} />
        <span className='display-name'>
          <strong className='display-name__html'>
            {account.display_name || account.username}
          </strong>
          <span className='display-name__account'>@{account.acct}</span>
        </span>
        <span aria-hidden>▾</span>
      </summary>
      <div className='account-switcher__menu' aria-busy={busy}>
        {loading && <p role='status'>{intl.formatMessage(messages.loading)}</p>}
        {accounts.map((saved) => (
          <div className='account-switcher__row' key={saved.id}>
            <button
              className='account-switcher__select'
              data-account-id={saved.id}
              type='button'
              disabled={busy || saved.id === me}
              onClick={handleSwitch}
              onKeyDown={handleKeyDown}
            >
              <img src={saved.avatar} width={28} height={28} alt='' />
              <span className='account-switcher__name'>
                <strong>{saved.display_name}</strong>
                <span>@{saved.username}</span>
              </span>
              {saved.id === me && (
                <span aria-label={intl.formatMessage(messages.current)}>✓</span>
              )}
            </button>
            {saved.id !== me && (
              <button
                className='account-switcher__remove'
                data-account-id={saved.id}
                type='button'
                disabled={busy}
                aria-label={intl.formatMessage(messages.remove, {
                  username: saved.username,
                })}
                title={intl.formatMessage(messages.remove, {
                  username: saved.username,
                })}
                onClick={handleRemove}
                onKeyDown={handleKeyDown}
              >
                <CloseIcon
                  className='account-switcher__remove-icon'
                  aria-hidden
                />
              </button>
            )}
          </div>
        ))}
        <button
          type='button'
          disabled={busy || loading}
          onClick={handleAdd}
          onKeyDown={handleKeyDown}
        >
          {intl.formatMessage(messages.add)}
        </button>
        {error && (
          <p role='alert'>
            {intl.formatMessage(
              error === 'remove' ? messages.removeError : messages.error,
            )}
          </p>
        )}
      </div>
    </details>
  );
};

const AccountChangedNotice: React.FC = () => {
  const intl = useIntl();
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    button.current?.focus();
  }, []);
  const handleReload = useCallback(() => {
    window.location.reload();
  }, []);
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (event.key === 'Tab') {
        event.preventDefault();
        button.current?.focus();
      }
    },
    [],
  );

  return createPortal(
    <div className='account-switcher__changed'>
      <div
        role='alertdialog'
        aria-modal='true'
        aria-label={intl.formatMessage(messages.changed)}
      >
        <p>{intl.formatMessage(messages.changed)}</p>
        <button
          className='button'
          type='button'
          ref={button}
          onClick={handleReload}
          onKeyDown={handleKeyDown}
        >
          {intl.formatMessage(messages.reload)}
        </button>
      </div>
    </div>,
    document.body,
  );
};
