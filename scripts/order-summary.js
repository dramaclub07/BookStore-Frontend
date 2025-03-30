const API_BASE_URL = 'http://127.0.0.1:3000/api/v1';

document.addEventListener("DOMContentLoaded", async () => {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
        alert("Please log in to continue.");
        window.location.href = '../pages/login.html';
        return;
    }

    try {
        await Promise.all([
            loadUserProfile(),
            loadCartItems(),
            loadOrderSummary()
        ]);
    } catch (error) {
        console.error("Error during initial load:", error);
        alert("Failed to load initial data. Please try refreshing the page.");
    }

    setupHeaderEventListeners();
});

// Get auth headers
function getAuthHeaders() {
    const token = localStorage.getItem('access_token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token || ''}`
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
        }
        throw new Error(data.error || "Token refresh failed");
    } catch (error) {
        console.error("Error refreshing token:", error);
        localStorage.clear();
        alert("Session expired. Please log in again.");
        window.location.href = "../pages/login.html";
        return false;
    }
}

async function fetchWithAuth(url, options = {}) {
    const accessToken = localStorage.getItem("access_token");
    if (!accessToken) {
        window.location.href = "../pages/login.html";
        return null;
    }

    const expiresIn = Number(localStorage.getItem("token_expires_in"));
    if (expiresIn && Date.now() >= expiresIn) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) return null;
    }

    options.headers = { ...options.headers, ...getAuthHeaders() };
    try {
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
    } catch (error) {
        console.error("Fetch error:", error);
        return null;
    }
}

// Update Cart Count
function updateCartCount(count) {
    const cartCount = document.querySelector('#cart-link .cart-count');
    const sectionCount = document.getElementById('cart-count');
    const cartHeader = document.querySelector('h2'); // Assuming "My cart (4)" is in an h2

    if (cartHeader) {
        cartHeader.textContent = `My cart (${count})`;
    }

    if (cartCount) {
        cartCount.textContent = count > 0 ? count : "";
        cartCount.style.display = count > 0 ? "flex" : "none";
    }

    if (sectionCount) {
        sectionCount.textContent = count > 0 ? count : "";
        sectionCount.style.display = count > 0 ? "inline" : "none";
    }
}

// Load User Profile
async function loadUserProfile() {
    const profileElement = document.getElementById('profile-link');
    if (!profileElement) {
        console.error("Profile link element (#profile-link) not found in DOM");
        return;
    }

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/users/profile`);
        if (!response || !response.ok) {
            throw new Error(`Profile fetch failed with status: ${response?.status || 'unknown'}`);
        }

        const userData = await response.json();
        const username = userData.name || userData.full_name || 'User';
        profileElement.innerHTML = `<i class="fa-solid fa-user"></i> <span class="profile-name">${username}</span>`;
        localStorage.setItem('username', username);

        const nameInput = document.querySelector('input[readonly][value="Poonam Yadav"]');
        if (nameInput) nameInput.value = username;

        const mobileInput = document.querySelector('input[readonly][value="81678954778"]');
        if (mobileInput) mobileInput.value = userData.mobile_number || 'N/A';
    } catch (error) {
        console.error("Profile fetch error:", error.message);
        profileElement.innerHTML = `<i class="fa-solid fa-user"></i> <span class="profile-name">${localStorage.getItem('username') || 'User'}</span>`;
    }
}

// Load Cart Items
async function loadCartItems() {
    const cartContainer = document.getElementById('cart-container');
    if (!cartContainer) {
        console.error("Cart container (#cart-container) not found in DOM");
        return;
    }

    cartContainer.innerHTML = '<p>Loading cart...</p>';

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/carts`, { method: 'GET' });
        if (!response || !response.ok) {
            throw new Error(`Error ${response?.status || 'unknown'}: Failed to fetch cart items`);
        }

        const data = await response.json();
        console.log("Cart API response:", data);

        if (!data.success) {
            throw new Error(data.message || "Failed to load cart");
        }

        const cartItems = data.cart || [];
        console.log("Cart items extracted:", cartItems);

        renderCartItems(cartItems);
        updateCartCount(cartItems.length);
        setupCartEventListeners();
        await loadCartSummary();

        localStorage.setItem('cartItems', JSON.stringify(cartItems));
    } catch (error) {
        console.error('Error fetching cart items:', error);
        cartContainer.innerHTML = `<p>Error loading cart: ${error.message}</p>`;
        updateCartCount(0);
    }
}

// Render Cart Items
function renderCartItems(cartItems) {
    const cartContainer = document.getElementById('cart-container');
    if (!cartContainer) return;

    if (!cartItems || !Array.isArray(cartItems) || cartItems.length === 0) {
        cartContainer.innerHTML = `<p>Your cart is empty.</p>`;
        updateCartCount(0);
        return;
    }

    cartContainer.innerHTML = cartItems.map(item => {
        const totalDiscountedPrice = (item.discounted_price * (item.quantity || 1)).toFixed(2);
        const totalUnitPrice = (item.book_mrp * (item.quantity || 1)).toFixed(2);
        return `
        <div class="cart-item" data-id="${item.book_id}" data-discounted-price="${item.discounted_price}" data-unit-price="${item.book_mrp}">
            <img src="${item.book_image || item.image_url || '/default-book-image.jpg'}" alt="${item.book_name || 'Unknown'}">
            <div class="cart-item-details">
                <h3>${item.book_name || 'Untitled'}</h3>
                <p>by ${item.author_name || 'Unknown'}</p>
                <p>Rs. <span class="discounted-price">${totalDiscountedPrice}</span> <del>Rs. <span class="unit-price">${totalUnitPrice || 'N/A'}</span></del></p>
                <div class="quantity">
                    <button class="decrease">-</button>
                    <span class="quantity-value">${item.quantity || 1}</span>
                    <button class="increase">+</button>
                </div>
                <button class="remove">Remove</button>
            </div>
        </div>
    `;
    }).join('');
}

// Setup Cart Event Listeners
function setupCartEventListeners() {
    document.querySelectorAll('.increase').forEach(button => {
        button.addEventListener('click', () => updateQuantity(button, 1));
    });

    document.querySelectorAll('.decrease').forEach(button => {
        button.addEventListener('click', () => updateQuantity(button, -1));
    });

    document.querySelectorAll('.remove').forEach(button => {
        button.addEventListener('click', () => removeCartItem(button));
    });
}

// Update Quantity
async function updateQuantity(button, change) {
    const cartItem = button.closest('.cart-item');
    if (!cartItem) return;

    const bookId = cartItem.dataset.id;
    const quantityElement = cartItem.querySelector('.quantity-value');
    const discountedPriceElement = cartItem.querySelector('.discounted-price');
    const unitPriceElement = cartItem.querySelector('.unit-price');
    const currentQuantity = parseInt(quantityElement?.textContent || '1', 10);

    if (isNaN(currentQuantity)) {
        console.error("Invalid quantity:", quantityElement?.textContent);
        alert("Error: Invalid quantity.");
        return;
    }

    const newQuantity = currentQuantity + change;
    if (newQuantity <= 0) {
        await removeCartItem(button);
        return;
    }

    const perUnitDiscountedPrice = parseFloat(cartItem.dataset.discountedPrice);
    const perUnitPrice = parseFloat(cartItem.dataset.unitPrice);

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/carts/${bookId}`, {
            method: 'PATCH',
            body: JSON.stringify({ quantity: newQuantity })
        });

        if (!response || !response.ok) {
            const errorData = await response?.json();
            throw new Error(errorData?.message || "Failed to update quantity");
        }

        quantityElement.textContent = newQuantity;
        discountedPriceElement.textContent = (perUnitDiscountedPrice * newQuantity).toFixed(2);
        unitPriceElement.textContent = (perUnitPrice * newQuantity).toFixed(2);

        await loadCartSummary();
        await loadOrderSummary();

        const cartItems = JSON.parse(localStorage.getItem('cartItems') || '[]');
        const updatedCartItems = cartItems.map(item =>
            item.book_id === bookId ? { ...item, quantity: newQuantity } : item
        );
        localStorage.setItem('cartItems', JSON.stringify(updatedCartItems));
    } catch (error) {
        console.error("Error updating quantity:", error);
        alert(`Failed to update quantity: ${error.message}`);
        quantityElement.textContent = currentQuantity;
    }
}

// Remove Cart Item
async function removeCartItem(button) {
    const cartItem = button.closest('.cart-item');
    const bookId = cartItem?.dataset.id;

    if (!bookId) {
        console.error("Book ID not found");
        return;
    }

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/carts/${bookId}/delete`, {
            method: 'PATCH'
        });

        if (!response || !response.ok) {
            const errorData = await response?.json();
            throw new Error(errorData?.message || "Failed to remove item");
        }

        cartItem.remove();
        const remainingItems = document.querySelectorAll('.cart-item').length;
        updateCartCount(remainingItems);
        await loadCartSummary();
        await loadOrderSummary();

        if (remainingItems === 0) {
            document.getElementById('cart-container').innerHTML = '<p>Your cart is empty.</p>';
        }

        const cartItems = JSON.parse(localStorage.getItem('cartItems') || '[]');
        localStorage.setItem('cartItems', JSON.stringify(cartItems.filter(item => item.book_id !== bookId)));
    } catch (error) {
        console.error("Error removing item:", error);
        alert(`Failed to remove item: ${error.message}`);
    }
}

// Load Cart Summary
async function loadCartSummary() {
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/carts/summary`);
        if (!response || !response.ok) {
            throw new Error("Failed to fetch cart summary");
        }

        const cartData = await response.json();
        updateCartCount(cartData.total_items || 0);
    } catch (error) {
        console.error("Error fetching cart summary:", error);
        updateCartCount(0);
    }
}

// Load Order Summary
// Load Order Summary
async function loadOrderSummary() {
    const cartItems = JSON.parse(localStorage.getItem('cartItems') || '[]');
    const selectedAddress = JSON.parse(localStorage.getItem('selectedAddress') || '{}');
    const summarySection = document.getElementById('order-summary-section');

    if (!summarySection) {
        console.error("Order summary section (#order-summary-section) not found in DOM");
        return;
    }

    if (!cartItems.length) {
        summarySection.innerHTML = '<p>Your cart is empty.</p>';
        updateCartCount(0);
        return;
    }

    if (!selectedAddress.id) {
        alert("No address selected. Please select an address.");
        window.location.href = '../pages/customer-details.html';
        return;
    }

    // Update address fields
    const streetTextarea = document.querySelector('textarea[readonly]');
    const cityInput = document.querySelector('input[readonly][value="Bengaluru"]');
    const stateInput = document.querySelector('input[readonly][value="Karnataka"]');
    const radio = document.querySelector(`input[name="address-type"][value="${selectedAddress.address_type || 'Work'}"]`);

    if (streetTextarea) streetTextarea.value = selectedAddress.street || 'N/A';
    if (cityInput) cityInput.value = selectedAddress.city || 'N/A';
    if (stateInput) stateInput.value = selectedAddress.state || 'N/A';
    if (radio) radio.checked = true;

    const totalPrice = cartItems.reduce((sum, item) => {
        const price = parseFloat(item.discounted_price) || 0;
        const qty = parseInt(item.quantity, 10) || 1;
        return sum + (price * qty);
    }, 0).toFixed(2);

    const summaryItems = cartItems.map(item => {
        const discountedPrice = parseFloat(item.discounted_price) || 0;
        const unitPrice = parseFloat(item.book_mrp) || 0;
        const quantity = parseInt(item.quantity, 10) || 1;
        return `
        <div class="summary-item">
            <img src="${item.book_image || item.image_url || '/default-book-image.jpg'}" alt="${item.book_name || 'Unknown'}">
            <div class="summary-item-details">
                <h3>${item.book_name || 'Untitled'}</h3>
                <p>by ${item.author_name || 'Unknown'}</p>
                <p>Rs. ${(discountedPrice * quantity).toFixed(2)} <del>Rs. ${(unitPrice * quantity).toFixed(2)}</del></p>
                <p>Quantity: ${quantity}</p>
            </div>
        </div>
    `;
    }).join('');

    summarySection.innerHTML = `
        <h2>Order Summary</h2>
        ${summaryItems}
        <p>Total Price: Rs. ${totalPrice}</p>
        <button class="checkout">CHECKOUT</button>
    `;

    document.querySelector('.checkout').addEventListener('click', async () => {
        const requestBody = { address_id: selectedAddress.id };
        console.log("Placing order with body:", requestBody);

        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/orders`, {
                method: 'POST',
                body: JSON.stringify(requestBody)
            });

            if (!response) {
                throw new Error("No response from server - network issue or auth failure");
            }

            const orderData = await response.json();
            console.log("Order API response:", orderData);

            if (!response.ok || !orderData.success) {
                throw new Error(orderData.message || `Server error: ${response.status}`);
            }

            console.log("Order placed successfully:", orderData.order);
            localStorage.removeItem('cartItems');
            localStorage.removeItem('selectedAddress');
            window.location.href = `../pages/order-confirmation.html?order_id=${orderData.order.id}`;
        } catch (error) {
            console.error("Error placing order:", error.message);
            alert(`Failed to place order: ${error.message}`);
        }
    });
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
            window.location.href = "../pages/homePage.html";
        });
    }

    if (profileLink) {
        profileLink.addEventListener("click", (event) => {
            event.preventDefault();
            toggleDropdown();
        });

        document.addEventListener("click", (event) => {
            if (isDropdownOpen && !profileLink.contains(event.target) && dropdownMenu && !dropdownMenu.contains(event.target)) {
                closeDropdown();
            }
        });
    }

    if (cartLink) {
        cartLink.addEventListener("click", (event) => {
            event.preventDefault();
            window.location.href = '../pages/cart.html';
        });
    }

    const searchInput = document.getElementById("search");
    if (searchInput) {
        searchInput.addEventListener("keypress", (event) => {
            if (event.key === "Enter" && event.target.value.trim()) {
                window.location.href = `../pages/homePage.html?query=${encodeURIComponent(event.target.value.trim())}`;
            }
        });
    }

    function toggleDropdown() {
        isDropdownOpen ? closeDropdown() : openDropdown();
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
        FB.getLoginStatus((response) => {
            if (response.status === "connected") {
                FB.logout(() => console.log("Facebook session revoked"));
            }
        });
    }

    localStorage.clear();
    alert("Logged out successfully.");
    window.location.href = "../pages/homePage.html";
}