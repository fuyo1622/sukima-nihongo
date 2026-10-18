import { toKatakana } from './text';
import type { KanaItem } from './types';

type Entry = [kana: string, romaji: string];

const BASIC: Entry[] = [
  ['あ', 'a'], ['い', 'i'], ['う', 'u'], ['え', 'e'], ['お', 'o'],
  ['か', 'ka'], ['き', 'ki'], ['く', 'ku'], ['け', 'ke'], ['こ', 'ko'],
  ['さ', 'sa'], ['し', 'shi'], ['す', 'su'], ['せ', 'se'], ['そ', 'so'],
  ['た', 'ta'], ['ち', 'chi'], ['つ', 'tsu'], ['て', 'te'], ['と', 'to'],
  ['な', 'na'], ['に', 'ni'], ['ぬ', 'nu'], ['ね', 'ne'], ['の', 'no'],
  ['は', 'ha'], ['ひ', 'hi'], ['ふ', 'fu'], ['へ', 'he'], ['ほ', 'ho'],
  ['ま', 'ma'], ['み', 'mi'], ['む', 'mu'], ['め', 'me'], ['も', 'mo'],
  ['や', 'ya'], ['ゆ', 'yu'], ['よ', 'yo'],
  ['ら', 'ra'], ['り', 'ri'], ['る', 'ru'], ['れ', 're'], ['ろ', 'ro'],
  ['わ', 'wa'], ['を', 'wo'], ['ん', 'n'],
];

const DAKUTEN: Entry[] = [
  ['が', 'ga'], ['ぎ', 'gi'], ['ぐ', 'gu'], ['げ', 'ge'], ['ご', 'go'],
  ['ざ', 'za'], ['じ', 'ji'], ['ず', 'zu'], ['ぜ', 'ze'], ['ぞ', 'zo'],
  ['だ', 'da'], ['ぢ', 'ji'], ['づ', 'zu'], ['で', 'de'], ['ど', 'do'],
  ['ば', 'ba'], ['び', 'bi'], ['ぶ', 'bu'], ['べ', 'be'], ['ぼ', 'bo'],
];

const HANDAKUTEN: Entry[] = [
  ['ぱ', 'pa'], ['ぴ', 'pi'], ['ぷ', 'pu'], ['ぺ', 'pe'], ['ぽ', 'po'],
];

const YOON: Entry[] = [
  ['きゃ', 'kya'], ['きゅ', 'kyu'], ['きょ', 'kyo'],
  ['しゃ', 'sha'], ['しゅ', 'shu'], ['しょ', 'sho'],
  ['ちゃ', 'cha'], ['ちゅ', 'chu'], ['ちょ', 'cho'],
  ['にゃ', 'nya'], ['にゅ', 'nyu'], ['にょ', 'nyo'],
  ['ひゃ', 'hya'], ['ひゅ', 'hyu'], ['ひょ', 'hyo'],
  ['みゃ', 'mya'], ['みゅ', 'myu'], ['みょ', 'myo'],
  ['りゃ', 'rya'], ['りゅ', 'ryu'], ['りょ', 'ryo'],
  ['ぎゃ', 'gya'], ['ぎゅ', 'gyu'], ['ぎょ', 'gyo'],
  ['じゃ', 'ja'], ['じゅ', 'ju'], ['じょ', 'jo'],
  ['びゃ', 'bya'], ['びゅ', 'byu'], ['びょ', 'byo'],
  ['ぴゃ', 'pya'], ['ぴゅ', 'pyu'], ['ぴょ', 'pyo'],
];

/** 字源: the kanji each kana was derived from. Traditional forms in brackets where they differ. */
const HIRAGANA_ORIGIN: Record<string, string> = {
  あ: '安', い: '以', う: '宇', え: '衣', お: '於',
  か: '加', き: '幾', く: '久', け: '計', こ: '己',
  さ: '左', し: '之', す: '寸', せ: '世', そ: '曽（曾）',
  た: '太', ち: '知', つ: '川', て: '天', と: '止',
  な: '奈', に: '仁', ぬ: '奴', ね: '祢（禰）', の: '乃',
  は: '波', ひ: '比', ふ: '不', へ: '部', ほ: '保',
  ま: '末', み: '美', む: '武', め: '女', も: '毛',
  や: '也', ゆ: '由', よ: '与（與）',
  ら: '良', り: '利', る: '留', れ: '礼（禮）', ろ: '呂',
  わ: '和', を: '遠', ん: '无（無）',
};

const KATAKANA_ORIGIN: Record<string, string> = {
  ア: '阿', イ: '伊', ウ: '宇', エ: '江', オ: '於',
  カ: '加', キ: '幾', ク: '久', ケ: '介', コ: '己',
  サ: '散', シ: '之', ス: '須', セ: '世', ソ: '曽（曾）',
  タ: '多', チ: '千', ツ: '川', テ: '天', ト: '止',
  ナ: '奈', ニ: '二', ヌ: '奴', ネ: '祢（禰）', ノ: '乃',
  ハ: '八', ヒ: '比', フ: '不', ヘ: '部', ホ: '保',
  マ: '末', ミ: '三', ム: '牟', メ: '女', モ: '毛',
  ヤ: '也', ユ: '由', ヨ: '與',
  ラ: '良', リ: '利', ル: '流', レ: '礼（禮）', ロ: '呂',
  ワ: '和', ヲ: '乎', ン: '尓（爾）',
};

const NOTES: Record<string, string> = {
  を: '只當助詞使用，發音和「お」相同',
  ヲ: '現代幾乎不使用，發音和「オ」相同',
  ん: '鼻音，不會出現在單字開頭',
  は: '當助詞「は」時讀作 wa',
  へ: '當助詞「へ」時讀作 e',
  ぢ: '發音和「じ」相同，較少使用',
  づ: '發音和「ず」相同，較少使用',
  ヂ: '發音和「ジ」相同，很少使用',
  ヅ: '發音和「ズ」相同，很少使用',
  つ: '唸 tsu，不是 tu；小寫的「っ」是促音（停一拍）',
  ふ: '唸 fu，介於 fu 和 hu 之間',
  し: '唸 shi，接近注音「ㄒㄧ」',
  ち: '唸 chi，接近注音「ㄑㄧ」',
  ら: '日語的 r 介於 l 和 r 之間，舌尖輕彈',
  シ: '三點由左下往上寫，注意和「ツ」的差別',
  ツ: '三點由上往下寫，注意和「シ」的差別',
  ソ: '筆畫由上往下，注意和「ン」的差別',
  ン: '鼻音，不會出現在單字開頭；最後一筆由下往上挑，注意和「ソ」的差別',
};

function build(): KanaItem[] {
  const groups: [KanaItem['group'], Entry[]][] = [
    ['basic', BASIC],
    ['dakuten', DAKUTEN],
    ['handakuten', HANDAKUTEN],
    ['yoon', YOON],
  ];
  const ordered: Omit<KanaItem, 'd' | 'id'>[] = [];
  for (const script of ['hiragana', 'katakana'] as const) {
    for (const [group, entries] of groups) {
      for (const [hira, romaji] of entries) {
        const kana = script === 'hiragana' ? hira : toKatakana(hira);
        const origins = script === 'hiragana' ? HIRAGANA_ORIGIN : KATAKANA_ORIGIN;
        ordered.push({
          type: 'kana',
          level: 'kana',
          kana,
          romaji,
          script,
          group,
          origin: origins[kana],
          note: NOTES[kana],
        });
      }
    }
  }
  const last = ordered.length - 1;
  return ordered.map((item, i) => ({
    ...item,
    id: `ka:${item.kana}`,
    d: Math.round(5 + (140 * i) / last),
  }));
}

export const KANA_ITEMS: readonly KanaItem[] = build();

/** Groups of kana that are easy to confuse visually; used for distractors. */
export const CONFUSABLE_KANA: readonly string[][] = [
  ['あ', 'お', 'め', 'ぬ'],
  ['い', 'り', 'こ'],
  ['う', 'つ', 'ら'],
  ['き', 'さ', 'ち'],
  ['く', 'へ', 'し'],
  ['け', 'は', 'ほ', 'に'],
  ['ね', 'れ', 'わ'],
  ['る', 'ろ', 'そ'],
  ['ま', 'も', 'ほ'],
  ['す', 'む', 'お'],
  ['た', 'な', 'に'],
  ['シ', 'ツ', 'ミ'],
  ['ソ', 'ン', 'リ'],
  ['ク', 'ケ', 'タ', 'ワ'],
  ['ア', 'マ', 'ヤ'],
  ['コ', 'ユ', 'ロ', 'エ'],
  ['ウ', 'ワ', 'フ', 'ラ'],
  ['ノ', 'メ', 'ナ'],
  ['チ', 'テ', 'ナ'],
  ['ヌ', 'ス', 'フ'],
  ['セ', 'サ', 'ヤ'],
  ['ホ', 'ネ', 'オ'],
];

/** Gojūon chart layout for the kana chart screen (null = empty cell). */
export const GOJUON_ROWS: (string | null)[][] = [
  ['あ', 'い', 'う', 'え', 'お'],
  ['か', 'き', 'く', 'け', 'こ'],
  ['さ', 'し', 'す', 'せ', 'そ'],
  ['た', 'ち', 'つ', 'て', 'と'],
  ['な', 'に', 'ぬ', 'ね', 'の'],
  ['は', 'ひ', 'ふ', 'へ', 'ほ'],
  ['ま', 'み', 'む', 'め', 'も'],
  ['や', null, 'ゆ', null, 'よ'],
  ['ら', 'り', 'る', 'れ', 'ろ'],
  ['わ', null, null, null, 'を'],
  ['ん', null, null, null, null],
];

export const DAKUTEN_ROWS: string[][] = [
  ['が', 'ぎ', 'ぐ', 'げ', 'ご'],
  ['ざ', 'じ', 'ず', 'ぜ', 'ぞ'],
  ['だ', 'ぢ', 'づ', 'で', 'ど'],
  ['ば', 'び', 'ぶ', 'べ', 'ぼ'],
  ['ぱ', 'ぴ', 'ぷ', 'ぺ', 'ぽ'],
];

export const YOON_ROWS: string[][] = [
  ['きゃ', 'きゅ', 'きょ'],
  ['しゃ', 'しゅ', 'しょ'],
  ['ちゃ', 'ちゅ', 'ちょ'],
  ['にゃ', 'にゅ', 'にょ'],
  ['ひゃ', 'ひゅ', 'ひょ'],
  ['みゃ', 'みゅ', 'みょ'],
  ['りゃ', 'りゅ', 'りょ'],
  ['ぎゃ', 'ぎゅ', 'ぎょ'],
  ['じゃ', 'じゅ', 'じょ'],
  ['びゃ', 'びゅ', 'びょ'],
  ['ぴゃ', 'ぴゅ', 'ぴょ'],
];
