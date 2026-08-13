/**
 * Enable R8 code optimization defaults + optimized resource shrinking.
 *
 * Expo/RN templates ship getDefaultProguardFile("proguard-android.txt"), which
 * includes -dontoptimize. Play wants proguard-android-optimize.txt.
 *
 * Generated AGP is 8.12.x (RN 0.83). Optimized resource shrinking is opt-in
 * until AGP 9; set android.r8.optimizedResourceShrinking=true.
 */
const {
  withAppBuildGradle,
  withGradleProperties,
} = require('expo/config-plugins');

const PROGUARD_FROM =
  /getDefaultProguardFile\(\s*["']proguard-android\.txt["']\s*\)/g;
const PROGUARD_TO =
  'getDefaultProguardFile("proguard-android-optimize.txt")';
const OPT_SHRINK_KEY = 'android.r8.optimizedResourceShrinking';

function withAndroidR8Optimize(config) {
  config = withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') {
      return cfg;
    }
    cfg.modResults.contents = cfg.modResults.contents.replace(
      PROGUARD_FROM,
      PROGUARD_TO,
    );
    return cfg;
  });

  config = withGradleProperties(config, (cfg) => {
    const existing = cfg.modResults.find(
      (item) => item.type === 'property' && item.key === OPT_SHRINK_KEY,
    );
    if (existing) {
      existing.value = 'true';
    } else {
      cfg.modResults.push({
        type: 'property',
        key: OPT_SHRINK_KEY,
        value: 'true',
      });
    }
    return cfg;
  });

  return config;
}

module.exports = withAndroidR8Optimize;
