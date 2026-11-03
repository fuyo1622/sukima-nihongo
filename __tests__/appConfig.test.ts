import type { ExpoConfig } from 'expo/config';

import appConfig from '../app.config';
import appJson from '../app.json';

const SHA = '0123456789abcdef0123456789abcdef01234567';

/** Resolves the config as the CLI would, with only `env` set of the build variables (CI sets them too). */
function resolve(env: Record<string, string>): ExpoConfig {
  const saved = { ...process.env };
  delete process.env.ANDROID_VERSION_CODE;
  delete process.env.APP_BUILD;
  Object.assign(process.env, env);
  try {
    const config = JSON.parse(JSON.stringify(appJson.expo)) as Partial<ExpoConfig>;
    return appConfig({ config, projectRoot: '', staticConfigPath: null, packageJsonPath: null });
  } finally {
    process.env = saved;
  }
}

describe('app.config.ts', () => {
  test('without the APK build variables it is app.json unchanged', () => {
    const config = resolve({});
    expect(config).toMatchObject(appJson.expo);
    expect(config.android?.versionCode).toBeUndefined();
    expect(config.extra).not.toHaveProperty('build');
  });

  test('the APK build stamps in its version code and commit', () => {
    const config = resolve({ ANDROID_VERSION_CODE: '42', APP_BUILD: SHA });
    expect(config.android?.versionCode).toBe(42);
    expect(config.android?.package).toBe(appJson.expo.android.package);
    expect(config.extra?.build).toBe('0123456789ab');
    expect(config.version).toBe(appJson.expo.version);
  });

  test('ignores a version code that is not a positive number', () => {
    for (const ANDROID_VERSION_CODE of ['', '0', 'abc', '-3']) {
      expect(resolve({ ANDROID_VERSION_CODE }).android?.versionCode).toBeUndefined();
    }
  });
});
