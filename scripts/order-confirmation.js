const API_BASE_URL = 'http://127.0.0.1:3000/api/v1';

function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}

document.addEventListener("DOMContentLoaded", async function () {
    const token = localStorage.getItem('token');
    if (!token) {
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

async function loadUserProfile() {
    try {
        const response = await fetch(`${API_BASE_URL}/users/profile`, {
            headers: getAuthHeaders()
        });
        if (!response.ok) {
            if (response.status === 401) {
                alert("Session expired. Please log in again.");
                localStorage.removeItem('token');
                window.location.href = '../pages/login.html';
                return;
            }
            throw new Error(`Profile fetch failed with status: ${response.status}`);
        }
        const userData = await response.json();
        if (userData.success) {
            const profileElement = document.getElementById('profile-link');
            if (profileElement) {
                profileElement.innerHTML = `<i class="fa-solid fa-user"></i> <span class="profile-name">${userData.name || 'User'}</span>`;
                localStorage.setItem('username', userData.name || 'User');
            }
        }
    } catch (error) {
        console.error("Profile fetch error:", error.message);
    }
}

async function fetchOrderDetails() {
    try {
        const orderResponse = await fetch(`${API_BASE_URL}/orders`, {
            headers: getAuthHeaders()
        });

        if (orderResponse.status === 401) {
            handleUnauthorized();
            return;
        }
        if (!orderResponse.ok) {
            throw new Error(`Failed to fetch orders: ${orderResponse.status}`);
        }

        const orderData = await orderResponse.json();
        console.log("Orders Response:", orderData);

        if (orderData.success && orderData.orders && orderData.orders.length > 0) {
            const latestOrder = orderData.orders.sort((a, b) => 
                new Date(b.created_at) - new Date(a.created_at)
            )[0];
            console.log("Latest Order:", latestOrder);

            const orderIdElement = document.getElementById('order-id');
            if (orderIdElement) {
                orderIdElement.innerText = `#${latestOrder.id}`;
            } else {
                console.error("Order ID element not found");
            }

            if (!["processing", "shipped", "delivered"].includes(latestOrder.status)) {
                const statusResponse = await fetch(`${API_BASE_URL}/orders/${latestOrder.id}/update_status`, {
                    method: "PATCH",
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ status: "processing" })
                });

                if (statusResponse.status === 401) {
                    handleUnauthorized();
                    return;
                }
                if (!statusResponse.ok) {
                    const errorData = await statusResponse.json();
                    throw new Error(`Failed to update order status: ${errorData.error || statusResponse.status}`);
                }

                const updatedOrderData = await statusResponse.json();
                console.log("Updated Order:", updatedOrderData);
                if (updatedOrderData.success && updatedOrderData.order) {
                    displayOrderDetails(updatedOrderData.order);
                } else {
                    throw new Error("Invalid response from status update");
                }
            } else {
                displayOrderDetails(latestOrder);
            }
        } else {
            console.error("No orders found in response");
            document.querySelector('.success-message').innerHTML = `
                <p>No recent order found. Please place an order first.</p>
            `;
        }
    } catch (error) {
        console.error("Error in fetchOrderDetails:", error);
        document.querySelector('.success-message').innerHTML = `
            <p>Error loading order details: ${error.message}</p>
        `;
    }
}

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

function handleUnauthorized() {
    alert("Session expired. Please log in again.");
    localStorage.removeItem('token');
    console.log("Redirecting to login page due to 401");
    window.location.href = '../pages/login.html';
}

function setupHeaderEventListeners() {
    let dropdownMenu = null;
    let isDropdownOpen = false;
    const profileLink = document.getElementById("profile-link");
    const cartLink = document.getElementById("cart-link");
    const logo = document.querySelector(".logo"); // Added logo selector

    // Add logo click event listener
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
    window.location.href = "../pages/login.html";
}