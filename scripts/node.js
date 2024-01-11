'use strict';

// Dependencies
const ProofOfCombat = require('../services/ProofOfCombat');

// Settings
const settings = require('../settings/local');

// Main Process
async function main (input) {
  // Create local instance
  const service = new ProofOfCombat(input);

  // Attach event handlers
  service.on('error', (err) => {
    console.error('[PROOFOFCOMBAT]', 'Service Error:', err);
  });

  service.on('debug', (msg) => {
    console.debug('[PROOFOFCOMBAT]', 'Service Debug:', msg);
  });

  service.on('ready', () => {
    // console.log('[PROOFOFCOMBAT]', 'Service Ready:', service);
  });

  service.on('commit', (commit) => {
    console.log('[PROOFOFCOMBAT]', 'Commit:', commit);
  });

  service.on('location', (location) => {
    console.log('[PROOFOFCOMBAT]', 'Location:', location);
  });

  service.on('user', (user) => {
    console.log('[PROOFOFCOMBAT]', 'User:', user);
  });

  // Start the service
  await service.start();

  // Provide response
  return {
    id: service.id,
    links: [
      `http://${service.settings.http.hostname}:${service.settings.http.port}`
    ]
  };
}

// Execution
main(settings).catch((error) => {
  console.error('[PROOFOFCOMBAT]', 'Main Process Exception:', error);
}).then((result) => {
  console.log('[PROOFOFCOMBAT]', 'Main Process Running:', result);
});
