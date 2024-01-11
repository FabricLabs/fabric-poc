'use strict';

// Dependencies
const { applyOperation } = require('fast-json-patch');
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
      frequency: 1,
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
      content: this.settings.state,
      parent: null
    };

    return this;
  }

  get interval () {
    return this.settings.frequency * 1000;
  }

  get parent () {
    return this._state.parent;
  }

  set heartbeat (interval) {
    this._heartbeat = interval;
  }

  set parent (id) {
    this._state.parent = id;
  }

  applyOperation (operation) {
    this._state.content = applyOperation(this._state.content, operation);
    return this;
  }

  beat () {
    this.emit('debug', `[PROOFOFCOMBAT] [BEAT] Beating...`);

    // Deterministic State ID
    const state = new Actor(this.state);

    // Create Beat
    const beat = {
      id: state.id,
      created: (new Date()).toISOString(),
      state: this.state
    };

    // Emit Beat
    this.emit('beat', beat);

    return this;
  }

  commit () {
    const commit = new Actor({
      parent: this.parent,
      state: this.state
    });

    this.emit('commit', {
      id: commit.id,
      actor: this.actor.id,
      content: commit.toGenericMessage(),
      created: (new Date()).toISOString(),
      parent: this.parent,
      // signature: commit.signature
    });

    this.parent = commit.id;

    return this;
  }

  async enumerateUsers () {
    const query = gql`
      query {
        users {
          id
          name
          email
          username
          password
          createdAt
          updatedAt
        }
      }
    `;

    const result = await this.apollo.query({ query });
    const users = result.data.users;

    for (let user of users) {
      this._state.content.collections.users[user.id] = user;
      this.emit('user', user);
    }

    this.commit();

    return this;
  }

  async start () {
    this.emit('debug', `[PROOFOFCOMBAT] Starting...`);
    this.heartbeat = setInterval(this.beat.bind(this), 1000);
    await this.sync();
    this.emit('debug', `[PROOFOFCOMBAT] Started!`);
    return this;
  }

  async stop () {
    clearInterval(this._heartbeat);
  }

  async sync () {
    console.debug('[PROOFOFCOMBAT] Syncing...');

    // TODO:
    // - [ ] Sync Places
    // - [ ] Sync Users (Players)
    // - [ ] Sync Mobs
    // - [ ] Sync Items
    // - [ ] Sync Shops
    // - [ ] Sync Events / Messages

    // Users
    const users = await this.enumerateUsers();

    for (let user of users) {
      this._state.content.collections.users[user.id] = user;
      this.emit('user', user);
    }

    this.commit();

    return this;
  }
}

module.exports = ProofOfCombat;
