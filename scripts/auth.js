document.addEventListener("DOMContentLoaded", function () {
    const loginForm = document.getElementById("loginForm");
    const signupForm = document.getElementById("signupForm");

    if (loginForm) {
        loginForm.addEventListener("submit", function (e) {
            e.preventDefault();
            console.log("Login logic here...");
            alert("Login successful (fake implementation)");
        });
    }

    if (signupForm) {
        signupForm.addEventListener("submit", function (e) {
            e.preventDefault();
            console.log("Signup logic here...");
            alert("Signup successful (fake implementation)");
        });
    }
});
