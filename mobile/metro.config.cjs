const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Adicionar resolver customizado para expo-video
config.resolver = {
  ...config.resolver,
  resolveRequest: (context, moduleName, platform) => {
    // Ignorar VideoAirPlayButton que não existe em algumas plataformas
    if (moduleName.includes('VideoAirPlayButton')) {
      return {
        type: 'empty',
      };
    }
    // Usar o resolver padrão
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = withNativeWind(config, { input: './global.css' });
