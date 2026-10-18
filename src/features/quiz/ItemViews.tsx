import * as WebBrowser from 'expo-web-browser';
import { Pressable, StyleSheet, View } from 'react-native';

import { speak } from '@/audio/speech';
import { KANA_ITEMS } from '@/content';
import { rubyBase, toHiragana, toKatakana } from '@/content/text';
import { POS_LABEL, type Example, type ExampleSource, type Item } from '@/content/types';
import { speechFor } from '@/engine/exercises';
import { LEVEL_INFO } from '@/engine/levels';
import { useSettings } from '@/state/settings';
import { Card, Pill } from '@/ui/controls';
import { Icon } from '@/ui/Icon';
import { Ruby } from '@/ui/Ruby';
import { radius, space, useColors } from '@/ui/theme';
import { Txt } from '@/ui/Txt';

/** まな.ぶ → まな(ぶ) */
export function kunDisplay(kun: string): string {
  const [stem, okurigana] = kun.split('.');
  return okurigana ? `${stem}(${okurigana})` : stem;
}

/** Small speaker button; hidden in silent mode. */
export function SpeakButton({ text, size = 20 }: { text: string; size?: number }) {
  const c = useColors();
  const { sound, speechRate } = useSettings((s) => s.settings);
  if (!sound || !text) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="播放發音"
      hitSlop={10}
      onPress={() => void speak(text, speechRate)}
      style={({ pressed }) => [styles.speak, { backgroundColor: c.primarySoft, opacity: pressed ? 0.6 : 1 }]}>
      <Icon name="soundOn" size={size} color={c.primary} />
    </Pressable>
  );
}

function ExampleBlock({ example, furigana }: { example: Example; furigana: boolean }) {
  return (
    <Card tone="default" style={{ gap: space.sm }}>
      <View style={styles.rowTop}>
        <View style={{ flex: 1 }}>
          <Ruby text={example.ja} size={18} showRuby={furigana} />
        </View>
        <SpeakButton text={rubyBase(example.ja)} size={16} />
      </View>
      <Txt color="textMuted">{example.zh}</Txt>
      {example.source && <SourceCredit source={example.source} />}
    </Card>
  );
}

/** Credit for a Tatoeba sentence (its license, CC BY 2.0 FR, asks for the author); opens the sentence page. */
function SourceCredit({ source }: { source: ExampleSource }) {
  const translator = source.zhAuthor && source.zhAuthor !== source.author ? ` · 中譯 ${source.zhAuthor}` : '';
  const label = `例句：Tatoeba${source.author ? ` · ${source.author}` : ''}${translator}`;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${label}。開啟 Tatoeba 網頁`}
      hitSlop={8}
      onPress={() => void WebBrowser.openBrowserAsync(`https://tatoeba.org/sentences/show/${source.id}`)}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, alignSelf: 'flex-start' })}>
      <Txt variant="caption" color="textMuted">
        {label}
      </Txt>
    </Pressable>
  );
}

function Note({ text }: { text: string }) {
  return (
    <Card tone="warning" style={styles.note}>
      <Icon name="lightbulb" size={18} />
      <Txt style={{ flex: 1 }}>{text}</Txt>
    </Card>
  );
}

/** Teaching card shown the first time an item appears (教學卡). */
export function ItemIntro({ item }: { item: Item }) {
  const c = useColors();
  const furigana = useSettings((s) => s.settings.furigana);
  const level = LEVEL_INFO[item.level].label;

  switch (item.type) {
    case 'kana': {
      const other = item.script === 'hiragana' ? toKatakana(item.kana) : toHiragana(item.kana);
      const otherExists = KANA_ITEMS.some((k) => k.kana === other);
      return (
        <View style={styles.stack}>
          <Pill label={`新假名 · ${item.script === 'hiragana' ? '平假名' : '片假名'}`} icon="sparkles" />
          <View style={styles.hero}>
            <Txt lang="ja" size={112} weight="500">
              {item.kana}
            </Txt>
            <View style={styles.row}>
              <Txt lang="latin" size={32} weight="700" color="primary">
                {item.romaji}
              </Txt>
              <SpeakButton text={item.kana} />
            </View>
          </View>
          {item.origin && (
            <Card>
              <Txt variant="label" color="textMuted">
                字源
              </Txt>
              <Txt size={20}>
                「{item.origin}」→ <Txt lang="ja" size={20}>{item.kana}</Txt>
              </Txt>
              <Txt variant="caption" color="textMuted">
                假名是從漢字演變而來的，記住字源更容易聯想。
              </Txt>
            </Card>
          )}
          {otherExists && (
            <Txt color="textMuted">
              {item.script === 'hiragana' ? '片假名' : '平假名'}寫作「<Txt lang="ja">{other}</Txt>」
            </Txt>
          )}
          {item.note && <Note text={item.note} />}
        </View>
      );
    }
    case 'vocab':
    case 'trap':
      return (
        <View style={styles.stack}>
          {item.type === 'trap' ? (
            <Pill label={`漢字陷阱 · ${level}`} tone="accent" icon="warning" />
          ) : (
            <Pill label={`新單字 · ${level} · ${POS_LABEL[item.pos]}`} icon="sparkles" />
          )}
          <View style={styles.hero}>
            <Ruby text={item.ruby} size={44} showRuby center />
            <View style={styles.row}>
              {item.word !== item.reading && (
                <Txt lang="ja" size={18} color="textMuted">
                  {item.reading}
                </Txt>
              )}
              <SpeakButton text={speechFor(item)} />
            </View>
          </View>
          {item.type === 'trap' ? (
            <View style={{ gap: space.sm }}>
              <Card tone="accent" style={styles.note}>
                <Icon name="wrong" size={20} color={c.danger} />
                <View style={{ flex: 1 }}>
                  <Txt variant="caption" color="textMuted">
                    中文直覺（錯）
                  </Txt>
                  <Txt size={18}>{item.trap}</Txt>
                </View>
              </Card>
              <Card tone="success" style={styles.note}>
                <Icon name="correct" size={20} color={c.success} />
                <View style={{ flex: 1 }}>
                  <Txt variant="caption" color="textMuted">
                    日文的意思
                  </Txt>
                  <Txt size={22} weight="700">
                    {item.meaning}
                  </Txt>
                </View>
              </Card>
            </View>
          ) : (
            <Txt size={24} weight="700" center>
              {item.meaning}
            </Txt>
          )}
          {item.type === 'vocab' && item.note && <Note text={item.note} />}
          {item.example && <ExampleBlock example={item.example} furigana={furigana} />}
        </View>
      );
    case 'kanji':
      return (
        <View style={styles.stack}>
          <Pill label={`新漢字 · ${level}`} icon="sparkles" />
          <View style={styles.kanjiHero}>
            <View style={[styles.kanjiBox, { borderColor: c.border, backgroundColor: c.surface }]}>
              <Txt lang="ja" size={88} weight="500" style={{ lineHeight: 104 }}>
                {item.kanji}
              </Txt>
              <Txt variant="caption" color="textMuted">
                日文
              </Txt>
            </View>
            {item.trad ? (
              <View style={[styles.kanjiBox, { borderColor: c.accent, backgroundColor: c.accentSoft }]}>
                <Txt lang="zh" size={88} weight="500" style={{ lineHeight: 104 }}>
                  {item.trad}
                </Txt>
                <Txt variant="caption" color="accent" weight="600">
                  繁體
                </Txt>
              </View>
            ) : (
              <Pill label="和繁體字相同" tone="success" icon="correct" />
            )}
          </View>
          <Txt size={22} weight="700" center>
            {item.meaning}
          </Txt>
          <Card>
            {item.on.length > 0 && (
              <View style={styles.readingRow}>
                <Txt variant="label" color="textMuted" style={styles.readingLabel}>
                  音讀
                </Txt>
                <Txt lang="ja" size={18} style={{ flex: 1 }}>
                  {item.on.join('・')}
                </Txt>
              </View>
            )}
            {item.kun.length > 0 && (
              <View style={styles.readingRow}>
                <Txt variant="label" color="textMuted" style={styles.readingLabel}>
                  訓讀
                </Txt>
                <Txt lang="ja" size={18} style={{ flex: 1 }}>
                  {item.kun.map(kunDisplay).join('・')}
                </Txt>
              </View>
            )}
          </Card>
          {item.words.length > 0 && (
            <Card style={{ gap: space.sm }}>
              <Txt variant="label" color="textMuted">
                例詞
              </Txt>
              {item.words.map((w) => (
                <View key={w.word} style={styles.wordRow}>
                  <Txt lang="ja" size={20} weight="600">
                    {w.word}
                  </Txt>
                  <Txt lang="ja" color="textMuted">
                    {w.reading}
                  </Txt>
                  <Txt style={{ flex: 1 }} color="textMuted">
                    {w.meaning}
                  </Txt>
                  <SpeakButton text={w.reading} size={16} />
                </View>
              ))}
            </Card>
          )}
          {item.note && <Note text={item.note} />}
        </View>
      );
    case 'grammar':
      return (
        <View style={styles.stack}>
          <Pill label={`新文法 · ${level}`} icon="sparkles" />
          <View style={[styles.hero, { gap: space.sm }]}>
            <Txt lang="ja" size={30} weight="700" center>
              {item.pattern}
            </Txt>
            <Txt size={20} color="primary" weight="600" center>
              {item.meaning}
            </Txt>
          </View>
          {item.form && (
            <Card tone="primary" style={{ gap: 2 }}>
              <Txt variant="caption" color="textMuted">
                接續
              </Txt>
              <Txt lang="ja">{item.form}</Txt>
            </Card>
          )}
          <Txt>{item.explain}</Txt>
          {item.examples.map((ex) => (
            <ExampleBlock key={ex.ja} example={ex} furigana={furigana} />
          ))}
        </View>
      );
  }
}

/** Compact answer card shown after a question (答案卡). */
export function ItemSummary({ item, quizIndex }: { item: Item; quizIndex?: number }) {
  const { furigana } = useSettings((s) => s.settings);
  switch (item.type) {
    case 'kana':
      return (
        <View style={styles.summaryRow}>
          <Txt lang="ja" size={40}>
            {item.kana}
          </Txt>
          <Txt lang="latin" size={24} weight="700" color="primary" style={{ flex: 1 }}>
            {item.romaji}
          </Txt>
          <SpeakButton text={item.kana} />
        </View>
      );
    case 'vocab':
    case 'trap':
      return (
        <View style={{ gap: space.xs }}>
          <View style={styles.summaryRow}>
            <View style={{ flex: 1 }}>
              <Ruby text={item.ruby} size={26} showRuby />
            </View>
            <SpeakButton text={speechFor(item)} />
          </View>
          <Txt size={18} weight="600">
            {item.meaning}
          </Txt>
          {item.type === 'trap' && (
            <Txt variant="caption" color="textMuted">
              不是「{item.trap}」喔！
            </Txt>
          )}
        </View>
      );
    case 'kanji':
      return (
        <View style={styles.summaryRow}>
          <Txt lang="ja" size={44}>
            {item.kanji}
          </Txt>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt weight="600">
              {item.meaning}
              {item.trad ? `（繁體：${item.trad}）` : ''}
            </Txt>
            <Txt lang="ja" color="textMuted">
              {[...item.on, ...item.kun.map(kunDisplay)].join('・')}
            </Txt>
          </View>
          <SpeakButton text={speechFor(item)} />
        </View>
      );
    case 'grammar': {
      const quiz = item.quizzes[quizIndex ?? 0];
      return (
        <View style={{ gap: space.sm }}>
          <Txt lang="ja" size={20} weight="700">
            {item.pattern}
            <Txt color="primary" size={16} weight="600">
              {'  '}
              {item.meaning}
            </Txt>
          </Txt>
          {quiz && (
            <View style={{ gap: 2 }}>
              <View style={styles.rowTop}>
                <View style={{ flex: 1 }}>
                  <Ruby text={quiz.ja} fill={quiz.answer} size={18} showRuby={furigana} />
                </View>
                <SpeakButton text={rubyBase(quiz.ja).replace('＿＿', quiz.answer)} size={16} />
              </View>
              {quiz.zh && <Txt color="textMuted">{quiz.zh}</Txt>}
            </View>
          )}
        </View>
      );
    }
  }
}

const styles = StyleSheet.create({
  stack: { gap: space.lg },
  hero: { alignItems: 'center', gap: space.xs, paddingVertical: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rowTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  speak: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  note: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  kanjiHero: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space.lg },
  kanjiBox: { alignItems: 'center', borderWidth: 1, borderRadius: radius.lg, paddingHorizontal: space.xl, paddingBottom: space.sm },
  readingRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.md },
  readingLabel: { width: 36 },
  wordRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
});
