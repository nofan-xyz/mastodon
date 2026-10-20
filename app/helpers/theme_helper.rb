# frozen_string_literal: true

module ThemeHelper
  def javascript_inline_tag(path)
    entry = InlineScriptManager.instance.file(path)

    # Only add hash if we don't allow arbitrary includes already, otherwise it's going
    # to break the React Tools browser extension or other inline scripts
    unless Rails.env.development? && request.content_security_policy.dup.script_src.include?("'unsafe-inline'")
      request.content_security_policy = request.content_security_policy.clone.tap do |policy|
        values = policy.script_src
        values << "'sha256-#{entry[:digest]}'"
        policy.script_src(*values)
      end
    end

    content_tag(:script, entry[:contents], type: 'text/javascript')
  end

  def flavoured_vite_typescript_tag(pack_name, flavour: nil, **)
    prefix = Themes.instance.flavour(flavour || current_flavour)
      &.fetch('pack_directory', nil)
      &.delete_prefix('app/javascript/')

    vite_typescript_tag(prefix ? "#{prefix}/#{pack_name}" : pack_name, **)
  end

  def theme_style_tags(flavour_and_skin)
    flavour, skin = flavour_and_skin
    skin = Themes.instance.canonical_skin(flavour, skin)

    vite_stylesheet_tag "skins/#{flavour}/#{skin}", type: :virtual, media: 'all', crossorigin: 'anonymous'
  end

  def available_theme_colors(theme)
    Themes.instance.available_theme_colors(theme)
  end

  def flavour_theme_colors
    Themes.instance.flavours_and_skins.flat_map(&:last).to_h do |pair|
      colors = available_theme_colors(pair).index_with { |color| I18n.t("color_theme.#{color}", default: color) }
      [pair.join('/'), colors]
    end
  end

  def theme_color_tags(color_scheme)
    case color_scheme
    when 'auto'
      ''.html_safe.tap do |tags|
        tags << tag.meta(name: 'theme-color', content: Themes::THEME_COLORS[:dark], media: '(prefers-color-scheme: dark)')
        tags << tag.meta(name: 'theme-color', content: Themes::THEME_COLORS[:light], media: '(prefers-color-scheme: light)')
      end
    when 'light'
      tag.meta name: 'theme-color', content: Themes::THEME_COLORS[:light]
    when 'dark'
      tag.meta name: 'theme-color', content: Themes::THEME_COLORS[:dark]
    end
  end

  def custom_stylesheet
    return if active_custom_stylesheet.blank?

    stylesheet_link_tag(
      custom_css_path(active_custom_stylesheet),
      host: root_url,
      media: :all,
      skip_pipeline: true
    )
  end

  def current_flavour
    [current_user&.setting_flavour, Setting.flavour, 'mastodon-ui'].find { |flavour| Themes.instance.flavours.include?(flavour) }
  end

  def current_skin
    skins = Themes.instance.skins_for(current_flavour)
    [current_user&.setting_skin, Setting.skin, 'default']
      .map { |skin| Themes.instance.canonical_skin(current_flavour, skin) }
      .find { |skin| skins.include?(skin) }
  end

  def current_theme
    [current_flavour, current_skin]
  end

  def color_scheme
    current_user&.setting_color_scheme || 'auto'
  end

  def contrast
    current_user&.setting_contrast || 'auto'
  end

  def density
    current_user&.setting_density || 'default'
  end

  def theme_color(theme)
    available_colors = available_theme_colors(theme)
    return if available_colors.empty?

    user_color = current_user&.setting_theme_color
    return user_color if user_color && available_colors.include?(user_color)

    # TODO: server setting

    available_colors.first
  end

  def page_color_scheme
    content_for(:force_color_scheme).presence || color_scheme
  end

  def page_theme_color(theme)
    content_for(:force_theme_color).presence || theme_color(theme)
  end

  private

  def active_custom_stylesheet
    return if cached_custom_css_digest.blank?

    [:custom, cached_custom_css_digest.to_s.first(8)]
      .compact_blank
      .join('-')
  end

  def cached_custom_css_digest
    Rails.cache.fetch(:setting_digest_custom_css) do
      Setting.custom_css&.then { |content| Digest::SHA256.hexdigest(content) }
    end
  end
end
