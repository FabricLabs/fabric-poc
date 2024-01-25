'use strict';

const {
  FIXTURE_SEED
} = require('@fabric/core/constants');

module.exports = {
  alias: 'PROOFOFCOMBAT_LOCAL',
  name: 'ProofOfCombat',
  seed: FIXTURE_SEED,
  frequency: 0.016666666666666, // Hz, 1 minute
  authority: 'https://chrisinajar.com:8443/graphql',
  http: {
    hostname: 'localhost',
    port: 9898
  },
  remotes: [
    { host: 'proofofcombat.com', port: 443, secure: true, collections: ['users'] }
  ],
  socketio: {
    authority: 'https://chrisinajar.com:2096'
  },
  token: 'get from proofofcombat.com'
};
