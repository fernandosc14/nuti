const { withAndroidManifest, withInfoPlist } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Config Plugin for Widgets
 * Configures native widgets for iOS and Android
 */
const withWidgets = (config) => {
  // Android: Add widget receiver to AndroidManifest
  config = withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    const { manifest } = androidManifest;

    if (!manifest.application) {
      manifest.application = [{}];
    }

    const application = manifest.application[0];
    
    // Add receiver for widget
    if (!application.receiver) {
      application.receiver = [];
    }

    // Check if the receiver already exists
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

  // iOS: Add App Groups to share data
  config = withInfoPlist(config, (config) => {
    const infoPlist = config.modResults;
    
    // Add App Group
    if (!infoPlist['AppGroups']) {
      infoPlist['AppGroups'] = [];
    }
    
    const appGroupId = `group.${config.ios?.bundleIdentifier || 'com.nuti.app'}`;
    
    if (!infoPlist['AppGroups'].includes(appGroupId)) {
      infoPlist['AppGroups'].push(appGroupId);
    }

    // Add WidgetKit capability
    if (!infoPlist['NSSupportsLiveActivities']) {
      infoPlist['NSSupportsLiveActivities'] = true;
    }

    return config;
  });

  return config;
};

module.exports = withWidgets;



