// API Base URL
const API_BASE_URL = "http://127.0.0.1:3000/api/v1";

document.addEventListener("DOMContentLoaded", async () => {
    const accessToken = localStorage.getItem("access_token");

    if (!accessToken) {
        alert("Please log in to view your cart.");
        window.location.href = "../pages/login.html";
        return;
    }

    await loadUserProfile();
    await loadCartItems();
    setupLocationButton();
    setupHeaderEventListeners();
});

// Get auth headers
function getAuthHeaders() {
    const accessToken = localStorage.getItem("access_token");
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`
    };
}

// Authentication and Token Refresh
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
            localStorage.setItem("token_expires_in", Date.now() + (data.expires_in * 1000)); // Assumes expires_in from backend
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

// Update cart count in UI
function updateCartCount(count) {
    const cartCount = document.querySelector("#cart-link .cart-count");
    const sectionCount = document.getElementById("cart-count");
    const placeOrderButton = document.querySelector(".place-order");

    if (cartCount) {
        if (count > 0) {
            cartCount.textContent = count;
            cartCount.style.display = "flex";
        } else {
            cartCount.textContent = "";
            cartCount.style.display = "none";
        }
    }

    if (sectionCount) {
        if (count > 0) {
            sectionCount.textContent = count;
            sectionCount.style.display = "inline";
        } else {
            sectionCount.textContent = "";
            sectionCount.style.display = "none";
        }
    }

    if (placeOrderButton) {
        placeOrderButton.style.display = count > 0 ? "block" : "none";
    }
}

// Fetch and display cart items
async function loadCartItems() {
    const cartContainer = document.getElementById("cart-container");
    if (!cartContainer) return;

    cartContainer.innerHTML = "<p>Loading cart...</p>";

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/carts`, { method: "GET" });
        if (!response) {
            cartContainer.innerHTML = "<p>Authentication failed. Please log in again.</p>";
            return;
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Error ${response.status}: ${errorData.message || "Failed to fetch cart items"}`);
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message || "Failed to load cart");
        }

        const cartItems = data.cart || []; // Access nested cart array

        // Remove out-of-stock items
        for (const item of cartItems) {
            const bookResponse = await fetch(`${API_BASE_URL}/books/${item.book_id}`);
            const book = await bookResponse.json();
            if (book.quantity === 0) {
                await removeCartItem(item.book_id);
            }
        }

        // Reload cart after cleanup
        const updatedResponse = await fetchWithAuth(`${API_BASE_URL}/carts`, { method: "GET" });
        if (!updatedResponse) {
            cartContainer.innerHTML = "<p>Authentication failed. Please log in again.</p>";
            return;
        }

        const updatedData = await updatedResponse.json();
        if (!updatedData.success) {
            throw new Error(updatedData.message || "Failed to reload cart");
        }

        const updatedCartItems = updatedData.cart || [];
        renderCartItems(updatedCartItems);
        updateCartCount(updatedCartItems.reduce((sum, item) => sum + (item.quantity || 1), 0));
        setupCartEventListeners();
        await loadCartSummary();
    } catch (error) {
        console.error("Error fetching cart items:", error);
        cartContainer.innerHTML = `<p>Error loading cart: ${error.message}</p>`;
        updateCartCount(0);
    }
}

// Render cart items
function renderCartItems(cartItems) {
    const cartContainer = document.getElementById("cart-container");
    if (!cartContainer) return;

    if (!cartItems || cartItems.length === 0) {
        cartContainer.innerHTML = "<p>Your cart is empty.</p>";
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
                <h3>${item.book_name || "Untitled"}</h3>
                <p>by ${item.author_name || "Unknown"}</p>
                <p>Rs. <span class="discounted-price">${totalDiscountedPrice}</span> <del>Rs. <span class="unit-price">${totalUnitPrice || ""}</span></del></p>
                <div class="quantity">
                    <button class="decrease">-</button>
                    <span class="quantity-value">${item.quantity || 1}</span>
                    <button class="increase">+</button>
                </div>
                <button class="remove">Remove</button>
            </div>
        </div>
    `;
    }).join("");
}

// Setup event listeners for cart actions
function setupCartEventListeners() {
    document.querySelectorAll(".increase").forEach(button => {
        button.addEventListener("click", function () {
            updateQuantity(this, 1);
        });
    });

    document.querySelectorAll(".decrease").forEach(button => {
        button.addEventListener("click", function () {
            updateQuantity(this, -1);
        });
    });

    document.querySelectorAll(".remove").forEach(button => {
        button.addEventListener("click", function () {
            removeCartItem(this.closest(".cart-item").dataset.id);
        });
    });
}

// Update quantity
async function updateQuantity(button, change) {
    const cartItem = button.closest(".cart-item");
    const bookId = cartItem.dataset.id;
    const quantityElement = cartItem.querySelector(".quantity-value");
    const discountedPriceElement = cartItem.querySelector(".discounted-price");
    const unitPriceElement = cartItem.querySelector(".unit-price");
    let currentQuantity = parseInt(quantityElement.textContent, 10);

    if (isNaN(currentQuantity)) {
        console.error("Invalid quantity:", quantityElement.textContent);
        alert("Error: Invalid quantity.");
        return;
    }

    const newQuantity = currentQuantity + change;

    if (newQuantity <= 0) {
        await removeCartItem(bookId);
        return;
    }

    if (change > 0) {
        const bookResponse = await fetch(`${API_BASE_URL}/books/${bookId}`);
        const book = await bookResponse.json();
        if (book.quantity < newQuantity) {
            alert("Cannot increase quantity: insufficient stock!");
            return;
        }
    }

    const perUnitDiscountedPrice = parseFloat(cartItem.dataset.discountedPrice);
    const perUnitPrice = parseFloat(cartItem.dataset.unitPrice);

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/carts/${bookId}`, {
            method: "PATCH",
            body: JSON.stringify({ quantity: newQuantity })
        });
        if (!response) {
            alert("Authentication failed. Please log in again.");
            return;
        }

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.message || "Failed to update quantity");
        }

        quantityElement.textContent = newQuantity;
        const newDiscountedPrice = (perUnitDiscountedPrice * newQuantity).toFixed(2);
        const newUnitPrice = (perUnitPrice * newQuantity).toFixed(2);

        if (discountedPriceElement) discountedPriceElement.textContent = newDiscountedPrice;
        if (unitPriceElement) unitPriceElement.textContent = newUnitPrice;

        await loadCartSummary();
        await loadCartItems();
    } catch (error) {
        console.error("Error updating quantity:", error);
        alert(`Failed to update quantity: ${error.message}`);
        quantityElement.textContent = currentQuantity;
    }
}

// Remove item
async function removeCartItem(bookId) {
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/carts/${bookId}/delete`, {
            method: "PATCH"
        });
        if (!response) {
            alert("Authentication failed. Please log in again.");
            return;
        }

        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.message || "Failed to remove item");
        }

        await loadCartItems(); // Refresh cart
    } catch (error) {
        console.error("Error removing item:", error);
        alert(`Failed to remove item: ${error.message}`);
        await loadCartItems(); // Refresh even on error
    }
}

// Fetch and display cart summary
async function loadCartSummary() {
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/carts/summary`);
        if (!response) return;

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || "Failed to fetch cart summary");
        }

        const cartData = await response.json();
        const totalPriceElement = document.getElementById("cart-total");
        if (totalPriceElement) {
            totalPriceElement.textContent = cartData.total_price || 0;
        }
        updateCartCount(cartData.total_items || 0);
    } catch (error) {
        console.error("Error fetching cart summary:", error);
        updateCartCount(0);
    }
}

// User profile
async function loadUserProfile() {
    const profileNameElement = document.querySelector(".profile-name");
    if (!profileNameElement) return;

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/users/profile`);
        if (!response) return;

        if (!response.ok) throw new Error(`Profile fetch failed with status: ${response.status}`);
        const userData = await response.json();
        const username = userData.name || "User";
        profileNameElement.textContent = username;
        localStorage.setItem("username", username);
    } catch (error) {
        console.error("Profile fetch error:", error.message);
        profileNameElement.textContent = localStorage.getItem("username") || "User";
    }
}

// Setup header event listeners (dropdown functionality)
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

    if (profileLink) {
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
                closeDropdown();
            }
        });
    } else {
        console.error("Profile link not found in DOM");
    }

    if (cartLink) {
        cartLink.addEventListener("click", (event) => {
            event.preventDefault();
            console.log("Cart link clicked, already on cart page");
        });
    }

    document.getElementById("search")?.addEventListener("keypress", (event) => {
        if (event.key === "Enter") {
            const query = event.target.value.trim();
            if (query) {
                console.log("Search triggered with query:", query);
                window.location.href = `../pages/homePage.html?query=${encodeURIComponent(query)}`;
            }
        }
    });

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

// Sign Out (Logout) functionality
function handleSignOut() {
    console.log("Logging out...");
    const provider = localStorage.getItem("socialProvider");

    if (provider === "google" && typeof google !== "undefined" && google.accounts) {
        console.log("Logging out from Google");
        google.accounts.id.disableAutoSelect();
        google.accounts.id.revoke(localStorage.getItem("socialEmail") || "", () => {
            console.log("Google session revoked");
        });
    }

    if (provider === "facebook" && typeof FB !== "undefined") {
        console.log("Logging out from Facebook");
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

// Save current location to backend
async function saveCurrentLocationToBackend(locationData) {
    try {
        const addressData = {
            street: locationData.street || "Unknown Street",
            city: locationData.city || "Unknown City",
            state: locationData.state || "Unknown State",
            zip_code: locationData.zip_code || "00000",
            country: locationData.country || "Unknown Country",
            address_type: "other",
            is_default: false
        };

        const response = await fetchWithAuth(`${API_BASE_URL}/addresses/create`, {
            method: "POST",
            body: JSON.stringify(addressData)
        });
        if (!response) return;

        const result = await response.json();
        if (!response.ok) {
            throw new Error(`Failed to save address: ${result.error || "Unknown error"}`);
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
        const response = await fetchWithAuth(`${API_BASE_URL}/addresses`);
        if (!response) return null;

        if (!response.ok) throw new Error(`Failed to fetch addresses: ${response.status}`);

        const data = await response.json();
        return data.addresses || [];
    } catch (error) {
        console.error("Error fetching addresses:", error);
        return null;
    }
}

// Update address display
function updateAddressFields(address) {
    const addressContainer = document.getElementById("address-container");
    if (addressContainer) {
        addressContainer.innerHTML = `<p>${address.street}, ${address.city}, ${address.state} ${address.zip_code}, ${address.country}</p>`;
    }
}

// Setup location button
function setupLocationButton() {
    const useLocationButton = document.querySelector(".use-location");
    if (!useLocationButton) {
        console.log("Use current location button not found");
        return;
    }

    useLocationButton.addEventListener("click", async function () {
        if (!("geolocation" in navigator)) {
            alert("Geolocation is not supported by your browser.");
            return;
        }

        useLocationButton.innerHTML = '<i class="fa-solid fa-location-dot"></i> Fetching location...';
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
                    "User-Agent": "BookstoreApp/1.0 (your-email@example.com)"
                }
            });

            if (!response.ok) {
                throw new Error("Failed to fetch address from Nominatim API");
            }

            const data = await response.json();
            if (!data || !data.address) {
                throw new Error("No address found for the given coordinates");
            }

            const address = {
                street: data.address.road || data.address.street || "",
                city: data.address.city || data.address.town || data.address.village || "",
                state: data.address.state || data.address.region || "",
                zip_code: data.address.postcode || "00000",
                country: data.address.country || ""
            };

            const savedAddress = await saveCurrentLocationToBackend(address);
            updateAddressFields(savedAddress);
            localStorage.setItem("selectedAddress", JSON.stringify(savedAddress));
            localStorage.setItem("selectedAddressId", savedAddress.id);

            alert("Latest current location saved successfully!");
            useLocationButton.innerHTML = '<i class="fa-solid fa-location-dot"></i> Use Current Location';
            useLocationButton.disabled = false;
        } catch (error) {
            let errorMessage = "Unable to fetch or save location: ";
            if (error.code) {
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage += "User denied the request for Geolocation.";
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage += "Location information is unavailable.";
                        break;
                    case error.TIMEOUT:
                        errorMessage += "The request to get user location timed out.";
                        break;
                    default:
                        errorMessage += "An unknown error occurred.";
                        break;
                }
            } else {
                errorMessage += error.message;
            }
            alert(errorMessage);
            const addressContainer = document.getElementById("address-container");
            if (addressContainer) {
                addressContainer.innerHTML = `<p>No address selected.</p>`;
            }
            useLocationButton.innerHTML = '<i class="fa-solid fa-location-dot"></i> Use Current Location';
            useLocationButton.disabled = false;
        }
    });

    const selectedAddress = JSON.parse(localStorage.getItem("selectedAddress") || "{}");
    if (selectedAddress.street) {
        updateAddressFields(selectedAddress);
    }
}

// Handle page navigation with address choice
document.querySelector(".place-order")?.addEventListener("click", async () => {
    const selectedAddress = JSON.parse(localStorage.getItem("selectedAddress") || "{}");

    if (selectedAddress.street) {
        window.location.href = "../pages/customer-details.html";
    } else {
        const userChoice = confirm("No address selected. Would you like to use your current location? Click 'OK' for yes, or 'Cancel' to set an address manually.");

        if (userChoice) {
            if (!("geolocation" in navigator)) {
                alert("Geolocation is not supported by your browser.");
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
                        "User-Agent": "BookstoreApp/1.0 (your-email@example.com)"
                    }
                });

                if (!response.ok) {
                    throw new Error("Failed to fetch address from Nominatim API");
                }

                const data = await response.json();
                if (!data || !data.address) {
                    throw new Error("No address found for the given coordinates");
                }

                const address = {
                    street: data.address.road || data.address.street || "",
                    city: data.address.city || data.address.town || data.address.village || "",
                    state: data.address.state || data.address.region || "",
                    zip_code: data.address.postcode || "00000",
                    country: data.address.country || ""
                };

                const savedAddress = await saveCurrentLocationToBackend(address);
                updateAddressFields(savedAddress);
                localStorage.setItem("selectedAddress", JSON.stringify(savedAddress));
                localStorage.setItem("selectedAddressId", savedAddress.id);

                window.location.href = "../pages/customer-details.html";
            } catch (error) {
                let errorMessage = "Unable to fetch or save location: ";
                if (error.code) {
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            errorMessage += "User denied the request for Geolocation.";
                            break;
                        case error.POSITION_UNAVAILABLE:
                            errorMessage += "Location information is unavailable.";
                            break;
                        case error.TIMEOUT:
                            errorMessage += "The request to get user location timed out.";
                            break;
                        default:
                            errorMessage += "An unknown error occurred.";
                            break;
                    }
                } else {
                    errorMessage += error.message;
                }
                alert(errorMessage);
            }
        } else {
            window.location.href = "../pages/customer-details.html";
        }
    }
});