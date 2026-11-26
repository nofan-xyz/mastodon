import type { ApiCustomEmojiJSON } from '@/mastodon/api_types/custom_emoji';
import { emojis, loadCustomEmojis } from '@/mastodon/reducers/slices/emojis';

import { selectPickerData } from './picker';

const row = (
  shortcode: string,
  category: string,
  category_order?: number,
  featured = false,
): ApiCustomEmojiJSON => ({
  shortcode,
  category,
  category_order,
  featured,
  url: `https://example.com/${shortcode}.gif`,
  static_url: `https://example.com/${shortcode}.png`,
  visible_in_picker: true,
});

const load = (rows: ApiCustomEmojiJSON[]) =>
  loadCustomEmojis.fulfilled(
    rows.map((emoji) => ({ ...emoji, tokens: [emoji.shortcode] })),
    'picker-test',
    undefined,
    {},
  );

const picker = (state: ReturnType<typeof emojis>) =>
  selectPickerData.resultFunc(
    state.custom,
    state.customCategories,
    state.customCategoryOrder,
  );

const customCategories = (state: ReturnType<typeof emojis>) =>
  picker(state).categories.filter((name) => name.startsWith('custom-'));

describe('personal emoji pack navigation', () => {
  it('keeps the saved pack order when labels have no numbers', () => {
    // IndexedDB returns rows by shortcode, independently of the saved pack order.
    const state = emojis(
      undefined,
      load([row('aaa', 'Alpha', 1), row('zzz', 'Zebra', 0)]),
    );
    expect(customCategories(state)).toEqual(['custom-Zebra', 'custom-Alpha']);
  });

  it('uses the same order with numbered labels and translated names', () => {
    const state = emojis(
      undefined,
      load([row('aaa', '02. 阿尔法', 1), row('zzz', '01. 斑马', 0)]),
    );
    expect(customCategories(state)).toEqual([
      'custom-01. 斑马',
      'custom-02. 阿尔法',
    ]);
  });

  it('replaces hidden packs and applies a newly saved order on reload', () => {
    const before = emojis(
      undefined,
      load([
        row('aaa', 'Alpha', 0),
        row('bbb', 'Beta', 1),
        row('zzz', 'Zebra', 2),
      ]),
    );
    const after = emojis(
      before,
      load([row('aaa', 'Alpha', 1), row('zzz', 'Zebra', 0)]),
    );
    expect(customCategories(after)).toEqual(['custom-Zebra', 'custom-Alpha']);
    expect(picker(after).emojis.map((emoji) => emoji.id)).not.toContain('bbb');
  });

  it('clears custom navigation after hiding all packs, retaining standard categories', () => {
    const before = emojis(undefined, load([row('aaa', 'Alpha', 0)]));
    const after = emojis(before, load([]));
    expect(customCategories(after)).toEqual([]);
    expect(picker(after).emojis).toEqual([]);
    expect(picker(after).categories).toEqual([
      'recent',
      'custom',
      'people',
      'nature',
      'foods',
      'activity',
      'places',
      'objects',
      'symbols',
      'flags',
    ]);
    expect(after.customLoaded).toBe(true);
  });

  it('preserves featured covers and static thumbnail URLs', () => {
    const result = picker(
      emojis(undefined, load([row('cover', 'Alpha', 0, true)])),
    );
    expect(result.emojis[0]).toMatchObject({
      featured: true,
      staticImageUrl: 'https://example.com/cover.png',
    });
  });

  it('keeps the existing lexical fallback for old cached API responses', () => {
    const state = emojis(
      undefined,
      load([row('zzz', 'Zebra'), row('aaa', 'Alpha')]),
    );
    expect(customCategories(state)).toEqual(['custom-Alpha', 'custom-Zebra']);
  });
});
