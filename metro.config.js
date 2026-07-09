const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Enable Metro to resolve WebAssembly (.wasm) files for SQLite Web support
config.resolver.assetExts.push('wasm');

module.exports = config;
