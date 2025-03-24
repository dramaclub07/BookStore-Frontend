const API_BASE_URL = 'http://127.0.0.1:3000/api/v1';

document.addEventListener("DOMContentLoaded", async function () {
    const ordersContainer = document.getElementById("orders-container");
    const token = localStorage.getItem("token");

    if (!token) {
        alert("Please log in to view your orders.");
        window.location.href = "../pages/login.html";
        return;
    }

    // Initial fetches
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

            if (!response.ok) {
                if (response.status === 401) {
                    alert("Session expired. Please log in again.");
                    localStorage.removeItem('token');
                    window.location.href = '../pages/login.html';
                    return;
                }
                throw new Error("Failed to fetch cart summary");
            }

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

            if (!response.ok) {
                if (response.status === 401) {
                    alert("Session expired. Please log in again.");
                    localStorage.removeItem('token');
                    window.location.href = '../pages/login.html';
                    return;
                }
                throw new Error(`Error fetching orders: ${response.status}`);
            }

            const data = await response.json();
            console.log("Orders Data:", data);

            if (data.success && data.orders.length > 0) {
                ordersContainer.innerHTML = "";

                for (const order of data.orders) {
                    try {
                        const bookResponse = await fetch(`${API_BASE_URL}/books/${order.book_id}`, {
                            headers: getAuthHeaders()
                        });
                        if (!bookResponse.ok) {
                            throw new Error(`Failed to fetch book: ${bookResponse.status}`);
                        }
                        const bookData = await bookResponse.json();
                        console.log("Book Data:", bookData);

                        const orderElement = document.createElement("div");
                        orderElement.classList.add("order-item");

                        orderElement.innerHTML = `
                            <div class="order-item-container">
                                <img class="book-image" src="${bookData.book_image || '../assets/1.png'}" alt="${bookData.book_name}" />
                                <div class="order-details">
                                    <div class="order-main-details">
                                        <h3>Order #${order.id}</h3>
                                        <p>Book: <strong>${bookData.book_name}</strong></p>
                                        <p>Author: ${bookData.author_name}</p>
                                        <p>Total Price: ₹${order.total_price}</p>
                                    </div>
                                    <div class="order-date">
                                        <p>Placed on: ${new Date(order.created_at).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            </div>
                        `;

                        ordersContainer.appendChild(orderElement);
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
});