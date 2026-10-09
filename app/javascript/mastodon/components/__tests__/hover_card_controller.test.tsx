import type { ReactNode } from 'react';

import {
  act,
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
} from '@/testing/rendering';

import { HoverCardController } from '../hover_card_controller';

vi.mock('mastodon/components/hover_card_account', () => ({
  HoverCardAccount: ({ accountId }: { accountId: string }) => (
    <div>Profile {accountId}</div>
  ),
}));
vi.mock('mastodon/components/popover', () => ({
  Popover: ({
    isOpen,
    children,
  }: {
    isOpen: boolean;
    children: (value: { props: object }) => ReactNode;
  }) => (isOpen ? children({ props: {} }) : null),
}));

describe('HoverCardController', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  const hoverProfile = async () => {
    const movement = createEvent.mouseMove(document.body);
    Object.defineProperty(movement, 'movementX', { value: 1 });
    fireEvent(document.body, movement);
    fireEvent.mouseEnter(screen.getByText('Alice'));
    await act(() => vi.advanceTimersByTime(0));
  };

  it('shows the profile after intentional mouse hover', async () => {
    render(
      <>
        <HoverCardController />
        <a href='/@alice' data-hover-card-account='1'>
          Alice
        </a>
      </>,
    );
    await hoverProfile();
    await act(() => vi.advanceTimersByTime(750));
    expect(screen.getByText('Profile 1')).toBeTruthy();
  });

  it('does not show a pending profile after its hover trigger is disabled', async () => {
    render(
      <>
        <HoverCardController />
        <a href='/@alice' data-hover-card-account='1'>
          Alice
        </a>
      </>,
    );
    await hoverProfile();
    screen.getByText('Alice').removeAttribute('data-hover-card-account');
    await act(() => vi.advanceTimersByTime(750));
    expect(screen.queryByText('Profile 1')).toBeNull();
  });

  it('does not open a hover card for touch interaction', async () => {
    render(
      <>
        <HoverCardController />
        <a href='/@alice' data-hover-card-account='1'>
          Alice
        </a>
      </>,
    );
    const profile = screen.getByText('Alice');
    fireEvent.touchStart(profile);
    fireEvent.mouseEnter(profile);
    await act(() => vi.advanceTimersByTime(750));
    expect(screen.queryByText('Profile 1')).toBeNull();
  });
});
