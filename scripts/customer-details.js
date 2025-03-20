// customer-details.js
const API_BASE_URL = 'http://127.0.0.1:3000/api/v1';

document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        alert("Please log in to continue.");
        window.location.href = '/pages/login.html';
        return;
    }

    await loadUserProfile();
    await loadCartItems();
    await loadAddresses();

    document.querySelector('.continue').addEventListener('click', () => {
        const selectedAddress = JSON.parse(localStorage.getItem('selectedAddress') || '{}');
        if (selectedAddress.id) {
            window.location.href = '/pages/order-summary.html';
        } else {
            alert("Please select an address.");
        }
    });

    document.querySelector('.add-address')?.addEventListener('click', () => {
        window.location.href = '/pages/address-details.html';
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
    const headerCount = document.querySelector('.cart-count');
    const sectionCount = document.getElementById('cart-count');
    if (headerCount) headerCount.textContent = count;
    if (sectionCount) sectionCount.textContent = count;
}

async function loadUserProfile() {
    try {
        const response = await fetch(`${API_BASE_URL}/users/profile`, { headers: getAuthHeaders() });
        if (response.status === 401) {
            alert("Session expired. Please log in again.");
            localStorage.removeItem('token');
            window.location.href = '/pages/login.html';
            return;
        }
        if (!response.ok) throw new Error(`Failed to fetch profile: ${response.status}`);

        const userData = await response.json();
        if (userData.success) {
            const profileElement = document.querySelector('.profile');
            if (profileElement) {
                profileElement.textContent = `👤 ${userData.name || 'User'}`;
            }
            document.querySelector('input[readonly][value="Poonam Yadav"]').value = userData.name || 'Unknown';
            document.querySelector('input[readonly][value="81678954778"]').value = userData.mobile_number || 'N/A';
        }
    } catch (error) {
        console.error("Error fetching profile:", error);
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
                window.location.href = '/pages/login.html';
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

        // Save cart items to localStorage for use in order summary
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

        // Update cart items in localStorage after quantity change
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

        // Update cart items in localStorage after removal
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
                window.location.href = '/pages/login.html';
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
            window.location.href = '/pages/login.html';
            return null;
        }
        if (!response.ok) throw new Error(`Failed to fetch addresses: ${response.status}`);

        const data = await response.json();
        if (!data.success) throw new Error("Failed to load addresses from server");

        console.log("Fetched Addresses:", data.addresses);
        return data.addresses || [];
    } catch (error) {
        console.error("Error fetching addresses:", error);
        alert("Error loading addresses. Please try again.");
        return null;
    }
}

async function loadAddresses() {
    const addresses = await fetchAddresses();
    if (!addresses || addresses.length === 0) {
        alert("No addresses found. Please add an address.");
        return;
    }

    window.addressesList = addresses;

    let selectedAddress = addresses.find(addr => addr.address_type.toLowerCase() === 'work') || 
                         addresses.find(addr => addr.is_default) || 
                         addresses[0];
    updateAddressFields(selectedAddress);
    localStorage.setItem('selectedAddress', JSON.stringify(selectedAddress));
    const initialRadio = document.querySelector(`input[name="address-type"][value="${selectedAddress.address_type}"]`);
    if (initialRadio) initialRadio.checked = true;

    document.querySelectorAll('input[name="address-type"]').forEach(radio => {
        radio.addEventListener('change', async () => {
            const selectedType = radio.value;
            const freshAddresses = await fetchAddresses();
            if (!freshAddresses) return;

            window.addressesList = freshAddresses;
            const filteredAddress = freshAddresses.find(addr => addr.address_type.toLowerCase() === selectedType.toLowerCase());
            if (filteredAddress) {
                updateAddressFields(filteredAddress);
                localStorage.setItem('selectedAddress', JSON.stringify(filteredAddress));
            } else {
                updateAddressFields({ street: '', city: '', state: '' });
                localStorage.removeItem('selectedAddress');
                alert(`No ${selectedType} address found. Please add one.`);
            }
        });
    });
}

function updateAddressFields(address) {
    document.getElementById('address-street').value = address.street || '';
    document.getElementById('address-city').value = address.city || '';
    document.getElementById('address-state').value = address.state || '';
}