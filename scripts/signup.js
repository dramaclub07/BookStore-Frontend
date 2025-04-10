const BASE_URL = "https://bookstore-backend-p7e1.onrender.com/api/v1/";

// Password toggle functionality
document.getElementById("signup-toggle-password").addEventListener("click", () => {
    const passwordField = document.getElementById("signup-password");
    const toggleIcon = document.querySelector("#signup-toggle-password svg");

    if (passwordField.type === "password") {
        passwordField.type = "text";
        toggleIcon.innerHTML = `
            <path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7.028 7.028 0 0 0-2.79.588l.77.771A5.944 5.944 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13.134 13.134 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755-.165.165-.337.328-.517.486l.708.709z"/>
            <path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829l.822.822zm-2.943 1.299.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829z"/>
            <path d="M3.35 5.47c-.18.16-.353.322-.518.487A13.134 13.134 0 0 0 1.172 8l.195.288c.335.48.83 1.12 1.465 1.755C4.121 11.332 5.881 12.5 8 12.5c.716 0 1.39-.133 2.02-.36l.77.772A7.029 7.029 0 0 1 8 13.5C3 13.5 0 8 0 8s.939-1.721 2.641-3.238l.708.709zm10.296 8.884-12-12 .708-.708 12 12-.708.708z"/>
        `;
    } else {
        passwordField.type = "password";
        toggleIcon.innerHTML = `
            <path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/>
            <path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8zm8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/>
        `;
    }
});

// Redirect to login page when clicking the "LOGIN" tab
document.querySelector('.tab[data-tab="login"]').addEventListener("click", () => {
    window.location.href = "../pages/login.html";
});

// Check if in admin mode via URL parameter
const urlParams = new URLSearchParams(window.location.search);
const isAdminMode = urlParams.get("adminMode") === "true";
const roleGroup = document.getElementById("role-group");

if (isAdminMode) {
    roleGroup.style.display = "block";
} else {
    roleGroup.style.display = "none";
}

// Form validation and API submission
const signupForm = document.getElementById("signup-form");

signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("signup-name").value.trim();
    const email = document.getElementById("signup-email").value.trim();
    const password = document.getElementById("signup-password").value.trim();
    const mobile = document.getElementById("signup-mobile").value.trim();
    const role = isAdminMode ? document.getElementById("signup-role").value : "user";

    const nameField = document.getElementById("signup-name");
    const emailField = document.getElementById("signup-email");
    const passwordField = document.getElementById("signup-password");
    const mobileField = document.getElementById("signup-mobile");
    const roleField = document.getElementById("signup-role");
    const nameError = document.getElementById("name-error");
    const emailError = document.getElementById("email-error");
    const passwordError = document.getElementById("password-error");
    const mobileError = document.getElementById("mobile-error");
    const roleError = document.getElementById("role-error");

    const errorElements = [nameField, emailField, passwordField, mobileField];
    const errorMessages = [nameError, emailError, passwordError, mobileError];
    if (isAdminMode) {
        errorElements.push(roleField);
        errorMessages.push(roleError);
    }

    errorElements.forEach(el => el.classList.remove("error"));
    errorMessages.forEach(el => (el.textContent = ""));

    if (!name || name.length < 3 || name.length > 50) {
        nameField.classList.add("error");
        nameError.textContent = "Full name must be between 3 and 50 characters.";
        return;
    }

    const VALID_EMAIL_REGEX = /^[\w+\-.]+@(gmail\.com|yahoo\.com|outlook\.com)$/i;
    if (!email || !VALID_EMAIL_REGEX.test(email)) {
        emailField.classList.add("error");
        emailError.textContent = "Please enter a valid email (e.g., user@gmail.com, user@yahoo.com, or user@outlook.com).";
        return;
    }

    if (!password || password.length < 6) {
        passwordField.classList.add("error");
        passwordError.textContent = "Password must be at least 6 characters.";
        return;
    }

    const VALID_MOBILE_REGEX = /^[6789]\d{9}$/;
    if (!mobile || !VALID_MOBILE_REGEX.test(mobile)) {
        mobileField.classList.add("error");
        mobileError.textContent = "Mobile number must be 10 digits and start with 6, 7, 8, or 9.";
        return;
    }

    if (isAdminMode && (!role || (role !== "user" && role !== "admin"))) {
        roleField.classList.add("error");
        roleError.textContent = "Please select a valid role (Customer or Admin).";
        return;
    }

    try {
        const response = await fetch(`${BASE_URL}/users`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                user: {
                    full_name: name,
                    email: email,
                    password: password,
                    mobile_number: mobile,
                    role: role
                }
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.errors ? errorData.errors.join(", ") : `HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();

        localStorage.setItem('user', JSON.stringify({
            id: data.user.id,
            email: data.user.email,
            full_name: data.user.full_name,
            role: role
        }));

        const roleText = role === "admin" ? "Admin" : "Customer";
        const redirectMessage = isAdminMode ? "Returning to homepage..." : "Redirecting to login...";
        alert(`Signup successful as ${roleText}! ${redirectMessage}`);
        window.location.href = isAdminMode ? "../pages/homePage.html" : "../pages/login.html";
    } catch (error) {
        alert(`Signup failed: ${error.message}. Please ensure the backend is running at ${BASE_URL}.`);
        errorMessages.forEach(el => (el.textContent = error.message));
    }
});