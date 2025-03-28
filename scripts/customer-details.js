const API_BASE_URL = 'http://127.0.0.1:3000/api/v1';

document.addEventListener("DOMContentLoaded", async () => {
    console.log("DOM fully loaded, initializing...");

    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
        console.warn("No access token found, redirecting to login...");
        alert("Please log in to continue.");
        window.location.href = '../pages/login.html';
        return;
    }

    try {
        await Promise.all([
            loadUserProfile(),
            loadCartItems(),
            loadAddresses()
        ]);
        console.log("Initial data loaded successfully");
    } catch (error) {
        console.error("Error during initial load:", error);
    }

    setupLocationButton();
    setupHeaderEventListeners();

    const continueButton = document.querySelector('.continue');
    if (continueButton) {
        continueButton.addEventListener('click', () => {
            const selectedAddress = JSON.parse(localStorage.getItem('selectedAddress') || '{}');
            if (selectedAddress.id || (selectedAddress.street && selectedAddress.city && selectedAddress.state)) {
                console.log("Continue clicked, redirecting to order-summary with address:", selectedAddress);
                window.location.href = '../pages/order-summary.html';
            } else {
                alert("Please select an address or use your current location.");
            }
        });
    } else {
        console.error("Continue button not found in DOM");
    }

    const addAddressButton = document.querySelector('.add-address');
    if (addAddressButton) {
        addAddressButton.addEventListener('click', () => {
            console.log("Add address clicked, redirecting to profile...");
            window.location.href = '../pages/profile.html';
        });
    } else {
        console.error("Add address button not found in DOM");
    }
});

// Get auth headers
function getAuthHeaders() {
    const accessToken = localStorage.getItem('access_token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
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
        console.log("Refresh token response:", data);
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
        console.warn("No access token, redirecting to login...");
        window.location.href = "../pages/login.html";
        return null;
    }

    const expiresIn = localStorage.getItem("token_expires_in");
    if (expiresIn && Date.now() >= expiresIn) {
        console.log("Token expired, attempting refresh...");
        const refreshed = await refreshAccessToken();
        if (!refreshed) return null;
    }

    options.headers = { ...options.headers, ...getAuthHeaders() };
    let response = await fetch(url, options);

    if (response.status === 401) {
        console.warn("Received 401, attempting token refresh...");
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

// Update cart count in UI
function updateCartCount(count) {
    console.log("Updating cart count to:", count);
    const cartCount = document.querySelector('#cart-link .cart-count');
    const sectionCount = document.getElementById('cart-count');

    if (cartCount) {
        if (count > 0) {
            cartCount.textContent = count;
            cartCount.style.display = "flex";
            console.log("Cart count visible:", cartCount.textContent);
        } else {
            cartCount.textContent = ""; // Clear content when count is 0
            cartCount.style.display = "none"; // Hide the element
            console.log("Cart count hidden");
        }
    } else {
        console.error("Cart count element (#cart-link .cart-count) not found in DOM");
    }

    if (sectionCount) {
        if (count > 0) {
            sectionCount.textContent = count;
            sectionCount.style.display = "inline";
        } else {
            sectionCount.textContent = ""; // Clear content when count is 0
            sectionCount.style.display = "none"; // Hide the element
        }
    } else {
        console.error("Section count element (#cart-count) not found in DOM");
    }
}

// Fetch and display user profile
async function loadUserProfile() {
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/users/profile`);
        if (!response) return;

        if (!response.ok) throw new Error(`Profile fetch failed with status: ${response.status}`);
        const userData = await response.json();
        console.log("User profile data:", userData);

        const profileElement = document.getElementById('profile-link');
        if (profileElement) {
            profileElement.innerHTML = `<i class="fa-solid fa-user"></i> <span class="profile-name">${userData.name || userData.full_name || 'User'}</span>`;
            localStorage.setItem('username', userData.name || userData.full_name || 'User');
        } else {
            console.error("Profile link element (#profile-link) not found in DOM");
        }

        const nameInput = document.querySelector('input[readonly][value="Poonam Yadav"]');
        if (nameInput) nameInput.value = userData.name || userData.full_name || 'Unknown';

        const mobileInput = document.querySelector('input[readonly][value="81678954778"]');
        if (mobileInput) mobileInput.value = userData.mobile_number || 'N/A';
    } catch (error) {
        console.error("Profile fetch error:", error.message);
    }
}

// Fetch and display cart items
async function loadCartItems() {
    const cartContainer = document.getElementById('cart-container');
    if (!cartContainer) {
        console.error("Cart container (#cart-container) not found in DOM");
        return;
    }

    cartContainer.innerHTML = '<p>Loading cart...</p>';

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/carts`, { method: 'GET' });
        if (!response) return;

        if (!response.ok) throw new Error(`Error ${response.status}: Failed to fetch cart items`);
        const cartItems = await response.json();
        console.log("Cart items fetched:", cartItems);

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

// Render cart items
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
        return `
        <div class="cart-item" data-id="${item.book_id}" data-discounted-price="${item.discounted_price}" data-unit-price="${item.unit_price}">
            <img src="${item.image_url || '/default-image.jpg'}" alt="${item.book_name || 'Unknown'}">
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

// Setup cart event listeners
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

// Update quantity
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
            const result = await response.json();
            throw new Error(result.error || "Failed to update quantity");
        }

        quantityElement.textContent = newQuantity;
        const newDiscountedPrice = (perUnitDiscountedPrice * newQuantity).toFixed(2);
        const newUnitPrice = (perUnitPrice * newQuantity).toFixed(2);

        if (discountedPriceElement) discountedPriceElement.textContent = newDiscountedPrice;
        if (unitPriceElement) unitPriceElement.textContent = newUnitPrice;

        await loadCartSummary();

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

// Remove cart item
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
            const result = await response.json();
            throw new Error(result.error || "Failed to remove item");
        }

        cartItem.remove();
        const remainingItems = document.querySelectorAll('.cart-item').length;
        updateCartCount(remainingItems);
        await loadCartSummary();

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

// Fetch cart summary
async function loadCartSummary() {
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/carts/summary`);
        if (!response) return;

        if (!response.ok) throw new Error("Failed to fetch cart summary");

        const cartData = await response.json();
        console.log("Cart summary:", cartData);
        updateCartCount(cartData.total_items || 0);
    } catch (error) {
        console.error("Error fetching cart summary:", error);
        updateCartCount(0);
    }
}

// Fetch addresses
async function fetchAddresses() {
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/addresses`);
        if (!response) return null;

        if (!response.ok) throw new Error(`Failed to fetch addresses: ${response.status}`);
        const data = await response.json();
        console.log("Fetched addresses:", data);
        return data.addresses || [];
    } catch (error) {
        console.error("Error fetching addresses:", error);
        alert("Error loading addresses. Please try again.");
        return null;
    }
}

// Load addresses
async function loadAddresses() {
    const selectedAddress = JSON.parse(localStorage.getItem('selectedAddress') || '{}');
    const addresses = await fetchAddresses();

    if (!addresses || addresses.length === 0) {
        if (selectedAddress.street) {
            updateAddressFields(selectedAddress, selectedAddress.address_type === 'other');
        } else {
            updateAddressFields({ street: '', city: '', state: '' }, false);
        }
        return;
    }

    window.addressesList = addresses;

    let defaultAddress;
    if (selectedAddress.id && addresses.some(addr => addr.id === selectedAddress.id)) {
        defaultAddress = selectedAddress;
    } else {
        defaultAddress = addresses.find(addr => addr.is_default) || addresses[0];
        localStorage.setItem('selectedAddress', JSON.stringify(defaultAddress));
        localStorage.setItem('selectedAddressId', defaultAddress.id);
    }

    updateAddressFields(defaultAddress, defaultAddress.address_type === 'other');

    const initialRadio = document.querySelector(`input[name="address-type"][value="${defaultAddress.address_type}"]`);
    if (initialRadio) initialRadio.checked = true;

    document.querySelectorAll('input[name="address-type"]').forEach(radio => {
        radio.addEventListener('change', async () => {
            const selectedType = radio.value;
            const freshAddresses = await fetchAddresses();
            if (!freshAddresses) return;

            window.addressesList = freshAddresses;
            const filteredAddress = freshAddresses.find(addr => addr.address_type.toLowerCase() === selectedType.toLowerCase());
            if (filteredAddress) {
                updateAddressFields(filteredAddress, filteredAddress.address_type === 'other');
                localStorage.setItem('selectedAddress', JSON.stringify(filteredAddress));
                localStorage.setItem('selectedAddressId', filteredAddress.id);
            } else {
                updateAddressFields({ street: '', city: '', state: '' }, false);
                localStorage.removeItem('selectedAddress');
                localStorage.removeItem('selectedAddressId');
                alert(`No ${selectedType} address found. Please add one.`);
            }
        });
    });
}

// Update address fields
function updateAddressFields(address, shouldBlink = false) {
    const streetInput = document.getElementById('address-street');
    const cityInput = document.getElementById('address-city');
    const stateInput = document.getElementById('address-state');

    if (streetInput) streetInput.value = address.street || '';
    else console.error("Address street input (#address-street) not found in DOM");

    if (cityInput) cityInput.value = address.city || '';
    else console.error("Address city input (#address-city) not found in DOM");

    if (stateInput) stateInput.value = address.state || '';
    else console.error("Address state input (#address-state) not found in DOM");

    const otherRadio = document.querySelector('input[name="address-type"][value="Other"]');
    if (shouldBlink && otherRadio) {
        otherRadio.checked = true;
        otherRadio.classList.add('blink');
        setTimeout(() => otherRadio.classList.remove('blink'), 2000);
    } else if (otherRadio) {
        otherRadio.classList.remove('blink');
    }
}

// Save current location to backend
async function saveCurrentLocationToBackend(locationData) {
    try {
        const addressData = {
            street: locationData.street || 'Unknown Street',
            city: locationData.city || 'Unknown City',
            state: locationData.state || 'Unknown State',
            zip_code: locationData.zip_code || '00000',
            country: locationData.country || 'Unknown Country',
            address_type: 'other',
            is_default: false
        };

        const response = await fetchWithAuth(`${API_BASE_URL}/addresses/create`, {
            method: 'POST',
            body: JSON.stringify(addressData)
        });
        if (!response) return;

        const result = await response.json();
        if (!response.ok) {
            throw new Error(`Failed to save address: ${result.error || 'Unknown error'}`);
        }
        console.log("Saved address:", result.address);
        return result.address;
    } catch (error) {
        console.error("Error saving current location:", error);
        throw error;
    }
}

// Setup location button
function setupLocationButton() {
    const useLocationButton = document.querySelector('.use-location');
    if (!useLocationButton) {
        console.error("Use location button (.use-location) not found in DOM");
        return;
    }

    useLocationButton.addEventListener('click', async function() {
        if (!("geolocation" in navigator)) {
            alert('Geolocation is not supported by your browser.');
            return;
        }

        useLocationButton.textContent = '📍 Fetching location...';
        useLocationButton.disabled = true;

        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 });
            });

            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;

            const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`;
            const response = await fetch(nominatimUrl, {
                headers: {
                    'User-Agent': 'BookstoreApp/1.0 (your-email@example.com)'
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch address from Nominatim API');
            }

            const data = await response.json();
            if (!data || !data.address) {
                throw new Error('No address found for the given coordinates');
            }

            const address = {
                street: data.address.road || data.address.street || '',
                city: data.address.city || data.address.town || data.address.village || '',
                state: data.address.state || data.address.region || '',
                zip_code: data.address.postcode || '00000',
                country: data.address.country || ''
            };

            const savedAddress = await saveCurrentLocationToBackend(address);
            updateAddressFields(savedAddress, true);
            localStorage.setItem('selectedAddress', JSON.stringify(savedAddress));
            localStorage.setItem('selectedAddressId', savedAddress.id);
            await loadAddresses();

            alert('Latest current location saved successfully!');
            useLocationButton.textContent = '📍 Use current location';
            useLocationButton.disabled = false;
        } catch (error) {
            let errorMessage = 'Unable to fetch or save location: ';
            if (error.code) {
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage += 'User denied the request for Geolocation.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage += 'Location information is unavailable.';
                        break;
                    case error.TIMEOUT:
                        errorMessage += 'The request to get user location timed out.';
                        break;
                    default:
                        errorMessage += 'An unknown error occurred.';
                        break;
                }
            } else {
                errorMessage += error.message;
            }
            console.error(errorMessage);
            alert(errorMessage);
            updateAddressFields({ street: '', city: '', state: '' }, false);
            localStorage.removeItem('selectedAddress');
            localStorage.removeItem('selectedAddressId');
            useLocationButton.textContent = '📍 Use current location';
            useLocationButton.disabled = false;
        }
    });
}

// Dropdown Functionality
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
        console.error("Logo element (.logo) not found in DOM");
    }

    if (!profileLink) {
        console.error("Profile link element (#profile-link) not found in DOM");
        return;
    }

    profileLink.addEventListener("click", (event) => {
        event.preventDefault();
        console.log("Profile link clicked, toggling dropdown");
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
            console.log("Clicked outside dropdown, closing...");
            closeDropdown();
        }
    });

    if (cartLink) {
        cartLink.addEventListener("click", (event) => {
            event.preventDefault();
            console.log("Cart link clicked, redirecting to cart...");
            window.location.href = '../pages/cart.html';
        });
    } else {
        console.error("Cart link element (#cart-link) not found in DOM");
    }

    const searchInput = document.getElementById("search");
    if (searchInput) {
        searchInput.addEventListener("keypress", (event) => {
            if (event.key === "Enter") {
                const query = event.target.value.trim();
                if (query) {
                    console.log("Search triggered with query:", query);
                    window.location.href = `../pages/homePage.html?query=${encodeURIComponent(query)}`;
                }
            }
        });
    } else {
        console.error("Search input (#search) not found in DOM");
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
        console.log("Dropdown opened");

        document.getElementById("dropdown-profile").addEventListener("click", () => {
            console.log("Profile clicked, redirecting...");
            window.location.href = "../pages/profile.html";
            closeDropdown();
        });
        document.getElementById("dropdown-orders").addEventListener("click", () => {
            console.log("Orders clicked, redirecting...");
            window.location.href = "../pages/myOrders.html";
            closeDropdown();
        });
        document.getElementById("dropdown-wishlist").addEventListener("click", () => {
            console.log("Wishlist clicked, redirecting...");
            window.location.href = "../pages/wishlist.html";
            closeDropdown();
        });
        document.getElementById("dropdown-logout").addEventListener("click", () => {
            console.log("Logout clicked");
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
        console.log("Dropdown closed");
    }
}

// Sign Out Functionality
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