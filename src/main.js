
export const CONSTANTS = {
    COLORS: {
        BACKGROUND: '#0F172A',
        PADDLE: '#38BDF8',
        BALL: '#FFFFFF',
        BLOCKS: ['#EF4444', '#F97316', '#EAB308', '#22C55E'] // Red, Orange, Yellow, Green
    },
    GAME: {
        PADDLE_WIDTH_RATIO: 0.2, // 20% of screen width
        PADDLE_HEIGHT_RATIO: 0.02,
        BALL_RADIUS_RATIO: 0.015,
        BLOCK_ROWS: 5,
        BLOCK_COLS: 8,
        PADDLE_Y_OFFSET: 0.1, // 10% from bottom
        BALL_SPEED_BASE: 0.005, // Speed relative to height
    }
};

export class Ball {
    constructor(x, y, radius, color) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.vx = 0;
        this.vy = 0;
        this.speed = 0;
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.closePath();
    }
}

export class Paddle {
    constructor(x, y, width, height, color) {
        this.x = x; // Center x
        this.y = y; // Top y
        this.width = width;
        this.height = height;
        this.color = color;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x - this.width / 2, this.y, this.width, this.height);
    }

    updatePosition(x) {
        this.x = x;
    }
}

export const GameState = {
    INIT: 'INIT',
    PLAYING: 'PLAYING',
    GAME_OVER: 'GAME_OVER',
    VICTORY: 'VICTORY',
    LEVEL_COMPLETE: 'LEVEL_COMPLETE'
};

export class Block {
    constructor(x, y, width, height, color, type) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.color = color;
        this.type = type; // 1 for normal, 2 for reinforced
        this.active = true;
        this.health = type;
    }

    draw(ctx) {
        if (!this.active) return;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.strokeStyle = '#0F172A';
        ctx.lineWidth = 2;
        ctx.strokeRect(this.x, this.y, this.width, this.height);
    }

    hit() {
        this.health--;
        if (this.health <= 0) {
            this.active = false;
            return true; // Destroyed
        }
        return false; // Still active
    }
}

export class CollisionEngine {
    static checkWallCollision(ball, width, height) {
        let hit = false;
        // Left
        if (ball.x - ball.radius < 0) {
            ball.x = ball.radius;
            ball.vx = -ball.vx;
            hit = true;
        }
        // Right
        if (ball.x + ball.radius > width) {
            ball.x = width - ball.radius;
            ball.vx = -ball.vx;
            hit = true;
        }
        // Top
        if (ball.y - ball.radius < 0) {
            ball.y = ball.radius;
            ball.vy = -ball.vy;
            hit = true;
        }
        // Bottom check is handled by game logic (life loss)
        return { hit, bottom: (ball.y - ball.radius > height) };
    }

    static checkPaddleCollision(ball, paddle) {
        const pLeft = paddle.x - paddle.width / 2;
        const pRight = paddle.x + paddle.width / 2;
        const pTop = paddle.y;
        const pBottom = paddle.y + paddle.height;

        if (ball.y + ball.radius >= pTop &&
            ball.y - ball.radius <= pBottom &&
            ball.x >= pLeft &&
            ball.x <= pRight) {

            // Check if ball was moving down
            if (ball.vy > 0) {
                return true;
            }
        }
        return false;
    }

    static resolvePaddleCollision(ball, paddle) {
        // Calculate hit position ratio (-1 to 1)
        const hitPos = (ball.x - paddle.x) / (paddle.width / 2);

        // Reflection angle
        // Max reflection angle e.g. 60 degrees
        const maxAngle = Math.PI / 3;
        const angle = hitPos * maxAngle;

        // New velocity
        ball.vx = ball.speed * Math.sin(angle);
        ball.vy = -ball.speed * Math.cos(angle);
    }

    static checkBlockCollision(ball, block) {
        // Closest point on rectangle to circle center
        let closestX = Math.max(block.x, Math.min(ball.x, block.x + block.width));
        let closestY = Math.max(block.y, Math.min(ball.y, block.y + block.height));

        let distanceX = ball.x - closestX;
        let distanceY = ball.y - closestY;

        let distanceSquared = (distanceX * distanceX) + (distanceY * distanceY);

        if (distanceSquared < (ball.radius * ball.radius)) {
            return {
                collision: true,
                closestX,
                closestY
            };
        }
        return { collision: false };
    }

    static resolveBlockCollision(ball, block, collisionData) {
        // Determine collision side
        // Overlap on X axis
        const overlapX = (ball.radius + block.width / 2) - Math.abs(ball.x - (block.x + block.width / 2));
        const overlapY = (ball.radius + block.height / 2) - Math.abs(ball.y - (block.y + block.height / 2));

        if (overlapX < overlapY) {
            // Hit vertical side
            ball.vx = -ball.vx;
            // Correct position
            if (ball.x < block.x + block.width / 2) {
                ball.x -= overlapX;
            } else {
                ball.x += overlapX;
            }
        } else {
            // Hit horizontal side
            ball.vy = -ball.vy;
            // Correct position
            if (ball.y < block.y + block.height / 2) {
                ball.y -= overlapY;
            } else {
                ball.y += overlapY;
            }
        }
    }
}

class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Input handling
        this.setupInput();

        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.combo = 0;
        this.shake = 0;
        this.particles = [];

        this.state = GameState.INIT;
        this.init();
        this.lastTime = 0;
        this.loop = this.loop.bind(this);
        requestAnimationFrame(this.loop);
    }

    setupInput() {
        // Touch events
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });

        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.handleMouseUp());
        this.canvas.addEventListener('mouseleave', () => this.handleMouseUp());
    }

    handleTouchStart(e) {
        e.preventDefault();
        const touch = e.touches[0];
        this.lastTouchX = touch.clientX;

        if (this.state === GameState.INIT) {
            this.startGame();
        } else if (this.state === GameState.GAME_OVER || this.state === GameState.VICTORY) {
            this.init();
            this.state = GameState.INIT;
        } else if (this.state === GameState.LEVEL_COMPLETE) {
            this.startNextLevel();
        }
    }

    handleTouchMove(e) {
        e.preventDefault();
        if (this.state !== GameState.PLAYING && this.state !== GameState.INIT) return;

        const touch = e.touches[0];
        const deltaX = touch.clientX - this.lastTouchX;
        this.lastTouchX = touch.clientX;

        this.movePaddle(deltaX);
    }

    handleMouseDown(e) {
        this.isDragging = true;
        this.lastMouseX = e.clientX;
        if (this.state === GameState.INIT) {
            this.startGame();
        } else if (this.state === GameState.GAME_OVER || this.state === GameState.VICTORY) {
            this.init();
            this.state = GameState.INIT;
        } else if (this.state === GameState.LEVEL_COMPLETE) {
            this.startNextLevel();
        }
    }

    handleMouseMove(e) {
        if (!this.isDragging) return;
        if (this.state !== GameState.PLAYING && this.state !== GameState.INIT) return;

        // If lastMouseX is undefined (should not happen with isDragging check but safe to check)
        if (this.lastMouseX === undefined) {
            this.lastMouseX = e.clientX;
            return;
        }

        const deltaX = e.clientX - this.lastMouseX;
        this.lastMouseX = e.clientX;
        this.movePaddle(deltaX);
    }

    handleMouseUp() {
        this.isDragging = false;
        this.lastMouseX = undefined;
    }

    movePaddle(deltaX) {
        let newX = this.paddle.x + deltaX;
        // Clamp to screen
        const halfWidth = this.paddle.width / 2;
        if (newX - halfWidth < 0) newX = halfWidth;
        if (newX + halfWidth > this.width) newX = this.width - halfWidth;

        this.paddle.updatePosition(newX);

        // If in INIT state, ball follows paddle
        if (this.state === GameState.INIT) {
            this.ball.x = newX;
        }
    }

    startGame() {
        this.state = GameState.PLAYING;
        // Launch ball
        const speed = this.height * CONSTANTS.GAME.BALL_SPEED_BASE;
        this.ball.speed = speed;
        // Random angle between -45 and 45 degrees from vertical up
        // Math.random() is 0 to 1.
        // -0.5 is -0.5 to 0.5.
        // angle is -PI/2 + (-0.5 to 0.5) rads.
        // This is fine.

        const angle = -Math.PI / 2 + (Math.random() - 0.5);
        this.ball.vx = speed * Math.cos(angle);
        this.ball.vy = speed * Math.sin(angle);

        console.log("StartGame: ", {speed, angle, vx: this.ball.vx, vy: this.ball.vy, x: this.ball.x, y: this.ball.y});
    }

    resize() {
        const oldWidth = this.width;
        const oldHeight = this.height;

        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;

        this.width = this.canvas.width;
        this.height = this.canvas.height;

        if (oldWidth && oldHeight && (oldWidth !== this.width || oldHeight !== this.height)) {
            const scaleX = this.width / oldWidth;
            const scaleY = this.height / oldHeight;

            // Scale Paddle
            this.paddle.x *= scaleX;
            this.paddle.y *= scaleY;
            this.paddle.width *= scaleX;
            this.paddle.height *= scaleY;

            // Scale Ball
            this.ball.x *= scaleX;
            this.ball.y *= scaleY;
            // Scale radius by average scale or just one dimension to keep circle
            // Keep circle -> use min scale or X scale? X scale matches width.
            this.ball.radius *= scaleX;
            // Also scale velocity? Yes, if space scales, speed scales.
            this.ball.vx *= scaleX;
            this.ball.vy *= scaleY;
            this.ball.speed *= scaleY; // Approx

            // Scale Blocks
            this.blocks.forEach(b => {
                b.x *= scaleX;
                b.y *= scaleY;
                b.width *= scaleX;
                b.height *= scaleY;
            });

            // Scale Particles
            this.particles.forEach(p => {
                p.x *= scaleX;
                p.y *= scaleY;
            });
        }
    }

    init() {
        this.width = this.canvas.width;
        this.height = this.canvas.height;

        // Initialize Paddle
        const pWidth = this.width * CONSTANTS.GAME.PADDLE_WIDTH_RATIO;
        const pHeight = this.height * CONSTANTS.GAME.PADDLE_HEIGHT_RATIO;
        const pX = this.width / 2;
        const pY = this.height * (1 - CONSTANTS.GAME.PADDLE_Y_OFFSET);
        this.paddle = new Paddle(pX, pY, pWidth, pHeight, CONSTANTS.COLORS.PADDLE);

        // Initialize Ball
        const bRadius = this.width * CONSTANTS.GAME.BALL_RADIUS_RATIO;
        this.ball = new Ball(pX, pY - bRadius - 2, bRadius, CONSTANTS.COLORS.BALL);

        // Initialize Blocks
        this.blocks = [];
        const rows = CONSTANTS.GAME.BLOCK_ROWS;
        const cols = CONSTANTS.GAME.BLOCK_COLS;
        const bWidth = this.width / cols;
        const bHeight = this.height * 0.03; // 3% of screen height

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const color = CONSTANTS.COLORS.BLOCKS[r % CONSTANTS.COLORS.BLOCKS.length];
                // Reinforced blocks on level > 1 or random
                let type = 1;
                if (this.level > 1 && Math.random() < 0.2) type = 2; // 20% chance of reinforced
                // Move blocks down to 80px to avoid UI overlap
                this.blocks.push(new Block(c * bWidth, r * bHeight + 80, bWidth, bHeight, color, type));
            }
        }
    }

    update(dt) {
        // Normalize speed to 60fps
        const timeScale = dt / 16.667;

        // Update particles
        this.updateParticles(timeScale);

        if (this.shake > 0) this.shake -= 1 * timeScale;

        if (this.state !== GameState.PLAYING) return;

        // Ball movement
        if (isNaN(this.ball.x) || isNaN(this.ball.y)) {
            console.error("Ball position is NaN", this.ball);
        }
        this.ball.x += this.ball.vx * timeScale;
        this.ball.y += this.ball.vy * timeScale;

        // Wall Collision
        const wallRes = CollisionEngine.checkWallCollision(this.ball, this.width, this.height);
        if (wallRes.hit) {
            this.shake = 5;
        }
        if (wallRes.bottom) {
            this.handleLifeLost();
        }

        // Paddle Collision
        if (CollisionEngine.checkPaddleCollision(this.ball, this.paddle)) {
             this.shake = 5; // Screen shake on paddle hit
             this.combo = 0;
             CollisionEngine.resolvePaddleCollision(this.ball, this.paddle);
        }

        // Block Collision
        for (let block of this.blocks) {
            if (!block.active) continue;

            const result = CollisionEngine.checkBlockCollision(this.ball, block);
            if (result.collision) {
                const destroyed = block.hit();

                if (destroyed) {
                    this.combo++;
                    let points = (block.type === 2) ? 250 : 100;
                    if (this.combo > 1) {
                         points += 50 * (this.combo - 1);
                    }
                    this.score += points;
                    this.checkLevelComplete();

                    // Spawn particles
                    this.createParticles(block.x + block.width / 2, block.y + block.height / 2, block.color);
                } else {
                    this.shake = 5;
                }

                CollisionEngine.resolveBlockCollision(this.ball, block, result);
                break;
            }
        }
    }

    handleLifeLost() {
        this.lives--;
        if (this.lives > 0) {
            this.state = GameState.INIT;
            // Reset ball position
            const pX = this.paddle.x;
            const pY = this.paddle.y;
            const bRadius = this.ball.radius;
            this.ball.x = pX;
            this.ball.y = pY - bRadius - 2;
            this.ball.vx = 0;
            this.ball.vy = 0;
        } else {
            this.state = GameState.GAME_OVER;
        }
    }

    checkLevelComplete() {
        const activeBlocks = this.blocks.filter(b => b.active).length;
        if (activeBlocks === 0) {
            this.state = GameState.LEVEL_COMPLETE;
        }
    }

    startNextLevel() {
        this.level++;
        this.state = GameState.INIT;
        // Increase speed slightly
        CONSTANTS.GAME.BALL_SPEED_BASE *= 1.1;
        this.init(); // Resets paddle and ball, recreates blocks
    }

    createParticles(x, y, color) {
        for (let i = 0; i < 10; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 5,
                vy: (Math.random() - 0.5) * 5,
                life: 30,
                color: color
            });
        }
    }

    updateParticles(timeScale) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            let p = this.particles[i];
            p.x += p.vx * timeScale;
            p.y += p.vy * timeScale;
            p.life -= 1 * timeScale;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    draw() {
        this.ctx.save();
        if (this.shake > 0) {
            const dx = (Math.random() - 0.5) * 10;
            const dy = (Math.random() - 0.5) * 10;
            this.ctx.translate(dx, dy);
        }

        this.ctx.fillStyle = CONSTANTS.COLORS.BACKGROUND;
        this.ctx.fillRect(-10, -10, this.width + 20, this.height + 20);

        this.paddle.draw(this.ctx);
        this.ball.draw(this.ctx);
        this.blocks.forEach(block => block.draw(this.ctx));

        // Draw particles
        this.particles.forEach(p => {
            this.ctx.fillStyle = p.color;
            this.ctx.globalAlpha = p.life / 30;
            this.ctx.fillRect(p.x, p.y, 4, 4);
            this.ctx.globalAlpha = 1.0;
        });

        this.ctx.restore();

        // UI
        this.drawUI();
    }

    drawUI() {
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = '20px Arial';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Score: ${this.score}`, 20, 30);
        this.ctx.fillText(`Level: ${this.level}`, 20, 60);

        // Lives (Hearts)
        this.ctx.textAlign = 'right';
        let livesText = '❤️'.repeat(this.lives);
        this.ctx.fillText(livesText, this.width - 20, 30);

        if (this.state === GameState.INIT) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = '30px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText("TAP TO START", this.width / 2, this.height / 2);
        } else if (this.state === GameState.GAME_OVER) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = '40px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText("GAME OVER", this.width / 2, this.height / 2 - 20);
            this.ctx.font = '20px Arial';
            this.ctx.fillText(`Final Score: ${this.score}`, this.width / 2, this.height / 2 + 30);
            this.ctx.fillText("Tap to Restart", this.width / 2, this.height / 2 + 70);
        } else if (this.state === GameState.LEVEL_COMPLETE) {
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            this.ctx.fillRect(0, 0, this.width, this.height);
            this.ctx.fillStyle = '#FFFFFF';
            this.ctx.font = '30px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText("LEVEL COMPLETE!", this.width / 2, this.height / 2 - 20);
            this.ctx.font = '20px Arial';
            this.ctx.fillText("Tap to Next Level", this.width / 2, this.height / 2 + 30);
        }
    }

    loop(timestamp) {
        const dt = timestamp - this.lastTime;
        this.lastTime = timestamp;

        this.update(dt);
        this.draw();

        requestAnimationFrame(this.loop);
    }
}

// Start the game
new Game();
