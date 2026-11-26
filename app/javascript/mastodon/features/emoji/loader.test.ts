import { loadCacheValue, putCacheValue, putCustomEmojiData } from './database';
import { importCustomEmojiData } from './loader';

vi.mock('./database', () => ({
  loadCacheValue: vi.fn(),
  putCacheValue: vi.fn(),
  putCustomEmojiData: vi.fn(),
}));

describe('personal custom emoji cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadCacheValue).mockResolvedValue('previous');
    vi.mocked(putCustomEmojiData).mockResolvedValue(undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('[]', {
          status: 200,
          headers: { ETag: 'current' },
        }),
      ),
    );
  });

  afterEach(() => vi.unstubAllGlobals());

  it('persists an empty selection so the picker can clear old packs', async () => {
    await expect(importCustomEmojiData()).resolves.toEqual([]);
    expect(putCustomEmojiData).toHaveBeenCalledWith({
      emojis: [],
      clear: true,
    });
    expect(putCacheValue).toHaveBeenCalledWith('custom', 'current');
  });

  it('does not mark a failed database write as cached', async () => {
    vi.mocked(putCustomEmojiData).mockRejectedValueOnce(
      new Error('write failed'),
    );
    await expect(importCustomEmojiData()).rejects.toThrow('write failed');
    expect(putCacheValue).not.toHaveBeenCalled();
  });
});
