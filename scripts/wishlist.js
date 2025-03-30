const API_BASE_URL = 'http://127.0.0.1:3000/api/v1';

document.addEventListener("DOMContentLoaded", function () {
    const wishlistContainer = document.getElementById("wishlist-container");
    const wishlistCountElement = document.getElementById("wishlist-count");

    const accessToken = localStorage.getItem("access_token");
    if (!accessToken) {
        window.location.href = "../pages/login.html";
        return;
    }

    // Initial fetches
    loadUserProfile();
    loadCartSummary();
    fetchWishlist();
    setupHeaderEventListeners();

    // Get auth headers
    function getAuthHeaders() {
        return {
            'Authorization': `Bearer ${localStorage.getItem("access_token")}`,
            'Content-Type': 'application/json'
        };
    }

    // Token Refresh Logic
    async function refreshAccessToken() {
        const refreshToken = localStorage.getItem("refresh_token");
        if (!refreshToken) {
            console.error("No refresh token available");
            return false;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/refresh`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refresh_token: refreshToken })
            });

            const data = await response.json();
            if (response.ok && data.access_token) {
                localStorage.setItem("access_token", data.access_token);
                localStorage.setItem("token_expires_in", Date.now() + (data.expires_in * 1000));
                console.log("Access token refreshed successfully");
                return true;
            } else {
                console.error("Failed to refresh token:", data.error);
                localStorage.clear();
                alert("Session expired. Please log in again.");
                window.location.href = "../pages/login.html";
                return false;
            }
        } catch (error) {
            console.error("Error refreshing token:", error);
            localStorage.clear();
            window.location.href = "../pages/login.html";
            return false;
        }
    }

    async function fetchWithAuth(url, options = {}) {
        if (!localStorage.getItem("access_token")) {
            window.location.href = "../pages/login.html";
            return null;
        }

        const expiresIn = localStorage.getItem("token_expires_in");
        if (expiresIn && Date.now() >= expiresIn) {
            const refreshed = await refreshAccessToken();
            if (!refreshed) return null;
        }

        options.headers = { ...options.headers, ...getAuthHeaders() };
        let response = await fetch(url, options);

        if (response.status === 401) {
            const refreshed = await refreshAccessToken();
            if (refreshed) {
                options.headers = { ...options.headers, ...getAuthHeaders() };
                response = await fetch(url, options);
            } else {
                return null;
            }
        }

        return response;
    }

    // Load User Profile
    async function loadUserProfile() {
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/users/profile`);
            if (!response) return;

            if (!response.ok) throw new Error(`Profile fetch failed with status: ${response.status}`);
            const userData = await response.json();
            const profileElement = document.getElementById('profile-link');
            if (profileElement) {
                profileElement.innerHTML = `<i class="fa-solid fa-user"></i> <span class="profile-name">${userData.full_name || userData.name || 'User'}</span>`;
                localStorage.setItem('username', userData.full_name || userData.name || 'User');
            }
        } catch (error) {
            console.error("Profile fetch error:", error.message);
        }
    }

    // Update Cart Count
    function updateCartCount(count) {
        const cartCount = document.querySelector('#cart-link .cart-count');
        if (cartCount) {
            cartCount.textContent = count;
            cartCount.style.display = count > 0 ? "flex" : "none";
        }
    }

    // Load Cart Summary
    async function loadCartSummary() {
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/carts/summary`);
            if (!response) return;

            if (!response.ok) throw new Error("Failed to fetch cart summary");

            const cartData = await response.json();
            updateCartCount(cartData.total_items || 0);
        } catch (error) {
            console.error("Error fetching cart summary:", error);
            updateCartCount(0); // Fallback to 0 on error
        }
    }

    // Fetch Wishlist
    async function fetchWishlist() {
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/wishlists`);
            if (!response) return;

            if (!response.ok) throw new Error(`Error ${response.status}: Unable to fetch wishlist`);

            const data = await response.json();
            wishlistContainer.innerHTML = "";
            const wishlistItems = data.wishlist || []; // Access the wishlist array
            wishlistCountElement.textContent = wishlistItems.length;

            if (wishlistItems.length === 0) {
                wishlistContainer.innerHTML = "<p>Your wishlist is empty.</p>";
                return;
            }

            wishlistItems.forEach(item => {
                const bookElement = document.createElement("div");
                bookElement.classList.add("wishlist-item");

                bookElement.innerHTML = `
                    <a href="bookDetails.html?id=${item.book_id}" class="wishlist-main-container">
                        <div class="img-container">
                            <img src="${item.book_image || '/default-book-image.jpg'}" alt="${item.book_name || 'Unknown'}">
                        </div>
                        <div class="wishlist-details">
                            <h3>${item.book_name || 'Untitled'}</h3>
                            <p>Author: ${item.author_name || 'Unknown'}</p>
                            <p>₹${item.discounted_price || 'N/A'}</p>
                        </div>
                        <div class="btn-container">
                            <button class="remove-btn" data-id="${item.book_id}">
                                <i class="fa fa-trash delete-icon" aria-hidden="true"></i>
                            </button>
                        </div>
                    </a>
                `;

                wishlistContainer.appendChild(bookElement);
            });

            document.querySelectorAll(".remove-btn").forEach(button => {
                button.addEventListener("click", function (event) {
                    event.preventDefault();
                    toggleWishlist(this.getAttribute("data-id"));
                });
            });
        } catch (error) {
            console.error("Error fetching wishlist:", error);
            wishlistContainer.innerHTML = "<p>Failed to load wishlist. Please try again.</p>";
            wishlistCountElement.textContent = "0";
        }
    }

    // Toggle Wishlist
    async function toggleWishlist(bookId) {
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/wishlists`, {
                method: "POST",
                body: JSON.stringify({ book_id: bookId })
            });
            if (!response) return;

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Failed to toggle wishlist");
            }

            await fetchWishlist();
        } catch (error) {
            console.error("Error toggling wishlist:", error);
            alert(`Failed to remove item from wishlist: ${error.message}`);
        }
    }

    // Setup Header Event Listeners
    function setupHeaderEventListeners() {
        let dropdownMenu = null;
        let isDropdownOpen = false;
        const profileLink = document.getElementById("profile-link");
        const cartLink = document.getElementById("cart-link");
        const logo = document.querySelector(".logo");

        if (logo) {
            logo.addEventListener("click", (event) => {
                event.preventDefault();
                console.log("Logo clicked, redirecting to homepage");
                window.location.href = "../pages/homePage.html";
            });
        } else {
            console.error("Logo element not found in DOM");
        }

        if (!profileLink) {
            console.error("Profile link element (#profile-link) not found in DOM");
            return;
        }

        profileLink.addEventListener("click", (event) => {
            event.preventDefault();
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

        if (cartLink) {
            cartLink.addEventListener("click", (event) => {
                event.preventDefault();
                window.location.href = '../pages/cart.html';
            });
        }

        const searchInput = document.getElementById("search");
        if (searchInput) {
            searchInput.addEventListener("keypress", (event) => {
                if (event.key === "Enter") {
                    const query = event.target.value.trim();
                    if (query) {
                        window.location.href = `../pages/homePage.html?query=${encodeURIComponent(query)}`;
                    }
                }
            });
        }

        function openDropdown() {
            if (dropdownMenu) dropdownMenu.remove();

            dropdownMenu = document.createElement("div");
            dropdownMenu.classList.add("dropdown-menu");
            const username = localStorage.getItem("username") || "User";

            dropdownMenu.innerHTML = `
                <div class="dropdown-item dropdown-header">Hello ${username},</div>
                <div class="dropdown-item" id="dropdown-profile">Profile</div>
                <div class="dropdown-item" id="dropdown-orders">My Orders</div>
                <div class="dropdown-item" id="dropdown-wishlist">My Wishlist</div>
                <div class="dropdown-item"><button id="dropdown-logout">Logout</button></div>
            `;

            profileLink.parentElement.appendChild(dropdownMenu);

            document.getElementById("dropdown-profile").addEventListener("click", () => {
                window.location.href = "../pages/profile.html";
                closeDropdown();
            });
            document.getElementById("dropdown-orders").addEventListener("click", () => {
                window.location.href = "../pages/myOrders.html";
                closeDropdown();
            });
            document.getElementById("dropdown-wishlist").addEventListener("click", () => {
                window.location.href = "../pages/wishlist.html";
                closeDropdown();
            });
            document.getElementById("dropdown-logout").addEventListener("click", () => {
                handleSignOut();
                closeDropdown();
            });

            isDropdownOpen = true;
        }

        function closeDropdown() {
            if (dropdownMenu) {
                dropdownMenu.remove();
                dropdownMenu = null;
            }
            isDropdownOpen = false;
        }
    }

    // Sign Out Function
    function handleSignOut() {
        const provider = localStorage.getItem("socialProvider");

        if (provider === "google" && typeof google !== "undefined" && google.accounts) {
            google.accounts.id.disableAutoSelect();
            google.accounts.id.revoke(localStorage.getItem("socialEmail") || "", () => {
                console.log("Google session revoked");
            });
        }

        if (provider === "facebook" && typeof FB !== "undefined") {
            FB.getLoginStatus(function (response) {
                if (response.status === "connected") {
                    FB.logout(function (response) {
                        console.log("Facebook session revoked");
                    });
                }
            });
        }

        localStorage.clear();
        alert("Logged out successfully.");
        window.location.href = "../pages/homePage.html";
    }
});