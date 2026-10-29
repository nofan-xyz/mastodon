import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  apiGetOnThisDay,
  apiGetOnThisDayState,
} from '@/mastodon/api/on_this_day';
import { reducerWithInitialState } from '@/mastodon/reducers';
import type { onThisDay } from '@/mastodon/reducers/slices/on_this_day';
import { resetForDate } from '@/mastodon/reducers/slices/on_this_day';
import { act, cleanup, fireEvent, render, screen } from '@/testing/rendering';

import { OnThisDayController } from './controller';
import { OnThisDayPage } from './page';

vi.mock('@/mastodon/api/on_this_day', () => ({
  apiGetOnThisDayState: vi.fn(),
  apiGetOnThisDay: vi.fn(),
}));

const today = '2026-10-21';
const pendingMessage = /Your memories are still being prepared/;
const emptyMessage = /You left no trace on nofan this day/;
const makeStore = (initial: Partial<ReturnType<typeof onThisDay>> = {}) =>
  configureStore({
    reducer: reducerWithInitialState({
      onThisDay: { date: today, state: 'pending', ...initial },
    }),
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ serializableCheck: false, immutableCheck: false }),
  });
const mount = async (
  store: ReturnType<typeof makeStore>,
  withPolling = false,
) => {
  await act(async () => {
    render(
      <Provider store={store}>
        {withPolling && <OnThisDayController />}
        <OnThisDayPage />
      </Provider>,
    );
    await Promise.resolve();
  });
};
const advance = async (ms: number) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
};

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    },
  );
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-21T01:00:00Z'));
  vi.mocked(apiGetOnThisDayState)
    .mockReset()
    .mockResolvedValue({ state: 'pending', date: today });
  vi.mocked(apiGetOnThisDay).mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('On This Day page waiting and empty states', () => {
  it('shows an empty day immediately without fetching content or returning to a skeleton', async () => {
    await mount(makeStore({ state: 'empty' }), true);
    expect(screen.getByText(emptyMessage)).toBeTruthy();
    await advance(15_000);
    expect(screen.getByText(emptyMessage)).toBeTruthy();
    expect(screen.queryByLabelText('Loading')).toBeNull();
    expect(apiGetOnThisDayState).not.toHaveBeenCalled();
    expect(apiGetOnThisDay).not.toHaveBeenCalled();
  });

  it('replaces a long skeleton with a waiting message while polling continues, then displays an empty result automatically', async () => {
    await mount(makeStore(), true);
    await advance(9_999);
    expect(screen.getByLabelText('Loading')).toBeTruthy();
    expect(screen.queryByText(pendingMessage)).toBeNull();
    await advance(1);
    expect(screen.queryByLabelText('Loading')).toBeNull();
    expect(screen.getByText(pendingMessage)).toBeTruthy();
    expect(screen.queryByText(emptyMessage)).toBeNull();
    expect(apiGetOnThisDayState).toHaveBeenCalledTimes(4);

    vi.mocked(apiGetOnThisDayState).mockResolvedValue({
      state: 'empty',
      date: today,
    });
    await advance(2_000);
    expect(apiGetOnThisDayState).toHaveBeenCalledTimes(5);
    expect(screen.getByText(emptyMessage)).toBeTruthy();
    expect(screen.queryByText(pendingMessage)).toBeNull();
    expect(apiGetOnThisDay).not.toHaveBeenCalled();
  });

  it('allows retrying a delayed generation and renders empty content after deleted memories are filtered', async () => {
    await mount(makeStore());
    await advance(10_000);
    vi.mocked(apiGetOnThisDayState).mockResolvedValue({
      state: 'ready',
      date: today,
    });
    vi.mocked(apiGetOnThisDay).mockResolvedValue({
      date: today,
      data: { years: {} },
      accounts: [],
      statuses: [],
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
      await Promise.resolve();
    });
    expect(apiGetOnThisDayState).toHaveBeenCalledTimes(1);
    expect(apiGetOnThisDay).toHaveBeenCalledTimes(1);
    expect(screen.getByText(emptyMessage)).toBeTruthy();
    expect(screen.queryByText(pendingMessage)).toBeNull();
  });

  it('starts a fresh waiting period when the business date changes', async () => {
    const store = makeStore();
    await mount(store);
    await advance(10_000);
    expect(screen.getByText(pendingMessage)).toBeTruthy();
    await act(async () => {
      vi.setSystemTime(new Date('2026-10-22T01:00:00Z'));
      store.dispatch(resetForDate('2026-10-22'));
      await Promise.resolve();
    });
    expect(screen.getByLabelText('Loading')).toBeTruthy();
    expect(screen.queryByText(pendingMessage)).toBeNull();
    await advance(10_000);
    expect(screen.getByText(pendingMessage)).toBeTruthy();
  });

  it('shows the request error instead of continuing the waiting message and recovers on retry', async () => {
    await mount(makeStore(), true);
    await advance(10_000);
    vi.mocked(apiGetOnThisDayState).mockRejectedValueOnce(new Error('offline'));
    await advance(2_000);
    expect(screen.getByText(/Couldn't find this day's memories/)).toBeTruthy();
    expect(screen.queryByText(pendingMessage)).toBeNull();
    vi.mocked(apiGetOnThisDayState).mockResolvedValue({
      state: 'empty',
      date: today,
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
      await Promise.resolve();
    });
    expect(screen.getByText(emptyMessage)).toBeTruthy();
  });
});
