import type { ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from './Icon';
import { MAX_WIDTH, radius, space, TAB_BAR_SPACE, useColors } from './theme';
import { Txt } from './Txt';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: 'lg' | 'md' | 'sm';
  icon?: IconName;
  iconRight?: IconName;
  sublabel?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({ label, onPress, variant = 'primary', size = 'lg', icon, iconRight, sublabel, disabled, style }: ButtonProps) {
  const c = useColors();
  const tone = {
    primary: { bg: c.primary, fg: c.onPrimary, border: c.primary },
    secondary: { bg: c.surface, fg: c.primary, border: c.border },
    ghost: { bg: 'transparent', fg: c.primary, border: 'transparent' },
    danger: { bg: c.dangerSoft, fg: c.danger, border: c.dangerSoft },
    accent: { bg: c.accent, fg: c.onAccent, border: c.accent },
  }[variant];
  const minHeight = { lg: 56, md: 46, sm: 36 }[size];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={sublabel ? `${label}，${sublabel}` : label}
      onPress={onPress}
      disabled={disabled}
      android_ripple={{ color: variant === 'primary' || variant === 'accent' ? 'rgba(255,255,255,0.25)' : c.primarySoft }}
      style={({ pressed }) => [
        styles.button,
        { minHeight, backgroundColor: tone.bg, borderColor: tone.border, opacity: disabled ? 0.45 : pressed ? 0.82 : 1 },
        pressed && styles.pressed,
        style,
      ]}>
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 20} color={tone.fg} />}
      <View style={styles.buttonText}>
        <Txt variant={size === 'sm' ? 'label' : 'heading'} style={{ color: tone.fg }}>
          {label}
        </Txt>
        {sublabel && (
          <Txt variant="caption" style={{ color: tone.fg, opacity: 0.85 }}>
            {sublabel}
          </Txt>
        )}
      </View>
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 16 : 20} color={tone.fg} />}
    </Pressable>
  );
}

type CardTone = 'default' | 'primary' | 'accent' | 'success' | 'warning';

export function Card({
  children,
  tone = 'default',
  onPress,
  style,
  accessibilityLabel,
}: {
  children: ReactNode;
  tone?: CardTone;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const c = useColors();
  const bg = { default: c.surface, primary: c.primarySoft, accent: c.accentSoft, success: c.successSoft, warning: c.warningSoft }[tone];
  const border = tone === 'default' ? c.border : bg;
  const base = [styles.card, { backgroundColor: bg, borderColor: border }, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [base, pressed && styles.pressed, pressed && { opacity: 0.9 }]}>
      {children}
    </Pressable>
  );
}

export function ProgressBar({ value, color, height = 8 }: { value: number; color?: string; height?: number }) {
  const c = useColors();
  const pct = `${Math.round(Math.min(1, Math.max(0, value)) * 1000) / 10}%` as const;
  return (
    <View style={[styles.track, { height, borderRadius: height / 2, backgroundColor: c.surfaceAlt }]}>
      <View style={{ width: pct, height: '100%', borderRadius: height / 2, backgroundColor: color ?? c.primary }} />
    </View>
  );
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const c = useColors();
  return (
    <View style={[styles.segmented, { backgroundColor: c.surfaceAlt }]} accessibilityRole="radiogroup">
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={String(opt.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(opt.value)}
            style={[styles.segment, selected && { backgroundColor: c.surface, borderColor: c.border }]}>
            <Txt variant="label" color={selected ? 'primary' : 'textMuted'} center>
              {opt.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Section({ title, children, footer }: { title?: string; children: ReactNode; footer?: string }) {
  const c = useColors();
  return (
    <View style={{ gap: space.sm }}>
      {title && (
        <Txt variant="label" color="textMuted" style={{ paddingHorizontal: space.xs }}>
          {title}
        </Txt>
      )}
      <View style={[styles.section, { backgroundColor: c.surface, borderColor: c.border }]}>{children}</View>
      {footer && (
        <Txt variant="caption" color="textMuted" style={{ paddingHorizontal: space.xs }}>
          {footer}
        </Txt>
      )}
    </View>
  );
}

export function SwitchRow({
  label,
  detail,
  value,
  onValueChange,
}: {
  label: string;
  detail?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const c = useColors();
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Txt>{label}</Txt>
        {detail && (
          <Txt variant="caption" color="textMuted">
            {detail}
          </Txt>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: c.primary, false: c.surfaceAlt }}
        accessibilityLabel={label}
      />
    </View>
  );
}

export function Row({
  label,
  detail,
  value,
  onPress,
  destructive,
  children,
}: {
  label: string;
  detail?: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  children?: ReactNode;
}) {
  const c = useColors();
  const content = (
    <>
      <View style={styles.rowText}>
        <Txt color={destructive ? 'danger' : 'text'}>{label}</Txt>
        {detail && (
          <Txt variant="caption" color="textMuted">
            {detail}
          </Txt>
        )}
      </View>
      {value && <Txt color="textMuted">{value}</Txt>}
      {children}
      {onPress && <Icon name="chevron" size={16} color={c.textFaint} />}
    </>
  );
  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
      {content}
    </Pressable>
  );
}

/** Setting row with a segmented control underneath the label. */
export function ChoiceRow<T extends string | number>(props: {
  label: string;
  detail?: string;
  options: { label: string; value: T }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={[styles.row, styles.column]}>
      <View style={styles.rowText}>
        <Txt>{props.label}</Txt>
        {props.detail && (
          <Txt variant="caption" color="textMuted">
            {props.detail}
          </Txt>
        )}
      </View>
      <Segmented options={props.options} value={props.value} onChange={props.onChange} />
    </View>
  );
}

export function Divider() {
  const c = useColors();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.border, marginLeft: space.lg }} />;
}

/** Daily goal as dots: ●●○ */
export function Dots({ value, total }: { value: number; total: number }) {
  const c = useColors();
  return (
    <View style={styles.dots} accessibilityLabel={`${value} / ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.dot, { backgroundColor: i < value ? c.accent : c.surfaceAlt }]} />
      ))}
    </View>
  );
}

export function Pill({ label, tone = 'primary', icon }: { label: string; tone?: 'primary' | 'accent' | 'success' | 'warning' | 'muted'; icon?: IconName }) {
  const c = useColors();
  const colors = {
    primary: [c.primarySoft, c.primary],
    accent: [c.accentSoft, c.accent],
    success: [c.successSoft, c.success],
    warning: [c.warningSoft, c.warning],
    muted: [c.surfaceAlt, c.textMuted],
  }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: colors[0] }]}>
      {icon && <Icon name={icon} size={13} color={colors[1]} />}
      <Txt variant="caption" weight="600" style={{ color: colors[1] }}>
        {label}
      </Txt>
    </View>
  );
}

/**
 * Full-height page for modal routes. iOS presents modals outside the root SafeAreaProvider, where a
 * SafeAreaView never learns the status bar height: the header would sit under the clock and battery,
 * where taps don't reach it. So each modal gets its own provider.
 */
export function ModalScreen({ children }: { children: ReactNode }) {
  const c = useColors();
  return (
    <SafeAreaProvider style={{ flex: 1, backgroundColor: c.bg }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top', 'bottom']}>
        {children}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

/** Scrollable tab screen with a large title. */
export function Screen({ title, subtitle, right, children }: { title?: string; subtitle?: string; right?: ReactNode; children: ReactNode }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  // iOS insets the scroll view automatically. Android's native tabs only inset the bottom (the app draws
  // edge-to-edge), and the web app has no native tabs, so the safe areas are added here; in a desktop
  // browser they are 0.
  const topInset = Platform.OS === 'ios' ? 0 : insets.top;
  const bottomInset = Platform.OS === 'web' ? insets.bottom : 0;
  return (
    // Not flattened, so iOS native tabs still find the ScrollView for insets and scroll-to-top.
    <View collapsable={false} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView
        style={{ flex: 1 }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.screen,
          { paddingTop: space.md + topInset, paddingBottom: TAB_BAR_SPACE + space.xxl + bottomInset },
        ]}>
        <View style={styles.screenInner}>
          {title && (
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Txt variant="display">{title}</Txt>
                {subtitle && <Txt color="textMuted">{subtitle}</Txt>}
              </View>
              {right}
            </View>
          )}
          {children}
        </View>
      </ScrollView>
      {/* Keeps scrolled content from running under the status bar. */}
      {Platform.OS !== 'web' && <View style={[styles.statusBarScrim, { height: insets.top, backgroundColor: c.bg }]} />}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: space.lg + 2,
    paddingVertical: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  buttonText: { alignItems: 'center' },
  pressed: { transform: [{ scale: 0.98 }] },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: space.lg, gap: space.md },
  track: { overflow: 'hidden', width: '100%' },
  segmented: { flexDirection: 'row', borderRadius: radius.sm + 2, padding: 3, gap: 3 },
  segment: {
    flex: 1,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: space.sm,
  },
  section: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 52 },
  column: { flexDirection: 'column', alignItems: 'stretch' },
  rowText: { flex: 1, gap: 2 },
  dots: { flexDirection: 'row', gap: 5 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill },
  screen: { paddingHorizontal: space.lg, alignItems: 'center' },
  statusBarScrim: { position: 'absolute', top: 0, left: 0, right: 0 },
  screenInner: { width: '100%', maxWidth: MAX_WIDTH, gap: space.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingTop: space.sm },
});
