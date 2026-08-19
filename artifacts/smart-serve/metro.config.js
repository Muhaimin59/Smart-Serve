// Expo 54's Metro config uses Array.prototype.toReversed, which is missing in Node 18.
if (!Array.prototype.toReversed) {
  Object.defineProperty(Array.prototype, 'toReversed', { value: function () { return Array.from(this).reverse(); }, configurable: true });
}
const { getDefaultConfig } = require('expo/metro-config');
module.exports = getDefaultConfig(__dirname);
