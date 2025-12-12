const { withAndroidManifest, withInfoPlist } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Config Plugin para Widgets
 * Configura widgets nativos para iOS e Android
 */
const withWidgets = (config) => {
  // Android: Adicionar receiver de widget ao AndroidManifest
  config = withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    const { manifest } = androidManifest;

    if (!manifest.application) {
      manifest.application = [{}];
    }

    const application = manifest.application[0];
    
    // Adicionar receiver para widget
    if (!application.receiver) {
      application.receiver = [];
    }

    // Verificar se já existe o receiver
    const hasWidgetReceiver = application.receiver.some(
      (receiver) => receiver.$?.['android:name'] === '.widget.NutiWidgetProvider'
    );

    if (!hasWidgetReceiver) {
      application.receiver.push({
        $: {
          'android:name': '.widget.NutiWidgetProvider',
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name': 'android.appwidget.action.APPWIDGET_UPDATE',
                },
              },
            ],
          },
        ],
        'meta-data': [
          {
            $: {
              'android:name': 'android.appwidget.provider',
              'android:resource': '@xml/nuti_widget_info',
            },
          },
        ],
      });
    }

    return config;
  });

  // iOS: Adicionar App Groups para compartilhar dados
  config = withInfoPlist(config, (config) => {
    const infoPlist = config.modResults;
    
    // Adicionar App Group
    if (!infoPlist['AppGroups']) {
      infoPlist['AppGroups'] = [];
    }
    
    const appGroupId = `group.${config.ios?.bundleIdentifier || 'com.nuti.app'}`;
    
    if (!infoPlist['AppGroups'].includes(appGroupId)) {
      infoPlist['AppGroups'].push(appGroupId);
    }

    // Adicionar WidgetKit capability
    if (!infoPlist['NSSupportsLiveActivities']) {
      infoPlist['NSSupportsLiveActivities'] = true;
    }

    return config;
  });

  return config;
};

module.exports = withWidgets;



