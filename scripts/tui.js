'use strict';

const settings = require('../settings/local');
const TUI = require('../types/tui');

async function main (args) {
  const tui = new TUI(args);
  await tui.start();
}

main(settings).then((result) => {
  // console.log('Result:', result);
}).catch((exception) => {
  console.error('Exception:', exception);
});
