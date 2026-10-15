import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  apiGetOnThisDay,
  apiGetOnThisDayState,
} from '@/mastodon/api/on_this_day';
import type {
  ApiOnThisDayResponse,
  ApiOnThisDayStateResponse,
} from '@/mastodon/api/on_this_day';
import { OnThisDayController } from '@/mastodon/features/on_this_day/controller';
import { OnThisDayNavItem } from '@/mastodon/features/on_this_day/nav_item';
import { reducerWithInitialState } from '@/mastodon/reducers';
import {
  getOnThisDayDate,
  millisecondsUntilOnThisDayMidnight,
} from '@/mastodon/utils/on_this_day';
import { act, cleanup, render, screen } from '@/testing/rendering';

import type { onThisDay } from './on_this_day';
import {
  checkOnThisDay,
  fetchOnThisDayData,
  fetchOnThisDayState,
  resetForDate,
} from './on_this_day';

vi.mock('@/mastodon/api/on_this_day', () => ({
  apiGetOnThisDayState: vi.fn(),
  apiGetOnThisDay: vi.fn(),
}));

const today = '2026-10-15';
const makeStore = (initial: Partial<ReturnType<typeof onThisDay>> = {}) =>
  configureStore({
    reducer: reducerWithInitialState({
      onThisDay: { date: today, ...initial },
    }),
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ serializableCheck: false, immutableCheck: false }),
  });
const mount = async (store: ReturnType<typeof makeStore>) => {
  await act(async () => {
    render(
      <Provider store={store}>
        <OnThisDayController />
        <OnThisDayNavItem />
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
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((_resolve) => {
    resolve = _resolve;
  });
  return { promise, resolve };
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-15T15:30:00Z'));
  vi.clearAllMocks();
  vi.mocked(apiGetOnThisDayState)
    .mockReset()
    .mockResolvedValue({ state: 'pending', date: today });
  vi.mocked(apiGetOnThisDay).mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('On This Day refresh', () => {
  it('keeps navigation visible and continues beyond one pending poll, then stops when ready', async () => {
    vi.mocked(apiGetOnThisDayState)
      .mockResolvedValueOnce({ state: 'pending', date: today })
      .mockResolvedValueOnce({ state: 'pending', date: today })
      .mockResolvedValueOnce({ state: 'ready', date: today });
    const store = makeStore({ state: 'pending' });
    await mount(store);
    expect(screen.getByRole('link', { name: 'On This Day' })).toBeTruthy();
    expect(apiGetOnThisDayState).toHaveBeenCalledTimes(1);
    await advance(3_000);
    expect(apiGetOnThisDayState).toHaveBeenCalledTimes(2);
    await advance(3_000);
    expect(apiGetOnThisDayState).toHaveBeenCalledTimes(3);
    expect(store.getState().onThisDay.state).toBe('ready');
    await advance(15_000);
    expect(apiGetOnThisDayState).toHaveBeenCalledTimes(3);
  });

  it('retains the empty-day entry but hides an explicitly disabled feature', async () => {
    await mount(makeStore({ state: 'empty' }));
    expect(screen.getByRole('link', { name: 'On This Day' })).toBeTruthy();
    cleanup();
    await mount(makeStore({ state: 'disabled' }));
    expect(screen.queryByRole('link', { name: 'On This Day' })).toBeNull();
    expect(apiGetOnThisDayState).not.toHaveBeenCalled();
  });

  it('clears yesterday data and fetches the new day at Beijing midnight without a reload', async () => {
    vi.setSystemTime(new Date('2026-10-15T15:59:59.500Z'));
    vi.mocked(apiGetOnThisDayState).mockResolvedValue({
      state: 'pending',
      date: '2026-10-16',
    });
    const store = makeStore({
      state: 'ready',
      data: { years: { '2025': ['old'] } },
    });
    await mount(store);
    expect(apiGetOnThisDayState).not.toHaveBeenCalled();
    await advance(500);
    expect(store.getState().onThisDay).toMatchObject({
      state: 'pending',
      date: '2026-10-16',
      data: undefined,
    });
    expect(apiGetOnThisDayState).toHaveBeenCalledTimes(1);
  });

  it('checks the date when returning to a suspended tab and removes listeners on unmount', async () => {
    const store = makeStore({ state: 'empty' });
    await mount(store);
    vi.setSystemTime(new Date('2026-10-16T01:00:00Z'));
    vi.mocked(apiGetOnThisDayState).mockResolvedValue({
      state: 'ready',
      date: '2026-10-16',
    });
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });
    expect(store.getState().onThisDay).toMatchObject({
      state: 'ready',
      date: '2026-10-16',
    });
    cleanup();
    window.dispatchEvent(new Event('focus'));
    expect(apiGetOnThisDayState).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('backs off after a network error and clears the error on success', async () => {
    vi.mocked(apiGetOnThisDayState)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ state: 'empty', date: today });
    const store = makeStore({ state: 'pending' });
    await mount(store);
    expect(store.getState().onThisDay.error).toBe(true);
    await advance(3_000);
    expect(apiGetOnThisDayState).toHaveBeenCalledTimes(1);
    await advance(3_000);
    expect(store.getState().onThisDay).toMatchObject({
      state: 'empty',
      error: false,
      failures: 0,
    });
  });

  it('deduplicates requests while a response is outstanding', async () => {
    const response = deferred<ApiOnThisDayStateResponse>();
    vi.mocked(apiGetOnThisDayState).mockReturnValue(response.promise);
    const store = makeStore({ state: 'pending' });
    const first = store.dispatch(fetchOnThisDayState());
    await store.dispatch(fetchOnThisDayState());
    store.dispatch(checkOnThisDay(true));
    expect(apiGetOnThisDayState).toHaveBeenCalledTimes(1);
    response.resolve({ state: 'ready', date: today });
    await first;
  });

  it('ignores yesterday state arriving after midnight while today is pending', async () => {
    const oldResponse = deferred<ApiOnThisDayStateResponse>();
    vi.setSystemTime(new Date('2026-10-15T15:59:59Z'));
    vi.mocked(apiGetOnThisDayState)
      .mockReturnValueOnce(oldResponse.promise)
      .mockResolvedValue({ state: 'pending', date: '2026-10-16' });
    const store = makeStore({ state: 'pending' });
    await mount(store);
    await advance(1_000);
    expect(apiGetOnThisDayState).toHaveBeenCalledTimes(2);
    await act(async () => {
      oldResponse.resolve({ state: 'ready', date: today });
      await oldResponse.promise;
    });
    expect(store.getState().onThisDay).toMatchObject({
      state: 'pending',
      date: '2026-10-16',
    });
  });

  it('ignores yesterday content after the date changes', async () => {
    const oldResponse = deferred<ApiOnThisDayResponse>();
    vi.mocked(apiGetOnThisDay).mockReturnValue(oldResponse.promise);
    const store = makeStore({ state: 'ready' });
    const request = store.dispatch(fetchOnThisDayData());
    vi.setSystemTime(new Date('2026-10-15T16:00:00Z'));
    store.dispatch(resetForDate('2026-10-16'));
    oldResponse.resolve({
      date: today,
      data: { years: { '2025': ['old'] } },
      accounts: [],
      statuses: [],
    });
    await request;
    expect(store.getState().onThisDay).toMatchObject({
      state: 'pending',
      date: '2026-10-16',
      data: undefined,
    });
  });

  it('handles memories that all disappeared after precomputation as an empty day', async () => {
    vi.mocked(apiGetOnThisDay).mockResolvedValue({
      date: today,
      data: { years: {} },
      accounts: [],
      statuses: [],
    });
    const store = makeStore({ state: 'ready' });
    await store.dispatch(fetchOnThisDayData());
    expect(store.getState().onThisDay).toMatchObject({
      state: 'empty',
      error: false,
      data: { years: {} },
    });
  });

  it('uses Beijing dates across a year boundary regardless of browser timezone', () => {
    const before = Date.parse('2026-12-31T15:59:59.000Z');
    expect(getOnThisDayDate(before)).toBe('2026-12-31');
    expect(millisecondsUntilOnThisDayMidnight(before)).toBe(1_000);
    expect(getOnThisDayDate(before + 1_000)).toBe('2027-01-01');
  });
});
