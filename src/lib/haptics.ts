import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Feedback you can feel without looking closely: useful while standing on a train.
const enabled = () => Platform.OS === 'ios' || Platform.OS === 'android';

export function hapticCorrect(): void {
  if (enabled()) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

export function hapticWrong(): void {
  if (enabled()) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
}

export function hapticTap(): void {
  if (enabled()) void Haptics.selectionAsync().catch(() => {});
}
