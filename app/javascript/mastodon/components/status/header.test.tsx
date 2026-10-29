import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import type * as InitialState from '@/mastodon/initial_state';
import { reducerWithInitialState } from '@/mastodon/reducers';
import { accountFactoryState } from '@/testing/factories';
import { cleanup, render, screen } from '@/testing/rendering';

import { StatusRedesignHeader } from './header';

const mode = vi.hoisted(() => ({ xUi: false }));
vi.mock('@/mastodon/initial_state', async (importOriginal) => ({
  ...(await importOriginal<typeof InitialState>()),
  get isXUi() {
    return mode.xUi;
  },
}));

afterEach(() => {
  cleanup();
});

it.each(
  [false, true].flatMap((xUi) =>
    (['public', 'private', 'direct'] as const).map((visibility) => ({
      xUi,
      visibility,
    })),
  ),
)(
  'keeps the profile, visibility and timestamp accessible for $visibility when X UI is $xUi',
  ({ xUi, visibility }) => {
    mode.xUi = xUi;
    const account = {
      ...accountFactoryState(),
      id: '123',
      acct: 'alice',
      username: 'alice',
      display_name: 'Alice',
      display_name_html: 'Alice',
    };
    const store = configureStore({
      reducer: reducerWithInitialState(),
      middleware: (getDefault) =>
        getDefault({ serializableCheck: false, immutableCheck: false }),
    });
    render(
      <Provider store={store}>
        <StatusRedesignHeader
          status={{
            id: '456',
            account,
            created_at: '2026-10-20T03:00:00Z',
            visibility,
            mentions:
              visibility === 'direct'
                ? [{ id: '999', acct: 'bob', username: 'bob', url: '' }]
                : [],
          }}
        />
      </Provider>,
    );
    const name = screen.getByRole('link', { name: 'Alice' });
    const handle = screen.getByText('@alice');
    expect(name.getAttribute('href')).toBe('/@alice');
    expect(name.getAttribute('aria-describedby')).toBe(handle.id);
    expect(name.closest('p') === handle.closest('p')).toBe(
      xUi && visibility === 'public',
    );
    expect(screen.getByRole('time')).toBeTruthy();
    if (visibility === 'private')
      expect(screen.getByText(/to Followers/)).toBeTruthy();
    if (visibility === 'direct')
      expect(screen.getByText(/to You/)).toBeTruthy();
  },
);
