const API_BASE_URL = 'http://127.0.0.1:3000/api/v1';

document.addEventListener("DOMContentLoaded", async function () {
    const ordersContainer = document.getElementById("orders-container");
    const accessToken = localStorage.getItem("access_token");

    if (!accessToken) {
        alert("Please log in to view your orders.");
        window.location.href = "../pages/login.html";
        return;
    }

    // Initial fetches
    await loadUserProfile();
    await loadCartSummary();
    await fetchOrders();
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
                profileElement.innerHTML = `<i class="fa-solid fa-user"></i> <span class="profile-name">${userData.name || 'User'}</span>`;
                localStorage.setItem('username', userData.name || 'User');
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

    // Fetch Orders
    async function fetchOrders() {
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/orders`);
            if (!response) {
                ordersContainer.innerHTML = `<p>Authentication error. Please try again later.</p>`;
                return;
            }
    
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Error fetching orders: ${response.status} - ${errorText}`);
            }
    
            const data = await response.json();
            console.log("Raw Orders Response:", data); // Log raw response for debugging
    
            // Handle different possible response formats
            let orders = [];
            if (Array.isArray(data)) {
                orders = data; // Direct array of orders
            } else if (data && Array.isArray(data.orders)) {
                orders = data.orders; // Object with orders array
            } else {
                console.warn("Unexpected orders data format:", data);
                throw new Error("Orders data is not in an expected array format");
            }
    
            ordersContainer.innerHTML = ""; // Clear previous content
            console.log("Total Orders Found:", orders.length);
    
            if (orders.length === 0) {
                ordersContainer.innerHTML = `<p>No orders found. Place an order first.</p>`;
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
                            <img class="book-image" src="${bookData.book_image || '../assets/1.png'}" alt="${bookData.book_name}" />
                            <div class="order-details">
                                <div class="order-main-details">
                                    <h3>Order #${order.id}</h3>
                                    <p>Book: <strong>${bookData.book_name}</strong><span class="order-quantity">Qty: ${order.quantity || 1}</span></p>
                                    <p>Author: ${bookData.author_name}</p>
                                    <p>Total Price: ₹${order.total_price || 'N/A'}</p>
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
                        orderElement.querySelector('.cancel-order-btn').addEventListener('click', () => cancelOrder(order.id));
                    }
                } catch (bookError) {
                    console.error(`Error processing order ${order.id}:`, bookError);
                    // Fallback display for orders with missing/invalid book data
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
                                    <p>Total Price: ₹${order.total_price || 'N/A'}</p>
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
                        orderElement.querySelector('.cancel-order-btn').addEventListener('click', () => cancelOrder(order.id));
                    }
                }
            }
        } catch (error) {
            console.error("Error fetching orders:", error.message);
            ordersContainer.innerHTML = `<p>Error loading orders: ${error.message}. Please try again later.</p>`;
        }
    }

    // Cancel Order Function
    async function cancelOrder(orderId) {
        if (!confirm("Are you sure you want to cancel this order?")) return;

        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/orders/${orderId}/cancel`, {
                method: 'PATCH'
            });
            if (!response) return;

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