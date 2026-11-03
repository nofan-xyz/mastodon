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
  const renderComposer = () =>
    render(
      <>
        <HoverCardController />
        <a href='/@alice' data-hover-card-account='1'>
          Alice
        </a>
        <form role='dialog'>
          <textarea aria-label='Draft' />
          <div role='textbox' contentEditable aria-label='Rich draft' />
        </form>
      </>,
    );

  it('cancels a pending card when the composer receives focus', async () => {
    renderComposer();
    await hoverProfile();
    act(() => {
      screen.getByLabelText('Draft').focus();
    });
    await act(() => vi.advanceTimersByTime(900));
    expect(screen.queryByText('Profile 1')).toBeNull();
  });

  it('closes an existing card when the composer receives focus', async () => {
    renderComposer();
    await hoverProfile();
    await act(() => vi.advanceTimersByTime(750));
    expect(screen.getByText('Profile 1')).toBeTruthy();
    act(() => {
      screen.getByLabelText('Draft').focus();
    });
    expect(screen.queryByText('Profile 1')).toBeNull();
  });

  it('does not open a profile over an already focused composer', async () => {
    renderComposer();
    act(() => {
      screen.getByLabelText('Draft').focus();
    });
    await hoverProfile();
    fireEvent.input(screen.getByLabelText('Draft'));
    await act(() => vi.advanceTimersByTime(900));
    expect(screen.queryByText('Profile 1')).toBeNull();
  });

  it('cancels a pending profile on IME composition in a rich editor', async () => {
    renderComposer();
    await hoverProfile();
    fireEvent.compositionStart(screen.getByLabelText('Rich draft'));
    await act(() => vi.advanceTimersByTime(900));
    expect(screen.queryByText('Profile 1')).toBeNull();
  });

  it('preserves profile hover when an unrelated search field is focused', async () => {
    render(
      <>
        <HoverCardController />
        <input aria-label='Search' />
        <a href='/@alice' data-hover-card-account='1'>
          Alice
        </a>
      </>,
    );
    act(() => {
      screen.getByLabelText('Search').focus();
    });
    await hoverProfile();
    await act(() => vi.advanceTimersByTime(750));
    expect(screen.getByText('Profile 1')).toBeTruthy();
  });
});
