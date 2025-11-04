const express = require('express');
const { createClient } = require('redis');
const app = express();

// Redis client setup with retry strategy
const client = createClient({
    url: 'redis://localhost:6379',
    socket: {
        reconnectStrategy: (retries) => {
            if (retries > 20) {
                console.log('Could not connect to Redis, falling back to in-memory storage');
                return false;
            }
            return Math.min(retries * 100, 3000);
        }
    }
});

client.on('error', err => {
    console.log('Redis Client Error:', err);
});

async function initRedis() {
    try {
        console.log('Attempting to connect to Redis...');
        await client.connect();
        console.log('Successfully connected to Redis');
        
        // Test the connection
        await client.set('test', 'Hello from Redis');
        const testValue = await client.get('test');
        console.log('Redis test value:', testValue);
        
    } catch (err) {
        console.log('Failed to connect to Redis:', err.message);
        console.log('Falling back to in-memory storage');
        useInMemory = true;
    }
}

initRedis();

// Serve static files from public directory
app.use(express.static('public'));

// Get top 10 scores
app.get('/leaderboard', async (req, res) => {
    try {
        // Use a raw ZREVRANGE WITHSCORES command to be compatible across redis versions
        const raw = await client.sendCommand(['ZREVRANGE', 'game:leaderboard', '0', '9', 'WITHSCORES']);
        // raw is an array like [ member1, score1, member2, score2, ... ]
        const scores = [];
        for (let i = 0; i < raw.length; i += 2) {
            const value = raw[i];
            const score = Number(raw[i + 1]);
            scores.push({ value, score });
        }
        res.json(scores);
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({ error: 'Failed to fetch leaderboard' });
    }
});

// Save score
app.post('/score', express.json(), async (req, res) => {
    const { player, score } = req.body;
    try {
        // For Redis: only update if new score is greater than existing score
        const existing = await client.zScore('game:leaderboard', player);
        if (existing === null || Number(score) > Number(existing)) {
            await client.zAdd('game:leaderboard', [{ score: Number(score), value: player }]);
            return res.json({ success: true, updated: true });
        }

        // no update performed because existing score is greater or equal
        res.json({ success: true, updated: false });
    } catch (error) {
        console.error('Error saving score:', error);
        res.status(500).json({ error: 'Failed to save score' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});