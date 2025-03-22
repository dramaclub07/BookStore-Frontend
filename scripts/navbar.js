console.log("navbar.js loaded");

document.addEventListener("DOMContentLoaded", async () => {
    const profileLink = document.getElementById("profile-link");
    const cartLink = document.getElementById("cart-link");
    const usernameElement = document.querySelector(".username");
    const cartCountElement = document.getElementById("cart-count");

    console.log("DOM elements - Profile link:", profileLink, "Username:", usernameElement, "Cart count:", cartCountElement);

    // User state
    const token = localStorage.getItem("token");
    const isLoggedIn = !!token;
    let username = localStorage.getItem("username") || "User"; // Fallback until fetched

    // Set initial username (will update after fetch if logged in)
    if (usernameElement) {
        usernameElement.textContent = isLoggedIn ? username : "Profile";
    } else {
        console.error("Username element (.username) not found in DOM");
    }

    // Fetch profile name if logged in
    if (isLoggedIn) {
        try {
            const response = await fetch("http://127.0.0.1:3000/api/v1/users/profile", {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            });

            if (!response.ok) {
                if (response.status === 401) {
                    console.log("Token invalid or expired, logging out...");
                    localStorage.clear();
                    window.location.href = "../pages/login.html";
                    return;
                }
                throw new Error(`Error ${response.status}: Failed to fetch profile`);
            }

            const data = await response.json();
            console.log("Profile data:", data);
            username = data.full_name || data.username || "User"; // Adjust based on your API response
            localStorage.setItem("username", username); // Update localStorage

            if (usernameElement) {
                usernameElement.textContent = username;
            }
        } catch (error) {
            console.error("Error fetching profile name:", error.message);
            if (usernameElement) {
                usernameElement.textContent = "User"; // Fallback on error
            }
        }
    }

    // Dropdown state
    let dropdownMenu = null;
    let isDropdownOpen = false;

    if (profileLink) {
        profileLink.addEventListener("click", (event) => {
            event.preventDefault();
            console.log("Profile link clicked, toggling dropdown");
            if (isDropdownOpen) {
                closeDropdown();
            } else {
                openDropdown();
            }
        });

        document.addEventListener("click", (event) => {
            if (
                isDropdownOpen &&
                !profileLink.contains(event.target) &&
                dropdownMenu &&
                !dropdownMenu.contains(event.target)
            ) {
                closeDropdown();
            }
        });
    } else {
        console.error("Profile link not found in DOM");
    }

    if (cartLink) {
        cartLink.addEventListener("click", (event) => {
            event.preventDefault();
            if (!isLoggedIn) {
                console.log("User not logged in, redirecting to please login page");
                window.location.href = "../pages/pleaseLogin.html";
            } else {
                console.log("Redirecting to cart page");
                window.location.href = "../pages/cart.html";
            }
        });
    }

    function openDropdown() {
        if (dropdownMenu) dropdownMenu.remove();

        dropdownMenu = document.createElement("div");
        dropdownMenu.classList.add("profile-dropdown");

        dropdownMenu.innerHTML = isLoggedIn
            ? `
                <div class="dropdown-item dropdown-header">Hello ${username},</div>
                <div class="dropdown-item" id="dropdown-profile">Profile</div>
                <div class="dropdown-item" id="dropdown-orders">My Orders</div>
                <div class="dropdown-item" id="dropdown-wishlist">My Wishlist</div>
                <div class="dropdown-item"><button id="dropdown-logout">Logout</button></div>
            `
            : `
                <div class="dropdown-item dropdown-header">Welcome</div>
                <div class="dropdown-item dropdown-subheader">To access account</div>
                <div class="dropdown-item"><button id="dropdown-login-signup">LOGIN/SIGNUP</button></div>
                <div class="dropdown-item" id="dropdown-orders">My Orders</div>
                <div class="dropdown-item" id="dropdown-wishlist">Wishlist</div>
            `;

        profileLink.parentElement.appendChild(dropdownMenu);

        if (isLoggedIn) {
            document.getElementById("dropdown-profile").addEventListener("click", () => {
                window.location.href = "../pages/profile.html";
                closeDropdown();
            });
            document.getElementById("dropdown-orders").addEventListener("click", () => {
                window.location.href = "../pages/orders.html";
                closeDropdown();
            });
            document.getElementById("dropdown-wishlist").addEventListener("click", () => {
                window.location.href = "../pages/wishlist.html";
                closeDropdown();
            });
            document.getElementById("dropdown-logout").addEventListener("click", () => {
                console.log("Logging out...");
                localStorage.clear();
                window.location.href = "../pages/login.html";
                closeDropdown();
            });
        } else {
            document.getElementById("dropdown-login-signup").addEventListener("click", () => {
                window.location.href = "../pages/login.html";
                closeDropdown();
            });
            document.getElementById("dropdown-orders").addEventListener("click", () => {
                window.location.href = "../pages/pleaseLogin.html";
                closeDropdown();
            });
            document.getElementById("dropdown-wishlist").addEventListener("click", () => {
                window.location.href = "../pages/pleaseLogin.html";
                closeDropdown();
            });
        }

        isDropdownOpen = true;
    }

    function closeDropdown() {
        if (dropdownMenu) {
            dropdownMenu.remove();
            dropdownMenu = null;
        }
        isDropdownOpen = false;
    }

    // Minimal Search
    document.getElementById("search")?.addEventListener("keypress", (event) => {
        if (event.key === "Enter") {
            const query = event.target.value.trim();
            if (query) {
                console.log("Search triggered with query:", query);
                window.location.href = `../pages/homePage.html?query=${encodeURIComponent(query)}`;
            }
        }
    });

    // Cart Count
    async function updateCartCount() {
        if (!cartCountElement) {
            console.error("Cart count element (#cart-count) not found in DOM");
            return;
        }

        if (!isLoggedIn) {
            cartCountElement.textContent = "0";
            cartCountElement.style.display = "none";
            return;
        }

        try {
            const response = await fetch("http://127.0.0.1:3000/api/v1/cart/summary", {
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (!response.ok) {
                if (response.status === 401) {
                    console.log("Token invalid, logging out...");
                    localStorage.clear();
                    window.location.href = "../pages/login.html";
                    return;
                }
                throw new Error("Cart fetch failed");
            }
            const data = await response.json();
            const count = data.total_items || 0;
            cartCountElement.textContent = count;
            cartCountElement.style.display = count > 0 ? "inline" : "none";
        } catch (error) {
            console.error("Cart count error:", error.message);
            cartCountElement.textContent = "0";
            cartCountElement.style.display = "none";
        }
    }

    // Initialize cart count
    updateCartCount();
});