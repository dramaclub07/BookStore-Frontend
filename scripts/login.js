// Base URL for API
const API_BASE_URL = 'http://localhost:3000';

console.log('login.js running');

// Initialize Facebook SDK
window.fbAsyncInit = function() {
    FB.init({
        appId: 'your_facebook_app_id', // Replace with your Facebook App ID
        cookie: true,
        xfbml: true,
        version: 'v20.0'
    });
    FB.AppEvents.logPageView();
};

// Function to handle Google Sign-In response
function handleCredentialResponse(response) {
    console.log("Google Sign-In successful!");
    
    // Google Sign-In returns a credential with an ID token
    const id_token = response.credential;
    
    // Send the token to your backend for verification
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
        
        // Determine the endpoint based on the provider
        const endpoint = provider === 'google' ? '/api/v1/google_auth' : '/api/v1/facebook_auth';
        
        // Send the token to your Rails backend for verification
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ token })
        });
        
        const data = await response.json();
        
        if (response.ok && data.message === 'Authentication successful') {
            console.log("User authenticated successfully:", data.user);
            
            // Store user info in localStorage
            localStorage.setItem('token', data.token);
            localStorage.setItem('username', data.user.name || data.user.email.split('@')[0]);
            localStorage.setItem('socialEmail', data.user.email);
            localStorage.setItem('socialProvider', provider);
            
            // Hide social login buttons, show sign-out button
            document.querySelector('.social-login').style.display = 'none';
            document.getElementById('signout-container').style.display = 'flex';
            
            // Redirect to home page
            alert(`${provider.charAt(0).toUpperCase() + provider.slice(1)} login successful! Welcome, ${data.user.name || data.user.email.split('@')[0]}`);
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

// Function to handle Sign-Out (Google and Facebook)
function handleSignOut() {
    console.log('Signing out');
    
    // Determine the provider from localStorage
    const provider = localStorage.getItem('socialProvider');
    
    // Sign out from Google if applicable
    if (provider === 'google' && typeof google !== 'undefined' && google.accounts) {
        console.log('Signing out from Google');
        google.accounts.id.disableAutoSelect();
        google.accounts.id.revoke(localStorage.getItem('socialEmail') || '', () => {
            console.log('Google session revoked');
        });
    }
    
    // Sign out from Facebook if applicable
    if (provider === 'facebook') {
        console.log('Signing out from Facebook');
        FB.getLoginStatus(function(response) {
            if (response.status === 'connected') {
                FB.logout(function(response) {
                    console.log('Facebook session revoked');
                });
            }
        });
    }
    
    // Remove user data from localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('username');
    localStorage.removeItem('socialEmail');
    localStorage.removeItem('socialProvider');
    
    // Show social login buttons, hide sign-out button
    document.querySelector('.social-login').style.display = 'block';
    document.getElementById('signout-container').style.display = 'none';
    
    alert('Signed out successfully.');
}

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", function () {
    // Check if user is already signed in
    if (localStorage.getItem('token') && localStorage.getItem('socialEmail')) {
        document.querySelector('.social-login').style.display = 'none';
        document.getElementById('signout-container').style.display = 'flex';
    }

    // Tab switching with card transition
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

    // Toggle signup from login footer
    document.querySelector('.toggle-signup').addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelector('.tab[data-tab="login"]').classList.remove('active');
        document.querySelector('.tab[data-tab="signup"]').classList.add('active');
        document.querySelector('#login-form').classList.remove('active');
        document.querySelector('#signup-form').classList.add('active');
    });

    // Password toggle for login form
    const loginPasswordInput = document.getElementById('login-password');
    const loginTogglePassword = document.getElementById('login-toggle-password');
    const loginEyeIcon = loginTogglePassword.querySelector('svg');
    loginTogglePassword.addEventListener('click', () => {
        loginPasswordInput.type = 'text';
        loginEyeIcon.style.opacity = '0.5';

        setTimeout(() => {
            loginPasswordInput.type = 'password';
            loginEyeIcon.style.opacity = '1';
        }, 2000);
    });

    // Password toggle for signup form
    const signupPasswordInput = document.getElementById('signup-password');
    const signupTogglePassword = document.getElementById('signup-toggle-password');
    const signupEyeIcon = signupTogglePassword.querySelector('svg');
    signupTogglePassword.addEventListener('click', () => {
        signupPasswordInput.type = 'text';
        signupEyeIcon.style.opacity = '0.5';

        setTimeout(() => {
            signupPasswordInput.type = 'password';
            signupEyeIcon.style.opacity = '1';
        }, 2000);
    });

    // Forgot Password Modal handling
    const forgotPasswordModal = document.getElementById('forgot-password-modal');
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    const closeBtn = document.querySelector('.close-btn');

    forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        forgotPasswordModal.style.display = 'flex';
    });

    closeBtn.addEventListener('click', () => {
        forgotPasswordModal.style.display = 'none';
    });

    window.addEventListener('click', (e) => {
        if (e.target === forgotPasswordModal) {
            forgotPasswordModal.style.display = 'none';
        }
    });

    // Forgot Password form submission
    document.getElementById('forgot-password-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const emailInput = document.getElementById('forgot-email');
        const email = emailInput.value.trim();
        const emailRegex = /^[\w+\-.]+@(gmail\.com|yahoo\.com|outlook\.com)$/i;

        if (!email || !emailRegex.test(email)) {
            alert('Please enter a valid email (Gmail, Yahoo, or Outlook).');
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/forgot_password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await response.json();
            if (response.ok && data.message) {
                alert(data.message);
                forgotPasswordModal.style.display = 'none';
            } else {
                alert(data.errors || 'Failed to send OTP. Please try again.');
            }
        } catch (error) {
            alert(`Failed to connect to the server at ${API_BASE_URL}. Error: ${error.message}`);
        }
    });

    // Login form submission
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const rememberMeCheckbox = document.getElementById('rememberMe');

    if (localStorage.getItem('rememberedEmail')) {
        emailInput.value = localStorage.getItem('rememberedEmail');
        if (rememberMeCheckbox) rememberMeCheckbox.checked = true;
    }

    document.getElementById('login-form').addEventListener('submit', async (e) => {
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
            const response = await fetch(`${API_BASE_URL}/api/v1/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            console.log('Login response:', data);
            if (data.token) {
                localStorage.setItem('token', data.token);
                const username = data.user?.full_name || email.split('@')[0];
                localStorage.setItem('username', username);
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
    document.getElementById('signup-form').addEventListener('submit', async (e) => {
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
            const response = await fetch(`${API_BASE_URL}/api/v1/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user: { full_name: name, email, password, mobile_number: mobile } })
            });

            const data = await response.json();
            if (response.ok && data.message) {
                alert(data.message);
                document.querySelector('.tab[data-tab="login"]').click();
            } else {
                alert(data.errors || 'Failed to sign up. Please try again.');
            }
        } catch (error) {
            alert(`Failed to connect to the server at ${API_BASE_URL}. Error: ${error.message}`);
        }
    });

    // Attach sign-out handler
    document.getElementById('signout-button').addEventListener('click', handleSignOut);
});