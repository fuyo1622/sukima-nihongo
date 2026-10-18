import { SymbolView, type SymbolViewProps } from 'expo-symbols';

import { useColors } from './theme';

type NameObject = Extract<SymbolViewProps['name'], object>;
type SF = NonNullable<NameObject['ios']>;
type Material = NonNullable<NameObject['web']>;

// SF Symbols on iOS, Material Symbols on Android and the web preview.
const ICONS = {
  home: { sf: 'house.fill', md: 'home' },
  course: { sf: 'books.vertical.fill', md: 'menu_book' },
  review: { sf: 'arrow.triangle.2.circlepath', md: 'replay' },
  me: { sf: 'person.crop.circle.fill', md: 'person' },
  soundOn: { sf: 'speaker.wave.2.fill', md: 'volume_up' },
  soundOff: { sf: 'speaker.slash.fill', md: 'volume_off' },
  close: { sf: 'xmark', md: 'close' },
  correct: { sf: 'checkmark.circle.fill', md: 'check_circle' },
  wrong: { sf: 'xmark.circle.fill', md: 'cancel' },
  next: { sf: 'arrow.right', md: 'arrow_forward' },
  flame: { sf: 'flame.fill', md: 'local_fire_department' },
  bolt: { sf: 'bolt.fill', md: 'bolt' },
  play: { sf: 'play.fill', md: 'play_arrow' },
  headphones: { sf: 'headphones', md: 'headphones' },
  timer: { sf: 'timer', md: 'timer' },
  chevron: { sf: 'chevron.right', md: 'chevron_right' },
  sparkles: { sf: 'sparkles', md: 'auto_awesome' },
  warning: { sf: 'exclamationmark.triangle', md: 'warning' },
  kana: { sf: 'character.ja', md: 'translate' },
  trophy: { sf: 'trophy.fill', md: 'emoji_events' },
  chart: { sf: 'chart.line.uptrend.xyaxis', md: 'trending_up' },
  ear: { sf: 'ear', md: 'hearing' },
  brain: { sf: 'brain.head.profile', md: 'psychology' },
  calendar: { sf: 'calendar', md: 'calendar_month' },
  eye: { sf: 'eye', md: 'visibility' },
  swap: { sf: 'arrow.left.arrow.right', md: 'swap_horiz' },
  restart: { sf: 'arrow.counterclockwise', md: 'restart_alt' },
  book: { sf: 'character.book.closed', md: 'menu_book' },
  lightbulb: { sf: 'lightbulb', md: 'lightbulb' },
  stack: { sf: 'square.stack.3d.up.fill', md: 'stacks' },
  settings: { sf: 'gearshape', md: 'settings' },
} satisfies Record<string, { sf: SF; md: Material }>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color?: string }) {
  const c = useColors();
  const icon = ICONS[name];
  return <SymbolView name={{ ios: icon.sf, android: icon.md, web: icon.md }} size={size} tintColor={color ?? c.text} />;
}
