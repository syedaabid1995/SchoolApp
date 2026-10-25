'use strict';

const { syncFromStore } = require('./ssh-firewall');

try {
  syncFromStore();
  console.log('SAAPT SSH block list synchronized with nftables');
} catch (error) {
  console.error('Could not synchronize SAAPT SSH block list:', error.message);
  process.exitCode = 1;
}
