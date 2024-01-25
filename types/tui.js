'use strict';

// Constants
const {
  MAX_CHAT_MESSAGE_LENGTH,
  BITCOIN_GENESIS
} = require('@fabric/core/constants');

const INPUT_HINT = 'Press the "i" key to begin typing.';

// Dependencies
const merge = require('lodash.merge');
const pointer = require('json-pointer'); // TODO: move uses to App
const monitor = require('fast-json-patch'); // TODO: move uses to App
const blessed = require('blessed');

// Fabric Types
const CLI = require('@fabric/core/types/cli');
const Identity = require('@fabric/core/types/identity');

// Services
const POC = require('../services/ProofOfCombat');

/**
 * Provides a Terminal User Interface (TUI) for interacting with Proof of Combat.
 */
class TUI extends CLI {
  /**
   * Create a terminal-based interface for a {@link User}.
   * @param {Object} [settings] Configuration values.
   * @param {Array} [settings.currencies] List of currencies to support.
   */
  constructor (settings = {}) {
    super(settings);

    // Assign Settings
    this.settings = merge({
      debug: true,
      ephemeral: false,
      listen: false,
      peering: false, // set to true to start Peer
      render: true,
      services: [],
      network: 'regtest',
      interval: 1000
    }, this.settings, settings);

    // Properties
    this.screen = null;
    this.history = [];

    this.aliases = {};
    this.channels = {};
    this.commands = {};
    this.contracts = {};
    this.documents = {};
    this.elements = {};
    this.peers = {};
    this.requests = {};
    this.services = {};
    this.connections = {};

    this.signer = null;

    // State
    this._state = {
      anchor: null,
      balances: {
        confirmed: 0,
        immature: 0,
        trusted: 0,
        unconfirmed: 0,
      },
      content: {
        actors: {},
        bitcoin: {
          best: null,
          genesis: BITCOIN_GENESIS
        },
        documents: {},
        messages: {}
      },
      contracts: {},
      clock: 0
    };

    this.identity = new Identity(this.settings);
    this.poc = new POC();

    // Chainable
    return this;
  }

  /**
   * Starts (and renders) the TUI.
   */
  async start () {
    // Register Internal Commands
    this._registerCommand('help', this._handleHelpRequest);

    await this.bootstrap();

    if (this.settings.render) {
      // Render UI
      this.render();
    }

    // ## Bindings
    this.on('log', this._handleSourceLog.bind(this));
    this.on('debug', this._handleSourceDebug.bind(this));
    this.on('error', this._handleSourceError.bind(this));
    this.on('warning', this._handleSourceWarning.bind(this));

    this.poc.on('message', this._handlePeerMessage.bind(this));

    // Start Proof of Combat
    await this.poc.start();

    // ## Start all services
    for (const [name, service] of Object.entries(this.services)) {
      // Skip when service name not found in settings
      if (!this.settings.services.includes(name)) continue;

      this._appendDebug(`Service "${name}" is enabled.  Starting...`);
      this.trust(this.services[name], name);

      try {
        await this.services[name].start();
        this._appendDebug(`The service named "${name}" has started!`);
      } catch (exception) {
        this._appendError(`The service named "${name}" could not start:\n${exception}`);
      }
    }

    // ## Track state changes
    this.observer = monitor.observe(this._state.content);

    // Bind remaining internals
    // TODO: enable
    // this.on('changes', this._handleChanges.bind(this));

    // ## Start P2P node
    // if (this.settings.peering) this.node.start();

    // ## Attach Heartbeat
    this._heart = setInterval(this.tick.bind(this), this.settings.interval);

    // ## Emit Ready
    this.status = 'READY';
    this.emit('ready');

    // Chainable
    return this;
  }

  /**
   * Disconnect all interfaces and exit the process.
   */
  async stop () {
    await this.node.stop();
    return process.exit(0);
  }

  _handleHelpRequest (params) {
    let text = '';

    switch (params[1]) {
      default:
        text = `{bold}Fabric TUI Help{/bold}\nThe Fabric TUI offers a simple command-based interface to a Fabric-speaking Network.  You can use \`/connect <address>\` to establish a connection to a known peer, or any of the available commands.\n\n{bold}Available Commands{/bold}:\n\n${Object.keys(this.commands).map(x => `\t${x}`).join('\n')}\n`
        break;
    }

    this._appendMessage(text);
  }

  commit () {
    ++this.clock;

    this['@parent'] = this.id;
    this['@preimage'] = this.toString();
    this['@constructor'] = this.constructor;

    let changes = null;

    /* if (this.observer) {
      changes = monitor.generate(this.observer);
    } */

    this['@id'] = this.id;

    if (changes && changes.length) {
      // this._appendMessage(`Changes: ${JSON.stringify(changes, null, '  ')}`);

      this.emit('changes', changes);
      // this.emit('state', this['@state']);
      this.emit('message', {
        '@type': 'Transaction',
        '@data': {
          'changes': changes,
          'state': changes
        }
      });
    }

    return this;
  }

  render () {
    if (!this.settings.render) return this;

    const self = this;

    self.screen = blessed.screen({
      smartCSR: true,
      input: this.settings.input,
      output: this.settings.output,
      terminal: this.settings.terminal,
      fullUnicode: this.settings.fullUnicode
    });

    self.elements.modeline = blessed.text({
      parent: self.screen,
      content: '  META ',
      bottom: 0,
      right: 0,
      width: 8,
      style: {
        bg: 'white',
        fg: 'black'
      }
    });

    self.elements['home'] = blessed.box({
      parent: self.screen,
      content: 'Fabric Command Line Interface\nVersion 0.0.1-dev (@martindale)',
      top: 6,
      bottom: 4,
      border: {
        type: 'line'
      },
    });

    self.elements['help'] = blessed.box({
      parent: self.screen,
      label: '[ Help ]',
      content: 'Fabric Command Line Interface\nVersion 0.0.1-dev (@martindale)',
      border: {
        type: 'line'
      },
      top: 6,
      bottom: 4,
      width: '100%'
    });

    self.elements['contracts'] = blessed.box({
      parent: self.screen,
      label: '[ Contracts ]',
      border: {
        type: 'line'
      },
      top: 6,
      bottom: 4
    });

    self.elements['contracthelp'] = blessed.text({
      parent: self.elements.contracts,
      tags: true,
      top: 1,
      left: 2,
      right: 2
    });

    self.elements['lightningbook'] = blessed.box({
      parent: self.elements.contracts,
      label: '[ Lightning ]',
      border: {
        type: 'line'
      },
      top: 6,
      // height: 10
    });

    self.elements['channellist'] = blessed.table({
      parent: self.elements.lightningbook,
      data: [
        ['ID']
      ],
      width: '100%-2'
    });

    /*
    self.elements['contractbook'] = blessed.box({
      parent: self.elements.contracts,
      label: '[ Fabric ]',
      border: {
        type: 'line'
      },
      top: 16
    });

    self.elements['contractlist'] = blessed.table({
      parent: self.elements.contractbook,
      data: [
        ['ID', 'Status', 'Type', 'Bond', 'Confirmations', 'Last Modified', 'Link']
      ],
      width: '100%-2'
    });
    */

    self.elements['network'] = blessed.list({
      parent: self.screen,
      label: '{bold}[ Network ]{/bold}',
      tags: true,
      border: {
        type: 'line'
      },
      top: 6,
      bottom: 4,
      width: '100%'
    });

    self.elements['connections'] = blessed.list({
      parent: this.elements['network'],
      top: 0,
      bottom: 0
    });

    self.elements['logBox'] = blessed.box({
      parent: self.screen,
      top: 6,
      bottom: 4,
      width: '100%'
    });

    self.elements['walletBox'] = blessed.box({
      parent: self.screen,
      label: '{bold}[ Wallet ]{/bold}',
      tags: true,
      border: {
        type: 'line'
      },
      top: 6,
      bottom: 4,
      width: '100%'
    });

    self.elements['wallethelp'] = blessed.text({
      parent: self.elements.walletBox,
      tags: true,
      top: 1,
      left: 2,
      right: 2
    });

    self.elements['outputbook'] = blessed.box({
      parent: self.elements.walletBox,
      label: '[ Unspent Outputs ]',
      border: {
        type: 'line'
      },
      top: 16
    });

    self.elements['outputlist'] = blessed.table({
      parent: self.elements.outputbook,
      data: [
        ['syncing...']
      ],
      width: '100%-2',
      top: 0,
      bottom: 0
    });

    self.elements['menu'] = blessed.listbar({
      parent: self.screen,
      top: '100%-1',
      left: 0,
      right: 8,
      style: {
        selected: {
          background: 'white',
          border: '1'
        }
      },
      commands: {
        'Help': {
          keys: ['f1'],
          callback: function () {
            this.setPane('help');
          }.bind(this)
        },
        'Console': {
          keys: ['f2'],
          callback: function () {
            this.setPane('messages');
            return true;
          }.bind(this)
        },
        'Network': {
          keys: ['f3'],
          callback: function () {
            this.setPane('network');
          }.bind(this)
        },
        'Wallet': {
          keys: ['f4'],
          callback: function () {
            this.setPane('wallet');
          }.bind(this)
        },
        'Contracts': {
          keys: ['f5'],
          callback: function () {
            this.setPane('contracts');
          }.bind(this)
        },
      }
    });

    self.elements['status'] = blessed.box({
      parent: self.screen,
      label: '{bold}[ Status ]{/bold}',
      tags: true,
      border: {
        type: 'line'
      },
      top: 0,
      height: 6,
      width: '100%'
    });

    self.elements['identity'] = blessed.box({
      parent: self.elements['status'],
      left: 1
    });

    self.elements['identityLabel'] = blessed.text({
      parent: self.elements['identity'],
      content: 'IDENTITY:',
      top: 0,
      bold: true
    });

    self.elements['identityString'] = blessed.text({
      parent: self.elements['identity'],
      content: 'loading...',
      top: 0,
      left: 10
    });

    self.elements['wallet'] = blessed.box({
      parent: self.elements['status'],
      right: 1,
      width: 29,
      height: 4
    });

    self.elements['balance'] = blessed.text({
      parent: self.elements['wallet'],
      content: '0.00000000',
      top: 0,
      right: 4
    });

    self.elements['label'] = blessed.text({
      parent: self.elements['wallet'],
      content: 'BALANCE:',
      top: 0,
      right: 29,
      bold: true
    });

    self.elements['denomination'] = blessed.text({
      parent: self.elements['wallet'],
      content: 'BTC',
      top: 0,
      right: 0
    });

    self.elements['unconfirmed'] = blessed.box({
      parent: self.elements['status'],
      top: 1,
      left: 1
    });

    self.elements['unconfirmedLabel'] = blessed.text({
      parent: self.elements['unconfirmed'],
      content: 'UNCONFIRMED:',
      top: 0,
      right: 30,
      bold: true
    });

    self.elements['unconfirmedValue'] = blessed.text({
      parent: self.elements['unconfirmed'],
      content: 'syncing...',
      top: 0,
      right: 1
    });

    self.elements['bonded'] = blessed.box({
      parent: self.elements['status'],
      top: 2,
      left: 1
    });

    self.elements['bondedLabel'] = blessed.text({
      parent: self.elements['bonded'],
      content: 'BONDED:',
      top: 0,
      right: 30,
      bold: true
    });

    self.elements['bondedValue'] = blessed.text({
      parent: self.elements['bonded'],
      content: 'syncing...',
      top: 0,
      right: 1
    });

    self.elements['progress'] = blessed.box({
      parent: self.elements['status'],
      top: 3,
      left: 1
    });

    self.elements['progressLabel'] = blessed.text({
      parent: self.elements['progress'],
      content: 'SYNC:',
      top: 0,
      right: 30,
      bold: true
    });

    self.elements['progressStatus'] = blessed.text({
      parent: self.elements['progress'],
      content: 'syncing...',
      top: 0,
      right: 1
    });

    self.elements['chain'] = blessed.box({
      parent: self.elements['status'],
      top: 1,
      left: 1,
      width: 50
    });

    self.elements['chainLabel'] = blessed.text({
      parent: self.elements['chain'],
      content: 'CHAIN TIP:',
      bold: true
    });

    self.elements['chainTip'] = blessed.text({
      parent: self.elements['chain'],
      content: 'loading...',
      left: 11,
      width: 50
    });

    self.elements['height'] = blessed.box({
      parent: self.elements['status'],
      top: 2,
      left: 1,
      width: 62
    });

    self.elements['heightLabel'] = blessed.text({
      parent: self.elements['height'],
      content: 'CHAIN HEIGHT:',
      bold: true
    });

    self.elements['heightValue'] = blessed.text({
      parent: self.elements['height'],
      content: 'loading...',
      left: 14,
      width: 50
    });

    self.elements['mempool'] = blessed.box({
      parent: self.elements['status'],
      top: 3,
      left: 1,
      width: 29
    });

    self.elements['mempoolLabel'] = blessed.text({
      parent: self.elements['mempool'],
      content: 'MEMPOOL SIZE:',
      bold: true
    });

    self.elements['mempoolCount'] = blessed.text({
      parent: self.elements['mempool'],
      content: '0',
      left: 14
    });

    // MAIN LOG OUTPUT
    self.elements['messages'] = blessed.log({
      parent: this.screen,
      label: '{bold}[ Console ]{/bold}',
      tags: true,
      border: {
        type: 'line'
      },
      scrollbar: {
        style: {
          bg: 'white',
          fg: 'blue'
        }
      },
      top: 6,
      width: '80%',
      bottom: 4,
      mouse: true,
      tags: true
    });

    self.elements['peers'] = blessed.list({
      parent: self.screen,
      label: '{bold}[ Peers ]{/bold}',
      tags: true,
      border: {
        type: 'line'
      },
      top: 6,
      left: '80%+1',
      bottom: 4
    });

    self.elements['controls'] = blessed.box({
      parent: this.screen,
      label: '{bold}[ INPUT ]{/bold}',
      tags: true,
      bottom: 1,
      height: 3,
      border: {
        type: 'line'
      }
    });

    self.elements['form'] = blessed.form({
      parent: self.elements['controls'],
      bottom: 0,
      height: 1,
      left: 1
    });

    self.elements['prompt'] = blessed.textbox({
      parent: self.elements['form'],
      name: 'input',
      input: true,
      keys: true,
      inputOnFocus: true,
      value: INPUT_HINT,
      style: {
        fg: 'grey'
      }
    });

    // Set Index for Command History
    this.elements['prompt'].historyIndex = -1;

    // Render the screen.
    self.screen.render();
    self._bindKeys();

    // TODO: clean up workaround (from https://github.com/chjj/blessed/issues/109)
    self.elements['prompt'].oldFocus = self.elements['prompt'].focus;
    self.elements['prompt'].focus = function () {
      let oldListener = self.elements['prompt'].__listener;
      let oldBlur = self.elements['prompt'].__done;

      self.elements['prompt'].removeListener('keypress', self.elements['prompt'].__listener);
      self.elements['prompt'].removeListener('blur', self.elements['prompt'].__done);

      delete self.elements['prompt'].__listener;
      delete self.elements['prompt'].__done;

      self.elements['prompt'].screen.focusPop(self.elements['prompt'])

      self.elements['prompt'].addListener('keypress', oldListener);
      self.elements['prompt'].addListener('blur', oldBlur);

      self.elements['prompt'].oldFocus();
    };

    // focus when clicked
    self.elements['form'].on('click', function () {
      self.elements['prompt'].focus();
    });

    self.elements['form'].on('submit', self._handleFormSubmit.bind(self));
    // this.focusInput();

    this.elements['identityString'].setContent(this.identity.id);
    this.setPane('messages');

    setInterval(function () {
      // self._appendMessage('10 seconds have passed.');
      // self.bitcoin.generateBlock();
    }, 10000);
  }

  tick () {
    // Increment clock and commit
    this._state.clock++;
    this.commit();
  }
}

module.exports = TUI;
