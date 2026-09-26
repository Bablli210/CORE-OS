// Expo's Metro config understands pnpm workspaces (it watches the repo root and resolves the symlinked
// @gymos/api and @gymos/i18n packages, which ship TypeScript source).
const { getDefaultConfig } = require("expo/metro-config");

module.exports = getDefaultConfig(__dirname);
