document.addEventListener("DOMContentLoaded", () => {
    const forgotPasswordForm = document.getElementById("forgot-password-form");
    const API_BASE_URL = "http://127.0.0.1:3000/api/v1";

    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const email = document.getElementById("forgot-email").value.trim();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (!email || !emailRegex.test(email)) {
                alert("Please enter a valid email address.");
                return;
            }

            try {
                const submitButton = forgotPasswordForm.querySelector(".btn-submit");
                submitButton.disabled = true;
                submitButton.textContent = "Sending...";

                const payload = { email };

                const response = await fetch(`${API_BASE_URL}/users/password/forgot`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                const data = await response.json();

                if (response.ok && data.message) {
                    alert(data.message);
                    window.location.href = `resetPassword.html?email=${encodeURIComponent(email)}`;
                } else {
                    alert(data.errors || "Failed to send reset link. Please try again.");
                }
            } catch (error) {
                alert(`Failed to connect to the server. Error: ${error.message}`);
            } finally {
                const submitButton = forgotPasswordForm.querySelector(".btn-submit");
                submitButton.disabled = false;
                submitButton.textContent = "Reset Password";
            }
        });
    }
});