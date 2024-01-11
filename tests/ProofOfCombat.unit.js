'use strict';

// Dependencies
const assert = require('assert');

const config = require('../settings/test');
const ProofOfCombat = require('../services/ProofOfCombat');

describe('@fabric/poc', function () {
  describe('ProofOfCombat', function () {
    it('should expose a constructor', function () {
      assert.equal(ProofOfCombat instanceof Function, true);
    });

    it('can start and stop cleanly', async function () {
      const instance = new ProofOfCombat();
      await instance.start();
      await instance.stop();
      assert.ok(instance);
    });

    it('can start and stop with the test configuration', async function () {
      const instance = new ProofOfCombat(config);
      await instance.start();
      await instance.stop();
      assert.ok(instance);
    });
  });
});
