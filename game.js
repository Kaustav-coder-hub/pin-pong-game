const canvas = document.getElementById('pongCanvas');
const ctx = canvas.getContext('2d');

// Game objects
const paddleWidth = 15;
const paddleHeight = 100;
const ballRadius = 10;

let leftPaddle = {
    x: 10,
    y: canvas.height / 2 - paddleHeight / 2,
    width: paddleWidth,
    height: paddleHeight
};

let rightPaddle = {
    x: canvas.width - paddleWidth - 10,
    y: canvas.height / 2 - paddleHeight / 2,
    width: paddleWidth,
    height: paddleHeight,
    speed: 4 // AI paddle speed
};

let ball = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    vx: 5 * (Math.random() > 0.5 ? 1 : -1),
    vy: 3 * (Math.random() > 0.5 ? 1 : -1),
    radius: ballRadius
};

// Score tracking
let userScore = 0;
let aiScore = 0;
let userHighScore = 0;
let aiHighScore = 0;

// Input state
let keys = {};
leftPaddle.speed = 6;

// Audio (simple beep) using WebAudio
let audioCtx = null;
function beep(freq = 440, duration = 0.05, volume = 0.05) {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.type = 'sine';
        o.frequency.value = freq;
        g.gain.value = volume;
        o.connect(g);
        g.connect(audioCtx.destination);
        o.start();
        setTimeout(() => { o.stop(); }, duration * 1000);
    } catch (e) {
        // ignore audio errors
    }
}

// UI
const userScoreDiv = document.getElementById('user-score');
const aiScoreDiv = document.getElementById('ai-score');
const userHighScoreDiv = document.getElementById('user-highscore');
const aiHighScoreDiv = document.getElementById('ai-highscore');
const restartBtn = document.getElementById('restartBtn');
const exitBtn = document.getElementById('exitBtn');
const pauseBtn = document.getElementById('pauseBtn');
const hintsDiv = document.getElementById('hints');
let pausedOverlayVisible = false;

// Mouse control for left paddle
canvas.addEventListener('mousemove', function(e) {
    const rect = canvas.getBoundingClientRect();
    let mouseY = e.clientY - rect.top;
    leftPaddle.y = mouseY - paddleHeight / 2;
    // Clamp paddle within canvas
    leftPaddle.y = Math.max(0, Math.min(canvas.height - paddleHeight, leftPaddle.y));
});

// Touch support
canvas.addEventListener('touchmove', function(e) {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    let touchY = e.touches[0].clientY - rect.top;
    leftPaddle.y = touchY - paddleHeight / 2;
    leftPaddle.y = Math.max(0, Math.min(canvas.height - paddleHeight, leftPaddle.y));
}, { passive: false });

// Improved mobile controls: left-side control zone and up/down buttons
const leftControl = document.getElementById('leftControl');
const upBtn = document.getElementById('upBtn');
const downBtn = document.getElementById('downBtn');

let mobileMoveUp = false;
let mobileMoveDown = false;

if (leftControl) {
    // Map touches on the left control to paddle position (control is off-canvas so finger doesn't block ball)
    leftControl.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const t = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        // Use the Y within canvas to compute paddle center
        const y = t.clientY - rect.top;
        leftPaddle.y = y - paddleHeight / 2;
        leftPaddle.y = Math.max(0, Math.min(canvas.height - paddleHeight, leftPaddle.y));
    }, { passive: false });

    leftControl.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const t = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const y = t.clientY - rect.top;
        // Smoothly interpolate to touched position to avoid jumps
        const targetY = Math.max(0, Math.min(canvas.height - paddleHeight, y - paddleHeight / 2));
        // Ease toward target for smooth motion
        leftPaddle.y += (targetY - leftPaddle.y) * 0.3;
    }, { passive: false });

    leftControl.addEventListener('touchend', (e) => { e.preventDefault(); }, { passive: false });
}

// Up/down button behavior (supports touch and mouse)
function bindButtonHold(btn, setter) {
    let holdId = null;
    const start = (e) => { e.preventDefault(); setter(true); };
    const end = (e) => { e && e.preventDefault(); setter(false); };
    btn.addEventListener('touchstart', start, { passive: false });
    btn.addEventListener('mousedown', start);
    window.addEventListener('touchend', end, { passive: false });
    window.addEventListener('mouseup', end);
}

if (upBtn && downBtn) {
    bindButtonHold(upBtn, (v) => mobileMoveUp = v);
    bindButtonHold(downBtn, (v) => mobileMoveDown = v);
}


// Keyboard controls
window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        togglePause();
        e.preventDefault();
        return;
    }
    keys[e.key.toLowerCase()] = true;
});
window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

pauseBtn.addEventListener('click', () => togglePause());

function togglePause() {
    gameRunning = !gameRunning;
    if (gameRunning) {
        pauseBtn.textContent = 'Pause';
        gameLoop();
    } else {
        pauseBtn.textContent = 'Resume';
    }
}

// Draw everything
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw paddles
    ctx.fillStyle = '#fff';
    ctx.fillRect(leftPaddle.x, leftPaddle.y, leftPaddle.width, leftPaddle.height);
    ctx.fillRect(rightPaddle.x, rightPaddle.y, rightPaddle.width, rightPaddle.height);

    // Draw ball
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#0ff';
    ctx.fill();
    ctx.closePath();
}

function updateScoreboard() {
    userScoreDiv.textContent = `User: ${userScore}`;
    aiScoreDiv.textContent = `AI: ${aiScore}`;
    userHighScoreDiv.textContent = `User High: ${userHighScore}`;
    aiHighScoreDiv.textContent = `AI High: ${aiHighScore}`;
}

// Ball movement and collision detection
function update() {
    // Player keyboard movement
    if (keys['w'] || keys['arrowup']) {
        leftPaddle.y -= leftPaddle.speed;
    }
    if (keys['s'] || keys['arrowdown']) {
        leftPaddle.y += leftPaddle.speed;
    }
    leftPaddle.y = Math.max(0, Math.min(canvas.height - paddleHeight, leftPaddle.y));

    // Move ball
    ball.x += ball.vx;
    ball.y += ball.vy;

    // Wall collision (top and bottom)
    if (ball.y - ball.radius < 0 || ball.y + ball.radius > canvas.height) {
        ball.vy = -ball.vy;
    }

    // Paddle collision - Left
    if (
        ball.x - ball.radius < leftPaddle.x + leftPaddle.width &&
        ball.y > leftPaddle.y &&
        ball.y < leftPaddle.y + leftPaddle.height
    ) {
        ball.vx = -ball.vx * 1.05; // speed up slightly
        ball.vy += (Math.random() - 0.5) * 2;
        // limit speed
        ball.vx = Math.max(Math.min(ball.vx, 12), -12);
        ball.x = leftPaddle.x + leftPaddle.width + ball.radius; // Prevent sticking
        beep(600, 0.04, 0.06);
    }

    // Paddle collision - Right (AI)
    if (
        ball.x + ball.radius > rightPaddle.x &&
        ball.y > rightPaddle.y &&
        ball.y < rightPaddle.y + rightPaddle.height
    ) {
        ball.vx = -ball.vx * 1.05; // speed up on hit
        ball.vy += (Math.random() - 0.5) * 2;
        ball.vx = Math.max(Math.min(ball.vx, 12), -12);
        ball.x = rightPaddle.x - ball.radius; // Prevent sticking
        beep(300, 0.04, 0.04);
    }

    // Score check (ball out of bounds)
    if (ball.x < 0) {
        // AI scores
        aiScore++;
        if (aiScore > aiHighScore) aiHighScore = aiScore;
        resetBall();
        updateScoreboard();
        beep(220, 0.08, 0.08);
    } else if (ball.x > canvas.width) {
        // User scores
        userScore++;
        if (userScore > userHighScore) userHighScore = userScore;
        resetBall();
        updateScoreboard();
        beep(880, 0.08, 0.08);
    }

    // Improved AI: follow ball but add a bit of reaction and difficulty scaling
    const aiCenter = rightPaddle.y + rightPaddle.height / 2;
    const diff = ball.y - aiCenter;
    // AI speed slightly scales with current score difference (keeps game interesting)
    const difficultyMultiplier = 1 + Math.min(Math.abs(userScore - aiScore) * 0.03, 0.6);
    if (Math.abs(diff) > 10) {
        rightPaddle.y += Math.sign(diff) * rightPaddle.speed * difficultyMultiplier;
    }
    // Clamp AI paddle
    rightPaddle.y = Math.max(0, Math.min(canvas.height - paddleHeight, rightPaddle.y));

    // Mobile buttons continuous movement
    if (mobileMoveUp) leftPaddle.y -= leftPaddle.speed;
    if (mobileMoveDown) leftPaddle.y += leftPaddle.speed;
    leftPaddle.y = Math.max(0, Math.min(canvas.height - paddleHeight, leftPaddle.y));
}

function resetBall() {
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    // start with moderate random direction
    const angle = (Math.random() * Math.PI / 4) - (Math.PI / 8);
    const speed = 5;
    const dir = (Math.random() > 0.5) ? 1 : -1;
    ball.vx = speed * Math.cos(angle) * dir;
    ball.vy = speed * Math.sin(angle) * (Math.random() > 0.5 ? 1 : -1);
}

// Main game loop
let gameRunning = true;
function gameLoop() {
    if (!gameRunning) return;
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

function restartGame() {
    userScore = 0;
    aiScore = 0;
    userHighScore = 0;
    aiHighScore = 0;
    leftPaddle.y = canvas.height / 2 - paddleHeight / 2;
    rightPaddle.y = canvas.height / 2 - paddleHeight / 2;
    resetBall();
    updateScoreboard();
    if (!gameRunning) {
        gameRunning = true;
        gameLoop();
    }
}

// Persist high scores
function loadHighScores() {
    try {
        const data = JSON.parse(localStorage.getItem('pong_highscores') || '{}');
        userHighScore = data.userHigh || 0;
        aiHighScore = data.aiHigh || 0;
    } catch (e) {
        userHighScore = 0; aiHighScore = 0;
    }
}
function saveHighScores() {
    try {
        localStorage.setItem('pong_highscores', JSON.stringify({ userHigh: userHighScore, aiHigh: aiHighScore }));
    } catch (e) {}
}

function exitGame() {
    // You may want to redirect, here we reload page for simplicity
    location.reload();
}

// Button event listeners
restartBtn.addEventListener('click', () => {
    restartGame();
});
exitBtn.addEventListener('click', () => {
    exitGame();
});

// Save highs on unload
window.addEventListener('beforeunload', saveHighScores);

// Start the game
loadHighScores();
updateScoreboard();
gameLoop();