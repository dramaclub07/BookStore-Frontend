// Base URL for API (aligned with signup.js)
const BASE_URL = 'http://127.0.0.1:3000/api/v1'; // Consistent with signup.js

console.log('login.js running');

// Initialize Facebook SDK
window.fbAsyncInit = function() {
    FB.init({
        appId: 'your_facebook_app_id', // Replace with your actual Facebook App ID
        cookie: true,
        xfbml: true,
        version: 'v20.0'
    });
    FB.AppEvents.logPageView();
};

// Function to handle Google Sign-In response
function handleCredentialResponse(response) {
    console.log("Google Sign-In successful!");
    const id_token = response.credential;
    verifySocialToken(id_token, 'google');
}

// Function to handle Facebook Sign-In
function facebookSignIn() {
    console.log("Initiating Facebook Sign-In");
    FB.login(function(response) {
        if (response.authResponse) {
            const accessToken = response.authResponse.accessToken;
            console.log("Facebook Sign-In successful! Access token received.");
            verifySocialToken(accessToken, 'facebook');
        } else {
            console.error('User cancelled Facebook login or did not fully authorize.');
            alert('Facebook login cancelled');
        }
    }, { scope: 'email' });
}

// Function to verify social tokens (Google or Facebook) with your backend
async function verifySocialToken(token, provider) {
    try {
        console.log(`Sending ${provider} token to backend for verification`);
        const endpoint = provider === 'google' ? '/google_auth' : '/facebook_auth';
        
        const response = await fetch(`${BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            console.log("User authenticated successfully:", data.user);
            
            // Store tokens and user info in localStorage (aligned with signup.js)
            localStorage.setItem('access_token', data.access_token);
            localStorage.setItem('refresh_token', data.refresh_token);
            localStorage.setItem('user', JSON.stringify({
                id: data.user.id,
                email: data.user.email,
                full_name: data.user.full_name,
                role: data.user.role // Store role from social login
            }));
            localStorage.setItem('username', data.user.full_name || data.user.email.split('@')[0]);
            localStorage.setItem('socialEmail', data.user.email);
            localStorage.setItem('socialProvider', provider);
            localStorage.setItem('token_expires_in', Date.now() + (data.expires_in * 1000));
            localStorage.setItem('justLoggedIn', 'true'); // Flag for homepage refresh
            
            alert(`${provider.charAt(0).toUpperCase() + provider.slice(1)} login successful! Welcome, ${data.user.full_name || data.user.email.split('@')[0]}`);
            window.location.href = '../pages/homePage.html';
        } else {
            console.error(`${provider} authentication failed:`, data.error || "Unknown error");
            alert(`Authentication failed: ${data.error || "Unknown error"}`);
        }
    } catch (error) {
        console.error(`Error verifying ${provider} token:`, error);
        alert(`Failed to verify ${provider} token: ${error.message}`);
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
        const response = await fetch(`${BASE_URL}/refresh`, {
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

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", async function () {
    displayRandomQuote();

    // Redirect to signup.html when "Signup" tab is clicked
    document.querySelector('.tab[data-tab="signup"]').addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = '../pages/signup.html';
    });

    // Password toggle functionality
    const loginPasswordInput = document.getElementById('login-password');
    const loginTogglePassword = document.getElementById('login-toggle-password');
    const loginEyeIcon = loginTogglePassword?.querySelector('svg');
    if (loginTogglePassword && loginEyeIcon) {
        loginTogglePassword.addEventListener('click', () => {
            if (loginPasswordInput.type === 'password') {
                loginPasswordInput.type = 'text';
                loginEyeIcon.style.opacity = '0.5';
            } else {
                loginPasswordInput.type = 'password';
                loginEyeIcon.style.opacity = '1';
            }
        });
    }

    // Handle "Remember Me" functionality
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const rememberMeCheckbox = document.getElementById('rememberMe');

    if (localStorage.getItem('rememberedEmail')) {
        emailInput.value = localStorage.getItem('rememberedEmail');
        if (rememberMeCheckbox) rememberMeCheckbox.checked = true;
    }

    // Form submission for email/password login
    document.getElementById('login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = emailInput.value.trim();
        const password = passwordInput.value.trim();

        // Validation aligned with signup.js
        const emailRegex = /^[\w+\-.]+@(gmail\.com|yahoo\.com|outlook\.com)$/i;
        if (!email || !emailRegex.test(email)) {
            alert('Please enter a valid email (e.g., user@gmail.com, user@yahoo.com, or user@outlook.com).');
            return;
        }

        if (!password || password.length < 6) {
            alert('Password must be at least 6 characters.');
            return;
        }

        // Handle "Remember Me"
        if (rememberMeCheckbox && rememberMeCheckbox.checked) {
            localStorage.setItem('rememberedEmail', email);
        } else {
            localStorage.removeItem('rememberedEmail');
        }

        try {
            const payload = { email, password };
            console.log('Login payload:', payload);
            const response = await fetch(`${BASE_URL}/users/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            console.log('Login response:', data);
            if (response.ok && data.access_token) {
                // Store tokens and user info in localStorage (aligned with signup.js)
                localStorage.setItem('access_token', data.access_token);
                localStorage.setItem('refresh_token', data.refresh_token);
                localStorage.setItem('token_expires_in', Date.now() + (data.expires_in * 1000));
                localStorage.setItem('user', JSON.stringify({
                    id: data.user.id,
                    email: data.user.email,
                    full_name: data.user.full_name,
                    role: data.user.role // Store role from login response
                }));
                localStorage.setItem('username', data.user.full_name || email.split('@')[0]);
                localStorage.setItem('justLoggedIn', 'true'); // Flag for homepage refresh

                console.log('Username stored in localStorage:', localStorage.getItem('username'));
                console.log('User role stored in localStorage:', data.user.role);
                alert(data.message || 'Login successful!');
                window.location.href = '../pages/homePage.html';
            } else {
                alert(data.errors || data.error || 'Invalid email or password.');
            }
        } catch (error) {
            console.error('Login error:', error.message);
            alert(`Failed to connect to the server at ${BASE_URL}. Error: ${error.message}`);
        }
    });

    // Ensure token is valid on page load (optional)
    await ensureValidToken();
});