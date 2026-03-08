window.onerror = function(message, source, lineno, colno, error) {
    const errDiv = document.createElement('div');
    errDiv.style.position = 'fixed';
    errDiv.style.top = '0';
    errDiv.style.left = '0';
    errDiv.style.width = '100%';
    errDiv.style.padding = '20px';
    errDiv.style.background = 'red';
    errDiv.style.color = 'white';
    errDiv.style.zIndex = '999999';
    errDiv.innerText = `Error: ${message} at ${lineno}:${colno}\n${error ? error.stack : ''}`;
    document.body.appendChild(errDiv);
};

// Card Types and Definitions
const CardTypes = {
    DEFUSE: 'Defuse',
    EXPLODE: 'Exploding Kitten',
    ATTACK: 'Attack',
    SKIP: 'Skip',
    FAVOR: 'Favor',
    SHUFFLE: 'Shuffle',
    SEEFUTURE: 'See the Future',
    NOPE: 'Nope',
    CAT1: 'Tacocat',
    CAT2: 'Cattermelon',
    CAT3: 'Hairy Potato Cat',
    CAT4: 'Beard Cat',
    CAT5: 'Rainbow-Ralphing Cat'
};

const Actions = {
    PLAY_CARD: 'PLAY_CARD',
    DRAW_CARD: 'DRAW_CARD',
    STEAL_CARD: 'STEAL_CARD'
};

// Game State
let state = {
    deck: [],
    discardPile: [],
    players: [],
    currentPlayerIndex: 0,
    turnsRemaining: 1,
    mode: 'local',
    isGameOver: false,
    actionStack: [], // For Nope mechanics
    nopeTimer: null,
    selectedCards: [], // For 2-card combos
    
    // Networking
    peer: null,
    conn: null,
    isHost: false,
    networkId: null,

    // Achievement Tracking
    achievements: {
        'lucky': { id: 'lucky', title: 'I AM LUCKY!', desc: 'Win with 2 Defuses', secret: false, unlocked: false },
        'favor': { id: 'favor', title: 'Please Please I Need This', desc: 'Use a Favor', secret: false, unlocked: false },
        'nope': { id: 'nope', title: 'Not Happening!', desc: 'Use a Nope 10 times', secret: false, unlocked: false },
        'close': { id: 'close', title: 'Close Call', desc: 'Defuse an Exploding Kitten', secret: false, unlocked: false },
        'ninelives': { id: 'ninelives', title: 'Nine Lives', desc: 'Use a Defuse nine times in a single game', secret: true, unlocked: false },
        'robbery': { id: 'robbery', title: 'Authorized Robbery', desc: 'Use a pair of cat cards three times in a single game', secret: false, unlocked: false }
    },
    stats: {
        globalNopes: 0,
        gameDefuses: 0,
        gamePairs: 0
    }
};

// DOM Elements
const screens = {
    mainMenu: document.getElementById('main-menu'),
    gameScreen: document.getElementById('game-screen'),
    passScreen: document.getElementById('pass-screen'),
    achievementsScreen: document.getElementById('achievements-screen')
};

const UI = {
    btnLocal: document.getElementById('btn-local-mp'),
    btnAI: document.getElementById('btn-ai'),
    btnHost: document.getElementById('btn-host'),
    btnJoin: document.getElementById('btn-join'),
    btnEndTurn: document.getElementById('btn-end-turn'), // mapped to Draw Card
    deckCount: document.getElementById('deck-count'),
    turnIndicator: document.getElementById('turn-indicator'),
    playerHand: document.getElementById('player-hand'),
    opponentHand: document.getElementById('opponent-hand'),
    discardPile: document.getElementById('discard-pile'),
    opponentHandCount: document.getElementById('opponent-hand-count'),
    modal: document.getElementById('action-modal'),
    modalTitle: document.getElementById('modal-title'),
    modalDesc: document.getElementById('modal-desc'),
    modalContent: document.getElementById('modal-custom-content'),
    modalClose: document.getElementById('modal-close'),
    drawPile: document.getElementById('draw-pile'),
    passMessage: document.getElementById('pass-message'),
    btnReady: document.getElementById('btn-ready'),

    // Lobby
    lobbyScreen: document.getElementById('lobby-screen'),
    lobbyHostView: document.getElementById('lobby-host-view'),
    lobbyJoinView: document.getElementById('lobby-join-view'),
    lobbyCodeDisplay: document.getElementById('lobby-code-display'),
    lobbyCodeInput: document.getElementById('lobby-code-input'),
    btnConnect: document.getElementById('btn-connect'),
    btnCancelLobby: document.getElementById('btn-cancel-lobby'),

    // Achievements
    btnAchievements: document.getElementById('btn-achievements'),
    btnCloseAchievements: document.getElementById('btn-close-achievements'),
    achievementsList: document.getElementById('achievements-list'),
    toastContainer: document.getElementById('toast-container')
};

// Initialization
function init() {
    loadAchievements();

    UI.btnLocal.addEventListener('click', () => startGame('local'));
    UI.btnAI.addEventListener('click', () => startGame('ai'));
    UI.btnHost.addEventListener('click', () => showLobby('host'));
    UI.btnJoin.addEventListener('click', () => showLobby('join'));
    UI.btnCancelLobby.addEventListener('click', hideLobby);
    UI.btnConnect.addEventListener('click', joinNetworkGame);
    UI.btnAchievements.addEventListener('click', showAchievements);
    UI.btnCloseAchievements.addEventListener('click', hideAchievements);
    
    UI.drawPile.addEventListener('click', handleDrawAction);
    UI.btnEndTurn.addEventListener('click', handleDrawAction);
    UI.btnReady.addEventListener('click', handleReady);
}

function startGame(mode) {
    state.mode = mode;
    state.isGameOver = false;
    screens.mainMenu.classList.remove('active');
    UI.lobbyScreen.classList.remove('active'); // Ensure lobby hides when game starts
    screens.gameScreen.classList.add('active');

    setupDeck();
    dealInitialHands();
    insertExplodingKittens();

    state.currentPlayerIndex = 0;
    state.turnsRemaining = 1;
    state.selectedCards = [];
    state.actionStack = [];

    // Reset per-game achievement stats
    state.stats.gameDefuses = 0;
    state.stats.gamePairs = 0;

    render();
}

// Networking & Lobby
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // removed confusing chars
    let code = '';
    for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
}

function showLobby(type) {
    screens.mainMenu.classList.remove('active');
    UI.lobbyScreen.classList.add('active');
    
    if (type === 'host') {
        state.isHost = true;
        UI.lobbyHostView.classList.remove('hidden');
        UI.lobbyJoinView.classList.add('hidden');
        UI.lobbyCodeDisplay.textContent = "Loading...";
        
        const code = generateRoomCode();
        state.networkId = `exploding-kittens-${code}`;
        
        state.peer = new Peer(state.networkId);
        state.peer.on('open', (id) => {
            UI.lobbyCodeDisplay.textContent = code;
        });
        
        state.peer.on('connection', (conn) => {
            state.conn = conn;
            setupConnection();
            // Host starts the game upon connection
            startGame('online');
            sendNetworkState();
        });
        
    } else {
        state.isHost = false;
        UI.lobbyHostView.classList.add('hidden');
        UI.lobbyJoinView.classList.remove('hidden');
        UI.lobbyCodeInput.value = '';
    }
}

function hideLobby() {
    UI.lobbyScreen.classList.remove('active');
    screens.mainMenu.classList.add('active');
    if (state.peer) {
        state.peer.destroy();
        state.peer = null;
    }
}

function joinNetworkGame() {
    const code = UI.lobbyCodeInput.value.toUpperCase().trim();
    if (code.length !== 4) {
        alert("Please enter a valid 4-digit code.");
        return;
    }
    
    UI.btnConnect.disabled = true;
    UI.btnConnect.textContent = "Connecting...";
    
    state.peer = new Peer();
    state.peer.on('open', (id) => {
        const hostId = `exploding-kittens-${code}`;
        state.conn = state.peer.connect(hostId);
        
        state.conn.on('open', () => {
             // Let host trigger the game start via state update
             setupConnection();
             UI.lobbyScreen.classList.remove('active');
             screens.gameScreen.classList.add('active');
             state.mode = 'online';
        });
        
        state.conn.on('error', (err) => {
            alert("Connection failed.");
            UI.btnConnect.disabled = false;
            UI.btnConnect.textContent = "Connect";
        });
    });
}

function setupConnection() {
    state.conn.on('data', (data) => {
        if (data.type === 'STATE_SYNC') {
            state = { ...state, ...data.state };
            render();
        } else if (data.type === 'ACTION_SYNC') {
            handleNetworkAction(data.action, data.payload);
        }
    });

    state.conn.on('close', () => {
        alert("Opponent disconnected.");
        location.reload();
    });
}

function sendNetworkState() {
    if (!state.conn || !state.conn.open) return;
    // Don't sync full peer/conn objects, just game state
    const syncState = {
        deck: state.deck,
        discardPile: state.discardPile,
        players: state.players,
        currentPlayerIndex: state.currentPlayerIndex,
        turnsRemaining: state.turnsRemaining,
        isGameOver: state.isGameOver,
        actionStack: state.actionStack,
        selectedCards: state.selectedCards,
        mode: state.mode
    };
    state.conn.send({ type: 'STATE_SYNC', state: syncState });
}

function sendNetworkAction(action, payload) {
    if (!state.conn || !state.conn.open) return;
    state.conn.send({ type: 'ACTION_SYNC', action, payload });
}

function handleNetworkAction(action, payload) {
    // Specifically handle actions triggered by the other player 
    // that don't just naturally flow from a state sync
    if (action === 'DEFUSE_MODAL') {
        showDefuseModal(payload.playerIndex);
    } else if (action === 'HIDE_MODAL') {
        hideModal();
    } else if (action === 'NOPE_PROMPT') {
        promptNope(state.actionStack[state.actionStack.length-1]);
    }
}

// Deck Management
function getBaseDeck() {
    return [
        ...Array(4).fill(CardTypes.ATTACK),
        ...Array(4).fill(CardTypes.SKIP),
        ...Array(4).fill(CardTypes.FAVOR),
        ...Array(4).fill(CardTypes.SHUFFLE),
        ...Array(5).fill(CardTypes.SEEFUTURE),
        ...Array(5).fill(CardTypes.NOPE),
        ...Array(4).fill(CardTypes.CAT1),
        ...Array(4).fill(CardTypes.CAT2),
        ...Array(4).fill(CardTypes.CAT3),
        ...Array(4).fill(CardTypes.CAT4),
        ...Array(4).fill(CardTypes.CAT5),
    ];
}

function setupDeck() {
    state.discardPile = [];
    state.deck = shuffle(getBaseDeck());

    state.players = [
        { id: 'player1', name: 'Player 1', hand: [], isAI: false },
        { id: 'player2', name: state.mode === 'ai' ? 'AI Opponent' : 'Player 2', hand: [], isAI: state.mode === 'ai' }
    ];
}

function shuffle(array) {
    let currentIndex = array.length, randomIndex;
    let tempArray = [...array];
    while (currentIndex != 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [tempArray[currentIndex], tempArray[randomIndex]] = [tempArray[randomIndex], tempArray[currentIndex]];
    }
    return tempArray;
}

function dealInitialHands() {
    for (let p of state.players) {
        p.hand.push(CardTypes.DEFUSE);
        for (let i = 0; i < 4; i++) {
            p.hand.push(state.deck.pop());
        }
    }
}

function insertExplodingKittens() {
    state.deck.push(CardTypes.EXPLODE); // 1 Exploding Kitten for 2 players
    state.deck.push(...Array(4).fill(CardTypes.DEFUSE)); // Remaining 4 Defuse cards
    state.deck = shuffle(state.deck); // Reshuffle with Kittens and Defuses
}

function refillDeck() {
    const newDeck = getBaseDeck();
    newDeck.push(CardTypes.EXPLODE);
    newDeck.push(...Array(4).fill(CardTypes.DEFUSE));
    state.deck = shuffle(newDeck);
}

// Actions
function handleDrawAction() {
    if (state.players[state.currentPlayerIndex] && state.players[state.currentPlayerIndex].isAI) return;
    if (state.actionStack.length > 0) return; // Can't draw while action pending
    if (state.isGameOver) return;

    drawCard(state.currentPlayerIndex);
}

function drawCard(playerIndex) {
    if (state.isGameOver) return; // Removed deck.length===0 block to allow refill

    if (state.deck.length === 0) {
        refillDeck();
        sendNetworkState();
        showModal("Deck Refilled!", "The draw pile ran out of cards, so a brand new deck was magically shuffled in.", "OK", hideModal);
    }

    const card = state.deck.pop();
    const player = state.players[playerIndex];

    if (card === CardTypes.EXPLODE) {
        handleExplodingKitten(playerIndex);
    } else {
        player.hand.push(card);
        state.turnsRemaining--;
        sendNetworkState();
        if (state.turnsRemaining <= 0) {
            endTurn();
        } else {
            render();
            if (state.players[state.currentPlayerIndex].isAI && !state.isGameOver) {
                setTimeout(playAITurn, 1500);
            }
        }
    }
}

function handleExplodingKitten(playerIndex) {
    const player = state.players[playerIndex];
    const defuseIndex = player.hand.findIndex(c => c === CardTypes.DEFUSE);

    if (defuseIndex !== -1) {
        player.hand.splice(defuseIndex, 1);
        state.discardPile.push(CardTypes.DEFUSE);
        sendNetworkState();
        showDefuseModal(playerIndex);
        if (state.mode === 'online') sendNetworkAction('DEFUSE_MODAL', { playerIndex });
    } else {
        state.isGameOver = true;
        sendNetworkState();
        
        // Check for 'I AM LUCKY!' achievement for the other player
        const winningPlayerIdx = (playerIndex + 1) % state.players.length;
        const winningPlayer = state.players[winningPlayerIdx];
        const defuseCount = winningPlayer.hand.filter(c => c === CardTypes.DEFUSE).length;
        if (!winningPlayer.isAI && defuseCount >= 2) {
            unlockAchievement('lucky');
        }

        showModal("BOOM!", `${player.name} exploded! Game Over.`, "Restart", () => {
            hideModal();
            if (state.mode === 'online') sendNetworkAction('HIDE_MODAL');
            screens.gameScreen.classList.remove('active');
            screens.mainMenu.classList.add('active');
        });
    }
}

function showDefuseModal(playerIndex) {
    const player = state.players[playerIndex];

    if (player.isAI) {
        const insertIndex = Math.floor(Math.random() * (state.deck.length + 1));
        state.deck.splice(insertIndex, 0, CardTypes.EXPLODE);
        showModal("Defused!", `AI Opponent defused the kitten and hid it back in the deck!`, "Continue", () => {
            hideModal();
            state.turnsRemaining--;
            if (state.turnsRemaining <= 0) {
                endTurn();
            } else {
                render();
                if (state.players[state.currentPlayerIndex].isAI && !state.isGameOver) {
                    setTimeout(playAITurn, 1500);
                }
            }
        });
        return;
    }

    const maxDepth = state.deck.length;
    let html = `
        <div style="margin: 15px 0;">
            <p style="font-size: 0.9rem; margin-bottom: 5px;">Secretly choose where to put the Exploding Kitten back.</p>
            <p style="font-size: 0.8rem; color: #ff9500;">0 = Top (next card drawn), ${maxDepth} = Bottom.</p>
            <input type="number" id="kitten-placement" min="0" max="${maxDepth}" value="0" style="padding: 10px; font-size: 1.1rem; width: 100px; text-align: center; margin-top: 10px; border-radius: 8px; border: 1px solid var(--accent-orange); background: #333; color: white;">
        </div>
    `;

    unlockAchievement('close');
    state.stats.gameDefuses++;
    if (state.stats.gameDefuses >= 9) {
        unlockAchievement('ninelives');
    }

    showModal("Defuse Successful!", `You defused the Exploding Kitten!`, "Hide Kitten", () => {
        let pos = parseInt(document.getElementById('kitten-placement').value, 10);
        if (isNaN(pos) || pos < 0) pos = 0;

        let spliceIndex = state.deck.length - pos;
        if (spliceIndex < 0) spliceIndex = 0;
        state.deck.splice(spliceIndex, 0, CardTypes.EXPLODE);

        hideModal();
        if (state.mode === 'online') sendNetworkAction('HIDE_MODAL');
        state.turnsRemaining--;
        sendNetworkState();
        if (state.turnsRemaining <= 0) {
            endTurn();
        } else {
            render();
        }
    }, html);
}

function endTurn() {
    state.currentPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
    state.turnsRemaining = 1;
    state.selectedCards = [];
    sendNetworkState();

    if (state.players[state.currentPlayerIndex].isAI) {
        render();
        setTimeout(playAITurn, 1500);
    } else {
        if (state.mode === 'local') {
            triggerPassScreen();
        } else {
            render();
        }
    }
}

function triggerPassScreen() {
    screens.passScreen.classList.remove('hidden');
    UI.passMessage.textContent = `It is now ${state.players[state.currentPlayerIndex].name}'s turn. Please hand over the device.`;
    // Hide hands intentionally while passing
    UI.playerHand.innerHTML = '';
    UI.opponentHand.innerHTML = '';
}

function handleReady() {
    screens.passScreen.classList.add('hidden');
    render();
}

// Card Playing Mechanics
function handleCardClick(index) {
    if (state.players[state.currentPlayerIndex].isAI) return;
    
    // Prevent clicking if playing online and it's not actually your turn
    const isMyTurnOnlineHost = state.mode === 'online' && state.isHost && state.currentPlayerIndex === 0;
    const isMyTurnOnlineJoin = state.mode === 'online' && !state.isHost && state.currentPlayerIndex === 1;
    if (state.mode === 'online' && !isMyTurnOnlineHost && !isMyTurnOnlineJoin) {
        return; // Not your turn in online mode
    }

    if (state.actionStack.length > 0) {
        // Only Nope can be played during Nope window!
        const card = state.players[state.currentPlayerIndex].hand[index];
        if (card === CardTypes.NOPE) {
            playCard(state.currentPlayerIndex, [index]);
        }
        return;
    }

    const card = state.players[state.currentPlayerIndex].hand[index];

    // Toggle Selection for Combos if Cat Card
    if (card.startsWith('Tacocat') || card.startsWith('Cattermelon') || card.startsWith('Hairy') || card.startsWith('Beard') || card.startsWith('Rainbow')) {
        const selIdx = state.selectedCards.indexOf(index);
        if (selIdx > -1) {
            state.selectedCards.splice(selIdx, 1);
        } else {
            state.selectedCards.push(index);
        }

        // If 2 selected, check if pair
        if (state.selectedCards.length === 2) {
            const card1 = state.players[state.currentPlayerIndex].hand[state.selectedCards[0]];
            const card2 = state.players[state.currentPlayerIndex].hand[state.selectedCards[1]];
            if (card1 === card2) {
                // Pair combo!
                playCard(state.currentPlayerIndex, [...state.selectedCards]);
                state.selectedCards = [];
            } else {
                // Invalid pair warning
                state.selectedCards = [];
                showModal("Invalid Combo", "Cat Card combos must be a pair of the EXACT same cat (e.g. 2 Tacocats). You cannot mix different cats!", "OK", hideModal);
            }
        }
        render();
    } else {
        // Single card action
        playCard(state.currentPlayerIndex, [index]);
    }
}

function playCard(playerIndex, indices) {
    const player = state.players[playerIndex];

    // Sort indices descending to splice correctly
    indices.sort((a, b) => b - a);

    let playedCards = [];
    for (let idx of indices) {
        playedCards.push(player.hand[idx]);
        player.hand.splice(idx, 1);
    }

    // Put on discard
    state.discardPile.push(...playedCards);
    sendNetworkState();

    const cardType = playedCards[0];

    if (cardType === CardTypes.NOPE) {
        handleNopePlay(playerIndex);
    } else {
        // Initiate an action that can be noped
        initiateAction(playerIndex, playedCards);
    }
}

function initiateAction(playerIndex, cards) {
    const action = {
        playerIndex,
        cards,
        resolved: false,
        noped: false // track odd/even nope counts essentially
    };

    state.actionStack.push(action);
    sendNetworkState();
    promptNope(action);
    if (state.mode === 'online') sendNetworkAction('NOPE_PROMPT');
}

function promptNope(action) {
    clearTimeout(state.nopeTimer);

    const isNoped = action.noped;
    const cardName = action.cards.length === 2 ? "a Pair of Cats" : action.cards[0];
    const statusText = isNoped ? `The action (${cardName}) is currently CANCELLED.` : `The action (${cardName}) is currently ALLOWED.`;

    let html = '<div style="display:flex; flex-direction:column; gap:10px; margin-bottom: 20px;">';

    // Player 1 Nope Button
    const p1HasNope = state.players[0].hand.includes(CardTypes.NOPE);
    html += `<button id="btn-nope-p1" class="secondary-btn" ${!p1HasNope ? 'disabled' : ''}>Player 1: Play Nope</button>`;

    // Player 2 Nope Button
    const p2IsAI = state.players[1].isAI;
    const p2HasNope = state.players[1].hand.includes(CardTypes.NOPE);
    if (!p2IsAI) {
        html += `<button id="btn-nope-p2" class="secondary-btn" ${!p2HasNope ? 'disabled' : ''}>Player 2: Play Nope</button>`;
    } else {
        html += `<div style="color:var(--text-secondary);font-size:0.9rem;">AI Opponent is thinking...</div>`;
    }
    html += '</div>';

    html += '<div style="display:flex; justify-content:center; gap:10px;">';
    let responder = !isNoped ? (action.playerIndex + 1) % 2 : action.playerIndex;
    
    // In online mode, verify identity of buttons before rendering them enabled
    const p1IsMe = (state.mode === 'online' && state.isHost) || state.mode !== 'online';
    const p2IsMe = (state.mode === 'online' && !state.isHost) || state.mode !== 'online';

    if (responder === 0 && p1IsMe) {
        html += `<button id="btn-pass-p1" class="primary-btn">Player 1: Pass (Allow)</button>`;
    } else if (responder === 1 && !p2IsAI && p2IsMe) {
        html += `<button id="btn-pass-p2" class="primary-btn">Player 2: Pass (Allow)</button>`;
    }
    html += '</div>';

    showModal("Waiting for Nope...", statusText, null, null, html);

    setTimeout(() => {
        const btnP1 = document.getElementById('btn-nope-p1');
        if (btnP1 && !btnP1.disabled && p1IsMe) btnP1.onclick = () => playNopeFromModal(0);

        const btnP2 = document.getElementById('btn-nope-p2');
        if (btnP2 && !btnP2.disabled && p2IsMe) btnP2.onclick = () => playNopeFromModal(1);

        const passP1 = document.getElementById('btn-pass-p1');
        if (passP1) passP1.onclick = resolveActionStack;

        const passP2 = document.getElementById('btn-pass-p2');
        if (passP2) passP2.onclick = resolveActionStack;
    }, 0);

    if (p2IsAI && p2HasNope) {
        // AI logic for deciding to Nope
        const shouldNope = (action.playerIndex !== 1 && !isNoped) || (action.playerIndex === 1 && isNoped);
        if (shouldNope && Math.random() > 0.2) {
            state.nopeTimer = setTimeout(() => {
                playNopeFromModal(1);
            }, 1000 + Math.random() * 1500); // 1-2.5 sec delay
            return;
        }
    }

    state.nopeTimer = setTimeout(() => {
        resolveActionStack();
    }, 5000);

    render();
}

function playNopeFromModal(playerIndex) {
    const nopeIndex = state.players[playerIndex].hand.indexOf(CardTypes.NOPE);
    if (nopeIndex !== -1) {
        if (!state.players[playerIndex].isAI) {
            state.stats.globalNopes++;
            saveAchievements(); // Save new count immediately
            if (state.stats.globalNopes >= 10) {
                unlockAchievement('nope');
            }
        }
        playCard(playerIndex, [nopeIndex]);
    }
}

function handleNopePlay(playerIndex) {
    if (state.actionStack.length === 0) return;

    const currentAction = state.actionStack[state.actionStack.length - 1];
    currentAction.noped = !currentAction.noped;

    promptNope(currentAction);
    render();
}

function resolveActionStack() {
    clearTimeout(state.nopeTimer);
    hideModal();
    if (UI.modalAltBtn) {
        UI.modalAltBtn.classList.add('hidden');
    }

    if (state.actionStack.length === 0) return;

    const action = state.actionStack.pop();

    if (!action.noped) {
        applyCardEffect(action.cards, action.playerIndex);
    }

    state.actionStack = []; // Clear remaining
    render();

    if (state.players[state.currentPlayerIndex].isAI && !state.isGameOver) {
        setTimeout(playAITurn, 1500);
    }
}

function applyCardEffect(cards, playerIndex) {
    const isPair = cards.length === 2;
    const targetPlayerIndex = (playerIndex + 1) % 2; // Support for 2 players
    const targetPlayer = state.players[targetPlayerIndex];
    const player = state.players[playerIndex];

    if (isPair) {
        if (!player.isAI) {
            state.stats.gamePairs++;
            if (state.stats.gamePairs >= 3) {
                unlockAchievement('robbery');
            }
        }
        // Steal a random card
        if (targetPlayer.hand.length > 0) {
            const stealIdx = Math.floor(Math.random() * targetPlayer.hand.length);
            const stolenCard = targetPlayer.hand.splice(stealIdx, 1)[0];
            state.players[playerIndex].hand.push(stolenCard);
            showModal("Stole Card", `You stole a card from ${targetPlayer.name}.`, "OK", hideModal);
        }
        return;
    }

    const card = cards[0];
    switch (card) {
        case CardTypes.ATTACK:
            state.turnsRemaining = 0;
            const nextPlayer = (state.currentPlayerIndex + 1) % state.players.length;
            endTurn();
            // Attack stack: if next player attacked, they add their 2 to the remaining turns.
            // standard rules: next player gets 2 turns
            state.turnsRemaining = 2;
            break;
        case CardTypes.SKIP:
            state.turnsRemaining--;
            if (state.turnsRemaining <= 0) {
                endTurn();
            } else {
                render();
            }
            break;
        case CardTypes.SHUFFLE:
            state.deck = shuffle(state.deck);
            break;
        case CardTypes.SEEFUTURE:
            if (state.players[playerIndex].isAI) {
                showModal("See the Future", "AI Opponent looked at the top 3 cards of the deck.", "Close", hideModal);
            } else {
                const topCards = state.deck.slice(-3).reverse();
                let html = '<div class="future-cards">';
                topCards.forEach(c => {
                    html += `<div class="card"><div class="card-inner" style="font-size:0.7rem;text-align:center;">${c}</div></div>`;
                });
                html += '</div>';
                showModal("See the Future", "The next 3 cards are:", "Close", hideModal, html);
            }
            break;
        case CardTypes.FAVOR:
            if (!player.isAI) {
                unlockAchievement('favor');
            }
            if (targetPlayer.hand.length > 0) {
                // Opponent chooses card. In local/AI we will automate a random one for simplicity, 
                // or random for AI and prompt for P2.
                const stealIdx = Math.floor(Math.random() * targetPlayer.hand.length);
                const favoredCard = targetPlayer.hand.splice(stealIdx, 1)[0];
                state.players[playerIndex].hand.push(favoredCard);
                showModal("Favor", `${targetPlayer.name} gave you a card.`, "OK", hideModal);
            }
            break;
    }
}

function playAITurn() {
    if (state.isGameOver) return;

    // Simple AI logic:
    // If has cards that don't need targeting, randomly play one with 30% chance.
    // Otherwise draw.
    const aiPlayer = state.players[1];
    const playableCards = aiPlayer.hand.map((c, i) => ({ c, i })).filter(o => {
        return o.c === CardTypes.SEEFUTURE || o.c === CardTypes.SHUFFLE;
    });

    if (playableCards.length > 0 && Math.random() > 0.6) {
        const choice = playableCards[Math.floor(Math.random() * playableCards.length)];
        playCard(1, [choice.i]);
    } else {
        drawCard(1);
    }
}

// Rendering
function render() {
    UI.deckCount.textContent = state.deck.length;

    let turnStatus = `${state.players[state.currentPlayerIndex].name}'s Turn`;
    if (state.turnsRemaining > 1) {
        turnStatus += ` (${state.turnsRemaining} turns left)`;
    }
    UI.turnIndicator.textContent = turnStatus;

    // Discard Pile
    UI.discardPile.innerHTML = '';
    if (state.discardPile.length > 0) {
        const topCard = state.discardPile[state.discardPile.length - 1];
        UI.discardPile.appendChild(createCardElement(topCard, false));
    } else {
        UI.discardPile.innerHTML = '<div class="pile-placeholder">Discard</div>';
    }

    // Active Player Hand
    UI.playerHand.innerHTML = '';
    
    let bottomPlayerIndex;
    let topPlayerIndex;
    
    if (state.mode === 'ai') {
        bottomPlayerIndex = 0;
        topPlayerIndex = 1;
    } else if (state.mode === 'online') {
        bottomPlayerIndex = state.isHost ? 0 : 1;
        topPlayerIndex = state.isHost ? 1 : 0;
    } else {
        bottomPlayerIndex = state.currentPlayerIndex;
        topPlayerIndex = (state.currentPlayerIndex + 1) % 2;
    }
    
    const bottomPlayer = state.players[bottomPlayerIndex];
    const topPlayer = state.players[topPlayerIndex];

    bottomPlayer.hand.forEach((card, index) => {
        const isSelected = bottomPlayerIndex === state.currentPlayerIndex && state.selectedCards.includes(index);
        const cardEl = createCardElement(card, true, isSelected);
        if (bottomPlayerIndex === state.currentPlayerIndex && !bottomPlayer.isAI) {
            cardEl.addEventListener('click', () => handleCardClick(index));
        }
        UI.playerHand.appendChild(cardEl);
    });

    // Opponent Area
    UI.opponentHand.innerHTML = '';
    UI.opponentHandCount.textContent = topPlayer.hand.length;

    topPlayer.hand.forEach(() => {
        const cardEl = document.createElement('div');
        cardEl.className = 'card card-back';
        cardEl.innerHTML = '<span>EK</span>';
        UI.opponentHand.appendChild(cardEl);
    });

    // Update Draw Button
    if (bottomPlayerIndex !== state.currentPlayerIndex) {
        UI.btnEndTurn.textContent = "Wait...";
        UI.btnEndTurn.disabled = true;
    } else if (state.actionStack.length > 0 && bottomPlayer.hand.includes(CardTypes.NOPE)) {
        UI.btnEndTurn.textContent = "You can't draw during action";
        UI.btnEndTurn.disabled = true;
    } else {
        UI.btnEndTurn.textContent = "End Turn (Draw)";
        UI.btnEndTurn.disabled = false;
    }
}

function createCardElement(cardType, isInteractable = false, isSelected = false) {
    const el = document.createElement('div');
    const classType = cardType.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    el.className = `card card-${classType}`;
    if (isSelected) {
        el.style.transform = 'translateY(-20px) scale(1.05)';
        el.style.zIndex = '10';
        el.style.boxShadow = '0 0 15px var(--accent-orange)';
    }

    // Determine if we have an image for this card type yet
    let styleAttr = '';
    let classExtra = 'has-image';
    
    if (cardType === CardTypes.EXPLODE) {
        styleAttr = `style="background-image: url('assets/explode.png');"`;
    } else if (cardType === CardTypes.DEFUSE) {
        styleAttr = `style="background-image: url('assets/defuse.png');"`;
    } else if (cardType === CardTypes.CAT1) {
        styleAttr = `style="background-image: url('assets/tacocat.png');"`;
    } else if (cardType === CardTypes.CAT2) {
        styleAttr = `style="background-image: url('assets/cattermelon.png');"`;
    } else if (cardType === CardTypes.CAT3) {
        styleAttr = `style="background-image: url('assets/hairypotatocat.png');"`;
    } else if (cardType === CardTypes.CAT4) {
        styleAttr = `style="background-image: url('assets/beardcat.png');"`;
    } else if (cardType === CardTypes.CAT5) {
        styleAttr = `style="background-image: url('assets/rainbowralphingcat.png');"`;
    } else if (cardType === CardTypes.ATTACK) {
        styleAttr = `style="background-image: url('assets/attack.png');"`;
    } else if (cardType === CardTypes.SKIP) {
        styleAttr = `style="background-image: url('assets/skip.png');"`;
    } else if (cardType === CardTypes.FAVOR) {
        styleAttr = `style="background-image: url('assets/favor.png');"`;
    } else if (cardType === CardTypes.SHUFFLE) {
        styleAttr = `style="background-image: url('assets/shuffle.png');"`;
    } else if (cardType === CardTypes.SEEFUTURE) {
        styleAttr = `style="background-image: url('assets/seethefuture.png');"`;
    } else if (cardType === CardTypes.NOPE) {
        styleAttr = `style="background-image: url('assets/nope.png');"`;
    } else {
        classExtra = ''; // Fallback for any unknown card
    }

    el.innerHTML = `
        <div class="card-inner ${classExtra}" ${styleAttr}>
            <div class="card-title" style="font-size:0.8rem">${cardType}</div>
            <div class="card-desc">Action</div>
        </div>
    `;
    return el;
}

function showModal(title, desc, btnText, btnAction, customHtml = '') {
    UI.modalTitle.textContent = title;
    UI.modalDesc.textContent = desc;
    UI.modalContent.innerHTML = customHtml;
    
    if (btnText) {
        UI.modalClose.textContent = btnText;
        UI.modalClose.onclick = btnAction;
        UI.modalClose.classList.remove('hidden');
    } else {
        UI.modalClose.classList.add('hidden');
    }
    
    UI.modal.classList.remove('hidden');
}

function hideModal() {
    UI.modal.classList.add('hidden');
}

// --- ACHIEVEMENTS LOGIC ---

function loadAchievements() {
    const saved = localStorage.getItem('ek_achievements');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            Object.keys(state.achievements).forEach(key => {
                if (data[key]) state.achievements[key].unlocked = data[key];
            });
            if (data.globalNopes) state.stats.globalNopes = data.globalNopes;
        } catch(e) { console.error("Could not parse saved achievements."); }
    }
}

function saveAchievements() {
    const data = {
        globalNopes: state.stats.globalNopes
    };
    Object.keys(state.achievements).forEach(key => {
        data[key] = state.achievements[key].unlocked;
    });
    localStorage.setItem('ek_achievements', JSON.stringify(data));
}

function unlockAchievement(id) {
    const ach = state.achievements[id];
    if (!ach || ach.unlocked) return; // Already unlocked or invalid

    ach.unlocked = true;
    saveAchievements();
    showAchievementToast(ach);
}

function showAchievementToast(ach) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
        <div class="toast-icon">🏆</div>
        <div class="toast-content">
            <h4>Achievement Unlocked!</h4>
            <p>${ach.title}</p>
        </div>
    `;
    
    UI.toastContainer.appendChild(toast);
    
    // Trigger animation
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });
    });

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

function showAchievements() {
    screens.mainMenu.classList.remove('active');
    screens.achievementsScreen.classList.add('active');
    UI.achievementsList.innerHTML = '';

    Object.values(state.achievements).forEach(ach => {
        if (ach.secret && !ach.unlocked) return; // Hide secret achievements until unlocked

        const el = document.createElement('div');
        el.className = `achievement-item ${ach.unlocked ? 'unlocked' : ''}`;
        
        // Use a generic lock icon if locked
        const icon = ach.unlocked ? '🏆' : '🔒';
        
        el.innerHTML = `
            <div class="achievement-icon">${icon}</div>
            <div class="achievement-details">
                <div class="achievement-title">${ach.title}</div>
                <div class="achievement-desc">${ach.unlocked ? ach.desc : (ach.secret ? '???' : ach.desc)}</div>
            </div>
        `;
        UI.achievementsList.appendChild(el);
    });
}

function hideAchievements() {
    screens.achievementsScreen.classList.remove('active');
    screens.mainMenu.classList.add('active');
}

// Start
init();
