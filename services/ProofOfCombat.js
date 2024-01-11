'use strict';

// Dependencies
const { ApolloClient, InMemoryCache, ApolloProvider, gql } = require('@apollo/client');

// Fabric Types
const Actor = require('@fabric/core/types/actor');
const Service = require('@fabric/core/types/service');

// HTTP Types
const Remote = require('@fabric/http/types/remote');

class ProofOfCombat extends Service {
  constructor (settings = {}) {
    super(settings);

    this.settings = Object.assign({
      authority: 'https://proofofcombat.com',
      name: 'ProofOfCombat',
      port: 9898,
      state: {
        status: 'INITIALIZED',
        collections: {
          places: {},
          users: {}
        }
      }
    });

    this.actor = new Actor({ name: this.settings.name });
    this.remote = new Remote({ authority: this.settings.authority });
    this.apollo = new ApolloClient({
      uri: this.settings.authority,
      cache: new InMemoryCache()
    });

    this._state = {
      content: this.settings.state
    };

    return this;
  }

  async _heartbeat () {
    this.emit('debug', `[${this.settings.name}] Heartbeat.`);
  }

  async start () {
    this.heartbeat = setInterval(this._heartbeat.bind(this), 1000);
  }

  async stop () {
    clearInterval(this.heartbeat);
  }
}

module.exports = ProofOfCombat;
