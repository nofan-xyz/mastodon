import {
  clearComposeSuggestions,
  fetchComposeSuggestions,
  COMPOSE_SUGGESTIONS_READY,
} from './compose';

const { get, emojiSearch } = vi.hoisted(() => ({
  get: vi.fn<
    (url: string, options: { signal: AbortSignal }) => Promise<unknown>
  >(),
  emojiSearch: vi.fn(),
}));
vi.mock('mastodon/api', () => ({ default: () => ({ get }) }));
vi.mock('./importer', () => ({
  importFetchedAccounts: () => ({ type: 'fixture-import' }),
  importFetchedStatus: vi.fn(),
}));
vi.mock('@/mastodon/features/emoji/picker', () => ({
  emojiMartSearch: emojiSearch,
}));

const deferred = <T = { data: unknown[] }>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((_resolve) => {
    resolve = _resolve;
  });
  return { promise, resolve };
};
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe('compose suggestion request lifetime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearComposeSuggestions();
    get.mockReset();
  });
  afterEach(() => {
    clearComposeSuggestions();
    vi.useRealTimers();
  });

  it('does not restore a cleared list when an aborted request still resolves', async () => {
    const request = deferred();
    get.mockReturnValue(request.promise);
    const dispatch =
      vi.fn<(action: { type: string; token?: string }) => void>();
    fetchComposeSuggestions('@alice')(dispatch);
    clearComposeSuggestions();
    request.resolve({ data: [{ id: '1' }] });
    await flush();
    expect(
      dispatch.mock.calls.some(
        ([action]) => action.type === COMPOSE_SUGGESTIONS_READY,
      ),
    ).toBe(false);
  });

  it('cancels a throttled trailing request when the token is cleared', async () => {
    const request = deferred();
    get.mockReturnValue(request.promise);
    const dispatch =
      vi.fn<(action: { type: string; token?: string }) => void>();
    fetchComposeSuggestions('@al')(dispatch);
    fetchComposeSuggestions('@ali')(dispatch);
    clearComposeSuggestions();
    await vi.advanceTimersByTimeAsync(300);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('accepts only the latest request when responses arrive out of order', async () => {
    const oldRequest = deferred(),
      newRequest = deferred();
    get
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(newRequest.promise);
    const dispatch =
      vi.fn<(action: { type: string; token?: string }) => void>();
    fetchComposeSuggestions('@al')(dispatch);
    fetchComposeSuggestions('@alice')(dispatch);
    await vi.advanceTimersByTimeAsync(200);
    newRequest.resolve({ data: [{ id: 'new' }] });
    await flush();
    oldRequest.resolve({ data: [{ id: 'old' }] });
    await flush();
    const ready = dispatch.mock.calls
      .map(([action]) => action)
      .filter((action) => action.type === COMPOSE_SUGGESTIONS_READY);
    expect(ready).toHaveLength(1);
    expect(ready[0]?.token).toBe('@alice');
  });

  it('keeps a newer request abortable after an older request finishes', async () => {
    const oldRequest = deferred(),
      newRequest = deferred();
    get
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(newRequest.promise);
    const dispatch =
      vi.fn<(action: { type: string; token?: string }) => void>();
    fetchComposeSuggestions('@al')(dispatch);
    fetchComposeSuggestions('@alice')(dispatch);
    await vi.advanceTimersByTimeAsync(200);
    oldRequest.resolve({ data: [] });
    await flush();
    const signal = get.mock.calls[1]?.[1]?.signal as AbortSignal;
    clearComposeSuggestions();
    expect(signal.aborted).toBe(true);
  });
  it('ignores a stale hashtag response after dismissal', async () => {
    const request = deferred<{ data: { hashtags: unknown[] } }>();
    get.mockReturnValue(request.promise);
    const dispatch =
      vi.fn<(action: { type: string; token?: string }) => void>();
    fetchComposeSuggestions('#topic')(dispatch);
    clearComposeSuggestions();
    request.resolve({ data: { hashtags: [] } });
    await flush();
    expect(
      dispatch.mock.calls.some(
        ([action]) => action.type === COMPOSE_SUGGESTIONS_READY,
      ),
    ).toBe(false);
  });

  it('ignores an emoji search that resolves after dismissal', async () => {
    const request = deferred<unknown[]>();
    emojiSearch.mockReturnValue(request.promise);
    const dispatch =
      vi.fn<(action: { type: string; token?: string }) => void>();
    fetchComposeSuggestions(':smile')(dispatch);
    clearComposeSuggestions();
    request.resolve([]);
    await flush();
    expect(
      dispatch.mock.calls.some(
        ([action]) => action.type === COMPOSE_SUGGESTIONS_READY,
      ),
    ).toBe(false);
  });
});
