// CommonJS wrapper that re-exports the actual config in metro.config.cjs
// This file will be parsed as CommonJS because `mobile/package.json` sets "type": "commonjs".
module.exports = require('./metro.config.cjs');
