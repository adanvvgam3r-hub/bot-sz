// Complete Ranking System Implementation

class RankingSystem {
    constructor() {
        this.rankings = {};
    }

    addPlayer(playerID, score) {
        this.rankings[playerID] = score;
    }

    getRankings() {
        return Object.entries(this.rankings)
            .sort((a, b) => b[1] - a[1])
            .map(([playerID, score], index) => ({ playerID, score, rank: index + 1 }));
    }
}

// X1 Flow Updated with Buttons Instead of Modal Input
function createButtonFlow() {
    const buttonContainer = document.createElement('div');
    const button1 = document.createElement('button');
    button1.innerText = 'Option 1';
    button1.onclick = () => handleOption(1);

    const button2 = document.createElement('button');
    button2.innerText = 'Option 2';
    button2.onclick = () => handleOption(2);

    buttonContainer.appendChild(button1);
    buttonContainer.appendChild(button2);
    document.body.appendChild(buttonContainer);
}

function handleOption(option) {
    console.log(`Option ${option} selected`);
    // Add the logic for handling the option
}

// Improved Simulation Features with Proper Bracket Generation
function generateBrackets(players) {
    const brackets = [];
    for (let i = 0; i < players.length; i += 2) {
        brackets.push(players.slice(i, i + 2));
    }
    return brackets;
}


// Usage Example
const rankingSystem = new RankingSystem();
rankingSystem.addPlayer('Player1', 150);
rankingSystem.addPlayer('Player2', 200);
const rankings = rankingSystem.getRankings();
console.log(rankings);

createButtonFlow();
const players = ['Player1', 'Player2', 'Player3', 'Player4'];
const matchBrackets = generateBrackets(players);
console.log(matchBrackets);