const API_BASE_URL = 'http://127.0.0.1:3000/api/v1';

document.addEventListener("DOMContentLoaded", async () => {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
        alert("Please log in to continue.");
        window.location.href = '../pages/login.html';
        return;
    }

    await loadUserProfile();
    await loadCartItems();
    await loadOrderSummary();
    setupHeaderEventListeners();
});

// Get auth headers
function getAuthHeaders() {
    const token = localStorage.getItem('access_token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
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

// Update Cart Count
function updateCartCount(count) {
    const cartCount = document.querySelector('#cart-link .cart-count');
    const sectionCount = document.getElementById('cart-count');
    if (cartCount) {
        cartCount.textContent = count;
        cartCount.style.display = count > 0 ? "flex" : "none";
    }
    if (sectionCount) {
        sectionCount.textContent = count;
    }
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
        document.querySelector('input[readonly][value="Poonam Yadav"]').value = userData.name || 'Unknown';
        document.querySelector('input[readonly][value="81678954778"]').value = userData.mobile_number || 'N/A';
    } catch (error) {
        console.error("Profile fetch error:", error.message);
    }
}

// Load Cart Items
async function loadCartItems() {
    const cartContainer = document.getElementById('cart-container');
    if (!cartContainer) return;

    cartContainer.innerHTML = '<p>Loading cart...</p>';

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/carts`, { method: 'GET' });
        if (!response) return;

        if (!response.ok) throw new Error(`Error ${response.status}: Failed to fetch cart items`);

        const data = await response.json();
        const cartItems = data || []; // Assuming /carts returns an array directly
        renderCartItems(cartItems);
        updateCartCount(cartItems.length);
        setupCartEventListeners();
        await loadCartSummary();

        localStorage.setItem('cartItems', JSON.stringify(cartItems));
    } catch (error) {
        console.error('Error fetching cart items:', error);
        cartContainer.innerHTML = `<p>Error loading cart.</p>`;
        updateCartCount(0);
    }
}

// Render Cart Items
function renderCartItems(cartItems) {
    const cartContainer = document.getElementById('cart-container');
    if (!cartContainer) return;

    if (!cartItems || cartItems.length === 0) {
        cartContainer.innerHTML = `<p>Your cart is empty.</p>`;
        updateCartCount(0);
        return;
    }

    cartContainer.innerHTML = cartItems.map(item => {
        const totalDiscountedPrice = (item.discounted_price * (item.quantity || 1)).toFixed(2);
        const totalUnitPrice = (item.book_mrp * (item.quantity || 1)).toFixed(2); // Assuming book_mrp is unit price
        return `
        <div class="cart-item" data-id="${item.book_id}" data-discounted-price="${item.discounted_price}" data-unit-price="${item.book_mrp}">
            <img src="${item.book_image || '/default-book-image.jpg'}" alt="${item.book_name || 'Unknown'}">
            <div class="cart-item-details">
                <h3>${item.book_name || 'Untitled'}</h3>
                <p>by ${item.author_name || 'Unknown'}</p>
                <p>Rs. <span class="discounted-price">${totalDiscountedPrice}</span> <del>Rs. <span class="unit-price">${totalUnitPrice || ''}</span></del></p>
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
        button.addEventListener('click', function() {
            updateQuantity(this, 1);
        });
    });

    document.querySelectorAll('.decrease').forEach(button => {
        button.addEventListener('click', function() {
            updateQuantity(this, -1);
        });
    });

    document.querySelectorAll('.remove').forEach(button => {
        button.addEventListener('click', function() {
            removeCartItem(this);
        });
    });
}

// Update Quantity
async function updateQuantity(button, change) {
    const cartItem = button.closest('.cart-item');
    const bookId = cartItem.dataset.id;
    const quantityElement = cartItem.querySelector('.quantity-value');
    const discountedPriceElement = cartItem.querySelector('.discounted-price');
    const unitPriceElement = cartItem.querySelector('.unit-price');
    let currentQuantity = parseInt(quantityElement.textContent, 10);

    if (isNaN(currentQuantity)) {
        console.error("Invalid quantity:", quantityElement.textContent);
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
        if (!response) return;

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Failed to update quantity");
        }

        quantityElement.textContent = newQuantity;
        const newDiscountedPrice = (perUnitDiscountedPrice * newQuantity).toFixed(2);
        const newUnitPrice = (perUnitPrice * newQuantity).toFixed(2);

        if (discountedPriceElement) discountedPriceElement.textContent = newDiscountedPrice;
        if (unitPriceElement) unitPriceElement.textContent = newUnitPrice;

        await loadCartSummary();
        await loadOrderSummary();

        const cartItems = JSON.parse(localStorage.getItem('cartItems') || '[]');
        const updatedCartItems = cartItems.map(item => {
            if (item.book_id === bookId) {
                return { ...item, quantity: newQuantity };
            }
            return item;
        });
        localStorage.setItem('cartItems', JSON.stringify(updatedCartItems));
    } catch (error) {
        console.error("Error updating quantity:", error);
        alert("Failed to update quantity.");
        quantityElement.textContent = currentQuantity;
    }
}

// Remove Cart Item
async function removeCartItem(button) {
    const cartItem = button.closest('.cart-item');
    const bookId = cartItem.dataset.id;

    if (!bookId) {
        console.error("Book ID not found");
        return;
    }

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/carts/${bookId}/delete`, {
            method: 'PATCH'
        });
        if (!response) return;

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Failed to remove item");
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
        const updatedCartItems = cartItems.filter(item => item.book_id !== bookId);
        localStorage.setItem('cartItems', JSON.stringify(updatedCartItems));
    } catch (error) {
        console.error("Error removing item:", error);
        alert("Failed to remove item.");
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

// Load Order Summary
async function loadOrderSummary() {
    const cartItems = JSON.parse(localStorage.getItem('cartItems') || '[]');
    const selectedAddress = JSON.parse(localStorage.getItem('selectedAddress') || '{}');

    if (!cartItems.length) {
        document.getElementById('order-summary-section').innerHTML = '<p>Your cart is empty.</p>';
        return;
    }

    if (!selectedAddress.id) {
        alert("No address selected. Please select an address.");
        window.location.href = '../pages/customer-details.html';
        return;
    }

    document.querySelector('textarea[readonly]').value = selectedAddress.street || '';
    document.querySelector('input[readonly][value="Bengaluru"]').value = selectedAddress.city || '';
    document.querySelector('input[readonly][value="Karnataka"]').value = selectedAddress.state || '';
    const radio = document.querySelector(`input[name="address-type"][value="${selectedAddress.address_type || 'Work'}"]`);
    if (radio) radio.checked = true;

    const summarySection = document.getElementById('order-summary-section');
    if (!summarySection) return;

    const totalPrice = cartItems.reduce((sum, item) => {
        return sum + (item.discounted_price * (item.quantity || 1));
    }, 0).toFixed(2);

    const summaryItems = cartItems.map(item => `
        <div class="summary-item">
            <img src="${item.book_image || '/default-book-image.jpg'}" alt="${item.book_name || 'Unknown'}">
            <div class="summary-item-details">
                <h3>${item.book_name || 'Untitled'}</h3>
                <p>by ${item.author_name || 'Unknown'}</p>
                <p>Rs. ${(item.discounted_price * (item.quantity || 1)).toFixed(2)} <del>Rs. ${(item.book_mrp * (item.quantity || 1)).toFixed(2) || ''}</del></p>
                <p>Quantity: ${item.quantity || 1}</p>
            </div>
        </div>
    `).join('');

    summarySection.innerHTML = `
        <h2>Order Summary</h2>
        ${summaryItems}
        <p>Total Price: Rs. ${totalPrice}</p>
        <button class="checkout">CHECKOUT</button>
    `;

    document.querySelector('.checkout').addEventListener('click', async () => {
        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/orders`, {
                method: 'POST',
                body: JSON.stringify({ address_id: selectedAddress.id })
            });
            if (!response) return;

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || "Failed to place order");
            }

            const orderData = await response.json();
            console.log("Order placed:", orderData);
            localStorage.removeItem('cartItems');
            localStorage.removeItem('selectedAddress');
            window.location.href = `../pages/order-confirmation.html?order_id=${orderData.order.id}`; // Pass order ID
        } catch (error) {
            console.error("Error placing order:", error);
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