'use strict';

// Dependencies
const { applyOperation, observe } = require('fast-json-patch');
const { ApolloClient, InMemoryCache, ApolloProvider, gql } = require('@apollo/client');

// Fabric Types
const Actor = require('@fabric/core/types/actor');
const Service = require('@fabric/core/types/service');

// HTTP Types
const Remote = require('@fabric/http/types/remote');
const HTTPServer = require('@fabric/http/types/server');

class ProofOfCombat extends Service {
  constructor (settings = {}) {
    super(settings);

    this.settings = Object.assign({
      authority: 'https://proofofcombat.com',
      name: 'ProofOfCombat',
      port: 9898,
      frequency: 1,
      http: {
        interface: '0.0.0.0',
        port: 9898
      },
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

    this.http = new HTTPServer(this.settings.http);
    this.observer = null;

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

  exitsForPlaceID (id) {
    if (!this.state.collections.places[id]) throw new Error(`No place found with ID ${id}.`);
    const place = this.state.collections.places[id];
    const exits = [];

    for (let x = place.x - 1; x <= place.x + 1; x++) {
      for (let y = place.y - 1; y <= place.y + 1; y++) {
        if (x === place.x && y === place.y) continue;
        const direction = (y > place.y) ? 'north' : (y < place.y) ? 'south' : (x > place.x) ? 'east' : (x < place.x) ? 'west' : null;
        const location = this.getLocationAt(x, y);
        if (!location) continue;
        exits.push({
          direction: direction,
          destination: location.id
        });
      }
    }

    return exits;
  }

  getLocationAt (x, y) {
    const places = Object.values(this.state.collections.places);

    for (let place of places) {
      if (place.x === x && place.y === y) return place;
    }

    return null;
  }

  selectAction (state) {
    let action = null;

    const entropy = Math.random();
    const map = this.mapWorldFromState(state);

    if (!state.status) {
      action = 'sleep';
    } else {
      // Select Actions
      // TODO: retrieve state.user.location, get from map, list exits
      if (entropy < 0.333333333333333) {
        action = 'sleep';
      } else {
        action = 'explore';
      }
    }

    return action;
  }

  mapWorldFromState (state) {
    const map = {};

    if (!state.collections) throw new Error('No collections found in state.');
    if (!state.collections.places) throw new Error('No places found in state.');

    for (let place of Object.values(state.collections.places)) {
      map[place.id] = place;
    }

    return map;
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

    try {
      const result = await this.apollo.query({ query });
      console.debug('[PROOFOFCOMBAT] Users:', result.data.users);
      if (!result.data.users) throw new Error('No users found in response.');
      const users = result.data.users;

      for (let user of users) {
        this._state.content.collections.users[user.id] = user;
        this.emit('user', user);
      }

      this.commit();
    } catch (exception) {
      console.error('[PROOFOFCOMBAT] Error enumerating users:', exception);
    }

    return Object.values(this.state.collections.users);
  }

  async start () {
    this.emit('debug', `[PROOFOFCOMBAT] Starting...`);

    // Attach Event Listeners
    this.http.on('log', this._handleHTTPLog.bind(this));

    // Sync
    await this.sync();

    // Attach monitor
    this.observer = observe(this._state.content, (patches) => {
      for (let patch of patches) {
        this.emit('patch', patch);
      }
    });

    // Start Services
    await this.http.start();

    // Start Heartbeat
    this.heartbeat = setInterval(this.beat.bind(this), this.interval);

    // Emit Events
    this.emit('debug', `[PROOFOFCOMBAT] Started!`);
    this.emit('ready', { id: this.agent.id });

    // Resolve to self
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

  async _handleHTTPLog (...args) {
    console.debug('[PROOFOFCOMBAT] HTTP Log:', ...args);
  }
}

module.exports = ProofOfCombat;
