import type { PayloadAction } from '@reduxjs/toolkit';
import { createSlice } from '@reduxjs/toolkit';

import type { Locale } from 'emojibase';

import type { ApiCustomEmojiJSON } from '@/mastodon/api_types/custom_emoji';
import { toSupportedLocale } from '@/mastodon/features/emoji/locale';
import { createAsyncThunk } from '@/mastodon/store/typed_functions';

interface EmojisState {
  custom: Record<
    string,
    Pick<ApiCustomEmojiJSON, 'url' | 'static_url' | 'featured'>
  >;
  customCategories: Record<string, string[]>; // { name: shortcodes[] }
  customCategoryOrder: Record<string, number>;
  customLoaded: boolean;
  localesLoaded: Locale[];
}

const initialState: EmojisState = {
  custom: {},
  customCategories: {},
  customCategoryOrder: {},
  customLoaded: false,
  localesLoaded: [],
};

const emojisSlice = createSlice({
  name: 'emojis',
  initialState,
  reducers: {
    loadLocale(state, action: PayloadAction<string>) {
      const locale = toSupportedLocale(action.payload);
      if (!state.localesLoaded.includes(locale)) {
        state.localesLoaded.push(locale);
      }
    },
  },
  extraReducers(builder) {
    builder.addAsyncThunk(loadCustomEmojis, {
      fulfilled(state, action) {
        if (!action.payload) {
          return;
        }

        // Replace the previous selection, including when all packs were hidden.
        state.custom = {};
        state.customCategories = {};
        state.customCategoryOrder = {};
        state.customLoaded = true;

        for (const emoji of action.payload) {
          const {
            shortcode,
            category,
            category_order,
            url,
            static_url,
            featured,
          } = emoji;
          state.custom[shortcode] = {
            url,
            static_url,
            featured,
          };

          if (category) {
            if (category_order !== undefined) {
              state.customCategoryOrder[category] = category_order;
            }
            state.customCategories[category] ??= [];
            if (!state.customCategories[category].includes(shortcode)) {
              state.customCategories[category].push(shortcode);
            }
          }
        }
      },
    });
  },
});

export const emojis = emojisSlice.reducer;
export const { loadLocale } = emojisSlice.actions;

export const loadCustomEmojis = createAsyncThunk(
  `${emojisSlice.name}/loadCustomEmojis`,
  async () => {
    const { loadAllCustomEmoji } =
      await import('@/mastodon/features/emoji/database');
    return loadAllCustomEmoji();
  },
);
