const express = require('express');
const redis = require('redis');
const app = express();
const port = 4000;
const BACKEND_URL = 'http://127.0.0.1:3000/api/v1';

// Initialize Redis client
const redisClient = redis.createClient({
    url: 'redis://localhost:6379',
    legacyMode: false,
});

redisClient.on('error', (err) => console.error('Redis Client Error:', err));
redisClient.on('connect', () => console.log('Connected to Redis'));
redisClient.on('ready', () => console.log('Redis connection established'));
redisClient.on('reconnecting', () => console.log('Reconnecting to Redis...'));

async function initializeRedis() {
    try {
        await redisClient.connect();
        await redisClient.set('test_key', 'test_value');
        const value = await redisClient.get('test_key');
        console.log('Redis test value:', value);
        console.log('Redis client initialized successfully');
    } catch (err) {
        console.error('Failed to connect to Redis:', err);
        console.warn('Proceeding without Redis caching as Redis is unavailable');
    }
}

app.use(express.json());

// Enable CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'http://127.0.0.1:5500');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD');
    res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.header('Access-Control-Expose-Headers', 'Authorization');
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

// Proxy middleware
app.use('/api/v1', async (req, res) => {
    const url = `${BACKEND_URL}${req.url}`;
    const method = req.method;
    const headers = { ...req.headers };
    delete headers['host'];
    headers['Host'] = '127.0.0.1:3000';

    // Try to fetch from backend first
    console.log(`Proxying request: ${method} ${url}`);

    try {
        const backendResponse = await fetch(url, {
            method,
            headers,
            body: method !== 'GET' && method !== 'HEAD' ? JSON.stringify(req.body) : undefined,
        });

        if (!backendResponse.ok) {
            const errorText = await backendResponse.text();
            console.error(`Backend error for ${url}: ${backendResponse.status} - ${errorText}`);
            throw new Error(`Backend error: ${backendResponse.status} - ${errorText}`);
        }

        const contentType = backendResponse.headers.get('content-type');
        let data;
        if (contentType && contentType.includes('application/json')) {
            data = await backendResponse.json();
        } else {
            data = await backendResponse.text();
            throw new Error(`Backend response is not JSON: ${data}`);
        }

        backendResponse.headers.forEach((value, key) => {
            res.setHeader(key, value);
        });

        // Cache the response if it's a GET request and successful
        if (method === 'GET' && backendResponse.status === 200 && typeof data === 'object' && redisClient.isOpen) {
            try {
                console.log(`Attempting to cache key: ${url}`);
                await redisClient.setEx(url, 3600, JSON.stringify({
                    status: backendResponse.status,
                    data,
                }));
                console.log(`Cache set for ${url}`);
            } catch (cacheError) {
                console.error(`Redis cache set failed: ${cacheError.message}`);
            }
        } else {
            console.log(`Not caching response: Method=${method}, Status=${backendResponse.status}, Data type=${typeof data}`);
        }

        return res.status(backendResponse.status).json(data);
    } catch (error) {
        console.error(`Backend failed for ${url}: ${error.message}`);

        // Fallback to Redis for GET requests
        if (method === 'GET' && redisClient.isOpen) {
            try {
                console.log(`Fetching cache for key: ${url}`);
                const cached = await redisClient.get(url);
                if (cached) {
                    console.log(`Serving cached response from Redis for ${url}`);
                    const { status, data } = JSON.parse(cached);
                    return res.status(status).json(data);
                }
                console.log(`No Redis cache found for ${url}`);
            } catch (redisError) {
                console.error(`Redis fetch error: ${redisError.message}`);
            }
        }

        // Mock responses for non-critical endpoints (excluding /api/v1/orders)
        const mockResponses = {
            '/api/v1/refresh': { 
                access_token: 'mock_access_token', 
                refresh_token: 'mock_refresh_token', 
                expires_in: 3600 
            },
            '/api/v1/github_auth/login': { 
                access_token: 'mock_github_access_token', 
                refresh_token: 'mock_github_refresh_token', 
                expires_in: 3600,
                user: { email: 'mock@github.com', full_name: 'Mock GitHub User' }
            },
            '/api/v1/google_auth': { 
                access_token: 'mock_google_access_token', 
                refresh_token: 'mock_google_refresh_token', 
                expires_in: 3600,
                user: { email: 'mock@google.com', full_name: 'Mock Google User' }
            },
            '/api/v1/users/login': {
                access_token: 'mock_user_access_token',
                refresh_token: 'mock_user_refresh_token',
                expires_in: 3600,
                user: { email: 'mock@example.com', full_name: 'Mock User' }
            },
            '/api/v1/books': { books: [{ id: 1, book_name: 'Mock Book', author_name: 'Mock Author' }], pagination: { total_count: 1 } },
            '/api/v1/carts': { cart_items: [], total_items: 0, total_price: 0 },
            '/api/v1/wishlists': { wishlist: [] },
            '/api/v1/addresses': { addresses: [] },
            '/api/v1/orders' : {orders: [] },
            '/api/v1/users/profile': { name: 'Guest', email: 'guest@example.com', role: 'user' },
        };

        // Dynamic mock for /api/v1/books/:id (only as a last resort)
        const bookMatch = req.url.match(/^\/books\/(\d+)$/);
        if (bookMatch && method === 'GET') {
            const bookId = parseInt(bookMatch[1]);
            const mockBooks = {
                1: { id: 1, book_name: 'Mock Book 1', author_name: 'Mock Author 1', book_image: 'mock_image_1.jpg' },
                2: { id: 2, book_name: 'Mock Book 2', author_name: 'Mock Author 2', book_image: 'mock_image_2.jpg' }
            };
            const mockBook = mockBooks[bookId];
            if (mockBook) {
                console.log(`Serving mock book for /api/v1/books/${bookId} (no backend or cache available)`);
                return res.status(200).json(mockBook);
            }
        }

        // Normalize the URL for matching other mock responses
        const baseUrl = req.baseUrl + (req.path === '/' ? '' : req.path);
        console.log(`Matching mock for baseUrl: ${baseUrl} (full URL: ${req.url})`);

        const mockKey = Object.keys(mockResponses).find((key) => {
            const normalizedKey = key.endsWith('/') ? key.slice(0, -1) : key;
            const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
            console.log(`Comparing ${normalizedKey} with ${normalizedBaseUrl}`);
            return normalizedKey === normalizedBaseUrl;
        });

        if (mockKey && method === 'GET') {
            console.log(`No backend or cache available, serving mock response for ${req.url} (matched ${mockKey})`);
            const mockData = mockResponses[mockKey];
            return res.status(200).json(mockData);
        }

        // If no backend, cache, or mock response is available, return 503
        console.log(`No backend, cache, or mock response available for ${req.url}, returning 503`);
        return res.status(503).json({ 
            message: 'Service temporarily unavailable', 
            error: error.message 
        });
    }
});

// Start server
async function startServer() {
    await initializeRedis();
    app.listen(port, () => {
        console.log(`Proxy server running on http://127.0.0.1:${port}`);
    });
}

startServer();

process.on('SIGTERM', async () => {
    console.log('Shutting down...');
    if (redisClient.isOpen) {
        await redisClient.quit();
    }
    process.exit(0);
});