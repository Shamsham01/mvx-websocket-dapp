const webpack = require('webpack');

module.exports = function override(config) {
  // Fix ESM resolution for @multiversx/sdk-dapp 5.x (fullySpecified)
  // Required for CRA + webpack 5 with packages that use ESM imports without extensions
  config.module.rules.push({
    test: /\.m?js$/,
    resolve: {
      fullySpecified: false,
    },
  });

  const fallback = config.resolve.fallback || {};
  Object.assign(fallback, {
    crypto: require.resolve('crypto-browserify'),
    stream: require.resolve('stream-browserify'),
    assert: require.resolve('assert'),
    http: require.resolve('stream-http'),
    https: require.resolve('https-browserify'),
    os: require.resolve('os-browserify'),
    url: require.resolve('url'),
    path: require.resolve('path-browserify'),
    'process/browser': require.resolve('process/browser.js'),
    fs: false, // Not available in browser; sdk-bls-wasm has optional Node usage
    vm: false, // Node module; not needed in browser
  });
  config.resolve.fallback = fallback;
  config.plugins = (config.plugins || []).concat([
    new webpack.ProvidePlugin({
      process: require.resolve('process/browser.js'),
      Buffer: ['buffer', 'Buffer'],
    }),
  ]);
  return config;
};
