// See app/serializers/rest/custom_emoji_serializer.rb
export interface ApiCustomEmojiJSON {
  shortcode: string;
  static_url: string;
  url: string;
  category?: string;
  category_order?: number;
  featured?: boolean;
  visible_in_picker: boolean;
}
