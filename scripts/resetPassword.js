document.addEventListener("DOMContentLoaded", () => {
    const resetPasswordForm = document.getElementById("reset-password-form");
    const resendOtpButton = document.getElementById("resend-otp");
    const passwordInput = document.getElementById("new-password");
    const passwordToggle = document.getElementById("password-toggle");
    const passwordStrength = document.getElementById("password-strength");
    const passwordRequirements = document.getElementById("password-requirements");
    const otpExpiryTimer = document.getElementById("otp-expiry-timer");
    const API_BASE_URL = "http://127.0.0.1:3000/api/v1";

    let otpExpiryTime = 300;
    let timerInterval;

    if (otpInput) {
        otpInput.addEventListener("input", (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, "");
        });

        otpInput.addEventListener("keypress", (e) => {
            const charCode = e.charCode || e.keyCode;
            if (charCode < 48 || charCode > 57) {
                e.preventDefault();
            }
        });
    }

    const urlParams = new URLSearchParams(window.location.search);
    const email = urlParams.get("email");

    if (!email) {
        showToaster("No email provided. Please go back to the Forgot Password page.", "error");
        setTimeout(() => {
            window.location.href = "forgotPassword.html";
        }, 3000);
        return;
    }

    if (passwordToggle) {
        passwordToggle.addEventListener("click", () => {
            const type = passwordInput.type === "password" ? "text" : "password";
            passwordInput.type = type;
            passwordToggle.classList.toggle("visible", type === "text");
            passwordToggle.innerHTML = type === "password"
                ? `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/>
                    <path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8zm8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/>
                    <path class="eye-slash" d="M2 2l12 12" stroke="currentColor" stroke-width="1.5"/>
                </svg>`
                : `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/>
                    <path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8zm8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/>
                    <path class="eye-slash" d="M2 2l12 12" stroke="currentColor" stroke-width="1.5"/>
                </svg>`;
        });

        passwordToggle.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                passwordToggle.click();
            }
        });
    }

    if (passwordInput) {
        passwordInput.addEventListener("input", () => {
            const password = passwordInput.value;
            const strength = checkPasswordStrength(password);
            updatePasswordStrengthUI(strength);
            validatePasswordRequirements(password);
        });
    }

    function checkPasswordStrength(password) {
        let strength = 0;
        if (password.length >= 8) strength++;
        if (/[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^A-Za-z0-9]/.test(password)) strength++;
        return strength;
    }

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

    function startOtpTimer() {
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(() => {
            if (otpExpiryTime <= 0) {
                clearInterval(timerInterval);
                otpExpiryTimer.textContent = "OTP INVALID, PLEASE RESEND";
                resendOtpButton.disabled = false;
                return;
            }
            const minutes = Math.floor(otpExpiryTime / 60);
            const seconds = otpExpiryTime % 60;
            otpExpiryTimer.textContent = `(Expires in ${minutes}:${seconds < 10 ? "0" : ""}${seconds})`;
            otpExpiryTime--;
        }, 1000);
    }

    startOtpTimer();

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
                    otpExpiryTime = 300;
                    startOtpTimer();
                } else {
                    errorMessage.textContent = data.error || "Failed to resend OTP. Please try again.";
                }
            } catch (error) {
                errorMessage.textContent = "Failed to connect to the server. Please try again.";
            } finally {
                resendOtpButton.disabled = false;
                resendOtpButton.textContent = "Resend OTP";
            }
        });
    }

    if (resetPasswordForm) {
        resetPasswordForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const otp = document.getElementById("otp").value.trim();
            const newPassword = passwordInput.value;

            if (!otp || otp.length !== 6 || !/^\d+$/.test(otp)) {
                showToaster("Invalid OTP", "error");
                return;
            }

            if (otpExpiryTime <= 0) {
                showToaster("OTP has expired. Please resend a new OTP.", "error");
                return;
            }

            const strength = checkPasswordStrength(newPassword);
            if (strength < 4) {
                showToaster("Password does not meet requirements.", "error");
                return;
            }

            try {
                const submitButton = resetPasswordForm.querySelector(".btn-submit");
                submitButton.disabled = true;
                submitButton.textContent = "Resetting...";

                const payload = { email, otp, new_password: newPassword };

                const response = await fetch(`${API_BASE_URL}/users/password/reset`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();

                if (response.ok && data.message) {
                    showToaster(data.message, "success");
                    setTimeout(() => {
                        window.location.href = "login.html";
                    }, 3000);
                } else {
                    errorMessage.textContent = data.error || "Failed to reset password. Please try again.";
                }
            } catch (error) {
                showToaster("Failed to connect to the server. Please try again.", "error");
            } finally {
                const submitButton = resetPasswordForm.querySelector(".btn-submit");
                submitButton.disabled = false;
                submitButton.textContent = "Reset Password";
            }
        });
    }

    const toastQueue = [];
    let isShowingToast = false;

    function showToaster(message, type = "error") {
        toastQueue.push({ message, type });
        if (!isShowingToast) {
            displayNextToast();
        }
    }

    function displayNextToast() {
        if (toastQueue.length === 0) {
            isShowingToast = false;
            return;
        }

        isShowingToast = true;
        const { message, type } = toastQueue.shift();
        const toaster = document.getElementById("toaster");
        const p = toaster.querySelector("p");

        const card = document.getElementById("reset-password-card");
        const cardRect = card.getBoundingClientRect();
        const toasterHeight = toaster.offsetHeight;
        const marginAboveCard = 10;

        const cardCenterX = cardRect.left + (cardRect.width / 2);
        const toasterLeft = cardCenterX - (toaster.offsetWidth / 2);
        const finalTop = cardRect.top - toasterHeight - marginAboveCard;

        toaster.style.left = `${toasterLeft}px`;
        toaster.style.top = `${finalTop}px`;

        toaster.classList.remove("show", "shake");
        toaster.offsetHeight;
        toaster.className = "toaster " + type;
        p.textContent = message;
        toaster.classList.add("show");

        if (type === "error") {
            toaster.classList.add("shake");
            shakePage();
        }

        setTimeout(() => {
            toaster.classList.remove("show");
            setTimeout(displayNextToast, 300);
        }, 5000);
    }

    function shakePage() {
        document.body.classList.remove("shake-all");
        document.body.offsetHeight;
        document.body.classList.add("shake-all");
    }

    const toaster = document.getElementById("toaster");
    if (toaster) {
        const closeBtn = toaster.querySelector(".close");
        closeBtn.addEventListener("click", () => {
            toaster.classList.remove("show");
            setTimeout(displayNextToast, 300);
        });
    }
});