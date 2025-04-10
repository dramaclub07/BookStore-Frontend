// API Base URLs
const API_BASE_URL = window.config.API_BASE_URL;; // Backend URL
const PROXY_URL = "http://127.0.0.1:4000/api/v1"; // Proxy URL as fallback



function showToast(message, type = 'info') {
    const existingToast = document.querySelector('.toast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.classList.add('toast');
    if (type === 'success') toast.classList.add('success');
    else if (type === 'error') toast.classList.add('error');
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);

    if (type === 'error' && message.includes("Please log in")) {
        setTimeout(() => {
            window.location.href = "./pages/login.html";
        }, 100);
    }
}

document.addEventListener("DOMContentLoaded", function () {
    const wishlistContainer = document.getElementById("wishlist-container");
    const wishlistCountElement = document.getElementById("wishlist-count");

    const accessToken = localStorage.getItem("access_token");
    if (!accessToken) {
        // window.location.href = "../pages/login.html";
        showToast("Please log in to view your wishlist.");
        return;
    }

    // Initial fetches
    loadUserProfile();
    loadCartSummary();
    fetchWishlist();
    setupHeaderEventListeners();
});

// Get auth headers
function getAuthHeaders() {
    return {
        "Authorization": `Bearer ${localStorage.getItem("access_token")}`,
        "Content-Type": "application/json"
    };
}

// Token Refresh Logic
async function refreshAccessToken() {
    const refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken) {
        console.error("No refresh token available");
        return false;
    }

    const backendUrl = `${API_BASE_URL}/refresh`;
    const proxyUrl = `${PROXY_URL}/refresh`;

    try {
        let response = await fetch(backendUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: refreshToken })
        });

        if (!response.ok && response.status >= 500) {
            console.warn("Backend refresh failed, trying proxy");
            response = await fetch(proxyUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refresh_token: refreshToken })
            });
        }

        const data = await response.json();
        if (response.ok && data.access_token) {
            localStorage.setItem("access_token", data.access_token);
            localStorage.setItem("token_expires_in", Date.now() + (data.expires_in * 1000));
            console.log("Access token refreshed successfully");
            return true;
        } else {
            console.error("Failed to refresh token:", data.error);
            localStorage.clear();
            showToast("Session expired. Please log in again.");
            // window.location.href = "../pages/login.html";
            return false;
        }
    } catch (error) {
        console.error("Error refreshing token:", error);
        try {
            const proxyResponse = await fetch(proxyUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refresh_token: refreshToken })
            });
            const data = await proxyResponse.json();
            if (proxyResponse.ok && data.access_token) {
                localStorage.setItem("access_token", data.access_token);
                localStorage.setItem("token_expires_in", Date.now() + (data.expires_in * 1000));
                console.log("Access token refreshed via proxy");
                return true;
            }
        } catch (proxyError) {
            console.error("Proxy refresh also failed:", proxyError);
        }
        localStorage.clear();
        // window.location.href = "../pages/login.html";
        showToast("Session expired. Please log in again.");
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

    try {
        let response = await fetch(url, options);
        if (!response.ok && response.status >= 500) {
            console.warn(`Backend failed for ${url}, falling back to proxy`);
            response = await fetch(url.replace(API_BASE_URL, PROXY_URL), options);
        }

        if (response.status === 401) {
            const refreshed = await refreshAccessToken();
            if (refreshed) {
                options.headers = { ...options.headers, ...getAuthHeaders() };
                response = await fetch(url, options);
                if (!response.ok && response.status >= 500) {
                    response = await fetch(url.replace(API_BASE_URL, PROXY_URL), options);
                }
            } else {
                return null;
            }
        }

        return response;
    } catch (error) {
        console.error(`Fetch error with backend: ${error.message}, trying proxy`);
        try {
            const proxyResponse = await fetch(url.replace(API_BASE_URL, PROXY_URL), options);
            return proxyResponse;
        } catch (proxyError) {
            console.error(`Proxy fetch also failed: ${proxyError.message}`);
            return null;
        }
    }
}

// Load User Profile
async function loadUserProfile() {
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/users/profile`);
        if (!response) return;

        if (!response.ok) throw new Error(`Profile fetch failed with status: ${response.status}`);
        const userData = await response.json();
        const profileElement = document.getElementById("profile-link");
        if (profileElement) {
            profileElement.innerHTML = `<i class="fa-solid fa-user"></i> <span class="profile-name">${userData.full_name || userData.name || "User"}</span>`;
            localStorage.setItem("username", userData.full_name || userData.name || "User");
        }
    } catch (error) {
        console.error("Profile fetch error:", error.message);
    }
}

// Update Cart Count
function updateCartCount(count) {
    const cartCount = document.querySelector("#cart-link .cart-count");
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
    const wishlistContainer = document.getElementById("wishlist-container");
    const wishlistCountElement = document.getElementById("wishlist-count");

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/wishlists`);
        if (!response) {
            wishlistContainer.innerHTML = "<p>Authentication error. Please try again later.</p>";
            wishlistCountElement.textContent = "0";
            return;
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error ${response.status}: Unable to fetch wishlist - ${errorText}`);
        }

        const data = await response.json();

        // Log the raw data for debugging
       

        // Handle different possible response formats
        let wishlistItems = [];
        if (Array.isArray(data)) {
            wishlistItems = data;
        } else if (data && data.wishlist && Array.isArray(data.wishlist)) {
            wishlistItems = data.wishlist; // If data is an object with a wishlist array
        } else if (data && data.items && Array.isArray(data.items)) {
            wishlistItems = data.items; // If data is an object with an items array
        } else {
            console.warn("Unexpected wishlist data format:", data);
            throw new Error("Wishlist data is not in an expected array format");
        }

        wishlistContainer.innerHTML = "";
        wishlistCountElement.textContent = wishlistItems.length;

        if (wishlistItems.length === 0) {
            wishlistContainer.innerHTML = "<p>Your wishlist is empty.</p>";
            return;
        }

        wishlistItems.forEach(item => {
            if (!item || !item.book_id) {
                console.warn("Invalid wishlist item:", item);
                return;
            }

            const bookElement = document.createElement("div");
            bookElement.classList.add("wishlist-item");

            bookElement.innerHTML = `
                <a href="bookDetails.html?id=${item.book_id}" class="wishlist-main-container">
                    <div class="img-container">
                        <img src="${item.book_image || "/default-book-image.jpg"}" alt="${item.book_name || "Unknown"}">
                    </div>
                    <div class="wishlist-details">
                        <h3>${item.book_name || "Untitled"}</h3>
                        <p>Author: ${item.author_name || "Unknown"}</p>
                        <p>₹${item.discounted_price || "N/A"}</p>
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
                removeFromWishlist(this.getAttribute("data-id"));
            });
        });
    } catch (error) {
        console.error("Error fetching wishlist:", error.message);
        wishlistContainer.innerHTML = "<p>Failed to load wishlist. Please try again.</p>";
        wishlistCountElement.textContent = "0";
    }
}

// Remove from Wishlist
// Remove from Wishlist
async function removeFromWishlist(bookId) {
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/wishlists`, {
            method: "POST", // Change to POST to match the toggle endpoint
            body: JSON.stringify({ book_id: parseInt(bookId) })
        });
        if (!response) return;

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Failed to remove from wishlist");
        }


        showToast("Item removed from wishlist.");
        await fetchWishlist(); // Refresh the wishlist
    } catch (error) {
        console.error("Error removing from wishlist:", error);
        showToast("Failed to remove from wishlist. Please try again.");
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
            window.location.href = "../pages/cart.html";
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
async function handleSignOut() {
    const provider = localStorage.getItem("socialProvider");

    try {
        await fetchWithAuth(`${API_BASE_URL}/logout`, {
            method: "POST",
            headers: getAuthHeaders()
        });
    } catch (error) {
        console.error("Error invalidating cache on logout:", error);
    }

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
    showToast("You have been signed out.");
    window.location.href = "../pages/homePage.html";
}