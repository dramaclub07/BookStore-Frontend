// API Base URLs
const API_BASE_URL = "http://127.0.0.1:3000/api/v1"; // Backend URL
const PROXY_URL = "http://127.0.0.1:4000/api/v1"; // Proxy URL as fallback

document.addEventListener("DOMContentLoaded", async function () {
    console.log("DOM fully loaded, starting initialization...");
    const ordersContainer = document.getElementById("orders-container");
    const accessToken = localStorage.getItem("access_token");

    if (!accessToken) {
        console.log("No access token found, redirecting to login.");
        alert("Please log in to view your orders.");
        window.location.href = "../pages/login.html";
        return;
    }

    // Initial fetches
    await loadUserProfile();
    await loadCartSummary();
    await fetchOrders();
    setupHeaderEventListeners();
    setupRefreshButton(); // Add refresh button listener
    console.log("Initialization completed.");
});

// Get auth headers
function getAuthHeaders() {
    const token = localStorage.getItem("access_token");
    console.log("Generating auth headers with token:", token ? token.substring(0, 20) + "..." : null);
    return {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
    };
}

// Token Refresh Logic
async function refreshAccessToken() {
    const refreshToken = localStorage.getItem("refresh_token");
    console.log("Attempting token refresh with refreshToken:", refreshToken ? refreshToken.substring(0, 20) + "..." : null);
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

        const data = await response.json();
        console.log("Backend refresh response:", data);
        if (response.ok && data.access_token) {
            localStorage.setItem("access_token", data.access_token);
            localStorage.setItem("token_expires_in", Date.now() + (data.expires_in * 1000));
            console.log("Access token refreshed successfully via backend");
            return true;
        } else {
            console.warn("Backend refresh failed, trying proxy:", data.error);
            response = await fetch(proxyUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refresh_token: refreshToken })
            });
            const proxyData = await response.json();
            console.log("Proxy refresh response:", proxyData);
            if (response.ok && proxyData.access_token) {
                localStorage.setItem("access_token", proxyData.access_token);
                localStorage.setItem("token_expires_in", Date.now() + (proxyData.expires_in * 1000));
                console.log("Access token refreshed successfully via proxy");
                return true;
            }
            throw new Error("Token refresh failed on both backend and proxy: " + (proxyData.error || "Unknown error"));
        }
    } catch (error) {
        console.error("Error refreshing token:", error.message);
        localStorage.clear();
        alert("Session expired. Please log in again.");
        window.location.href = "../pages/login.html";
        return false;
    }
}

async function fetchWithAuth(url, options = {}) {
    console.log("Fetching with auth:", url, options);
    if (!localStorage.getItem("access_token")) {
        console.log("No access token, redirecting to login.");
        window.location.href = "../pages/login.html";
        return null;
    }

    const expiresIn = localStorage.getItem("token_expires_in");
    if (expiresIn && Date.now() >= expiresIn) {
        console.log("Token expired, attempting refresh...");
        const refreshed = await refreshAccessToken();
        if (!refreshed) {
            console.log("Token refresh failed.");
            return null;
        }
    }

    options.headers = { ...options.headers, ...getAuthHeaders() };

    try {
        console.log(`Attempting backend fetch: ${url}`);
        let response = await fetch(url, options);
        console.log(`Backend response for ${url}:`, response.status, response.statusText);
        if (!response.ok && response.status >= 500) {
            console.warn(`Backend failed with ${response.status}, falling back to proxy`);
            const proxyUrl = url.replace(API_BASE_URL, PROXY_URL);
            console.log(`Attempting proxy fetch: ${proxyUrl}`);
            response = await fetch(proxyUrl, options);
            console.log(`Proxy response for ${proxyUrl}:`, response.status, response.statusText);
        }

        if (!response.ok) {
            if (response.status === 401) {
                console.log("Received 401, attempting token refresh...");
                const refreshed = await refreshAccessToken();
                if (refreshed) {
                    options.headers = { ...options.headers, ...getAuthHeaders() };
                    console.log(`Retrying backend fetch post-refresh: ${url}`);
                    response = await fetch(url, options);
                    console.log(`Post-refresh backend response:`, response.status);
                    if (!response.ok && response.status >= 500) {
                        const proxyUrl = url.replace(API_BASE_URL, PROXY_URL);
                        console.log(`Retrying proxy fetch post-refresh: ${proxyUrl}`);
                        response = await fetch(proxyUrl, options);
                        console.log(`Post-refresh proxy response:`, response.status);
                    }
                } else {
                    console.log("Token refresh failed after 401.");
                    return null;
                }
            }
            if (!response.ok) {
                throw new Error(`Fetch failed with status: ${response.status} - ${await response.text()}`);
            }
        }
        return response;
    } catch (error) {
        console.error(`Fetch error with backend ${url}:`, error.message);
        try {
            const proxyUrl = url.replace(API_BASE_URL, PROXY_URL);
            console.log(`Attempting proxy fallback for ${url} at ${proxyUrl}`);
            const proxyResponse = await fetch(proxyUrl, options);
            console.log(`Proxy response for ${proxyUrl}:`, proxyResponse.status, proxyResponse.statusText);
            if (!proxyResponse.ok) {
                throw new Error(`Proxy failed with status: ${proxyResponse.status} - ${await proxyResponse.text()}`);
            }
            return proxyResponse;
        } catch (proxyError) {
            console.error(`Proxy fetch failed for ${url}:`, proxyError.message);
            return null;
        }
    }
}

// Load User Profile
async function loadUserProfile() {
    console.log("Loading user profile...");
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/users/profile`);
        if (!response) {
            console.log("No response from profile fetch, skipping update.");
            return;
        }

        if (!response.ok) throw new Error(`Profile fetch failed with status: ${response.status}`);
        const userData = await response.json();
        console.log("Profile data received:", userData);
        const profileElement = document.getElementById("profile-link");
        if (profileElement) {
            profileElement.innerHTML = `<i class="fa-solid fa-user"></i> <span class="profile-name">${userData.name || "User"}</span>`;
            localStorage.setItem("username", userData.name || "User");
        }
    } catch (error) {
        console.error("Profile fetch error:", error.message);
    }
}

// Update Cart Count
function updateCartCount(count) {
    console.log("Updating cart count to:", count);
    const cartCount = document.querySelector("#cart-link .cart-count");
    if (cartCount) {
        cartCount.textContent = count > 0 ? count : "";
        cartCount.style.display = count > 0 ? "flex" : "none";
    } else {
        console.warn("Cart count element not found.");
    }
}

// Load Cart Summary
async function loadCartSummary() {
    console.log("Loading cart summary...");
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/carts/summary`);
        if (!response) {
            console.log("No response from cart summary, using fallback count.");
            updateCartCount(0);
            return;
        }

        if (!response.ok) throw new Error(`Cart summary fetch failed with status: ${response.status}`);
        const cartData = await response.json();
        console.log("Cart summary data:", cartData);
        updateCartCount(cartData.total_items || 0);
    } catch (error) {
        console.error("Error fetching cart summary:", error);
        updateCartCount(0); // Fallback to 0 on error
    }
}

// Fetch Orders
async function fetchOrders(forceRefresh = false) {
    const ordersContainer = document.getElementById("orders-container");
    if (!ordersContainer) {
        console.error("Orders container element not found.");
        return;
    }

    console.log("Fetching orders... (Force refresh:", forceRefresh, ")");
    ordersContainer.innerHTML = "<p>Loading orders...</p>";

    try {
        // Add ?refresh=true to the URL if forceRefresh is true
        const url = forceRefresh ? `${API_BASE_URL}/orders?refresh=true` : `${API_BASE_URL}/orders`;
        const response = await fetchWithAuth(url);
        if (!response) {
            const token = localStorage.getItem("access_token");
            if (!token) {
                ordersContainer.innerHTML = `<p>Authentication failed: No access token found. Please log in again.</p>`;
            } else {
                ordersContainer.innerHTML = `<p>Service unavailable: Both backend and proxy servers are down. Please check your connection or try again later.</p>`;
            }
            return;
        }

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Orders fetch failed with status: ${response.status} - ${errorText}`);
            if (response.status === 401) {
                ordersContainer.innerHTML = `<p>Authentication failed: Invalid or expired token. Please log in again.</p>`;
            } else if (response.status === 503) {
                ordersContainer.innerHTML = `<p>Service unavailable: The server is temporarily down. Please try again later.</p>`;
            } else {
                throw new Error(`Failed to fetch orders: ${response.status} - ${errorText}`);
            }
            return;
        }

        const data = await response.json();
        console.log("Raw Orders Response from server (backend or proxy):", data);

        let orders = [];
        if (Array.isArray(data)) {
            orders = data;
            console.log("Orders data is an array:", orders);
        } else if (data && Array.isArray(data.orders)) {
            orders = data.orders;
            console.log("Orders data extracted from 'orders' property:", orders);
        } else {
            console.warn("Unexpected orders data format:", data);
            throw new Error("Orders data is not in an expected array format");
        }

        ordersContainer.innerHTML = ""; // Clear loading message
        console.log("Total Orders Found:", orders.length);

        if (orders.length === 0) {
            ordersContainer.innerHTML = `
                <p>No orders found. Place an order first.</p>
                <button id="refresh-orders-btn" class="refresh-btn">Refresh Orders</button>
            `;
            setupRefreshButton(); // Reattach the refresh button listener
            return;
        }

        for (const order of orders) {
            try {
                if (!order.book_id) {
                    throw new Error(`Order ${order.id} missing book_id`);
                }

                const bookResponse = await fetchWithAuth(`${API_BASE_URL}/books/${order.book_id}`);
                let bookData = { book_name: "Unknown", author_name: "Unknown", book_image: "../assets/1.png" };

                if (bookResponse && bookResponse.ok) {
                    bookData = await bookResponse.json();
                    console.log(`Book Data for Order ${order.id}:`, bookData);
                } else if (bookResponse && bookResponse.status === 503) {
                    // Fallback to cache for book data if backend is down
                    const proxyUrl = `${PROXY_URL}/books/${order.book_id}`;
                    const proxyResponse = await fetch(proxyUrl, { headers: getAuthHeaders() });
                    if (proxyResponse && proxyResponse.ok) {
                        bookData = await proxyResponse.json();
                        console.log(`Cached Book Data for Order ${order.id} from proxy:`, bookData);
                    } else {
                        console.warn(`No cached data available for book ${order.book_id}`);
                    }
                } else {
                    console.warn(`Failed to fetch book for order ${order.id}:`, bookResponse?.status);
                }

                const orderElement = document.createElement("div");
                orderElement.classList.add("order-item");

                const orderStatus = order.status === "cancelled"
                    ? `<p class="order-status cancelled">Cancelled</p>`
                    : `<button class="cancel-order-btn" data-order-id="${order.id}">Cancel Order</button>`;

                orderElement.innerHTML = `
                    <div class="order-item-container">
                        <img class="book-image" src="${bookData.book_image || "../assets/1.png"}" alt="${bookData.book_name}" />
                        <div class="order-details">
                            <div class="order-main-details">
                                <h3>Order #${order.id}</h3>
                                <p>Book: <strong>${bookData.book_name}</strong><span class="order-quantity">Qty: ${order.quantity || 1}</span></p>
                                <p>Author: ${bookData.author_name}</p>
                                <p>Total Price: ₹${order.total_price || "N/A"}</p>
                            </div>
                            <div class="order-other-details">
                                <div class="order-date">
                                    <p>Placed on: ${new Date(order.created_at).toLocaleDateString()}</p>
                                </div>
                                <div class="order-actions">
                                    ${orderStatus}
                                </div>
                            </div>
                        </div>
                    </div>
                `;

                ordersContainer.appendChild(orderElement);

                if (order.status !== "cancelled") {
                    orderElement.querySelector(".cancel-order-btn").addEventListener("click", () => cancelOrder(order.id));
                }
            } catch (bookError) {
                console.error(`Error processing order ${order.id}:`, bookError);
                const orderElement = document.createElement("div");
                orderElement.classList.add("order-item");
                orderElement.innerHTML = `
                    <div class="order-item-container">
                        <img class="book-image" src="../assets/1.png" alt="Unknown Book" />
                        <div class="order-details">
                            <div class="order-main-details">
                                <h3>Order #${order.id}</h3>
                                <p>Book: <strong>Unknown</strong><span class="order-quantity">Qty: ${order.quantity || 1}</span></p>
                                <p>Author: Unknown</p>
                                <p>Total Price: ₹${order.total_price || "N/A"}</p>
                            </div>
                            <div class="order-other-details">
                                <div class="order-date">
                                    <p>Placed on: ${new Date(order.created_at).toLocaleDateString()}</p>
                                </div>
                                <div class="order-actions">
                                    ${order.status === "cancelled" ? '<p class="order-status cancelled">Cancelled</p>' : `<button class="cancel-order-btn" data-order-id="${order.id}">Cancel Order</button>`}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                ordersContainer.appendChild(orderElement);
                if (order.status !== "cancelled") {
                    orderElement.querySelector(".cancel-order-btn").addEventListener("click", () => cancelOrder(order.id));
                }
            }
        }
    } catch (error) {
        console.error("Error fetching orders:", error.message);
        ordersContainer.innerHTML = `
            <p>Error loading orders: ${error.message}. Please check your backend server or try again later.</p>
            <button id="refresh-orders-btn" class="refresh-btn">Refresh Orders</button>
        `;
        setupRefreshButton(); // Reattach the refresh button listener
    }
}

// Cancel Order Function
async function cancelOrder(orderId) {
    console.log("Attempting to cancel order:", orderId);
    if (!confirm("Are you sure you want to cancel this order?")) return;

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/orders/${orderId}/cancel`, {
            method: "PATCH"
        });
        if (!response) {
            console.log("No response from cancel request, skipping.");
            return;
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Failed to cancel order: ${response.status}`);
        }

        alert("Order cancelled successfully!");
        await fetchOrders(); // Refresh orders list
    } catch (error) {
        console.error("Error cancelling order:", error);
        alert(`Failed to cancel order: ${error.message}`);
    }
}

// Setup Header Event Listeners
function setupHeaderEventListeners() {
    console.log("Setting up header event listeners...");
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
        console.warn("Logo element not found.");
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
    } else {
        console.warn("Search input element not found.");
    }

    function openDropdown() {
        console.log("Opening dropdown...");
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
        console.log("Closing dropdown...");
        if (dropdownMenu) {
            dropdownMenu.remove();
            dropdownMenu = null;
        }
        isDropdownOpen = false;
    }
}

// Sign Out Function
async function handleSignOut() {
    console.log("Signing out...");
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
    alert("Logged out successfully.");
    window.location.href = "../pages/homePage.html";
}

// Setup Refresh Button
function setupRefreshButton() {
    const refreshButton = document.getElementById("refresh-orders-btn");
    if (refreshButton) {
        refreshButton.addEventListener("click", async () => {
            console.log("Refresh button clicked, forcing refresh...");
            await fetchOrders(true); // Force refresh with ?refresh=true
        });
    } else {
        console.warn("Refresh button element not found.");
    }
}