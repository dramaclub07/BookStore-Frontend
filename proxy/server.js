const express = require('express');
const redis = require('redis');
const app = express();
const port = 4000;
const BACKEND_URL = 'http://127.0.0.1:3000/api/v1';

// Initialize Redis client
const redisClient = redis.createClient({
    url: 'redis://localhost:6379'
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));
redisClient.on('connect', () => console.log('Connected to Redis'));

(async () => {
    await redisClient.connect();
})();

app.use(express.json());

// Enable CORS for the proxy itself to avoid frontend issues
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
    res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.header('Access-Control-Expose-Headers', 'Authorization');
    next();
});

app.use('/api/v1', async (req, res) => {
    const url = `${BACKEND_URL}${req.url}`;
    const method = req.method;
    const headers = { ...req.headers, host: '127.0.0.1:3000' };
    delete headers['host'];

    console.log(`Proxying request: ${method} ${url}`);

    try {
        // Handle OPTIONS preflight requests
        if (method === 'OPTIONS') {
            const backendResponse = await fetch(url, { method, headers });
            const responseHeaders = {};
            backendResponse.headers.forEach((value, key) => {
                responseHeaders[key] = value;
            });
            console.log(`OPTIONS response status: ${backendResponse.status}`);
            return res.status(backendResponse.status).set(responseHeaders).end();
        }

        // Check Redis cache for GET requests
        if (method === 'GET') {
            const cached = await redisClient.get(url);
            if (cached) {
                console.log(`Serving cached response from Redis for ${url}`);
                const { status, data } = JSON.parse(cached);
                return res.status(status).json(data);
            }
        }

        // Fetch from backend for non-OPTIONS requests
        const backendResponse = await fetch(url, {
            method,
            headers,
            body: method !== 'GET' && method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
        });

        console.log(`Backend response status: ${backendResponse.status}`);
        console.log(`Backend response headers: ${JSON.stringify([...backendResponse.headers])}`);

        if (!backendResponse.ok) {
            const errorText = await backendResponse.text();
            throw new Error(`Backend error: ${backendResponse.status} - ${errorText}`);
        }

        let data;
        const contentType = backendResponse.headers.get('content-type');
        console.log(`Content-Type: ${contentType}`);

        if (contentType && contentType.includes('application/json')) {
            data = await backendResponse.json();
            console.log(`Backend response data: ${JSON.stringify(data)}`);
        } else {
            const text = await backendResponse.text();
            throw new Error(`Backend response is not JSON: ${text}`);
        }

        // Cache successful GET responses in Redis
        if (method === 'GET') {
            await redisClient.setEx(url, 3600, JSON.stringify({
                status: backendResponse.status,
                data,
            }));
            console.log(`Cached response in Redis for ${url}`);
        }

        res.status(backendResponse.status).json(data);
    } catch (error) {
        console.error(`Backend unavailable: ${error.message}`);

        // Serve cached response from Redis if available
        if (method === 'GET') {
            const cached = await redisClient.get(url);
            if (cached) {
                console.log(`Serving cached response from Redis for ${url}`);
                const { status, data } = JSON.parse(cached);
                return res.status(status).json(data);
            }
        }

        // Fallback mock response
        const mockResponses = {
            '/api/v1/books': { success: true, books: [], pagination: { total_count: 0 } },
            '/api/v1/carts': { success: true, cart_items: [], total_items: 0, total_price: 0 },
            '/api/v1/orders': { success: true, orders: [] },
            '/api/v1/wishlists': { success: true, wishlist: [] },
            '/api/v1/addresses': { success: true, addresses: [] },
            '/api/v1/users/profile': { success: true, name: '', email: '', mobile_number: '', role: 'user' },
            '/api/v1/refresh': { success: true, access_token: '', refresh_token: '' },
        };

        const mockKey = Object.keys(mockResponses).find((key) => req.url.startsWith(key));
        if (mockKey) {
            console.log(`Serving mock response for ${req.url}`);
            return res.status(200).json(mockResponses[mockKey]);
        }

        res.status(503).json({ success: false, message: 'Service temporarily unavailable' });
    }
});

app.listen(port, () => {
    console.log(`Proxy server running on http://127.0.0.1:${port}`);
});

process.on('SIGTERM', async () => {
    await redisClient.quit();
    process.exit(0);
});