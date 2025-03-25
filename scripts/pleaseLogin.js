document.addEventListener("DOMContentLoaded", () => {
    // Redirect to login page when login button is clicked
    document.getElementById("loginBtn").addEventListener("click", function() {
        console.log("Login button clicked, redirecting to login.html");
        window.location.href = "login.html";
    });

    // Redirect to homepage when logo is clicked
    const logo = document.querySelector(".logo");
    if (logo) {
        logo.addEventListener("click", function() {
            console.log("Logo clicked, redirecting to homePage.html");
            window.location.href = "../pages/homePage.html";
        });
    } else {
        console.error("Logo element not found in DOM");
    }

    // Update cart count display
    const cartCountElement = document.querySelector("#cart-link .cart-count");
    if (cartCountElement) {
        // Initial setup - hide if 0
        const initialCount = parseInt(cartCountElement.textContent) || 0;
        cartCountElement.style.display = initialCount > 0 ? "inline" : "none";
        
        // Function to update cart count
        function updateCartDisplay(count) {
            cartCountElement.textContent = count;
            cartCountElement.style.display = count > 0 ? "inline" : "none";
        }

        // Example usage - you can call this when cart data is fetched
        // For now, we'll just simulate with the initial value
        updateCartDisplay(initialCount);
    } else {
        console.error("Cart count element not found in DOM");
    }
});