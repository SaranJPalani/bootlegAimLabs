const express = require('express');
const { createClient } = require('redis');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

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

// Fallback to in-memory storage if Redis is unavailable
let useInMemory = false;
let inMemoryLeaderboard = [];

client.on('error', err => {
    console.log('Redis Client Error:', err);
    useInMemory = true;
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
        if (useInMemory) {
            const sortedLeaderboard = inMemoryLeaderboard
                .sort((a, b) => b.score - a.score)
                .slice(0, 10)
                .map(entry => ({ value: entry.player, score: entry.score }));
            return res.json(sortedLeaderboard);
        }

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
        if (useInMemory) {
            inMemoryLeaderboard.push({ player, score });
            inMemoryLeaderboard = inMemoryLeaderboard
                .sort((a, b) => b.score - a.score)
                .slice(0, 10);
            return res.json({ success: true });
        }

        // zAdd expects an array of entries in this client version
        await client.zAdd('game:leaderboard', [{ score: score, value: player }]);
        res.json({ success: true });
    } catch (error) {
        console.error('Error saving score:', error);
        res.status(500).json({ error: 'Failed to save score' });
    }
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});