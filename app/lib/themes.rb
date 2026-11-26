# frozen_string_literal: true

class Themes
  include Singleton

  THEME_COLORS = {
    dark: '#181820',
    light: '#ffffff',
  }.freeze

  def initialize
    @conf = YAML.load_file(Rails.root.join('config', 'themes.yml'))
    @flavours = {}

    Rails.root.glob('app/javascript/flavours/*/theme.yml') do |pathname|
      data = YAML.load_file(pathname)
      next unless data['pack_directory']

      dir = pathname.dirname
      name = dir.basename.to_s
      locales = []
      screenshots = []

      if data['locales']
        Dir.glob(File.join(dir, data['locales'], '*.{js,json}')) do |locale|
          locale_name = File.basename(locale, File.extname(locale))
          locales.push(locale_name) unless /defaultMessages|whitelist|index/.match?(locale_name)
        end
      end

      if data['screenshot']
        if data['screenshot'].is_a? Array
          screenshots = data['screenshot'].map(&:to_s)
        else
          screenshots.push(data['screenshot'].to_s)
        end
      end

      data['name'] = name
      data['locales'] = locales
      data['screenshot'] = screenshots
      data['skins'] = []
      @flavours[name] = data
    end

    Rails.root.glob('app/javascript/skins/*/*') do |pathname|
      ext = pathname.extname.to_s
      skin = pathname.basename.to_s
      name = pathname.dirname.basename.to_s
      next unless @flavours[name]

      if pathname.directory?
        @flavours[name]['skins'] << skin if pathname.glob('{common,index,application}.{css,scss}').any?
      elsif /^\.s?css$/i.match?(ext)
        @flavours[name]['skins'] << pathname.basename(ext).to_s
      end
    end
  end

  # Flavours without an explicit skin preference list their skins
  # alphabetically; these flavours pin their primary variant first.
  PRIMARY_SKIN = {
    'bird-ui' => 'mastodon-bird-ui-auto',
    'tangerine-ui' => 'tangerine',
  }.freeze

  DEFAULT_FLAVOUR = 'mastodon-ui'

  def flavour(name)
    @flavours[name]
  end

  def flavours
    names = @flavours.keys.sort
    names.delete(DEFAULT_FLAVOUR) ? [DEFAULT_FLAVOUR, *names] : names
  end

  def skins_for(name)
    skins = (@flavours.dig(name, 'skins') || []).sort
    primary = PRIMARY_SKIN[name]

    primary && skins.delete(primary) ? [primary, *skins] : skins
  end

  # Keep saved preferences readable after merging the two Fanfou skins.
  def canonical_skin(flavour, skin)
    flavour == 'mastodon-ui' && skin == 'space_fanfou' ? 'fanfou_classic' : skin
  end

  def all_skins
    @flavours.values.flat_map { |data| data['skins'] }.uniq.sort
  end

  def flavours_and_skins
    flavours.map do |flavour|
      [flavour, skins_for(flavour).map { |skin| [flavour, skin] }]
    end
  end

  def names
    @conf.keys
  end

  def available_theme_colors(theme)
    theme = theme.last if theme.is_a?(Array)
    return [] unless @conf[theme].is_a?(Hash) && @conf[theme]['colors'].present?

    @conf[theme]['colors']
  end
end
