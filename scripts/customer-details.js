const API_BASE_URL = 'http://127.0.0.1:3000/api/v1';

document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        alert("Please log in to continue.");
        window.location.href = '../pages/login.html';
        return;
    }

    await loadUserProfile();
    await loadCartItems();
    await loadAddresses();
    setupLocationButton();
    setupHeaderEventListeners();

    document.querySelector('.continue')?.addEventListener('click', () => {
        const selectedAddress = JSON.parse(localStorage.getItem('selectedAddress') || '{}');
        if (selectedAddress.id || (selectedAddress.street && selectedAddress.city && selectedAddress.state)) {
            window.location.href = '../pages/order-summary.html';
        } else {
            alert("Please select an address or use your current location.");
        }
    });

    document.querySelector('.add-address')?.addEventListener('click', () => {
        window.location.href = '../pages/profile.html';
    });
});

function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

function updateCartCount(count) {
    const cartCount = document.querySelector('#cart-link .cart-count');
    const sectionCount = document.getElementById('cart-count');

    if (cartCount) {
        cartCount.textContent = count;
        cartCount.style.display = count > 0 ? "flex" : "none";
    }

    if (sectionCount) {
        sectionCount.textContent = count;
        sectionCount.style.display = count > 0 ? "inline" : "none";
    }
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
            document.querySelector('input[readonly][value="Poonam Yadav"]').value = userData.name || 'Unknown';
            document.querySelector('input[readonly][value="81678954778"]').value = userData.mobile_number || 'N/A';
        }
    } catch (error) {
        console.error("Profile fetch error:", error.message);
    }
}

async function loadCartItems() {
    const cartContainer = document.getElementById('cart-container');
    if (!cartContainer) return;

    cartContainer.innerHTML = '<p>Loading cart...</p>';

    try {
        const response = await fetch(`${API_BASE_URL}/cart`, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            if (response.status === 401) {
                alert("Session expired. Please log in again.");
                localStorage.removeItem('token');
                window.location.href = '../pages/login.html';
                return;
            }
            throw new Error(`Error ${response.status}: Failed to fetch cart items`);
        }

        const data = await response.json();
        const cartItems = data.cart || [];
        renderCartItems(cartItems);
        updateCartCount(cartItems.length);
        setupCartEventListeners();
        await loadCartSummary();

        localStorage.setItem('cartItems', JSON.stringify(cartItems));
    } catch (error) {
        console.error('Error fetching cart items:', error);
        cartContainer.innerHTML = `<p>Error loading cart.</p>`;
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
        return `
        <div class="cart-item" data-id="${item.book_id}" data-discounted-price="${item.discounted_price}" data-unit-price="${item.unit_price}">
            <img src="${item.image_url}" alt="${item.book_name || 'Unknown'}">
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
        const response = await fetch(`${API_BASE_URL}/cart/update_quantity`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ book_id: bookId, quantity: newQuantity })
        });

        if (!response.ok) {
            throw new Error("Failed to update quantity");
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

async function removeCartItem(button) {
    const cartItem = button.closest('.cart-item');
    const bookId = cartItem.dataset.id;

    if (!bookId) {
        console.error("Book ID not found");
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/cart/toggle_remove`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ book_id: bookId })
        });

        if (!response.ok) {
            throw new Error("Failed to remove item");
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

async function fetchAddresses() {
    try {
        const response = await fetch(`${API_BASE_URL}/addresses`, { headers: getAuthHeaders() });
        if (response.status === 401) {
            alert("Session expired. Please log in again.");
            localStorage.removeItem('token');
            window.location.href = '../pages/login.html';
            return null;
        }
        if (!response.ok) throw new Error(`Failed to fetch addresses: ${response.status}`);

        const data = await response.json();
        if (!data.success) throw new Error("Failed to load addresses from server");
        return data.addresses || [];
    } catch (error) {
        console.error("Error fetching addresses:", error);
        alert("Error loading addresses. Please try again.");
        return null;
    }
}

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

    // Prioritize the selected address from profile page if it exists
    let defaultAddress;
    if (selectedAddress.id && addresses.some(addr => addr.id === selectedAddress.id)) {
        defaultAddress = selectedAddress;
    } else {
        defaultAddress = addresses.find(addr => addr.is_default) || addresses[0];
        localStorage.setItem('selectedAddress', JSON.stringify(defaultAddress));
        localStorage.setItem('selectedAddressId', defaultAddress.id);
    }

    updateAddressFields(defaultAddress, defaultAddress.address_type === 'other');

    // Set the correct radio button
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

function updateAddressFields(address, shouldBlink = false) {
    document.getElementById('address-street').value = address.street || '';
    document.getElementById('address-city').value = address.city || '';
    document.getElementById('address-state').value = address.state || '';

    const otherRadio = document.querySelector('input[name="address-type"][value="Other"]');
    if (shouldBlink && otherRadio) {
        otherRadio.checked = true;
        otherRadio.classList.add('blink');
        setTimeout(() => otherRadio.classList.remove('blink'), 2000);
    } else if (otherRadio) {
        otherRadio.classList.remove('blink');
    }
}

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

        const response = await fetch(`${API_BASE_URL}/addresses/create`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(addressData)
        });

        const result = await response.json();
        if (!response.ok) {
            throw new Error(`Failed to save address: ${result.error || 'Unknown error'}`);
        }

        return result.address;
    } catch (error) {
        console.error("Error saving current location:", error);
        throw error;
    }
}

function setupLocationButton() {
    const useLocationButton = document.querySelector('.use-location');
    if (!useLocationButton) return;

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
    window.location.href = "../pages/homePage.html";
}