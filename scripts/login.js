// Base URL for API
const API_BASE_URL = 'http://127.0.0.1:3000/';

// GitHub OAuth configuration
const GITHUB_CLIENT_ID = 'Ov23liI3VxGwFnrQoeL1'; // Replace with your actual GitHub Client ID
const GITHUB_REDIRECT_URI = 'http://127.0.0.1:5500/pages/login.html'; // Must match GitHub OAuth app settings

console.log('login.js running');

// Function to handle Google Sign-In response
function handleCredentialResponse(response) {
    console.log("Google Sign-In successful!");
    const id_token = response.credential;
    verifySocialToken(id_token, 'google');
}

// Function to handle GitHub Sign-In
function githubSignIn() {
    console.log("Initiating GitHub Sign-In");
    const authUrl = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(GITHUB_REDIRECT_URI)}&scope=user:email`;
    window.location.href = authUrl; // Redirect to GitHub
}

// Function to verify social tokens (Google or GitHub) with your backend
async function verifySocialToken(tokenOrCode, provider) {
    try {
        console.log(`Sending ${provider} ${provider === 'google' ? 'token' : 'code'} to backend for verification`);
        const endpoint = provider === 'google' ? '/api/v1/google_auth' : '/api/v1/github_auth/login';
        const payload = provider === 'google' ? { token: tokenOrCode } : { code: tokenOrCode };

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (response.ok) {
            console.log("User authenticated successfully:", data.user);

            // Store tokens and user info in localStorage
            localStorage.setItem('access_token', data.access_token);
            localStorage.setItem('refresh_token', data.refresh_token);
            localStorage.setItem('username', data.user.full_name || data.user.email.split('@')[0]);
            localStorage.setItem('socialEmail', data.user.email);
            localStorage.setItem('socialProvider', provider);
            localStorage.setItem('token_expires_in', Date.now() + (data.expires_in * 1000));

            localStorage.setItem('justLoggedIn', 'true'); // Flag for homepage refresh

            alert(`${provider.charAt(0).toUpperCase() + provider.slice(1)} login successful! Welcome, ${data.user.full_name || data.user.email.split('@')[0]}`);
            window.location.href = '../pages/homePage.html'; // Redirect to homepage
        } else {
            console.error(`${provider} authentication failed:`, data.error || "Unknown error");
            alert(`Authentication failed: ${data.error || "Unknown error"}`); // Show the specific error
        }
    } catch (error) {
        console.error(`Error verifying ${provider} ${provider === 'google' ? 'token' : 'code'}:`, error);
        alert(`Failed to verify ${provider} ${provider === 'google' ? 'token' : 'code'}: ${error.message}`);
    }
}

// Function to refresh the access token
async function refreshAccessToken() {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
        console.error('No refresh token available');
        return false;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/v1/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ refresh_token: refreshToken })
        });

        const data = await response.json();
        if (response.ok && data.access_token) {
            localStorage.setItem('access_token', data.access_token);
            localStorage.setItem('token_expires_in', Date.now() + (data.expires_in * 1000));
            console.log('Access token refreshed successfully');
            return true;
        } else {
            console.error('Failed to refresh token:', data.error);
            localStorage.clear();
            alert('Session expired. Please log in again.');
            window.location.href = '../pages/login.html';
            return false;
        }
    } catch (error) {
        console.error('Error refreshing token:', error);
        localStorage.clear();
        window.location.href = '../pages/login.html';
        return false;
    }
}

// Function to check if token is expired and refresh if needed
async function ensureValidToken() {
    const expiresIn = localStorage.getItem('token_expires_in');
    if (!expiresIn || Date.now() >= expiresIn) {
        console.log('Token expired or not set, attempting to refresh');
        return await refreshAccessToken();
    }
    return true;
}

// Fallback quotes in case the API fails
const fallbackQuotes = [
    { quote: "A room without books is like a body without a soul.", author: "Marcus Tullius Cicero" },
    { quote: "The only thing that you absolutely have to know, is the location of the library.", author: "Albert Einstein" },
    { quote: "Books are a uniquely portable magic.", author: "Stephen King" },
    { quote: "I have always imagined that Paradise will be a kind of library.", author: "Jorge Luis Borges" },
    { quote: "Reading is to the mind what exercise is to the body.", author: "Joseph Addison" }
];

let fallbackQuoteIndex = 0;

// Function to fetch a random quote from Quotable API
async function fetchRandomQuote() {
    try {
        const response = await fetch('https://api.quotable.io/random?tags=books|literature|motivation|inspirational');
        if (!response.ok) throw new Error(`Error ${response.status}: Unable to fetch quote`);
        const data = await response.json();
        return { quote: data.content, author: data.author };
    } catch (error) {
        console.error('Error fetching random quote:', error);
        const quote = fallbackQuotes[fallbackQuoteIndex];
        fallbackQuoteIndex = (fallbackQuoteIndex + 1) % fallbackQuotes.length;
        return quote;
    }
}

// Function to display the random quote and rotate every 10 seconds
function displayRandomQuote() {
    const quoteText = document.getElementById('quote-text');
    const quoteAuthor = document.getElementById('quote-author');
    if (!quoteText || !quoteAuthor) {
        console.error('Quote elements not found in the DOM');
        return;
    }

    const updateQuote = async () => {
        const { quote, author } = await fetchRandomQuote();
        quoteText.style.opacity = '0';
        quoteAuthor.style.opacity = '0';
        setTimeout(() => {
            quoteText.textContent = `"${quote}"`;
            quoteAuthor.textContent = `— ${author}`;
            quoteText.style.opacity = '1';
            quoteAuthor.style.opacity = '1';
        }, 500);
    };

    updateQuote();
    setInterval(updateQuote, 10000);
}

// Handle GitHub callback on page load
function handleGitHubCallback() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
        console.log("GitHub code received:", code);
        verifySocialToken(code, 'github');
        // Clear the URL parameters to avoid re-processing
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", async function () {
    displayRandomQuote();
    handleGitHubCallback(); // Check for GitHub code on page load

    // Tab switching logic
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const tabId = tab.getAttribute('data-tab');
            document.querySelectorAll('.auth-card').forEach(card => card.classList.remove('active'));
            document.getElementById(`${tabId}-form`).classList.add('active');
        });
    });

    // Toggle to signup form
    document.querySelector('.toggle-signup').addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelector('.tab[data-tab="login"]').classList.remove('active');
        document.querySelector('.tab[data-tab="signup"]').classList.add('active');
        document.querySelector('#login-form').classList.remove('active');
        document.querySelector('#signup-form').classList.add('active');
    });

    // Password visibility toggle for login form
    const loginPasswordInput = document.getElementById('login-password');
    const loginTogglePassword = document.getElementById('login-toggle-password');
    const loginEyeIcon = loginTogglePassword?.querySelector('svg');
    if (loginTogglePassword && loginEyeIcon) {
        loginTogglePassword.addEventListener('click', () => {
            loginPasswordInput.type = 'text';
            loginEyeIcon.style.opacity = '0.5';
            setTimeout(() => {
                loginPasswordInput.type = 'password';
                loginEyeIcon.style.opacity = '1';
            }, 2000);
        });
    }

    // Password visibility toggle for signup form
    const signupPasswordInput = document.getElementById('signup-password');
    const signupTogglePassword = document.getElementById('signup-toggle-password');
    const signupEyeIcon = signupTogglePassword?.querySelector('svg');
    if (signupTogglePassword && signupEyeIcon) {
        signupTogglePassword.addEventListener('click', () => {
            signupPasswordInput.type = 'text';
            signupEyeIcon.style.opacity = '0.5';
            setTimeout(() => {
                signupPasswordInput.type = 'password';
                signupEyeIcon.style.opacity = '1';
            }, 2000);
        });
    }

    // Remember Me functionality
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const rememberMeCheckbox = document.getElementById('rememberMe');

    if (localStorage.getItem('rememberedEmail')) {
        emailInput.value = localStorage.getItem('rememberedEmail');
        if (rememberMeCheckbox) rememberMeCheckbox.checked = true;
    }

    // Login form submission
    document.getElementById('login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        const emailRegex = /^[\w+\-.]+@(gmail\.com|yahoo\.com|outlook\.com)$/i;

        if (!email || !emailRegex.test(email)) {
            alert('Please enter a valid email (Gmail, Yahoo, or Outlook).');
            return;
        }

        if (!password || password.length < 6) {
            alert('Password must be at least 6 characters.');
            return;
        }

        if (rememberMeCheckbox && rememberMeCheckbox.checked) {
            localStorage.setItem('rememberedEmail', email);
        } else {
            localStorage.removeItem('rememberedEmail');
        }

        try {
            const payload = { email, password };
            console.log('Login payload:', payload);
            const response = await fetch(`${API_BASE_URL}/api/v1/users/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            console.log('Login response:', data);
            if (response.ok && data.access_token) {
                localStorage.setItem('access_token', data.access_token);
                localStorage.setItem('refresh_token', data.refresh_token);
                localStorage.setItem('token_expires_in', Date.now() + (data.expires_in * 1000));
                const username = data.user?.full_name || email.split('@')[0];
                localStorage.setItem('username', username);
                localStorage.setItem('justLoggedIn', 'true'); // Flag for homepage refresh
                console.log('Username stored in localStorage:', username);
                alert(data.message || 'Login successful!');
                window.location.href = '../pages/homePage.html';
            } else {
                alert(data.errors || data.error || 'Invalid email or password.');
            }
        } catch (error) {
            console.error('Login error:', error.message);
            alert(`Failed to connect to the server at ${API_BASE_URL}. Error: ${error.message}`);
        }
    });

    // Signup form submission
    document.getElementById('signup-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('signup-name');
        const emailInput = document.getElementById('signup-email');
        const passwordInput = document.getElementById('signup-password');
        const mobileInput = document.getElementById('signup-mobile');
        const name = nameInput.value.trim();
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();
        const mobile = mobileInput.value.trim();
        const emailRegex = /^[\w+\-.]+@(gmail\.com|yahoo\.com|outlook\.com)$/i;
        const mobileRegex = /^[6789]\d{9}$/;

        if (!name || name.length < 3 || name.length > 50) {
            alert('Full Name must be between 3 and 50 characters.');
            return;
        }

        if (!email || !emailRegex.test(email)) {
            alert('Please enter a valid email (Gmail, Yahoo, or Outlook).');
            return;
        }

        if (!password || password.length < 6) {
            alert('Password must be at least 6 characters.');
            return;
        }

        if (!mobile || !mobileRegex.test(mobile)) {
            alert('Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user: { full_name: name, email, password, mobile_number: mobile } })
            });

            const data = await response.json();
            if (response.ok && data.message) {
                alert(data.message);
                document.querySelector('.tab[data-tab="login"]').click();
            } else {
                alert(data.errors || data.error || 'Failed to sign up. Please try again.');
            }
        } catch (error) {
            console.error('Signup error:', error.message);
            alert(`Failed to connect to the server at ${API_BASE_URL}. Error: ${error.message}`);
        }
    });

    // Ensure token is valid on page load
    await ensureValidToken();
});