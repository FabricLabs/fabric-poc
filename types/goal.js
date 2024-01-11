'use strict';

const Service = require('@fabric/core/types/service');

class Goal extends Service {
  constructor (settings = {}) {
    super(settings);

    this.settings = Object.assign({
      name: 'Goal',
      state: {
        status: 'INITIALIZED',
        collections: {}
      },
      validator: (state) => {
        if (!state) return false;
        if (!state.collections) return false;
        if (!state.user) return false;
        if (!state.user.id) return false;
        if (!state.user.balance) return false;
        // User has a balance, default validator passes!
        return true;
      }
    });

    this._state = {
      name: 'Goal',
      content: this.settings.state
    };

    return this;
  }

  assess (state) {
    const isComplete = this.settings.validator(state);

    return {
      passes: isComplete,
    };
  }
}

module.exports = Goal;
