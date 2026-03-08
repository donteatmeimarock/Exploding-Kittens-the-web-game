const fs = require('fs');
const code = fs.readFileSync('g:/My Drive/AIplayground/InteractiveMap/ExplodingKittens/game.js', 'utf8');

// Mock DOM
global.document = {
    getElementById: () => ({
        classList: { add: () => {}, remove: () => {} },
        innerHTML: '',
        textContent: '',
        appendChild: () => {},
        addEventListener: () => {}
    }),
    createElement: () => ({
        style: {},
        classList: { add: () => {}, remove: () => {} },
        innerHTML: ''
    })
};
global.window = {
    addEventListener: () => {},
    setTimeout: () => {},
    clearTimeout: () => {}
};
global.alert = console.log;

// Execute
eval(code);

// Override mode
state.mode = 'local';
state.isGameOver = false;
setupDeck();
dealInitialHands();
insertExplodingKittens();
state.currentPlayerIndex = 0;

// Give player 2 tacocats
state.players[0].hand = ['Tacocat', 'Tacocat', 'Attack'];

console.log("Before click: selected cards=", state.selectedCards);
handleCardClick(0);
console.log("After click 1: selected cards=", state.selectedCards);
handleCardClick(1);
console.log("After click 2: selected cards=", state.selectedCards);
