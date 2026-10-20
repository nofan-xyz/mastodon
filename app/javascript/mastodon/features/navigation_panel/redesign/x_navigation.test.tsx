import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import type * as InitialState from '@/mastodon/initial_state';
import { reducerWithInitialState } from '@/mastodon/reducers';
import { act, cleanup, fireEvent, render, screen } from '@/testing/rendering';

import { NavigationLink } from './navigation_link';
import { XNavigationPanel } from './x_navigation';

vi.mock('@/mastodon/initial_state', async (importOriginal) => ({
  ...(await importOriginal<typeof InitialState>()),
  isXUi: true,
}));
vi.mock('@/mastodon/hooks/useAccount', () => ({
  useAccount: () => ({
    id: '123',
    acct: 'alice',
    username: 'alice',
    display_name: 'Alice',
    display_name_html: 'Alice',
    emojis: [],
    locked: false,
  }),
}));
vi.mock('@/mastodon/features/ui/hooks/useBreakpoint', () => ({
  useBreakpoint: () => false,
}));
vi.mock('@/mastodon/api', () => ({
  default: () => ({
    get: () =>
      Promise.resolve({ data: { current_account_id: '123', accounts: [] } }),
  }),
}));

const mount = async (onCompose = vi.fn()) => {
  const store = configureStore({
    reducer: reducerWithInitialState({
      onThisDay: { date: '2026-10-21', state: 'empty' },
    }),
    middleware: (getDefault) =>
      getDefault({ serializableCheck: false, immutableCheck: false }),
  });
  await act(async () => {
    render(
      <Provider store={store}>
        <XNavigationPanel
          mode='static'
          notificationsCount={3}
          onCompose={onCompose}
          topSensor={null}
          bottomSensor={null}
          isScrolledToTop
          exploreLink={<NavigationLink to='/explore'>Explore</NavigationLink>}
          publicFeedLink={
            <NavigationLink to='/public'>Public Feeds</NavigationLink>
          }
          customFeeds={[{ id: '42', title: 'Friends' }]}
          followedHashtags={[{ name: 'cats' }]}
        />
      </Provider>,
    );
    await Promise.resolve();
  });
  return onCompose;
};

beforeEach(() => {
  const style = document.createElement('style');
  style.dataset.popoverTest = 'true';
  style.textContent = '[popover] { display: block !important; }';
  document.head.append(style);
});
afterEach(() => {
  cleanup();
  document.querySelector('[data-popover-test]')?.remove();
});

it('keeps primary routes and unread notifications directly accessible in the vertical navigation', async () => {
  await mount();
  expect(screen.getByRole('link', { name: 'Home' }).getAttribute('href')).toBe(
    '/home',
  );
  expect(
    screen.getByRole('link', { name: /Notifications/ }).textContent,
  ).toContain('3');
  for (const label of ['Messages', 'Saved', 'On This Day', 'Profile'])
    expect(screen.getByRole('link', { name: label })).toBeTruthy();
  expect(
    screen.getByRole('link', { name: 'Profile' }).getAttribute('href'),
  ).toBe('/@alice');
});

it('opens composition through the existing callback instead of adding a persistent editor', async () => {
  const compose = await mount();
  fireEvent.click(screen.getByRole('button', { name: 'New Post' }));
  expect(compose).toHaveBeenCalledOnce();
  expect(screen.queryByRole('textbox')).toBeNull();
});

it('keeps collections, liked posts, custom feeds and followed tags reachable under More', async () => {
  await mount();
  fireEvent.click(screen.getByRole('button', { name: 'More' }));
  for (const label of [
    'Collections',
    'Liked Posts',
    'Settings',
    'Friends',
    '#cats',
    'Create Feed',
  ])
    expect(screen.getByRole('link', { name: label })).toBeTruthy();
  expect(
    screen.getByRole('link', { name: 'Friends' }).getAttribute('href'),
  ).toBe('/lists/42');
  expect(screen.getByRole('link', { name: '#cats' }).getAttribute('href')).toBe(
    '/tags/cats',
  );
});

it('dismisses a submenu before allowing Escape to close the mobile drawer', async () => {
  await mount();
  const outsideKeyUp = vi.fn();
  document.addEventListener('keyup', outsideKeyUp);
  try {
    const trigger = screen.getByRole('button', { name: 'More' });
    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: 'Escape', code: 'Escape' });
    fireEvent.keyUp(trigger, { key: 'Escape', code: 'Escape' });
    expect(outsideKeyUp).not.toHaveBeenCalled();
    fireEvent.keyDown(trigger, { key: 'Escape', code: 'Escape' });
    fireEvent.keyUp(trigger, { key: 'Escape', code: 'Escape' });
    expect(outsideKeyUp).toHaveBeenCalledOnce();
  } finally {
    document.removeEventListener('keyup', outsideKeyUp);
  }
});
