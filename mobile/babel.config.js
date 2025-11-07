module.exports = function (api) {
  api.cache(true);
  return {
    // nativewind provides a babel "preset" (it returns an object with plugins),
    // so include it in presets rather than plugins to avoid the
    // ".plugins is not a valid Plugin property" error.
    presets: ["babel-preset-expo", "nativewind/babel"],
  };
};
