'use strict';

const locations = require('proofofcombat-server');

const {
  FIXTURE_SEED
} = require('@fabric/core/constants');

module.exports = {
  FIXTURE_SEED,
  defaults: {
    locations: locations
  }
};
