let score = 0;
let timeLeft = 30.0;
let gameInterval;
let isGameRunning = false;
let currentCircle = null;

const gameArea = document.getElementById('game-area');
const scoreElement = document.getElementById('score');
const timeElement = document.getElementById('time');
const startScreen = document.getElementById('start-screen');
const startButton = document.getElementById('start-button');
const playerNameInput = document.getElementById('player-name');
const leaderboardList = document.getElementById('leaderboard-list');

// Load leaderboard initially
loadLeaderboard();

startButton.addEventListener('click', () => {
    const playerName = playerNameInput.value.trim();
    if (playerName) {
        startGame();
    } else {
        alert('Please enter your name!');
    }
});

function startGame() {
    score = 0;
    timeLeft = 30.0;
    isGameRunning = true;
    startScreen.style.display = 'none';
    updateScore();
    updateTime();
    spawnCircle();

    gameInterval = setInterval(() => {
        timeLeft -= 0.1;
        updateTime();

        if (timeLeft <= 0) {
            endGame();
        }
    }, 100);
}

function spawnCircle() {
    if (!isGameRunning) return;

    if (currentCircle) {
        currentCircle.remove();
    }

    const circle = document.createElement('div');
    circle.className = 'circle';
    
    const size = Math.random() * (80 - 30) + 30;
    const maxX = gameArea.clientWidth - size;
    const maxY = gameArea.clientHeight - size;
    
    circle.style.width = `${size}px`;
    circle.style.height = `${size}px`;
    circle.style.left = `${Math.random() * maxX}px`;
    circle.style.top = `${Math.random() * maxY}px`;

    circle.addEventListener('click', () => {
        score++;
        timeLeft += 0.25; // Add 0.25 seconds for each click
        updateScore();
        updateTime();
        spawnCircle();
    });

    gameArea.appendChild(circle);
    currentCircle = circle;
}

function updateScore() {
    scoreElement.textContent = score;
}

function updateTime() {
    timeElement.textContent = timeLeft.toFixed(1);
}

async function endGame() {
    isGameRunning = false;
    clearInterval(gameInterval);
    if (currentCircle) {
        currentCircle.remove();
        currentCircle = null;
    }

    // Save score
    const playerName = playerNameInput.value;
    try {
        const response = await fetch('/score', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                player: playerName,
                score: score
            })
        });

        if (response.ok) {
            loadLeaderboard();
        }
    } catch (error) {
        console.error('Error saving score:', error);
    }

    // Show start screen
    startScreen.style.display = 'block';
}

async function loadLeaderboard() {
    try {
        const response = await fetch('/leaderboard');
        const leaderboard = await response.json();
        
        leaderboardList.innerHTML = '';
        leaderboard.forEach((entry, index) => {
            const item = document.createElement('div');
            item.className = 'leaderboard-item';
            item.innerHTML = `
                <span>${index + 1}. ${entry.value}</span>
                <span>${entry.score}</span>
            `;
            leaderboardList.appendChild(item);
        });
    } catch (error) {
        console.error('Error loading leaderboard:', error);
    }
}