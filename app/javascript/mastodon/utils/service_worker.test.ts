import { prepareServiceWorker } from './service_worker';

describe('prepareServiceWorker', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test('bypasses the script HTTP cache and waits until the replacement activates', async () => {
    const worker = Object.assign(new EventTarget(), { state: 'installing' });
    const register = vi.fn().mockResolvedValue({ installing: worker });
    vi.stubGlobal('navigator', { serviceWorker: { register } });
    let ready = false;
    const promise = prepareServiceWorker('/sw.js?version=release-2').then(
      () => {
        ready = true;
      },
    );
    await Promise.resolve();
    expect(ready).toBe(false);
    worker.state = 'activated';
    worker.dispatchEvent(new Event('statechange'));
    await promise;
    expect(register).toHaveBeenCalledWith('/sw.js?version=release-2', {
      scope: '/',
      type: 'module',
      updateViaCache: 'none',
    });
    expect(ready).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  test('does not block the app indefinitely when installation stalls', async () => {
    const worker = Object.assign(new EventTarget(), { state: 'installing' });
    vi.stubGlobal('navigator', {
      serviceWorker: {
        register: vi.fn().mockResolvedValue({ installing: worker }),
      },
    });
    const promise = prepareServiceWorker('/sw.js?version=release-2');
    await vi.advanceTimersByTimeAsync(5000);
    await expect(promise).resolves.toBeUndefined();
  });

  test('keeps the app available if service worker registration fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('navigator', {
      serviceWorker: {
        register: vi.fn().mockRejectedValue(new Error('offline')),
      },
    });
    await expect(
      prepareServiceWorker('/sw.js?version=release-2'),
    ).resolves.toBeUndefined();
  });
});
