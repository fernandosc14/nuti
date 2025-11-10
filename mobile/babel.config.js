module.exports = function(api) {
  api.cache(true);
  return {
    // NativeWind can be applied as a preset in some versions — include it here
    // to avoid Babel treating it as a plugin/preset mismatch.
    presets: ['babel-preset-expo', 'nativewind/babel'],
    plugins: [
      // react-native-reanimated/plugin deve ser o último plugin
      'react-native-reanimated/plugin',
    ],
  };
};

