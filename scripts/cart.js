// API Base URL
const API_BASE_URL = 'http://127.0.0.1:3000/api/v1';

document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem('token');

    if (!token) {
        alert("Please log in to view your cart.");
        window.location.href = '/pages/login.html';
        return;
    }

    await loadUserProfile();
    await loadCartItems();
    setupLocationButton();
});

// Get auth headers
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

// Setup event listeners
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
        
        if (remainingItems === 0) {
            document.getElementById('cart-container').innerHTML = '<p>Your cart is empty.</p>';
        }
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
            throw new Error("Failed to fetch cart summary");
        }

        const cartData = await response.json();
        const totalPriceElement = document.getElementById('cart-total');
        if (totalPriceElement) {
            totalPriceElement.textContent = cartData.total_price || 0;
        }
        updateCartCount(cartData.total_items || 0);
    } catch (error) {
        console.error("Error fetching cart summary:", error);
    }
}

// User profile
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
                profileElement.innerHTML = `<i class="fa-solid fa-user"></i> <span class="profile-name">${userData.name || 'User'}</span>`;
            }
        }
    } catch (error) {
        console.error("Profile fetch error:", error.message);
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

// Fetch addresses
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
        return data.addresses || [];
    } catch (error) {
        console.error("Error fetching addresses:", error);
        return null;
    }
}

// Update address display
function updateAddressFields(address) {
    const addressContainer = document.getElementById('address-container');
    if (addressContainer) {
        addressContainer.innerHTML = `<p>${address.street}, ${address.city}, ${address.state} ${address.zip_code}, ${address.country}</p>`;
    }
}

// Setup location button (direct geolocation)
function setupLocationButton() {
    const useLocationButton = document.querySelector('.use-location');
    if (!useLocationButton) {
        console.log('Use current location button not found');
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
            updateAddressFields(savedAddress);
            localStorage.setItem('selectedAddress', JSON.stringify(savedAddress));
            localStorage.setItem('selectedAddressId', savedAddress.id);

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
            const addressContainer = document.getElementById('address-container');
            if (addressContainer) {
                addressContainer.innerHTML = `<p>No address selected.</p>`;
            }
            useLocationButton.textContent = '📍 Use current location';
            useLocationButton.disabled = false;
        }
    });

    // Load any previously selected address
    const selectedAddress = JSON.parse(localStorage.getItem('selectedAddress') || '{}');
    if (selectedAddress.street) {
        updateAddressFields(selectedAddress);
    }
}

// Handle page navigation with address choice
document.querySelector('.place-order')?.addEventListener('click', async () => {
    const selectedAddress = JSON.parse(localStorage.getItem('selectedAddress') || '{}');
    
    if (selectedAddress.street) {
        window.location.href = '/pages/customer-details.html';
    } else {
        const userChoice = confirm("No address selected. Would you like to use your current location? Click 'OK' for yes, or 'Cancel' to set an address manually.");
        
        if (userChoice) {
            // Use Current Location
            if (!("geolocation" in navigator)) {
                alert('Geolocation is not supported by your browser.');
                return;
            }

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
                updateAddressFields(savedAddress);
                localStorage.setItem('selectedAddress', JSON.stringify(savedAddress));
                localStorage.setItem('selectedAddressId', savedAddress.id);

                window.location.href = '/pages/customer-details.html';
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
            }
        } else {
            // Set Address Manually
            window.location.href = '/pages/address-details.html';
        }
    }
});