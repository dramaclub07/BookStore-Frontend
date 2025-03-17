// Base URL for API
const API_BASE_URL = 'http://localhost:3000';

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", function () {
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

    // Password toggle for login form (inspired by fundooLogin.js)
    const loginPasswordInput = document.getElementById('login-password');
    const loginTogglePassword = document.getElementById('login-toggle-password');
    const loginEyeIcon = loginTogglePassword.querySelector('svg');
    loginTogglePassword.addEventListener('click', () => {
        loginPasswordInput.type = 'text';
        loginEyeIcon.style.opacity = '0.5'; // Visually indicate toggle (optional, adjust based on your CSS)

        setTimeout(() => {
            loginPasswordInput.type = 'password';
            loginEyeIcon.style.opacity = '1';
        }, 2000); // Revert after 2 seconds
    });

    // Password toggle for signup form (same behavior)
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

    // Login form submission (inspired by fundooLogin.js)
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');
    const rememberMeCheckbox = document.getElementById('rememberMe');

    // Check local storage for remembered email
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

        // Save email to localStorage if "Remember Me" is checked
        if (rememberMeCheckbox && rememberMeCheckbox.checked) {
            localStorage.setItem('rememberedEmail', email);
        } else {
            localStorage.removeItem('rememberedEmail');
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/v1/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user: { email, password } })
            });

            const data = await response.json();
            console.log('Login response:', data);
            if (data.token) {
                localStorage.setItem('token', data.token);
                alert(data.message || 'Login successful!');
                window.location.href = 'dashboard.html';
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

    // Social login buttons (placeholder)
    document.querySelector('.btn-facebook').addEventListener('click', () => {
        alert('Facebook login not implemented yet.');
    });

    document.querySelector('.btn-google').addEventListener('click', () => {
        alert('Google login not implemented yet.');
    });
});