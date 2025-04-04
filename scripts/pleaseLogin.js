document.addEventListener("DOMContentLoaded", () => {
   
    document.getElementById("loginBtn").addEventListener("click", function() {
        window.location.href = "login.html";
    });

   
    const logo = document.querySelector(".logo");
    if (logo) {
        logo.addEventListener("click", function() {
            window.location.href = "../pages/homePage.html";
        });
    } else {
        console.error("Logo element not found in DOM");
    }

    const cartCountElement = document.querySelector("#cart-link .cart-count");
    if (cartCountElement) {
       
        const initialCount = parseInt(cartCountElement.textContent) || 0;
        cartCountElement.style.display = initialCount > 0 ? "inline" : "none";
       
        function updateCartDisplay(count) {
            cartCountElement.textContent = count;
            cartCountElement.style.display = count > 0 ? "inline" : "none";
        }
        updateCartDisplay(initialCount);
    } else {
        console.error("Cart count element not found in DOM");
    }
});