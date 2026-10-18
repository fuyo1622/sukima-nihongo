import { router } from 'expo-router';

import type { BlockMode } from '@/engine/blockBuilder';
import { notify } from '@/lib/confirm';
import { startBlock } from '@/state/actions';

/** Builds a block and opens the session screen, or explains why there is nothing to study. */
export function beginBlock(mode: BlockMode): void {
  if (startBlock(mode)) {
    router.push('/session');
    return;
  }
  if (mode.type === 'review') {
    notify('目前沒有要複習的內容', '先學一些新內容吧！學過的項目會在最適合的時間回來讓你複習。');
  } else {
    notify('這個範圍已經學完了', '到「課程」選擇其他程度，或做一次複習。');
  }
}
