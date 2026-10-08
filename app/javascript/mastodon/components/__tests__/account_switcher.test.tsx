import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from '@/testing/rendering';

import { AccountSwitcher } from '../account_switcher';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
  hasDraft: false,
}));

vi.mock('mastodon/api', () => ({
  default: () => ({ get: mocks.get, post: mocks.post, delete: mocks.delete }),
}));
vi.mock('mastodon/initial_state', () => ({ me: '1', autoPlayGif: false }));
vi.mock('mastodon/store', () => ({ useAppSelector: () => mocks.hasDraft }));
vi.mock('mastodon/hooks/useAccount', () => ({
  useAccount: () => ({
    id: '1',
    acct: 'alice',
    username: 'alice',
    display_name: 'Alice',
    avatar: '',
    avatar_static: '',
  }),
}));

describe('AccountSwitcher', () => {
  beforeEach(() => {
    mocks.hasDraft = false;
    mocks.get.mockReset().mockResolvedValue({
      data: {
        current_account_id: '1',
        accounts: [
          {
            id: '1',
            username: 'alice',
            display_name: 'Alice',
            avatar: '/alice.png',
          },
          { id: '2', username: 'bob', display_name: 'Bob', avatar: '/bob.png' },
        ],
      },
    });
    mocks.post.mockReset().mockRejectedValue(new Error('Request failed'));
    mocks.delete.mockReset().mockResolvedValue({});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows the saved accounts and disables the current account', async () => {
    render(<AccountSwitcher />);
    fireEvent.click(screen.getByLabelText('Switch account'));
    const current = await screen.findByRole('button', { name: /Alice/ });
    expect(current.hasAttribute('disabled')).toBe(true);
    expect(
      screen.getByRole('button', { name: /Bob/ }).hasAttribute('disabled'),
    ).toBe(false);
  });

  it('sends the target and current account IDs and displays a failed switch', async () => {
    render(<AccountSwitcher />);
    fireEvent.click(screen.getByLabelText('Switch account'));
    fireEvent.click(await screen.findByRole('button', { name: /Bob/ }));
    await waitFor(() => {
      expect(mocks.post).toHaveBeenCalledWith(
        '/auth/accounts/switch',
        { account_id: '2', current_account_id: '1' },
        { headers: { Accept: 'application/json' } },
      );
    });
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /Bob/ }).hasAttribute('disabled'),
    ).toBe(false);
  });

  it('starts the add-account flow', async () => {
    render(<AccountSwitcher />);
    fireEvent.click(screen.getByLabelText('Switch account'));
    await screen.findByRole('button', { name: /Bob/ });
    fireEvent.click(
      screen.getByRole('button', { name: 'Log in to another account' }),
    );
    await waitFor(() => {
      expect(mocks.post).toHaveBeenCalledWith(
        '/auth/accounts/add',
        { account_id: undefined, current_account_id: '1' },
        { headers: { Accept: 'application/json' } },
      );
    });
  });

  it('keeps a draft when the user cancels switching', async () => {
    mocks.hasDraft = true;
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<AccountSwitcher />);
    fireEvent.click(screen.getByLabelText('Switch account'));
    fireEvent.click(await screen.findByRole('button', { name: /Bob/ }));
    expect(confirm).toHaveBeenCalled();
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('closes the list with Escape and returns focus to the summary', async () => {
    render(<AccountSwitcher />);
    const summary = screen.getByLabelText('Switch account');
    fireEvent.click(summary);
    const target = await screen.findByRole('button', { name: /Bob/ });
    fireEvent.keyDown(target, { key: 'Escape' });
    expect(summary.closest('details')?.open).toBe(false);
    expect(document.activeElement).toBe(summary);
  });

  it('blocks a stale tab and keeps focus on the reload prompt', async () => {
    mocks.get.mockResolvedValue({
      data: { current_account_id: '2', accounts: [] },
    });
    render(<AccountSwitcher />);
    await screen.findByRole('alertdialog');
    const reload = screen.getByRole('button', { name: 'Reload page' });
    expect(document.activeElement).toBe(reload);
    fireEvent.keyDown(reload, { key: 'Tab' });
    expect(document.activeElement).toBe(reload);
    expect(screen.queryByLabelText('Switch account')).toBeNull();
  });

  it('removes a saved account without switching or losing the current draft', async () => {
    mocks.hasDraft = true;
    render(<AccountSwitcher />);
    fireEvent.click(screen.getByLabelText('Switch account'));
    fireEvent.click(await screen.findByRole('button', { name: 'Remove @bob' }));
    await waitFor(() => {
      expect(mocks.delete).toHaveBeenCalledWith('/auth/accounts/2', {
        data: { current_account_id: '1' },
      });
      expect(screen.queryByRole('button', { name: /Bob/ })).toBeNull();
    });
    expect(mocks.post).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Remove @alice' })).toBeNull();
  });

  it('retains the saved account when removal fails', async () => {
    mocks.delete.mockRejectedValue(new Error('Request failed'));
    render(<AccountSwitcher />);
    fireEvent.click(screen.getByLabelText('Switch account'));
    fireEvent.click(await screen.findByRole('button', { name: 'Remove @bob' }));
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: /Bob/ })).toBeTruthy();
  });
});
