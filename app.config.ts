import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * app.json plus two values the Android APK build stamps in (.github/workflows/android.yml): the
 * version code, which has to grow for each APK to install over the previous one, and the commit the
 * build comes from, shown in 我的. Without them (dev server, web, EAS) app.json is used as it is.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const versionCode = Number(process.env.ANDROID_VERSION_CODE);
  const build = process.env.APP_BUILD?.slice(0, 12);
  return {
    ...(config as ExpoConfig),
    android: { ...config.android, ...(versionCode > 0 ? { versionCode } : {}) },
    // Left out rather than null: the CLI turns a null here into {}.
    extra: { ...config.extra, ...(build ? { build } : {}) },
  };
};
