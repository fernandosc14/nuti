const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add custom resolver for expo-video
config.resolver = {
  ...config.resolver,
  resolveRequest: (context, moduleName, platform) => {
    // Ignore VideoAirPlayButton which does not exist on some platforms.
    if (moduleName.includes('VideoAirPlayButton')) {
      return {
        type: 'empty',
      };
    }
    // Use the default resolver
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = withNativeWind(config, { input: './global.css' });
