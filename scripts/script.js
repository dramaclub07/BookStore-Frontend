// Base URL for API (adjust this based on your environment)
const API_BASE_URL = 'http://localhost:3000/api/v1';

// Helper function to get auth headers
function getAuthHeaders() {
    const token = localStorage.getItem('authToken');
    console.log('Auth Token:', token);
    console.log('Authorization Header:', `Bearer ${token}`);
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

function loadCartItems() {
    const url = `${API_BASE_URL}/cart`;
    console.log('Fetching from:', url);
    fetch(url, {
        method: 'GET',
        headers: getAuthHeaders()
    })
    .then(response => {
        console.log('Response status:', response.status);
        return response.json();
    })
    .then(data => {
        console.log('Response data:', data);
        if (data.success) {
            renderCartItems(data.data);
            setupQuantityControl();
            setupRemoveItem();
            updateCartCount(data.data.length);
        } else {
            console.error('Error fetching cart:', data.message);
        }
    })
    .catch(error => console.error('Error loading cart:', error));
}

// Function to render cart items
function renderCartItems(cartItems) {
    const cartContainer = document.querySelector('.section');
    const cartHtml = cartItems.map(item => `
        <div class="cart-item" data-id="${item.book_id}">
            <img src="${item.book.image_url || 'https://via.placeholder.com/80x120'}" alt="${item.book.title}">
            <div class="cart-item-details">
                <h3>${item.book.title}</h3>
                <p>by ${item.book.author || 'Unknown'}</p>
                <p>Rs. ${item.book.discounted_price || item.book.book_mrp} <del>Rs. ${item.book.book_mrp}</del></p>
                <div class="quantity">
                    <button>-</button>
                    <span>${item.quantity}</span>
                    <button>+</button>
                </div>
                <button class="remove">Remove</button>
            </div>
        </div>
    `).join('');
    
    cartContainer.innerHTML = `
        <h2>My cart (${cartItems.length})</h2>
        ${cartHtml}
        <button class="use-location">📍 Use current location</button>
        <button class="place-order" onclick="placeOrder()">Place Order</button>
    `;
}

// Function to set up quantity control
function setupQuantityControl() {
    document.querySelectorAll('.quantity button').forEach(button => {
        button.addEventListener('click', () => {
            const cartItem = button.closest('.cart-item');
            const bookId = cartItem.dataset.id;
            const span = button.parentElement.querySelector('span');
            let quantity = parseInt(span.textContent);

            if (button.textContent === '-' && quantity > 1) quantity--;
            if (button.textContent === '+' && quantity < 10) quantity++;
            
            span.textContent = quantity;
            updateCartItem(bookId, quantity);
        });
    });
}

// Function to update cart item quantity in backend
function updateCartItem(bookId, quantity) {
    fetch(`${API_BASE_URL}/cart/add`, {
        method: 'POST', // Using POST to update quantity via add action
        headers: getAuthHeaders(),
        body: JSON.stringify({ book_id: bookId, quantity: quantity })
    })
    .then(response => response.json())
    .then(data => {
        if (!data.success) {
            console.error('Error updating quantity:', data.message);
            loadCartItems(); // Reload cart to sync with backend in case of error
        }
    })
    .catch(error => console.error('Error updating item:', error));
}

// Function to set up remove item functionality
function setupRemoveItem() {
    document.querySelectorAll('.remove').forEach(button => {
        button.addEventListener('click', () => {
            const cartItem = button.closest('.cart-item');
            const bookId = cartItem.dataset.id;
            removeCartItem(bookId, cartItem);
        });
    });
}

// Function to remove item from backend
function removeCartItem(bookId, cartItemElement) {
    fetch(`${API_BASE_URL}/cart/toggle_remove`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ book_id: bookId })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            cartItemElement.remove();
            updateCartCount(document.querySelectorAll('.cart-item').length);
        } else {
            console.error('Error removing item:', data.message);
        }
    })
    .catch(error => console.error('Error removing item:', error));
}

// Function to update cart count in header
function updateCartCount(count) {
    const cartCount = document.querySelector('.cart-count');
    if (cartCount) {
        cartCount.textContent = count;
    }
}

// Function to place order (placeholder - you'll need a separate endpoint)
function placeOrder() {
    const cartItems = Array.from(document.querySelectorAll('.cart-item')).map(item => ({
        book_id: item.dataset.id,
        quantity: parseInt(item.querySelector('.quantity span').textContent)
    }));

    // Note: Your provided backend doesn't have an order placement endpoint yet
    // This is a placeholder - you'll need to add an order creation endpoint
    fetch(`${API_BASE_URL}/orders`, { // Adjust this URL to your actual order endpoint
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ items: cartItems })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            window.location.href = 'customer-details.html';
        } else {
            console.error('Error placing order:', data.message);
        }
    })
    .catch(error => console.error('Error placing order:', error));
}