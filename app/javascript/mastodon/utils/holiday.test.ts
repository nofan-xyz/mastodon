import { act, cleanup, renderHook } from '@testing-library/react';

import { useHolidayEmoji } from 'mastodon/hooks/useHolidayEmoji';

import { getHolidayEmoji, millisecondsUntilBeijingMidnight } from './holiday';

describe('Beijing holiday markers', () => {
  // Gregorian/lunar dates cross-checked against HKO's 2026 and 2027 calendars.
  it.each([
    ['2026-01-01', '🎉'],
    ['2026-02-17', '🧧'],
    ['2026-02-23', '🎂'],
    ['2026-03-03', '🏮'],
    ['2026-06-19', '🍙'],
    ['2026-08-19', '💫'],
    ['2026-09-25', '🥮'],
    ['2026-10-31', '🎃'],
    ['2026-12-22', '🥟'],
    ['2026-12-24', '🍎'],
    ['2026-12-25', '🎄'],
    ['2027-01-01', '🎉'],
    ['2027-02-06', '🧧'],
    ['2027-02-20', '🏮'],
    ['2027-06-09', '🍙'],
    ['2027-08-08', '💫'],
    ['2027-09-15', '🥮'],
    ['2027-12-22', '🥟'],
    ['2025-12-21', '🥟'],
    ['2026-12-21', null],
    ['2026-11-01', null],
    ['2009-06-27', null], // Leap fifth month: no second Dragon Boat Festival.
    ['2062-02-23', '🎂'], // Anniversary wins when it coincides with Lantern Festival.
  ])('%s displays %s', (date, expected) => {
    expect(getHolidayEmoji(new Date(`${date}T12:00:00+08:00`))).toBe(expected);
  });

  it.each([
    ['2026-10-30T15:59:59.999Z', null],
    ['2026-10-30T16:00:00.000Z', '🎃'],
    ['2026-10-31T15:59:59.999Z', '🎃'],
    ['2026-10-31T16:00:00.000Z', null],
    ['2026-12-24T15:59:59.999Z', '🍎'],
    ['2026-12-24T16:00:00.000Z', '🎄'],
    ['2026-12-25T16:00:00.000Z', null],
  ])('uses Beijing midnight at %s', (date, expected) => {
    expect(getHolidayEmoji(new Date(date))).toBe(expected);
  });

  it('schedules the next Beijing midnight rather than device-local midnight', () => {
    expect(
      millisecondsUntilBeijingMidnight(new Date('2026-10-31T15:59:59.999Z')),
    ).toBe(51);
  });
});

describe('holiday marker lifecycle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('removes Halloween after midnight without reloading', async () => {
    vi.setSystemTime(new Date('2026-10-31T23:59:59+08:00'));
    const { result } = renderHook(useHolidayEmoji);
    expect(result.current).toBe('🎃');
    await act(() => vi.advanceTimersByTime(1050));
    expect(result.current).toBeNull();
  });

  it('switches from Christmas Eve to Christmas in the same open tab', async () => {
    vi.setSystemTime(new Date('2026-12-24T23:59:59+08:00'));
    const { result } = renderHook(useHolidayEmoji);
    await act(() => vi.advanceTimersByTime(1050));
    expect(result.current).toBe('🎄');
  });

  it.each(['focus', 'pageshow'])(
    'refreshes on %s after a sleeping tab returns',
    async (event) => {
      vi.setSystemTime(new Date('2026-10-31T12:00:00+08:00'));
      const { result } = renderHook(useHolidayEmoji);
      vi.setSystemTime(new Date('2026-11-01T12:00:00+08:00'));
      await act(() => window.dispatchEvent(new Event(event)));
      expect(result.current).toBeNull();
    },
  );

  it('refreshes when a background tab becomes visible and cleans up its timer', async () => {
    vi.setSystemTime(new Date('2026-12-24T12:00:00+08:00'));
    const { result, unmount } = renderHook(useHolidayEmoji);
    vi.setSystemTime(new Date('2026-12-25T12:00:00+08:00'));
    await act(() => document.dispatchEvent(new Event('visibilitychange')));
    expect(result.current).toBe('🎄');
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
