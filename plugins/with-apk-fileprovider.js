const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('@expo/config-plugins');

const FILE_PROVIDER_XML = `<?xml version="1.0" encoding="utf-8"?>
<paths xmlns:android="http://schemas.android.com/apk/res/android">
  <external-cache-path name="external-cache-path" path="." />
  <external-media-path name="external-media-path" path="." />
  <cache-path name="cache-path" path="." />
  <external-path name="external-path" path="." />
  <files-path name="files-path" path="." />
  <external-files-path name="external-files-path" path="." />
</paths>
`;

const ensureInstallPermission = (manifest) => {
  manifest['uses-permission'] = manifest['uses-permission'] || [];
  const hasPermission = manifest['uses-permission'].some(
    (perm) => perm?.$?.['android:name'] === 'android.permission.REQUEST_INSTALL_PACKAGES'
  );
  if (!hasPermission) {
    manifest['uses-permission'].push({
      $: { 'android:name': 'android.permission.REQUEST_INSTALL_PACKAGES' },
    });
  }
};

const ensureFileProvider = (manifest) => {
  const app = manifest.application?.[0];
  if (!app) return;

  app.provider = app.provider || [];
  const exists = app.provider.some(
    (provider) => provider?.$?.['android:authorities'] === '${applicationId}.fileprovider'
  );
  if (exists) return;

  app.provider.push({
    $: {
      'android:name': 'androidx.core.content.FileProvider',
      'android:authorities': '${applicationId}.fileprovider',
      'android:exported': 'false',
      'android:grantUriPermissions': 'true',
    },
    'meta-data': [
      {
        $: {
          'android:name': 'android.support.FILE_PROVIDER_PATHS',
          'android:resource': '@xml/file_paths',
        },
      },
    ],
  });
};

const withApkFileProviderManifest = (config) =>
  withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults?.manifest;
    if (!manifest) return mod;
    ensureInstallPermission(manifest);
    ensureFileProvider(manifest);
    return mod;
  });

const withApkFileProviderXml = (config) =>
  withDangerousMod(config, [
    'android',
    async (mod) => {
      const xmlDir = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/res/xml');
      const xmlPath = path.join(xmlDir, 'file_paths.xml');
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.writeFileSync(xmlPath, FILE_PROVIDER_XML, 'utf8');
      return mod;
    },
  ]);

module.exports = function withApkFileProvider(config) {
  config = withApkFileProviderManifest(config);
  config = withApkFileProviderXml(config);
  return config;
};
