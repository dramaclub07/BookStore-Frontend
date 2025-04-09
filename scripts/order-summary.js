const API_BASE_URL = window.config.API_BASE_URL;;

document.addEventListener("DOMContentLoaded", async () => {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
        alert("Please log in to continue.");
        window.location.href = '../pages/login.html';
        return;
    }

    const isOrderSummaryPage = window.location.pathname.includes('order-summary.html');

    try {
        await loadUserProfile();
        if (!isOrderSummaryPage) {
            await loadCartItems();
        }
        await loadOrderSummary();
        setupHeaderEventListeners();
    } catch (error) {
    }
});

function getAuthHeaders() {
    const token = localStorage.getItem('access_token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

async function refreshAccessToken() {
    const refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken) {
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
            return true;
        } else {
            localStorage.clear();
            alert("Session expired. Please log in again.");
            window.location.href = "../pages/login.html";
            return false;
        }
    } catch (error) {
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

function updateCartCount(count) {
    const cartCount = document.querySelector('#cart-link .cart-count');
    const sectionCount = document.getElementById('cart-count');
    const isOrderSummaryPage = window.location.pathname.includes('order-summary.html');

    if (cartCount) {
        if (isOrderSummaryPage) {
            cartCount.style.display = 'none';
        } else {
            cartCount.textContent = count;
            cartCount.style.display = count > 0 ? "flex" : "none";
        }
    }
    if (sectionCount) {
        if (isOrderSummaryPage) {
            sectionCount.style.display = 'none';
        } else {
            sectionCount.textContent = count;
        }
    }
}

async function loadUserProfile() {
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/users/profile`);
        if (!response) return;

        if (!response.ok) throw new Error(`Profile fetch failed with status: ${response.status}`);
        const userData = await response.json();
        if (userData.success) {
            const profileElement = document.getElementById('profile-link');
            if (profileElement) {
                profileElement.innerHTML = `<i class="fa-solid fa-user"></i> <span class="profile-name">${userData.name || 'User'}</span>`;
                localStorage.setItem('username', userData.name || 'User');
            }
            const nameInput = document.querySelector('input[readonly][value="Poonam Yadav"]');
            const mobileInput = document.querySelector('input[readonly][value="81678954778"]');
            if (nameInput) nameInput.value = userData.name || 'Unknown';
            if (mobileInput) mobileInput.value = userData.mobile_number || 'N/A';
        }
    } catch (error) {
    }
}

async function loadCartItems() {
    const cartContainer = document.getElementById('cart-container');
    const isOrderSummaryPage = window.location.pathname.includes('order-summary.html');

    if (isOrderSummaryPage && cartContainer) {
        cartContainer.style.display = 'none';
        return;
    }

    if (!cartContainer) {
        return;
    }

    cartContainer.innerHTML = '<p>Loading cart...</p>';

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/carts`, { method: 'GET' });
        if (!response) {
            cartContainer.innerHTML = '<p>Failed to load cart due to authentication issues.</p>';
            return;
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error ${response.status}: Failed to fetch cart items - ${errorText}`);
        }

        const data = await response.json();
        const cartItems = data.cart || [];
        renderCartItems(cartItems);
        updateCartCount(cartItems.length);
        setupCartEventListeners();
        await loadCartSummary();

        localStorage.setItem('cartItems', JSON.stringify(cartItems));
    } catch (error) {
        cartContainer.innerHTML = `<p>Error loading cart: ${error.message}</p>`;
    }
}

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
        const totalUnitPrice = (item.unit_price * (item.quantity || 1)).toFixed(2);
        const imageUrl = item.image_url || '../assets/default-book-image.jpg';
        return `
        <div class="cart-item" data-id="${item.book_id}" data-discounted-price="${item.discounted_price}" data-unit-price="${item.unit_price}">
            <img src="${imageUrl}" alt="${item.book_name || 'Unknown'}" onerror="this.src='../assets/default-book-image.jpg';">
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

async function updateQuantity(button, change) {
    const cartItem = button.closest('.cart-item');
    const bookId = cartItem.dataset.id;
    const quantityElement = cartItem.querySelector('.quantity-value');
    const discountedPriceElement = cartItem.querySelector('.discounted-price');
    const unitPriceElement = cartItem.querySelector('.unit-price');
    let currentQuantity = parseInt(quantityElement.textContent, 10);

    if (isNaN(currentQuantity)) {
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
        alert("Failed to update quantity.");
        quantityElement.textContent = currentQuantity;
    }
}

async function removeCartItem(button) {
    const cartItem = button.closest('.cart-item');
    const bookId = cartItem.dataset.id;

    if (!bookId) {
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
        alert("Failed to remove item.");
    }
}

async function loadCartSummary() {
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/carts/summary`);
        if (!response) return;

        if (!response.ok) throw new Error("Failed to fetch cart summary");

        const cartData = await response.json();
        updateCartCount(cartData.total_items || 0);
    } catch (error) {
    }
}

async function loadOrderSummary() {
    const cartItems = JSON.parse(localStorage.getItem('cartItems') || '[]');
    const selectedAddress = JSON.parse(localStorage.getItem('selectedAddress') || '{}');
    const summarySection = document.getElementById('order-summary-section');
    const isOrderSummaryPage = window.location.pathname.includes('order-summary.html');

    if (!summarySection) {
        return;
    }

    if (!cartItems.length) {
        summarySection.innerHTML = '<p>Your cart is empty. Redirecting to cart...</p>';
        setTimeout(() => {
            window.location.href = '../pages/cart.html';
        }, 2000);
        return;
    }

    if (!selectedAddress.id && isOrderSummaryPage) {
        summarySection.innerHTML = '<p>No address selected. Redirecting to customer details...</p>';
        setTimeout(() => {
            window.location.href = '../pages/customer-details.html';
        }, 2000);
        return;
    }

    const addressTextarea = document.querySelector('textarea[readonly]');
    const cityInput = document.querySelector('input[readonly][value="Bengaluru"]');
    const stateInput = document.querySelector('input[readonly][value="Karnataka"]');
    const radio = document.querySelector(`input[name="address-type"][value="${selectedAddress.address_type || 'Work'}"]`);
    if (addressTextarea) addressTextarea.value = selectedAddress.street || '';
    if (cityInput) cityInput.value = selectedAddress.city || '';
    if (stateInput) stateInput.value = selectedAddress.state || '';
    if (radio) radio.checked = true;

    const totalPrice = cartItems.reduce((sum, item) => {
        return sum + (item.discounted_price * (item.quantity || 1));
    }, 0).toFixed(2);

    const summaryItems = cartItems.map(item => {
        const imageUrl = item.image_url || '../assets/default-book-image.jpg';
        return `
        <div class="summary-item">
            <img src="${imageUrl}" alt="${item.book_name || 'Unknown'}" onerror="this.src='../assets/default-book-image.jpg';">
            <div class="summary-item-details">
                <h3>${item.book_name || 'Untitled'}</h3>
                <p>by ${item.author_name || 'Unknown'}</p>
                <p>Rs. ${(item.discounted_price * (item.quantity || 1)).toFixed(2)} <del>Rs. ${(item.unit_price * (item.quantity || 1)).toFixed(2) || ''}</del></p>
                <p>Quantity: ${item.quantity || 1}</p>
            </div>
        </div>
    `;
    }).join('');

    summarySection.innerHTML = `
        <h2>Order Summary</h2>
        <div class="summary-items">${summaryItems}</div>
        <div class="summary-total">
            <p>Total Price: Rs. ${totalPrice}</p>
        </div>
        <div class="summary-address">
            <p><strong>Shipping Address:</strong> ${selectedAddress.street || 'Not set'}, ${selectedAddress.city || 'Not set'}, ${selectedAddress.state || 'Not set'}</p>
        </div>
        ${isOrderSummaryPage ? '<button class="checkout">CHECKOUT</button>' : ''}
    `;

    if (isOrderSummaryPage) {
        document.querySelector('.checkout').addEventListener('click', async () => {
            const cartItems = JSON.parse(localStorage.getItem('cartItems') || '[]');
            const selectedAddress = JSON.parse(localStorage.getItem('selectedAddress') || '{}');

            if (!cartItems.length) {
                alert("Your cart is empty. Please add items to your cart before placing an order.");
                return;
            }

            if (!selectedAddress.id) {
                alert("No address selected. Please select an address before placing an order.");
                return;
            }

            const payload = {
                order: {
                    address_id: selectedAddress.id
                }
            };

            try {
                const response = await fetchWithAuth(`${API_BASE_URL}/orders`, {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                if (!response) {
                    return;
                }

                const responseText = await response.text();

                if (!response.ok) {
                    const errorData = JSON.parse(responseText);
                    throw new Error(errorData.message || "Failed to place order");
                }

                const orderData = JSON.parse(responseText);
                if (orderData.success) {
                    localStorage.removeItem('cartItems');
                    localStorage.removeItem('selectedAddress');
                    window.location.href = `../pages/order-confirmation.html?order_id=${orderData.orders[orderData.orders.length - 1].id}`;
                } else {
                    alert("Order creation failed: " + (orderData.message || "Unknown error"));
                }
            } catch (error) {
                alert(`Failed to place order: ${error.message}`);
            }
        });
    }
}

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

    if (!profileLink) {
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
        google.accounts.id.revoke(localStorage.getItem("socialEmail") || "", () => {});
    }

    if (provider === "facebook" && typeof FB !== "undefined") {
        FB.getLoginStatus(function (response) {
            if (response.status === "connected") {
                FB.logout(function (response) {});
            }
        });
    }

    localStorage.clear();
    alert("Logged out successfully.");
    window.location.href = "../pages/homePage.html";
}