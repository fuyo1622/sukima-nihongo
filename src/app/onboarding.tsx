import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Level } from '@/content/types';
import { Footer } from '@/features/session/SessionParts';
import { setStartingLevel } from '@/state/actions';
import { useSettings, type BlockMinutes } from '@/state/settings';
import { Button, Card, Segmented } from '@/ui/controls';
import { Icon, type IconName } from '@/ui/Icon';
import { MAX_WIDTH, radius, space, useColors } from '@/ui/theme';
import { Txt } from '@/ui/Txt';

type Start = Level | 'test';

const STARTS: { value: Start; title: string; detail: string }[] = [
  { value: 'kana', title: '完全沒學過', detail: '從平假名、片假名開始' },
  { value: 'N5', title: '會五十音，剛開始學', detail: '從 N5 基礎單字與文法開始' },
  { value: 'N4', title: '學過一陣子', detail: '大約 N4 程度' },
  { value: 'N3', title: '中級', detail: '大約 N3 程度' },
  { value: 'N2', title: '中高級', detail: '大約 N2 程度' },
  { value: 'N1', title: '高級', detail: '大約 N1 程度' },
  { value: 'test', title: '不確定，幫我測驗', detail: '14 題、約 2 分鐘，不需要聲音' },
];

const FEATURES: { icon: IconName; text: string }[] = [
  { icon: 'timer', text: '1～5 分鐘一小節，隨時中斷、隨時繼續' },
  { icon: 'headphones', text: '戴耳機時聽、在捷運上靜音看，都能學' },
  { icon: 'chart', text: '從五十音到 N1，難度依表現自動調整' },
  { icon: 'book', text: '為中文母語者設計：漢字陷阱、新字體與繁體對照' },
];

function Option({ selected, title, detail, icon, onPress }: { selected: boolean; title: string; detail: string; icon?: IconName; onPress: () => void }) {
  const c = useColors();
  return (
    <Card tone={selected ? 'primary' : 'default'} onPress={onPress} style={[styles.option, selected && { borderColor: c.primary }]} accessibilityLabel={`${title}，${detail}`}>
      {icon && <Icon name={icon} size={24} color={selected ? c.primary : c.textMuted} />}
      <View style={{ flex: 1 }}>
        <Txt variant="heading">{title}</Txt>
        <Txt variant="caption" color="textMuted">
          {detail}
        </Txt>
      </View>
      {selected && <Icon name="correct" size={22} color={c.primary} />}
    </Card>
  );
}

export default function OnboardingScreen() {
  const c = useColors();
  const update = useSettings((s) => s.update);
  const [page, setPage] = useState(0);
  const [start, setStart] = useState<Start>('kana');
  const [sound, setSound] = useState(true);
  const [minutes, setMinutes] = useState<BlockMinutes>(3);

  // Android back goes to the previous onboarding page; on the first page it leaves the app as usual.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (page === 0) return false;
        setPage(page - 1);
        return true;
      });
      return () => sub.remove();
    }, [page]),
  );

  const finish = () => {
    update({ sound, blockMinutes: minutes });
    if (start === 'test') {
      router.replace('/placement');
      return;
    }
    setStartingLevel(start);
    update({ onboarded: true, manualLevel: start });
    router.replace('/');
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }} edges={['top', 'bottom']}>
      <View style={styles.frame}>
        <ScrollView contentContainerStyle={styles.content}>
          {page === 0 && (
            <View style={{ gap: space.xl }}>
              <View style={styles.hero}>
                <View style={[styles.logo, { backgroundColor: c.primary }]}>
                  <Txt lang="ja" size={40} weight="700" style={{ color: c.onPrimary }}>
                    ス
                  </Txt>
                  <View style={[styles.logoDot, { backgroundColor: c.accent }]} />
                </View>
                <Txt lang="ja" variant="display" center>
                  スキマ日語
                </Txt>
                <Txt size={18} color="textMuted" center>
                  零碎時間，一點一點學日語
                </Txt>
              </View>
              <View style={{ gap: space.md }}>
                {FEATURES.map((f) => (
                  <View key={f.text} style={styles.feature}>
                    <View style={[styles.featureIcon, { backgroundColor: c.primarySoft }]}>
                      <Icon name={f.icon} size={20} color={c.primary} />
                    </View>
                    <Txt style={{ flex: 1 }}>{f.text}</Txt>
                  </View>
                ))}
              </View>
            </View>
          )}

          {page === 1 && (
            <View style={{ gap: space.md }}>
              <Txt variant="display">你的日語程度？</Txt>
              <Txt color="textMuted">之後可以隨時在「課程」調整，系統也會依你的表現自動修正。</Txt>
              {STARTS.map((s) => (
                <Option
                  key={s.value}
                  selected={start === s.value}
                  title={s.title}
                  detail={s.detail}
                  icon={s.value === 'test' ? 'chart' : undefined}
                  onPress={() => setStart(s.value)}
                />
              ))}
            </View>
          )}

          {page === 2 && (
            <View style={{ gap: space.md }}>
              <Txt variant="display">你通常怎麼學？</Txt>
              <Txt color="textMuted">學習中隨時可以點右上角切換有聲／靜音。</Txt>
              <Option
                selected={sound}
                icon="headphones"
                title="有聲模式"
                detail="戴耳機或在家：播放發音，會出現聽力題"
                onPress={() => setSound(true)}
              />
              <Option
                selected={!sound}
                icon="soundOff"
                title="靜音模式"
                detail="捷運上、吃飯時：只用看的，讀音用假名顯示"
                onPress={() => setSound(false)}
              />
              <Txt variant="heading" style={{ marginTop: space.md }}>
                一個小節多長？
              </Txt>
              <Segmented<BlockMinutes>
                options={[
                  { label: '1 分鐘', value: 1 },
                  { label: '3 分鐘', value: 3 },
                  { label: '5 分鐘', value: 5 },
                ]}
                value={minutes}
                onChange={setMinutes}
              />
              <Txt variant="caption" color="textMuted">
                大約 1 分鐘 5 題。捷運一站約 2 分鐘，選 1～3 分鐘剛好。
              </Txt>
            </View>
          )}
        </ScrollView>
        <Footer>
          {page > 0 && <Button variant="secondary" label="上一步" onPress={() => setPage(page - 1)} style={{ flex: 1 }} />}
          {page < 2 ? (
            <Button label={page === 0 ? '開始' : '下一步'} iconRight="next" onPress={() => setPage(page + 1)} style={{ flex: 1.6 }} />
          ) : (
            <Button label={start === 'test' ? '開始測驗' : '開始學習'} iconRight="next" onPress={finish} style={{ flex: 1.6 }} />
          )}
        </Footer>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, width: '100%', maxWidth: MAX_WIDTH, alignSelf: 'center' },
  content: { padding: space.xl, paddingBottom: space.xxl },
  hero: { alignItems: 'center', gap: space.sm, paddingTop: space.xxl },
  logo: { width: 88, height: 88, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: space.md },
  logoDot: { position: 'absolute', right: 14, bottom: 14, width: 12, height: 12, borderRadius: 6 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  featureIcon: { width: 40, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  option: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 2 },
});
