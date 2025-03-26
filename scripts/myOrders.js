const API_BASE_URL = 'http://127.0.0.1:3000/api/v1';

document.addEventListener("DOMContentLoaded", async function () {
    const ordersContainer = document.getElementById("orders-container");
    const token = localStorage.getItem("token");

    if (!token) {
        alert("Please log in to view your orders.");
        window.location.href = "../pages/login.html";
        return;
    }

    // Load user profile, cart summary, and orders
    await loadUserProfile();
    await loadCartSummary();
    await fetchOrders();
    setupHeaderEventListeners();

    function getAuthHeaders() {
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    }

    async function loadUserProfile() {
        try {
            const response = await fetch(`${API_BASE_URL}/users/profile`, {
                headers: getAuthHeaders()
            });
            if (!response.ok) throw new Error(`Profile fetch failed: ${response.status}`);

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

    function updateCartCount(count) {
        const cartCount = document.querySelector('#cart-link .cart-count');
        if (cartCount) {
            cartCount.textContent = count;
            cartCount.style.display = count > 0 ? "flex" : "none";
        }
    }

    async function loadCartSummary() {
        try {
            const response = await fetch(`${API_BASE_URL}/cart/summary`, {
                headers: getAuthHeaders()
            });

            if (!response.ok) throw new Error("Failed to fetch cart summary");

            const cartData = await response.json();
            updateCartCount(cartData.total_items || 0);
        } catch (error) {
            console.error("Error fetching cart summary:", error);
        }
    }

    async function fetchOrders() {
        try {
            const response = await fetch(`${API_BASE_URL}/orders`, {
                headers: getAuthHeaders()
            });

            if (!response.ok) throw new Error(`Error fetching orders: ${response.status}`);

            const data = await response.json();
            ordersContainer.innerHTML = ""; // Clear previous content

            if (data.success && data.orders.length > 0) {
                for (const order of data.orders) {
                    try {
                        const bookResponse = await fetch(`${API_BASE_URL}/books/${order.book_id}`, {
                            headers: getAuthHeaders()
                        });
                        if (!bookResponse.ok) throw new Error(`Failed to fetch book: ${bookResponse.status}`);

                        const bookData = await bookResponse.json();

                        const orderElement = document.createElement("div");
                        orderElement.classList.add("order-item");

                        // Display "Cancelled" status if order is canceled
                        const orderStatus = order.status === "cancelled"
                            ? `<p class="order-status cancelled">Cancelled</p>`
                            : `<button class="cancel-order-btn" data-order-id="${order.id}">Cancel Order</button>`;

                        orderElement.innerHTML = `
                            <div class="order-item-container">
                                <img class="book-image" src="${bookData.book_image || '../assets/1.png'}" alt="${bookData.book_name}" />
                                <div class="order-details">
                                    <div class="order-main-details">
                                        <h3>Order #${order.id}</h3>
                                        <p>Book: <strong>${bookData.book_name}</strong><span class="order-quantity">Qty: ${order.quantity}</span></p>
                                        <p>Author: ${bookData.author_name}</p>
                                        <p>Total Price: ₹${order.total_price}</p>
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

                        // Add event listener for cancel button (if order is not already canceled)
                        if (order.status !== "cancelled") {
                            orderElement.querySelector('.cancel-order-btn').addEventListener('click', () => cancelOrder(order.id));
                        }
                    } catch (bookError) {
                        console.error("Error fetching book details:", bookError);
                    }
                }
            } else {
                ordersContainer.innerHTML = `<p>No orders found. Place an order first.</p>`;
            }
        } catch (error) {
            console.error("Error fetching orders:", error);
            ordersContainer.innerHTML = `<p>Error loading orders. Please try again later.</p>`;
        }
    }

    // Cancel Order Function
    async function cancelOrder(orderId) {
        if (!confirm("Are you sure you want to cancel this order?")) return;

        try {
            const response = await fetch(`${API_BASE_URL}/orders/${orderId}/cancel`, {
                method: 'PATCH',  // PATCH method for updating order status
                headers: getAuthHeaders()
            });

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

    // Logout Function
    function handleSignOut() {
        localStorage.clear();
        alert("Logged out successfully.");
        window.location.href = "../pages/homePage.html";
    }

    // Header Event Listeners
    function setupHeaderEventListeners() {
        let dropdownMenu = null;
        let isDropdownOpen = false;
        const profileLink = document.getElementById("profile-link");
        const cartLink = document.getElementById("cart-link");
        const logo = document.querySelector(".logo");

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

        // Profile link dropdown
        if (profileLink) {
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
        }

        // Cart link
        if (cartLink) {
            cartLink.addEventListener("click", (event) => {
                event.preventDefault();
                window.location.href = "../pages/cart.html";
            });
        }

        // Logout button
        document.getElementById("logout-button")?.addEventListener("click", handleSignOut);

        function openDropdown() {
            if (dropdownMenu) dropdownMenu.remove();

            dropdownMenu = document.createElement("div");
            dropdownMenu.classList.add("dropdown-menu");
            dropdownMenu.innerHTML = `
                <div class="dropdown-item" id="dropdown-profile">Profile</div>
                <div class="dropdown-item" id="dropdown-orders">My Orders</div>
                <div class="dropdown-item" id="dropdown-wishlist">My Wishlist</div>
                <div class="dropdown-item"><button id="dropdown-logout">Logout</button></div>
            `;

            profileLink.appendChild(dropdownMenu);

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
});