/**
 * Puppeteer configuration
 * Defines where Chrome browser will be downloaded
 */
const { join } = require('path');
const os = require('os');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Use user's home directory cache (persistent across deployments)
  cacheDirectory: join(os.homedir(), '.cache', 'puppeteer'),
};
