import Constants from 'expo-constants';
import { Platform } from 'react-native';

const build: unknown = Constants.expoConfig?.extra?.build;

/** The commit an APK was built from, stamped in by app.config.ts (null in Expo Go and dev builds). */
export const appBuild: string | null = typeof build === 'string' && build ? build : null;

/** What 我的 calls this kind of build, next to its id. */
export const buildKind = Platform.OS === 'ios' ? 'iOS 版' : 'Android 版';

/** Web app only (see appBuild.web.ts): the native app keeps its storage without asking. */
export function keepStorage(): void {}
