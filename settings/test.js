const {
  FIXTURE_SEED
} = require('@fabric/core/constants');

module.exports = {
  name: 'test',
  seed: FIXTURE_SEED,
  authority: 'http://localhost:9494',
  frequency: 1, // Hz, 1 second
  http: {
    port: 9494
  }
};
