const API_BASE_URL = 'http://127.0.0.1:3000/api/v1';

document.addEventListener("DOMContentLoaded", async function () {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
        alert("Please log in to view order confirmation.");
        window.location.href = '../pages/login.html';
        return;
    }

    try {
        await loadUserProfile();
        await fetchOrderDetails();
        setupHeaderEventListeners();

        document.querySelector('.continue-button')?.addEventListener('click', function() {
            window.location.href = '../pages/homePage.html';
        });
    } catch (error) {
        console.error("Initialization error:", error);
        document.querySelector('.success-message').innerHTML = `
            <p>Error loading confirmation details. Please try again later.</p>
        `;
    }
});

// Get auth headers
function getAuthHeaders() {
    const token = localStorage.getItem('access_token');
    return {
        'Authorization': `Bearer ${token}`,
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

// Fetch Order Details
async function fetchOrderDetails() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const orderId = urlParams.get('order_id'); // Expect order_id from URL query param

        if (!orderId) {
            // Fallback to fetching the latest order if no order_id is provided
            const ordersResponse = await fetchWithAuth(`${API_BASE_URL}/orders`);
            if (!ordersResponse) {
                handleUnauthorized();
                return;
            }

            if (!ordersResponse.ok) {
                throw new Error(`Failed to fetch orders: ${ordersResponse.status}`);
            }

            const orderData = await ordersResponse.json();
            console.log("Orders Response:", orderData);

            if (orderData.orders && orderData.orders.length > 0) {
                const latestOrder = orderData.orders.sort((a, b) => 
                    new Date(b.created_at) - new Date(a.created_at)
                )[0];
                console.log("Latest Order:", latestOrder);
                displayOrderDetails(latestOrder);
            } else {
                console.error("No orders found in response");
                document.querySelector('.success-message').innerHTML = `
                    <p>No recent order found. Please place an order first.</p>
                `;
            }
        } else {
            // Fetch specific order details using order_id
            const orderResponse = await fetchWithAuth(`${API_BASE_URL}/orders/${orderId}`);
            if (!orderResponse) {
                handleUnauthorized();
                return;
            }

            if (!orderResponse.ok) {
                throw new Error(`Failed to fetch order ${orderId}: ${orderResponse.status}`);
            }

            const orderData = await orderResponse.json();
            console.log("Order Response:", orderData);
            displayOrderDetails(orderData.order || orderData); // Adjust based on response structure
        }
    } catch (error) {
        console.error("Error in fetchOrderDetails:", error);
        document.querySelector('.success-message').innerHTML = `
            <p>Error loading order details: ${error.message}</p>
        `;
    }
}

// Display Order Details
function displayOrderDetails(order) {
    document.querySelector(".success-message").innerHTML = `
        <h1>Order Placed Successfully</h1>
        <p>Hurray!!! Your order is confirmed <br> 
           The order ID is <strong id="order-id">#${order.id}</strong>. 
           Save the order ID for further communication.
        </p>
        <p>Order #${order.id} is successfully placed.</p>
    `;

    const myOrdersList = document.createElement("ul");
    myOrdersList.id = "my-orders";
    myOrdersList.innerHTML = `
        <li>Order #${order.id} - Status: ${order.status}</li>
    `;
    document.querySelector('.success-container').appendChild(myOrdersList);
}

// Handle Unauthorized Access
function handleUnauthorized() {
    alert("Session expired. Please log in again.");
    localStorage.removeItem('access_token');
    console.log("Redirecting to login page due to 401");
    window.location.href = '../pages/login.html';
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