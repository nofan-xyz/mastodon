import { useCallback, useState } from 'react';

import { cleanup, fireEvent, render, screen } from '@/testing/rendering';

import { PopoverMenuCard } from '../menu/card';

vi.mock('@/mastodon/features/ui/hooks/useBreakpoint', () => ({
  useBreakpoint: () => true,
}));
vi.mock('@/mastodon/hooks/useScrollSensor', () => ({
  useScrollSensor: () => ({ sensor: null, isInViewport: true }),
}));
vi.mock('@/mastodon/hooks/useBodyScrollLock', () => ({
  useBodyScrollLock: () => undefined,
}));

const Fixture = () => {
  const [open, setOpen] = useState(false);
  const [reference, setReference] = useState<HTMLButtonElement | null>(null);
  const show = useCallback(() => {
    setOpen(true);
  }, []);
  const close = useCallback(() => {
    setOpen(false);
  }, []);
  return (
    <>
      <button type='button' ref={setReference} onClick={show}>
        Switch account
      </button>
      <button type='button'>Outside</button>
      <PopoverMenuCard
        isOpen={open}
        onClose={close}
        reference={reference}
        minWidth={220}
        maxWidth={320}
      >
        <p role='status'>Loading accounts</p>
      </PopoverMenuCard>
    </>
  );
};

const originalDialogMethods = {
  showModal: Object.getOwnPropertyDescriptor(
    HTMLDialogElement.prototype,
    'showModal',
  ),
  close: Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, 'close'),
};

beforeEach(() => {
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: {
      configurable: true,
      value: vi.fn(function (this: HTMLDialogElement) {
        this.open = true;
      }),
    },
    close: {
      configurable: true,
      value: vi.fn(function (this: HTMLDialogElement) {
        this.open = false;
      }),
    },
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  for (const [key, descriptor] of Object.entries(originalDialogMethods)) {
    if (descriptor)
      Object.defineProperty(HTMLDialogElement.prototype, key, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, key);
  }
});

it('keeps the mobile sheet open when its trigger is clicked and omits desktop width props', () => {
  const consoleError = vi.spyOn(console, 'error');
  render(<Fixture />);
  fireEvent.click(screen.getByRole('button', { name: 'Switch account' }));
  const dialog = screen.getByRole('dialog');
  expect(dialog.hasAttribute('minWidth')).toBe(false);
  expect(dialog.hasAttribute('maxWidth')).toBe(false);
  expect(consoleError).not.toHaveBeenCalled();
});

it('closes React state on native Escape cancellation even while account buttons are still loading', () => {
  render(<Fixture />);
  fireEvent.click(screen.getByRole('button', { name: 'Switch account' }));
  const cancel = new Event('cancel', { cancelable: true });
  fireEvent(screen.getByRole('dialog'), cancel);
  expect(cancel.defaultPrevented).toBe(true);
  expect(screen.queryByRole('dialog')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Switch account' }));
  expect(screen.getByRole('dialog')).toBeTruthy();
});

it('dismisses the sheet when clicking outside both the sheet and its trigger', () => {
  render(<Fixture />);
  fireEvent.click(screen.getByRole('button', { name: 'Switch account' }));
  fireEvent.click(screen.getByRole('button', { name: 'Outside' }));
  expect(screen.queryByRole('dialog')).toBeNull();
});
