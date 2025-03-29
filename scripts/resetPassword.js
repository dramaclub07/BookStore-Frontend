document.addEventListener("DOMContentLoaded", () => {
    const resetPasswordForm = document.getElementById("reset-password-form");
    const resendOtpButton = document.getElementById("resend-otp");
    const passwordInput = document.getElementById("new-password");
    const passwordToggle = document.getElementById("password-toggle");
    const passwordStrength = document.getElementById("password-strength");
    const passwordRequirements = document.getElementById("password-requirements");
    const errorMessage = document.getElementById("reset-error");
    const otpExpiryTimer = document.getElementById("otp-expiry-timer");
    const API_BASE_URL = "http://127.0.0.1:3000/api/v1"; // Updated for consistency

    let otpExpiryTime = 300; // 5 minutes in seconds
    let timerInterval;

    // Get email from URL query parameter
    const urlParams = new URLSearchParams(window.location.search);
    const email = urlParams.get("email");

    if (!email) {
        alert("No email provided. Please go back to the Forgot Password page.");
        window.location.href = "forgotPassword.html";
        return;
    }

    // Password toggle functionality
    if (passwordToggle) {
        passwordToggle.addEventListener("click", () => {
            const type = passwordInput.type === "password" ? "text" : "password";
            passwordInput.type = type;
            passwordToggle.innerHTML = type === "password"
                ? `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/>
                    <path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8zm8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/>
                </svg>`
                : `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M13.359 11.238C15.06 9.72 16 8 16 8s-3-5.5-8-5.5a7 7 0 0 0-2.79.588l.77.771A6 6 0 0 1 8 3.5c2.12 0 3.879 1.168 5.168 2.457A13 13 0 0 1 14.828 8c-.058.087-.122.183-.195.288-.335.48-.83 1.12-1.465 1.755l-.81-.81z"/>
                    <path d="M11.297 9.176a3.5 3.5 0 0 0-4.474-4.474l.823.823a2.5 2.5 0 0 1 2.829 2.829l.822.822zm-2.943 1.299l.822.822a3.5 3.5 0 0 1-4.474-4.474l.823.823a2.5 2.5 0 0 0 2.829 2.829z"/>
                    <path d="M3.35 5.47l-.77-.77A7 7 0 0 0 1 8c0 2.12 1.168 3.879 2.457 5.168A13 13 0 0 0 5.828 14.828c.087.058.183.122.288.195.48.335 1.12.83 1.755 1.465l.81-.81A6 6 0 0 1 3.5 8c0-.77.148-1.508.415-2.19l-.77-.77zM1 1l14 14"/>
                </svg>`;
        });
    }

    // Password strength checker
    if (passwordInput) {
        passwordInput.addEventListener("input", () => {
            const password = passwordInput.value;
            const strength = checkPasswordStrength(password);
            updatePasswordStrengthUI(strength);
            validatePasswordRequirements(password);
        });
    }

    // Check password strength
    function checkPasswordStrength(password) {
        let strength = 0;
        if (password.length >= 8) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^A-Za-z0-9]/.test(password)) strength++;
        return strength;
    }

    // Update password strength UI
    function updatePasswordStrengthUI(strength) {
        passwordStrength.classList.remove("weak", "medium", "strong");
        if (strength <= 1) {
            passwordStrength.classList.add("weak");
            passwordStrength.textContent = "Weak";
        } else if (strength <= 3) {
            passwordStrength.classList.add("medium");
            passwordStrength.textContent = "Medium";
        } else {
            passwordStrength.classList.add("strong");
            passwordStrength.textContent = "Strong";
        }
    }

    // Validate password requirements
    function validatePasswordRequirements(password) {
        const requirements = [];
        if (password.length < 8) requirements.push("at least 8 characters");
        if (!/[A-Z]/.test(password)) requirements.push("one uppercase letter");
        if (!/[0-9]/.test(password)) requirements.push("one number");
        if (!/[^A-Za-z0-9]/.test(password)) requirements.push("one special character");

        passwordRequirements.textContent = requirements.length > 0
            ? `Password must contain ${requirements.join(", ")}.`
            : "";
    }

    // OTP expiry timer
    function startOtpTimer() {
        if (timerInterval) clearInterval(timerInterval); // Clear any existing timer
        timerInterval = setInterval(() => {
            if (otpExpiryTime <= 0) {
                clearInterval(timerInterval);
                otpExpiryTimer.textContent = "OTP expired";
                resendOtpButton.disabled = false;
                return;
            }
            const minutes = Math.floor(otpExpiryTime / 60);
            const seconds = otpExpiryTime % 60;
            otpExpiryTimer.textContent = `(Expires in ${minutes}:${seconds < 10 ? "0" : ""}${seconds})`;
            otpExpiryTime--;
        }, 1000);
    }

    // Start the timer on page load
    startOtpTimer();

    // Resend OTP
    if (resendOtpButton) {
        resendOtpButton.addEventListener("click", async () => {
            try {
                resendOtpButton.disabled = true;
                resendOtpButton.textContent = "Resending...";

                const response = await fetch(`${API_BASE_URL}/users/password/forgot`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email })
                });

                const data = await response.json();
                if (response.ok && data.message) {
                    alert("OTP resent successfully!");
                    otpExpiryTime = 300; // Reset timer to 5 minutes
                    startOtpTimer();
                } else {
                    errorMessage.textContent = data.error || "Failed to resend OTP. Please try again.";
                }
            } catch (error) {
                console.error("Resend OTP Error:", error);
                errorMessage.textContent = "Failed to connect to the server. Please try again.";
            } finally {
                resendOtpButton.disabled = false;
                resendOtpButton.textContent = "Resend OTP";
            }
        });
    }

    // Reset Password Form Submission
    if (resetPasswordForm) {
        resetPasswordForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const otp = document.getElementById("otp").value.trim();
            const newPassword = passwordInput.value;

            if (!otp || otp.length !== 6 || !/^\d+$/.test(otp)) {
                errorMessage.textContent = "Please enter a valid 6-digit OTP.";
                return;
            }

            const strength = checkPasswordStrength(newPassword);
            if (strength < 4) {
                errorMessage.textContent = "Password does not meet requirements.";
                return;
            }

            try {
                const submitButton = resetPasswordForm.querySelector(".btn-submit");
                submitButton.disabled = true;
                submitButton.textContent = "Resetting...";

                const payload = { email, otp, new_password: newPassword };
                console.log("Raw Reset Password Request Body:", JSON.stringify(payload));

                const response = await fetch(`${API_BASE_URL}/users/password/reset`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();
                console.log("Reset Password Response:", data);

                if (response.ok && data.message) {
                    alert(data.message);
                    window.location.href = "login.html";
                } else {
                    errorMessage.textContent = data.error || "Failed to reset password. Please try again.";
                }
            } catch (error) {
                console.error("Reset Password Error:", error);
                errorMessage.textContent = "Failed to connect to the server. Please try again.";
            } finally {
                const submitButton = resetPasswordForm.querySelector(".btn-submit");
                submitButton.disabled = false;
                submitButton.textContent = "Reset Password";
            }
        });
    }
});