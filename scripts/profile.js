let isEditingPersonalDetails = false;
let isEditingAddress = {};
let isAddressFormVisible = false;

// Base URL for the backend (can be made configurable)
const BASE_URL = 'http://127.0.0.1:3000';

// Function to log out and redirect to login page
function logoutAndRedirect() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'login.html';
}

// Toggle edit mode for personal details or addresses
function toggleEdit(sectionId) {
    if (sectionId === 'personal-details') {
        isEditingPersonalDetails = !isEditingPersonalDetails;
        const inputs = document.querySelectorAll('#personal-details input');
        const saveButton = document.getElementById('save-personal-details');
        inputs.forEach(input => input.disabled = !isEditingPersonalDetails);
        saveButton.style.display = isEditingPersonalDetails ? 'block' : 'none';
    } else {
        const addressId = sectionId.split('-')[1];
        isEditingAddress[addressId] = !isEditingAddress[addressId];
        const addressItem = document.getElementById(`address-${addressId}`);
        const streetTextarea = document.getElementById(`street-${addressId}`);
        const cityInput = document.getElementById(`city-${addressId}`);
        const stateInput = document.getElementById(`state-${addressId}`);
        const zipCodeInput = document.getElementById(`zip-code-${addressId}`);
        const countryInput = document.getElementById(`country-${addressId}`);
        const saveButton = document.getElementById(`save-address-${addressId}`);
        const typeRadios = document.getElementsByName(`address-type-${addressId}`);

        if (isEditingAddress[addressId]) {
            const street = addressItem.getAttribute('data-street') || '';
            streetTextarea.disabled = false;
            cityInput.disabled = false;
            stateInput.disabled = false;
            zipCodeInput.disabled = false;
            countryInput.disabled = false;
            typeRadios.forEach(radio => radio.disabled = false);
        } else {
            const street = streetTextarea.value;
            const city = cityInput.value;
            const state = stateInput.value;
            const zipCode = zipCodeInput.value;
            const country = countryInput.value;
            const selectedType = Array.from(typeRadios).find(radio => radio.checked).value;
            addressItem.setAttribute('data-street', street);
            addressItem.setAttribute('data-city', city);
            addressItem.setAttribute('data-state', state);
            addressItem.setAttribute('data-zip-code', zipCode);
            addressItem.setAttribute('data-country', country);
            addressItem.setAttribute('data-type', selectedType);
            streetTextarea.disabled = true;
            cityInput.disabled = true;
            stateInput.disabled = true;
            zipCodeInput.disabled = true;
            countryInput.disabled = true;
            typeRadios.forEach(radio => radio.disabled = true);
        }
        saveButton.style.display = isEditingAddress[addressId] ? 'block' : 'none';
    }
}

// Fetch personal details from backend
async function fetchPersonalDetails() {
    const token = localStorage.getItem('token');

    if (!token) {
        logoutAndRedirect();
        return;
    }

    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/profile`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        // Check if the response is JSON
        const contentType = response.headers.get('Content-Type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Server returned an unexpected response. Please check if the backend is running on port 3000.');
        }

        const data = await response.json();
        if (response.ok) {
            document.getElementById('full_name').value = data.full_name || '';
            document.getElementById('email').value = data.email || '';
            document.getElementById('password').value = '********';
            document.getElementById('mobile_number').value = data.mobile_number || '';
            document.getElementById('user-name').textContent = data.full_name || 'User';

            localStorage.setItem('user', JSON.stringify({
                full_name: data.full_name,
                email: data.email,
                mobile_number: data.mobile_number
            }));
        } else {
            // If user is not found (e.g., deleted), log out
            if (response.status === 401 || response.status === 404) {
                alert('User not found. Logging out.');
                logoutAndRedirect();
                return;
            }
            throw new Error(data.errors || 'Failed to fetch personal details');
        }
    } catch (error) {
        console.error('Error fetching personal details:', error);
        alert(error.message);
        // Clear fields instead of showing cached data
        document.getElementById('full_name').value = '';
        document.getElementById('email').value = '';
        document.getElementById('password').value = '';
        document.getElementById('mobile_number').value = '';
        document.getElementById('user-name').textContent = 'User';
        logoutAndRedirect();
    }
}

// Save personal details to backend
async function savePersonalDetails() {
    const token = localStorage.getItem('token');
    if (!token) {
        logoutAndRedirect();
        return;
    }

    const updatedData = {
        user: {
            full_name: document.getElementById('full_name').value,
            email: document.getElementById('email').value,
            mobile_number: document.getElementById('mobile_number').value
        }
    };

    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/profile`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(updatedData)
        });

        // Check if the response is JSON
        const contentType = response.headers.get('Content-Type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Server returned an unexpected response. Please check if the backend is running on port 3000.');
        }

        const data = await response.json();
        if (response.ok) {
            alert('Personal details updated successfully');
            toggleEdit('personal-details');
            await fetchPersonalDetails();
        } else {
            // If user is not found (e.g., deleted), log out
            if (response.status === 401 || response.status === 404) {
                alert('User not found. Logging out.');
                logoutAndRedirect();
                return;
            }
            throw new Error(data.errors || 'Failed to update personal details');
        }
    } catch (error) {
        console.error('Error saving personal details:', error);
        alert(error.message);
    }
}

// Fetch addresses from backend
async function fetchAddresses() {
    const token = localStorage.getItem('token');
    if (!token) {
        logoutAndRedirect();
        return;
    }

    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/addresses`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        // Check if the response is JSON
        const contentType = response.headers.get('Content-Type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Server returned an unexpected response. Please check if the backend is running on port 3000.');
        }

        const data = await response.json();
        if (response.ok && data.addresses && data.addresses.length > 0) {
            renderAddresses(data.addresses);
        } else {
            // If user is not found (e.g., deleted), log out
            if (response.status === 401 || response.status === 404) {
                alert('User not found. Logging out.');
                logoutAndRedirect();
                return;
            }
            throw new Error(data.errors || 'No addresses found');
        }
    } catch (error) {
        console.error('Error fetching addresses:', error);
        alert('No address data available.');
        document.getElementById('address-list').innerHTML = '<p>No addresses found.</p>';
    }
}

function renderAddresses(addresses) {
    const addressList = document.getElementById('address-list');
    addressList.innerHTML = '';
    addresses.forEach((address, index) => {
        const addressType = address.address_type || 'unknown';
        addressList.innerHTML += `
            <div class="work-address" id="address-${address.id}" data-street="${address.street || ''}" data-city="${address.city || ''}" data-state="${address.state || ''}" data-zip-code="${address.zip_code || ''}" data-country="${address.country || ''}" data-type="${addressType}">
                <div class="work-header">
                    <div class="work-title">${index + 1}. ${addressType.toUpperCase()}</div>
                    <a href="#" class="address-edit-btn" onclick="toggleEdit('address-${address.id}')">Edit</a>
                </div>
                <div class="address-details">
                    <div class="form-group">
                        <label for="street-${address.id}">Address</label>
                        <textarea id="street-${address.id}" disabled>${address.street || ''}</textarea>
                    </div>
                    <div class="address-row">
                        <div class="address-col">
                            <div class="form-group">
                                <label for="city-${address.id}">City/Town</label>
                                <input type="text" id="city-${address.id}" value="${address.city || ''}" disabled>
                            </div>
                        </div>
                        <div class="address-col">
                            <div class="form-group">
                                <label for="state-${address.id}">State</label>
                                <input type="text" id="state-${address.id}" value="${address.state || ''}" disabled>
                            </div>
                        </div>
                    </div>
                    <div class="address-row">
                        <div class="address-col">
                            <div class="form-group">
                                <label for="zip-code-${address.id}">Zip Code</label>
                                <input type="text" id="zip-code-${address.id}" value="${address.zip_code || ''}" disabled>
                            </div>
                        </div>
                        <div class="address-col">
                            <div class="form-group">
                                <label for="country-${address.id}">Country</label>
                                <input type="text" id="country-${address.id}" value="${address.country || ''}" disabled>
                            </div>
                        </div>
                    </div>
                    <div class="form-group radio-group">
                        <label>Type</label>
                        <label><input type="radio" name="address-type-${address.id}" value="home" ${addressType === 'home' ? 'checked' : ''} disabled> Home</label>
                        <label><input type="radio" name="address-type-${address.id}" value="work" ${addressType === 'work' ? 'checked' : ''} disabled> Work</label>
                        <label><input type="radio" name="address-type-${address.id}" value="other" ${addressType === 'other' ? 'checked' : ''} disabled> Other</label>
                    </div>
                    <button style="display: none;" id="save-address-${address.id}" onclick="saveAddress(${address.id})">Save</button>
                </div>
            </div>
        `;
    });
}

// Toggle address form visibility
function toggleAddressForm() {
    isAddressFormVisible = !isAddressFormVisible;
    document.getElementById('address-form').classList.toggle('show', isAddressFormVisible);
    if (!isAddressFormVisible) {
        // Clear form when closing
        document.getElementById('new-street').value = '';
        document.getElementById('new-city').value = '';
        document.getElementById('new-state').value = '';
        document.getElementById('new-zip-code').value = '';
        document.getElementById('new-country').value = '';
        document.querySelector('input[name="new-address_type"][value="home"]').checked = true;
    }
}

// Save new address to backend
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
        const response = await fetch(`${BASE_URL}/api/v1/user/addresses`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ address: newAddress })
        });

        // Check if the response is JSON
        const contentType = response.headers.get('Content-Type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Server returned an unexpected response. Please check if the backend is running on port 3000.');
        }

        const data = await response.json();
        if (response.ok) {
            alert('Address added successfully');
            toggleAddressForm();
            await fetchAddresses();
        } else {
            // If user is not found (e.g., deleted), log out
            if (response.status === 401 || response.status === 404) {
                alert('User not found. Logging out.');
                logoutAndRedirect();
                return;
            }
            throw new Error(data.errors || 'Failed to add address');
        }
    } catch (error) {
        console.error('Error adding address:', error);
        alert(error.message);
    }
}

// Save existing address to backend
async function saveAddress(addressId) {
    const token = localStorage.getItem('token');
    if (!token) {
        logoutAndRedirect();
        return;
    }

    const addressItem = document.getElementById(`address-${addressId}`);
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
        address_type: addressItem.getAttribute('data-type')
    };

    try {
        const response = await fetch(`${BASE_URL}/api/v1/user/addresses/${addressId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ address: updatedAddress })
        });

        // Check if the response is JSON
        const contentType = response.headers.get('Content-Type');
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error('Server returned an unexpected response. Please check if the backend is running on port 3000.');
        }

        const data = await response.json();
        if (response.ok) {
            alert('Address updated successfully');
            toggleEdit(`address-${addressId}`);
            await fetchAddresses();
        } else {
            // If user is not found (e.g., deleted), log out
            if (response.status === 401 || response.status === 404) {
                alert('User not found. Logging out.');
                logoutAndRedirect();
                return;
            }
            throw new Error(data.errors || 'Failed to update address');
        }
    } catch (error) {
        console.error('Error saving address:', error);
        alert(error.message);
    }
}

// Initial data fetch on page load
window.onload = async function() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }
    await fetchPersonalDetails();
    await fetchAddresses();
};