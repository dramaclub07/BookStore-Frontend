const BASE_URL = "http://127.0.0.1:3000/api/v1"; // Backend URL
const PROXY_URL = "http://127.0.0.1:4000/api/v1"; // Proxy URL as fallback

let isEditingPersonalDetails = false;
let isEditingAddress = {};
let isAddressFormVisible = false;

document.addEventListener("DOMContentLoaded", async function () {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
        console.log("No token found, redirecting to login.");
        window.location.href = '../pages/login.html';
        return;
    }

    console.log("Access token found:", accessToken);

    try {
        await loadUserProfile();
        await fetchAddresses();
        await loadCartSummary();
        setupHeaderEventListeners();
    } catch (error) {
        console.error("Initialization error:", error);
    }
});

// Get auth headers
function getAuthHeaders() {
    const token = localStorage.getItem('access_token');
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}

// Token Refresh Logic
async function refreshAccessToken() {
    const refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken) {
        console.error("No refresh token available");
        return false;
    }

    const backendUrl = `${BASE_URL}/refresh`;
    const proxyUrl = `${PROXY_URL}/refresh`;

    try {
        let response = await fetch(backendUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: refreshToken })
        });

        if (!response.ok && response.status >= 500) {
            console.warn("Backend refresh failed, trying proxy");
            response = await fetch(proxyUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refresh_token: refreshToken })
            });
        }

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
        try {
            const proxyResponse = await fetch(proxyUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refresh_token: refreshToken })
            });
            const data = await proxyResponse.json();
            if (proxyResponse.ok && data.access_token) {
                localStorage.setItem("access_token", data.access_token);
                localStorage.setItem("token_expires_in", Date.now() + (data.expires_in * 1000));
                console.log("Access token refreshed via proxy");
                return true;
            }
        } catch (proxyError) {
            console.error("Proxy refresh also failed:", proxyError);
        }
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

    try {
        let response = await fetch(url, options);
        if (!response.ok && response.status >= 500) {
            console.warn(`Backend failed for ${url}, falling back to proxy`);
            response = await fetch(url.replace(BASE_URL, PROXY_URL), options);
        }

        if (response.status === 401) {
            const refreshed = await refreshAccessToken();
            if (refreshed) {
                options.headers = { ...options.headers, ...getAuthHeaders() };
                response = await fetch(url, options);
                if (!response.ok && response.status >= 500) {
                    response = await fetch(url.replace(BASE_URL, PROXY_URL), options);
                }
            } else {
                return null;
            }
        }

        return response;
    } catch (error) {
        console.error(`Fetch error with backend: ${error.message}, trying proxy`);
        try {
            const proxyResponse = await fetch(url.replace(BASE_URL, PROXY_URL), options);
            return proxyResponse;
        } catch (proxyError) {
            console.error(`Proxy fetch also failed: ${proxyError.message}`);
            return null;
        }
    }
}

function logoutAndRedirect() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    window.location.href = '../pages/login.html';
}

function toggleEdit(sectionId) {
    if (sectionId === 'personal-details') {
        isEditingPersonalDetails = !isEditingPersonalDetails;
        const inputs = document.querySelectorAll('#personal-details input');
        const saveButton = document.getElementById('save-personal-details');
        const newPasswordField = document.getElementById('new-password-field');
        const confirmPasswordField = document.getElementById('confirm-password-field');
        const currentPasswordInput = document.getElementById('current_password');

        inputs.forEach(input => input.disabled = !isEditingPersonalDetails);
        saveButton.style.display = isEditingPersonalDetails ? 'block' : 'none';

        if (isEditingPersonalDetails) {
            newPasswordField.classList.add('visible');
            confirmPasswordField.classList.add('visible');
            currentPasswordInput.value = '';
            currentPasswordInput.placeholder = 'Enter current password';
        } else {
            newPasswordField.classList.remove('visible');
            confirmPasswordField.classList.remove('visible');
            currentPasswordInput.value = '';
            currentPasswordInput.placeholder = '••••••••';
            document.getElementById('new_password').value = '';
            document.getElementById('confirm_password').value = '';
        }
    } else {
        const addressId = sectionId.split('-')[1];
        isEditingAddress[addressId] = !isEditingAddress[addressId];
        fetchAddresses();
    }
}

// Load User Profile
async function loadUserProfile() {
    try {
        const response = await fetchWithAuth(`${BASE_URL}/users/profile`);
        if (!response) {
            console.log("Unauthorized or no response in loadUserProfile, redirecting.");
            logoutAndRedirect();
            return;
        }

        if (!response.ok) throw new Error(`Failed to fetch profile: ${response.status}`);

        const userData = await response.json();
        console.log("Profile data received:", userData);

        const name = userData.full_name || userData.name || 'User';
        document.getElementById('full_name').value = name;
        document.getElementById('email').value = userData.email || '';
        document.getElementById('current_password').value = '';
        document.getElementById('current_password').placeholder = '••••••••';
        document.getElementById('new_password').value = '';
        document.getElementById('confirm_password').value = '';
        document.getElementById('mobile_number').value = userData.mobile_number || '';

        const profileElement = document.getElementById('profile-link');
        if (profileElement) {
            profileElement.innerHTML = `<i class="fa-solid fa-user"></i> <span class="profile-name">${name}</span>`;
            localStorage.setItem('username', name);
            console.log("Profile link updated with:", name);
        } else {
            console.error("Profile link element (#profile-link) not found in DOM");
        }

        localStorage.setItem('user', JSON.stringify({
            full_name: name,
            email: userData.email,
            mobile_number: userData.mobile_number
        }));
    } catch (error) {
        console.error("Profile fetch error:", error.message);
        alert(`Error fetching profile: ${error.message}`);
    }
}

// Save Personal Details
async function savePersonalDetails() {
    const currentPassword = document.getElementById('current_password').value;
    const newPassword = document.getElementById('new_password').value;
    const confirmPassword = document.getElementById('confirm_password').value;

    if (newPassword || confirmPassword || currentPassword) {
        if (!currentPassword) {
            alert('Please enter your current password');
            return;
        }
        if (!newPassword) {
            alert('Please enter a new password');
            return;
        }
        if (newPassword !== confirmPassword) {
            alert('New password and confirmation do not match');
            return;
        }
        if (newPassword.length < 6) {
            alert('New password must be at least 6 characters long');
            return;
        }
    }

    const updatedData = {
        full_name: document.getElementById('full_name').value,
        email: document.getElementById('email').value,
        mobile_number: document.getElementById('mobile_number').value
    };

    if (currentPassword && newPassword) {
        updatedData.current_password = currentPassword;
        updatedData.password = newPassword;
    }

    try {
        const response = await fetchWithAuth(`${BASE_URL}/users/profile`, {
            method: 'PATCH',
            body: JSON.stringify(updatedData)
        });
        if (!response) {
            logoutAndRedirect();
            return;
        }

        if (!response.ok) {
            const errorData = await response.json();
            let errorMessage = 'Failed to update profile';
            if (errorData && errorData.errors) {
                errorMessage = Array.isArray(errorData.errors) ? errorData.errors.join(', ') : errorData.errors.toString();
            } else if (errorData && errorData.error) {
                errorMessage = errorData.error;
            }
            throw new Error(`Failed to update profile: ${errorMessage}`);
        }

        alert('Personal details updated successfully');
        toggleEdit('personal-details');
        await loadUserProfile();
    } catch (error) {
        console.error('Error saving personal details:', error);
        alert(error.message);
    }
}

// Fetch Addresses
async function fetchAddresses() {
    try {
        const response = await fetchWithAuth(`${BASE_URL}/addresses`);
        if (!response) {
            logoutAndRedirect();
            return;
        }

        if (!response.ok) throw new Error('Failed to fetch addresses');

        const data = await response.json();
        if (data.addresses && data.addresses.length > 0) {
            renderAddresses(data.addresses);
        } else {
            document.getElementById('address-list').innerHTML = '<p>No addresses found.</p>';
        }
    } catch (error) {
        console.error('Error fetching addresses:', error);
        document.getElementById('address-list').innerHTML = '<p>No addresses found.</p>';
    }
}

// Render Addresses
function renderAddresses(addresses) {
    const addressList = document.getElementById('address-list');
    addressList.innerHTML = '';
    addresses.forEach((address, index) => {
        const addressId = address.id;
        const addressType = address.address_type || 'unknown';
        const isEditing = isEditingAddress[addressId];

        if (index === 0 || isEditing) {
            addressList.innerHTML += `
                <div class="work-address" id="address-${addressId}">
                    <div class="work-header">
                        <div class="work-title">${index + 1}. ${addressType.toUpperCase()}</div>
                        <div class="action-buttons">
                            <a href="#" class="address-edit-btn" onclick="toggleEdit('address-${addressId}')">${isEditing ? 'Cancel' : 'Edit'}</a>
                            <a href="#" class="address-select-btn" onclick="selectAddress(${addressId})">Select</a>
                            <a href="#" class="address-delete-btn" onclick="deleteAddress(${addressId})">Delete</a>
                        </div>
                    </div>
                    <div class="address-details">
                        <div class="form-group">
                            <label for="street-${addressId}">Address</label>
                            <textarea id="street-${addressId}" ${isEditing ? '' : 'disabled'}>${address.street || ''}</textarea>
                        </div>
                        <div class="address-row">
                            <div class="address-col">
                                <div class="form-group">
                                    <label for="city-${addressId}">City/Town</label>
                                    <input type="text" id="city-${addressId}" value="${address.city || ''}" ${isEditing ? '' : 'disabled'}>
                                </div>
                            </div>
                            <div class="address-col">
                                <div class="form-group">
                                    <label for="state-${addressId}">State</label>
                                    <input type="text" id="state-${addressId}" value="${address.state || ''}" ${isEditing ? '' : 'disabled'}>
                                </div>
                            </div>
                        </div>
                        <div class="address-row">
                            <div class="address-col">
                                <div class="form-group">
                                    <label for="zip-code-${addressId}">Zip Code</label>
                                    <input type="text" id="zip-code-${addressId}" value="${address.zip_code || ''}" ${isEditing ? '' : 'disabled'}>
                                </div>
                            </div>
                            <div class="address-col">
                                <div class="form-group">
                                    <label for="country-${addressId}">Country</label>
                                    <input type="text" id="country-${addressId}" value="${address.country || ''}" ${isEditing ? '' : 'disabled'}>
                                </div>
                            </div>
                        </div>
                        <div class="form-group radio-group">
                            <label>Type</label>
                            <label><input type="radio" name="address-type-${addressId}" value="home" ${addressType === 'home' ? 'checked' : ''} ${isEditing ? '' : 'disabled'}> Home</label>
                            <label><input type="radio" name="address-type-${addressId}" value="work" ${addressType === 'work' ? 'checked' : ''} ${isEditing ? '' : 'disabled'}> Work</label>
                            <label><input type="radio" name="address-type-${addressId}" value="other" ${addressType === 'other' ? 'checked' : ''} ${isEditing ? '' : 'disabled'}> Other</label>
                        </div>
                        ${isEditing ? `<button id="save-address-${addressId}" onclick="saveAddress(${addressId})">Save</button>` : ''}
                    </div>
                </div>
            `;
        } else {
            const addressString = `${address.street || ''}, ${address.city || ''}, ${address.state || ''}, ${address.zip_code || ''}, ${address.country || ''} (${addressType.toUpperCase()})`;
            addressList.innerHTML += `
                <div class="work-address" id="address-${addressId}">
                    <div class="work-header">
                        <div class="work-title">${index + 1}. ${addressType.toUpperCase()}</div>
                        <div class="action-buttons">
                            <a href="#" class="address-edit-btn" onclick="toggleEdit('address-${addressId}')">Edit</a>
                            <a href="#" class="address-select-btn" onclick="selectAddress(${addressId})">Select</a>
                            <a href="#" class="address-delete-btn" onclick="deleteAddress(${addressId})">Delete</a>
                        </div>
                    </div>
                    <div class="address-details">
                        <p>${addressString}</p>
                    </div>
                </div>
            `;
        }
    });
}

function toggleAddressForm() {
    isAddressFormVisible = !isAddressFormVisible;
    document.getElementById('address-form').classList.toggle('show', isAddressFormVisible);
    if (!isAddressFormVisible) {
        document.getElementById('new-street').value = '';
        document.getElementById('new-city').value = '';
        document.getElementById('new-state').value = '';
        document.getElementById('new-zip-code').value = '';
        document.getElementById('new-country').value = '';
        document.querySelector('input[name="new-address_type"][value="home"]').checked = true;
    }
}

// Save New Address
async function saveNewAddress() {
    const zipCode = document.getElementById('new-zip-code').value;
    if (!zipCode) {
        alert('Zip Code is required.');
        return;
    }

    const addressType = document.querySelector('input[name="new-address_type"]:checked').value;
    const newAddress = {
        street: document.getElementById('new-street').value,
        city: document.getElementById('new-city').value,
        state: document.getElementById('new-state').value,
        zip_code: zipCode,
        country: document.getElementById('new-country').value,
        address_type: addressType
    };

    try {
        const response = await fetchWithAuth(`${BASE_URL}/addresses/create`, {
            method: 'POST',
            body: JSON.stringify(newAddress)
        });
        if (!response) {
            logoutAndRedirect();
            return;
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to add address');
        }

        alert('Address added successfully');
        toggleAddressForm();
        await fetchAddresses();
    } catch (error) {
        console.error('Error adding address:', error);
        alert(error.message);
    }
}

// Save Existing Address
async function saveAddress(addressId) {
    const zipCode = document.getElementById(`zip-code-${addressId}`).value;
    if (!zipCode) {
        alert('Zip Code is required.');
        return;
    }

    const updatedAddress = {
        street: document.getElementById(`street-${addressId}`).value,
        city: document.getElementById(`city-${addressId}`).value,
        state: document.getElementById(`state-${addressId}`).value,
        zip_code: zipCode,
        country: document.getElementById(`country-${addressId}`).value,
        address_type: document.querySelector(`input[name="address-type-${addressId}"]:checked`).value
    };

    try {
        const response = await fetchWithAuth(`${BASE_URL}/addresses/${addressId}`, {
            method: 'PATCH',
            body: JSON.stringify(updatedAddress)
        });
        if (!response) {
            logoutAndRedirect();
            return;
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to update address');
        }

        alert('Address updated successfully');
        isEditingAddress[addressId] = false;
        await fetchAddresses();
    } catch (error) {
        console.error('Error saving address:', error);
        alert(error.message);
    }
}

// Delete Address
async function deleteAddress(addressId) {
    if (!confirm('Are you sure you want to delete this address?')) return;

    try {
        const response = await fetchWithAuth(`${BASE_URL}/addresses/${addressId}`, {
            method: 'DELETE'
        });
        if (!response) {
            logoutAndRedirect();
            return;
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to delete address');
        }

        alert('Address deleted successfully');
        await fetchAddresses();
    } catch (error) {
        console.error('Error deleting address:', error);
        alert(error.message);
    }
}

// Select Address
async function selectAddress(addressId) {
    try {
        const response = await fetchWithAuth(`${BASE_URL}/addresses/${addressId}`);
        if (!response) {
            logoutAndRedirect();
            return;
        }

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to fetch address details');
        }

        const data = await response.json();
        const selectedAddress = data.address || data;

        localStorage.setItem('selectedAddress', JSON.stringify({
            id: selectedAddress.id,
            street: selectedAddress.street,
            city: selectedAddress.city,
            state: selectedAddress.state,
            zip_code: selectedAddress.zip_code,
            country: selectedAddress.country,
            address_type: selectedAddress.address_type
        }));
        localStorage.setItem('selectedAddressId', selectedAddress.id);

        console.log(`Address ${addressId} selected and stored:`, selectedAddress);
        alert(`Address ${addressId} selected`);

        window.location.href = '../pages/cart.html';
    } catch (error) {
        console.error('Error selecting address:', error);
        alert(error.message);
    }
}

// Update Cart Count
function updateCartCount(count) {
    const cartCount = document.querySelector('#cart-link .cart-count');
    if (cartCount) {
        cartCount.textContent = count;
        cartCount.style.display = count > 0 ? 'flex' : 'none';
    } else {
        console.error("Cart count element not found in DOM");
    }
}

// Load Cart Summary
async function loadCartSummary() {
    try {
        const response = await fetchWithAuth(`${BASE_URL}/carts/summary`);
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
async function handleSignOut() {
    const provider = localStorage.getItem("socialProvider");

    // Invalidate cache on logout
    try {
        await fetchWithAuth(`${BASE_URL}/logout`, {
            method: "POST",
            headers: getAuthHeaders()
        });
    } catch (error) {
        console.error("Error invalidating cache on logout:", error);
    }

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