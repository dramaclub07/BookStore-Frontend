const BASE_URL = 'http://127.0.0.1:3000';

let isEditingPersonalDetails = false;
let isEditingAddress = {};
let isAddressFormVisible = false;

document.addEventListener("DOMContentLoaded", async function () {
    const token = localStorage.getItem('token');
    if (!token) {
        console.log("No token found, redirecting to login.");
        window.location.href = '../pages/login.html';
        return;
    }

    console.log("Token found:", token);

    try {
        await loadUserProfile();
        await fetchAddresses();
        await loadCartSummary();
        setupHeaderEventListeners();
    } catch (error) {
        console.error("Initialization error:", error);
    }
});

function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}

function logoutAndRedirect() {
    localStorage.removeItem('token');
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

        // Enable/disable inputs
        inputs.forEach(input => input.disabled = !isEditingPersonalDetails);
        saveButton.style.display = isEditingPersonalDetails ? 'block' : 'none';

        // Show/hide password fields
        if (isEditingPersonalDetails) {
            newPasswordField.classList.add('visible');
            confirmPasswordField.classList.add('visible');
            // Clear the current password field for user input
            currentPasswordInput.value = '';
            currentPasswordInput.placeholder = 'Enter current password';
        } else {
            newPasswordField.classList.remove('visible');
            confirmPasswordField.classList.remove('visible');
            // Restore dummy dots in current password field
            currentPasswordInput.value = '';
            currentPasswordInput.placeholder = '••••••••';
            // Clear other password fields
            document.getElementById('new_password').value = '';
            document.getElementById('confirm_password').value = '';
        }
    } else {
        const addressId = sectionId.split('-')[1];
        isEditingAddress[addressId] = !isEditingAddress[addressId];
        fetchAddresses();
    }
}

async function loadUserProfile() {
    const token = localStorage.getItem('token');
    if (!token) {
        console.log("No token in loadUserProfile, redirecting.");
        logoutAndRedirect();
        return;
    }

    try {
        console.log("Fetching profile from:", `${BASE_URL}/api/v1/users/profile`);
        const response = await fetch(`${BASE_URL}/api/v1/users/profile`, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        console.log("Response status:", response.status);

        if (!response.ok) {
            if (response.status === 401) {
                console.log("Unauthorized (401), logging out.");
                alert('Session expired or unauthorized. Logging out.');
                logoutAndRedirect();
                return;
            }
            const errorText = await response.text();
            throw new Error(`Failed to fetch profile: ${response.status} - ${errorText}`);
        }

        const userData = await response.json();
        console.log("Profile data received:", userData);

        const name = userData.full_name || userData.name || 'User';
        document.getElementById('full_name').value = name;
        document.getElementById('email').value = userData.email || '';
        document.getElementById('current_password').value = ''; // Clear current password
        document.getElementById('current_password').placeholder = '••••••••'; // Set dummy dots
        document.getElementById('new_password').value = '';     // Clear new password
        document.getElementById('confirm_password').value = ''; // Clear confirm password
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

async function savePersonalDetails() {
    const token = localStorage.getItem('token');
    if (!token) {
        logoutAndRedirect();
        return;
    }

    const currentPassword = document.getElementById('current_password').value;
    const newPassword = document.getElementById('new_password').value;
    const confirmPassword = document.getElementById('confirm_password').value;

    // Validate passwords if any are filled
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
        user: {
            full_name: document.getElementById('full_name').value,
            email: document.getElementById('email').value,
            mobile_number: document.getElementById('mobile_number').value
        }
    };

    // Only include password fields if they are filled
    if (currentPassword && newPassword) {
        updatedData.user.current_password = currentPassword;
        updatedData.user.new_password = newPassword;
    }

    try {
        const response = await fetch(`${BASE_URL}/api/v1/users/profile`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify(updatedData)
        });

        console.log("Update profile response status:", response.status);
        console.log("Update profile response headers:", [...response.headers.entries()]);

        if (!response.ok) {
            if (response.status === 401) {
                alert('Session expired. Logging out.');
                logoutAndRedirect();
                return;
            }

            let errorMessage = 'Failed to update profile';
            try {
                const errorData = await response.json();
                console.log("Error response data:", errorData);

                // Handle different error response formats
                if (errorData && errorData.errors) {
                    if (Array.isArray(errorData.errors)) {
                        errorMessage = errorData.errors.join(', ');
                    } else {
                        errorMessage = errorData.errors.toString();
                    }
                } else if (errorData && errorData.error) {
                    errorMessage = errorData.error;
                } else {
                    errorMessage = response.statusText || 'Unknown error';
                }
            } catch (jsonError) {
                // If response is not JSON, fall back to text
                console.error("Failed to parse error response as JSON:", jsonError);
                const errorText = await response.text();
                console.log("Error response text:", errorText);
                errorMessage = errorText || 'Unknown error';
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

async function fetchAddresses() {
    const token = localStorage.getItem('token');
    if (!token) {
        logoutAndRedirect();
        return;
    }

    try {
        const response = await fetch(`${BASE_URL}/api/v1/addresses`, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            if (response.status === 401) {
                alert('Session expired. Logging out.');
                logoutAndRedirect();
                return;
            }
            throw new Error('Failed to fetch addresses');
        }

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

async function saveNewAddress() {
    const token = localStorage.getItem('token');
    if (!token) {
        logoutAndRedirect();
        return;
    }

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
        const response = await fetch(`${BASE_URL}/api/v1/addresses`, { // Updated endpoint from /create
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ address: newAddress })
        });

        if (!response.ok) {
            if (response.status === 401) {
                alert('Session expired. Logging out.');
                logoutAndRedirect();
                return;
            }
            throw new Error('Failed to add address');
        }

        alert('Address added successfully');
        toggleAddressForm();
        await fetchAddresses();
    } catch (error) {
        console.error('Error adding address:', error);
        alert(error.message);
    }
}

async function saveAddress(addressId) {
    const token = localStorage.getItem('token');
    if (!token) {
        logoutAndRedirect();
        return;
    }

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
        const response = await fetch(`${BASE_URL}/api/v1/addresses/${addressId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ address: updatedAddress })
        });

        if (!response.ok) {
            if (response.status === 401) {
                alert('Session expired. Logging out.');
                logoutAndRedirect();
                return;
            }
            throw new Error('Failed to update address');
        }

        alert('Address updated successfully');
        isEditingAddress[addressId] = false;
        await fetchAddresses();
    } catch (error) {
        console.error('Error saving address:', error);
        alert(error.message);
    }
}

async function deleteAddress(addressId) {
    const token = localStorage.getItem('token');
    if (!token) {
        logoutAndRedirect();
        return;
    }

    if (!confirm('Are you sure you want to delete this address?')) return;

    try {
        const response = await fetch(`${BASE_URL}/api/v1/addresses/${addressId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            if (response.status === 401) {
                alert('Session expired. Logging out.');
                logoutAndRedirect();
                return;
            }
            throw new Error('Failed to delete address');
        }

        alert('Address deleted successfully');
        await fetchAddresses();
    } catch (error) {
        console.error('Error deleting address:', error);
        alert(error.message);
    }
}

async function selectAddress(addressId) {
    const token = localStorage.getItem('token');
    if (!token) {
        logoutAndRedirect();
        return;
    }

    try {
        const response = await fetch(`${BASE_URL}/api/v1/addresses/${addressId}`, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            if (response.status === 401) {
                alert('Session expired. Logging out.');
                logoutAndRedirect();
                return;
            }
            throw new Error('Failed to fetch address details');
        }

        const data = await response.json();
        const selectedAddress = data.address;

        // Store the selected address consistently with customer details
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

        window.location.href = '../pages/customer-details.html';
    } catch (error) {
        console.error('Error selecting address:', error);
        alert(error.message);
    }
}

function updateCartCount(count) {
    const cartCount = document.querySelector('#cart-link .cart-count');
    if (cartCount) {
        cartCount.textContent = count;
        cartCount.style.display = count > 0 ? 'flex' : 'none';
    } else {
        console.error("Cart count element not found in DOM");
    }
}

async function loadCartSummary() {
    try {
        const response = await fetch(`${BASE_URL}/api/v1/cart/summary`, {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            if (response.status === 401) {
                alert("Session expired. Please log in again.");
                logoutAndRedirect();
                return;
            }
            throw new Error("Failed to fetch cart summary");
        }

        const cartData = await response.json();
        console.log("Cart summary:", cartData);
        updateCartCount(cartData.total_items || 0);
    } catch (error) {
        console.error("Error fetching cart summary:", error);
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