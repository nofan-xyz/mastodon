import { customEmojiFactory } from '@/testing/factories';

import { emojis, loadCustomEmojis } from './emojis';

describe('personal emoji pack selection', () => {
  const receive = (selection: ReturnType<typeof customEmojiFactory>[] | null) =>
    loadCustomEmojis.fulfilled(selection, 'test', undefined);

  it('replaces a cached selection when the selected packs change', () => {
    const before = emojis(
      undefined,
      receive([customEmojiFactory({ shortcode: 'old', category: 'Old pack' })]),
    );
    const after = emojis(
      before,
      receive([customEmojiFactory({ shortcode: 'new', category: 'New pack' })]),
    );
    expect(Object.keys(after.custom)).toEqual(['new']);
    expect(after.customCategories).toEqual({ 'New pack': ['new'] });
  });

  it('clears the picker when the user selects no packs', () => {
    const before = emojis(undefined, receive([customEmojiFactory()]));
    const after = emojis(before, receive([]));
    expect(after.custom).toEqual({});
    expect(after.customCategories).toEqual({});
    expect(after.customLoaded).toBe(true);
  });

  it('keeps the selection when no new cached data is available', () => {
    const before = emojis(undefined, receive([customEmojiFactory()]));
    expect(emojis(before, receive(null))).toEqual(before);
  });
});
