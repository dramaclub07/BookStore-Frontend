// order-summary.js
const API_BASE_URL = 'http://127.0.0.1:3000/api/v1';

document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        alert("Please log in to continue.");
        window.location.href = '/pages/login.html';
        return;
    }

    await loadUserProfile(); // Updates header and form fields
    await loadCartItems();   // Loads and renders cart items in "My cart" section
    await loadOrderSummary(); // Loads order summary and address details
});

function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

// Update cart count in UI
function updateCartCount(count) {
    const cartCount = document.querySelector('#cart-link .cart-count');
    const sectionCount = document.getElementById('cart-count');
    if (cartCount) cartCount.textContent = count;
    if (sectionCount) sectionCount.textContent = count;
}

// Load user profile and update header/form
async function loadUserProfile() {
    try {
        const response = await fetch(`${API_BASE_URL}/users/profile`, {
            headers: getAuthHeaders()
        });
        if (!response.ok) {
            if (response.status === 401) {
                alert("Session expired. Please log in again.");
                localStorage.removeItem('token');
                window.location.href = '/pages/login.html';
                return;
            }
            throw new Error(`Profile fetch failed with status: ${response.status}`);
        }
        const userData = await response.json();
        if (userData.success) {
            const profileElement = document.getElementById('profile-link');
            if (profileElement) {
                profileElement.innerHTML = `<i class="fa-solid fa-user"></i> ${userData.name || 'User'}`;
            }
            document.querySelector('input[readonly][value="Poonam Yadav"]').value = userData.name || 'Unknown';
            document.querySelector('input[readonly][value="81678954778"]').value = userData.mobile_number || 'N/A';
        }
    } catch (error) {
        console.error("Profile fetch error:", error.message);
    }
}

// Fetch and display cart items
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

        // Save cart items to localStorage for consistency
        localStorage.setItem('cartItems', JSON.stringify(cartItems));
    } catch (error) {
        console.error('Error fetching cart items:', error);
        cartContainer.innerHTML = `<p>Error loading cart.</p>`;
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
        await loadOrderSummary(); // Refresh order summary after quantity change

        // Update cart items in localStorage
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

// Remove item
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
        await loadOrderSummary(); // Refresh order summary after removal

        if (remainingItems === 0) {
            document.getElementById('cart-container').innerHTML = '<p>Your cart is empty.</p>';
        }

        // Update cart items in localStorage
        const cartItems = JSON.parse(localStorage.getItem('cartItems') || '[]');
        const updatedCartItems = cartItems.filter(item => item.book_id !== bookId);
        localStorage.setItem('cartItems', JSON.stringify(updatedCartItems));
    } catch (error) {
        console.error("Error removing item:", error);
        alert("Failed to remove item.");
    }
}

// Fetch and display cart summary
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

// Load order summary
async function loadOrderSummary() {
    const cartItems = JSON.parse(localStorage.getItem('cartItems') || '[]');
    const selectedAddress = JSON.parse(localStorage.getItem('selectedAddress') || '{}');

    if (!cartItems.length) {
        alert("Your cart is empty. Please add items to proceed.");
        window.location.href = '/pages/cart.html';
        return;
    }

    if (!selectedAddress.id) {
        alert("No address selected. Please select an address.");
        window.location.href = '/pages/customer-details.html';
        return;
    }

    // Populate address fields
    document.querySelector('textarea[readonly]').value = selectedAddress.street || '';
    document.querySelector('input[readonly][value="Bengaluru"]').value = selectedAddress.city || '';
    document.querySelector('input[readonly][value="Karnataka"]').value = selectedAddress.state || '';
    const radio = document.querySelector(`input[name="address-type"][value="${selectedAddress.address_type || 'Work'}"]`);
    if (radio) radio.checked = true;

    // Populate order summary
    const summarySection = document.getElementById('order-summary-section');
    if (!summarySection) return;

    // Calculate total price
    const totalPrice = cartItems.reduce((sum, item) => {
        return sum + (item.discounted_price * (item.quantity || 1));
    }, 0).toFixed(2);

    const summaryItems = cartItems.map(item => `
        <div class="summary-item">
            <img src="${item.image_url || '/default-book-image.jpg'}" alt="${item.book_name || 'Unknown'}">
            <div class="summary-item-details">
                <h3>${item.book_name || 'Untitled'}</h3>
                <p>by ${item.author_name || 'Unknown'}</p>
                <p>Rs. ${(item.discounted_price * (item.quantity || 1)).toFixed(2)} <del>Rs. ${(item.unit_price * (item.quantity || 1)).toFixed(2) || ''}</del></p>
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

    // Add checkout event listener
    document.querySelector('.checkout').addEventListener('click', async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/orders`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ address_id: selectedAddress.id })
            });
            if (response.status === 401) {
                alert("Session expired. Please log in again.");
                localStorage.removeItem('token');
                window.location.href = '/pages/login.html';
                return;
            }
            if (!response.ok) {
                const errorData = await response.json();
                throw new  new Error(errorData.message || "Failed to place order");
            }

            const orderData = await response.json();
            if (orderData.success) {
                localStorage.removeItem('cartItems');
                localStorage.removeItem('selectedAddress');
                window.location.href = '/pages/order-confirmation.html';
            }
        } catch (error) {
            console.error("Error placing order:", error);
            alert(`Failed to place order: ${error.message}`);
        }
    });
}