// API Base URL
const API_BASE_URL = "https://bookstore-backend-p7e1.onrender.com/api/v1/";

// Global variable to store cart items after initial load
let cartItemsCache = null;

document.addEventListener("DOMContentLoaded", async () => {
  const accessToken = localStorage.getItem("access_token");

  if (!accessToken) {
    alert("Please log in to view your cart.");
    window.location.href = "../pages/login.html";
    return;
  }

  try {
    await Promise.all([loadUserProfile(), loadCartItems()]);
    setupLocationButton();
    setupHeaderEventListeners();
  } catch (error) {
    console.error("Initialization error:", error.message);
    alert("Failed to load cart or profile. Please try again.");
  }
});

// Get auth headers
function getAuthHeaders() {
  const accessToken = localStorage.getItem("access_token");
  console.log("Access Token:", accessToken); // Log token for debugging
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  };
}

// Authentication and Token Refresh
async function refreshAccessToken() {
  const refreshToken = localStorage.getItem("refresh_token");
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${API_BASE_URL}refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    const data = await response.json();
    if (response.ok && data.access_token) {
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem(
        "token_expires_in",
        Date.now() + data.expires_in * 1000
      );
      return true;
    }
    throw new Error("Refresh failed: " + (data.error || "Invalid response"));
  } catch (error) {
    console.error("Token refresh error:", error.message);
    localStorage.clear();
    alert("Session expired. Please log in again.");
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
    const response = await fetch(url, options);
    if (response.status === 401) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        options.headers = { ...options.headers, ...getAuthHeaders() };
        return await fetch(url, options);
      }
      return null;
    }
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})); // Handle JSON parse errors
      throw new Error(
        `Request failed: ${errorData.error || response.statusText} (Status: ${
          response.status
        })`
      );
    }
    return response;
  } catch (error) {
    console.error("Fetch error:", error.message);
    return null;
  }
}

// Update cart count in UI
function updateCartCount(count) {
  const cartCount = document.querySelector("#cart-link .cart-count");
  const sectionCount = document.getElementById("cart-count");
  const placeOrderButton = document.querySelector(".place-order");

  if (cartCount) {
    cartCount.textContent = count > 0 ? count : "";
    cartCount.style.display = count > 0 ? "flex" : "none";
  }

  if (sectionCount) {
    sectionCount.textContent = count > 0 ? count : "";
    sectionCount.style.display = count > 0 ? "inline" : "none";
  }

  if (placeOrderButton) {
    placeOrderButton.style.display = count > 0 ? "block" : "none";
  }
}

// Fetch and display cart items
async function loadCartItems(forceRefresh = false) {
  const cartContainer = document.getElementById("cart-container");
  if (!cartContainer) return;

  if (cartItemsCache && !forceRefresh) {
    renderCartItems(cartItemsCache);
    const totalCount = cartItemsCache.reduce(
      (sum, item) => sum + (item.quantity || 1),
      0
    );
    updateCartCount(totalCount);
    setupCartEventListeners();
    await loadCartSummary();
    return;
  }

  cartContainer.innerHTML = "<p>Loading cart...</p>";

  try {
    const response = await fetchWithAuth(`${API_BASE_URL}/carts`, {
      method: "GET",
    });
    if (!response) {
      cartContainer.innerHTML =
        "<p>Authentication error. Please log in again.</p>";
      updateCartCount(0);
      return;
    }

    const data = await response.json();
    let cartItems = [];
    if (Array.isArray(data)) {
      cartItems = data;
    } else if (data.items && Array.isArray(data.items)) {
      cartItems = data.items;
    } else if (data.cart && Array.isArray(data.cart)) {
      cartItems = data.cart;
    } else if (data.data && Array.isArray(data.data)) {
      cartItems = data.data;
    } else if (data.message) {
      cartItems = [];
    } else {
      throw new Error(`Invalid cart data format: ${JSON.stringify(data)}`);
    }

    cartItemsCache = cartItems;
    localStorage.setItem("cartItems", JSON.stringify(cartItems));

    renderCartItems(cartItems);
    const totalCount = cartItems.reduce(
      (sum, item) => sum + (item.quantity || 1),
      0
    );
    updateCartCount(totalCount);
    setupCartEventListeners();
    await loadCartSummary();
  } catch (error) {
    console.error("Cart load error:", error.message);
    const localCartItems = JSON.parse(
      localStorage.getItem("cartItems") || "[]"
    );
    if (localCartItems.length > 0) {
      cartItemsCache = localCartItems;
      renderCartItems(localCartItems);
      const totalCount = localCartItems.reduce(
        (sum, item) => sum + (item.quantity || 1),
        0
      );
      updateCartCount(totalCount);
      setupCartEventListeners();
    } else {
      cartContainer.innerHTML = `<p>Error loading cart: ${error.message}</p>`;
      cartItemsCache = [];
      updateCartCount(0);
    }
  }
}

// Render cart items
function renderCartItems(cartItems) {
  const cartContainer = document.getElementById("cart-container");
  if (!cartContainer) return;

  if (!cartItems || cartItems.length === 0) {
    cartContainer.innerHTML = `<p>Your cart is empty.</p>`;
    updateCartCount(0);
    return;
  }

  cartContainer.innerHTML = cartItems
    .map((item) => {
      const totalDiscountedPrice = (
        (item.discounted_price || 0) * (item.quantity || 1)
      ).toFixed(2);
      const totalUnitPrice = (
        (item.unit_price || 0) * (item.quantity || 1)
      ).toFixed(2);
      return `
        <div class="cart-item" data-id="${
          item.book_id || "unknown"
        }" data-discounted-price="${
        item.discounted_price || 0
      }" data-unit-price="${item.unit_price || 0}">
          <img src="${item.image_url || "default-image.jpg"}" alt="${
        item.book_name || "Unknown"
      }">
          <div class="cart-item-details">
            <h3>${item.book_name || "Untitled"}</h3>
            <p>by ${item.author_name || "Unknown"}</p>
            <p>Rs. <span class="discounted-price">${totalDiscountedPrice}</span> <del>Rs. <span class="unit-price">${
        totalUnitPrice || ""
      }</span></del></p>
            <div class="quantity">
              <button class="decrease">-</button>
              <span class="quantity-value">${item.quantity || 1}</span>
              <button class="increase">+</button>
            </div>
            <button class="remove">Remove</button>
          </div>
        </div>
      `;
    })
    .join("");
}

// Setup event listeners for cart actions
function setupCartEventListeners() {
  document.querySelectorAll(".increase").forEach((button) => {
    button.addEventListener("click", () => updateQuantity(button, 1));
  });

  document.querySelectorAll(".decrease").forEach((button) => {
    button.addEventListener("click", () => updateQuantity(button, -1));
  });

  document.querySelectorAll(".remove").forEach((button) => {
    button.addEventListener("click", () =>
      removeCartItem(button.closest(".cart-item").dataset.id)
    );
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
    alert("Error: Invalid quantity.");
    return;
  }

  const newQuantity = currentQuantity + change;

  if (newQuantity <= 0) {
    await removeCartItem(bookId);
    return;
  }

  const perUnitDiscountedPrice = parseFloat(cartItem.dataset.discountedPrice);
  const perUnitPrice = parseFloat(cartItem.dataset.unitPrice);

  try {
    const response = await fetchWithAuth(`${API_BASE_URL}/carts/${bookId}`, {
      method: "PATCH",
      body: JSON.stringify({ quantity: newQuantity }),
    });
    if (!response) return;

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Failed to update quantity");
    }

    quantityElement.textContent = newQuantity;
    discountedPriceElement.textContent = (
      perUnitDiscountedPrice * newQuantity
    ).toFixed(2);
    unitPriceElement.textContent = (perUnitPrice * newQuantity).toFixed(2);

    await loadCartItems(true);
  } catch (error) {
    console.error("Quantity update error:", error.message);
    alert(`Failed to update quantity: ${error.message}`);
    quantityElement.textContent = currentQuantity;
  }
}

// Remove item
async function removeCartItem(bookId) {
  try {
    const response = await fetchWithAuth(
      `${API_BASE_URL}/carts/${bookId}/delete`,
      {
        method: "PATCH",
      }
    );
    if (!response) return;

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Failed to remove item");
    }

    await loadCartItems(true);
  } catch (error) {
    console.error("Remove item error:", error.message);
    await loadCartItems(true);
  }
}

// Fetch and display cart summary
async function loadCartSummary() {
  try {
    const response = await fetchWithAuth(`${API_BASE_URL}/carts/summary`);
    if (!response) return;

    const cartData = await response.json();
    const totalPriceElement = document.getElementById("cart-total");
    if (totalPriceElement) {
      totalPriceElement.textContent = cartData.total_price || 0;
    }
    updateCartCount(cartData.total_items || 0);
  } catch (error) {
    console.error("Cart summary error:", error.message);
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

    const userData = await response.json();
    const username = userData.full_name || userData.name || "User";
    profileNameElement.textContent = username;
    localStorage.setItem("username", username);
  } catch (error) {
    console.error("Profile load error:", error.message);
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
      window.location.href = "../pages/homePage.html";
    });
  }

  if (profileLink) {
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
  }

  if (cartLink) {
    cartLink.addEventListener("click", (event) => {
      event.preventDefault();
    });
  }

  const searchInput = document.getElementById("search");
  if (searchInput) {
    searchInput.addEventListener("keypress", (event) => {
      if (event.key === "Enter") {
        const query = event.target.value.trim();
        if (query) {
          window.location.href = `../pages/homePage.html?query=${encodeURIComponent(
            query
          )}`;
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

    document
      .getElementById("dropdown-profile")
      .addEventListener("click", () => {
        window.location.href = "../pages/profile.html";
        closeDropdown();
      });
    document.getElementById("dropdown-orders").addEventListener("click", () => {
      window.location.href = "../pages/myOrders.html";
      closeDropdown();
    });
    document
      .getElementById("dropdown-wishlist")
      .addEventListener("click", () => {
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
async function handleSignOut() {
  const provider = localStorage.getItem("socialProvider");

  try {
    await fetchWithAuth(`${API_BASE_URL}/logout`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
  } catch (error) {
    console.error("Logout error:", error.message);
  }

  if (
    provider === "google" &&
    typeof google !== "undefined" &&
    google.accounts
  ) {
    google.accounts.id.disableAutoSelect();
    google.accounts.id.revoke(
      localStorage.getItem("socialEmail") || "",
      () => {}
    );
  }

  if (provider === "facebook" && typeof FB !== "undefined") {
    FB.getLoginStatus(function (response) {
      if (response.status === "connected") {
        FB.logout(function (response) {});
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
      is_default: false,
    };

    const response = await fetchWithAuth(`${API_BASE_URL}/addresses/create`, {
      method: "POST",
      body: JSON.stringify(addressData),
    });
    if (!response)
      throw new Error("Authentication failed or server is unavailable");

    const result = await response.json();
    if (!response.ok)
      throw new Error(
        `Failed to save address: ${result.error || "Server error"} (Status: ${
          response.status
        })`
      );

    return result.address || result;
  } catch (error) {
    console.error("Location save error:", error.message);
    alert(
      `Error saving location: ${error.message}. Please try again or contact support if the issue persists.`
    );
    throw error;
  }
}

// Fetch addresses
async function fetchAddresses() {
  try {
    const response = await fetchWithAuth(`${API_BASE_URL}/addresses`);
    if (!response) return null;

    const data = await response.json();
    return data.addresses || [];
  } catch (error) {
    console.error("Address fetch error:", error.message);
    return null;
  }
}

// Update address display
function updateAddressFields(address) {
  const addressContainer = document.getElementById("address-container");
  if (addressContainer) {
    addressContainer.innerHTML = address
      ? `<p>${address.street}, ${address.city}, ${address.state} ${address.zip_code}, ${address.country}</p>`
      : "<p>No address selected.</p>";
  }
}

// Setup location button
function setupLocationButton() {
  const useLocationButton = document.querySelector(".use-location");
  if (!useLocationButton) return;

  useLocationButton.addEventListener("click", async function () {
    if (!("geolocation" in navigator)) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    useLocationButton.innerHTML =
      '<i class="fa-solid fa-location-dot"></i> Fetching location...';
    useLocationButton.disabled = true;

    try {
      const position = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
        })
      );

      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;

      const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`;
      const response = await fetch(nominatimUrl, {
        headers: {
          "User-Agent": "BookstoreApp/1.0 (your-email@example.com)",
        },
      });

      if (!response.ok)
        throw new Error("Failed to fetch address from Nominatim API");

      const data = await response.json();
      if (!data || !data.address)
        throw new Error("No address found for the given coordinates");

      const address = {
        street: data.address.road || data.address.street || "",
        city:
          data.address.city || data.address.town || data.address.village || "",
        state: data.address.state || data.address.region || "",
        zip_code: data.address.postcode || "00000",
        country: data.address.country || "",
      };

      const savedAddress = await saveCurrentLocationToBackend(address);
      updateAddressFields(savedAddress);
      localStorage.setItem("selectedAddress", JSON.stringify(savedAddress));
      localStorage.setItem("selectedAddressId", savedAddress.id);

      alert("Latest current location saved successfully!");
    } catch (error) {
      console.error("Geolocation error:", error.message);
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
    } finally {
      useLocationButton.innerHTML =
        '<i class="fa-solid fa-location-dot"></i> Use Current Location';
      useLocationButton.disabled = false;
    }

    const selectedAddress = JSON.parse(
      localStorage.getItem("selectedAddress") || "{}"
    );
    if (selectedAddress.street) {
      updateAddressFields(selectedAddress);
    }
  });

  const selectedAddress = JSON.parse(
    localStorage.getItem("selectedAddress") || "{}"
  );
  if (selectedAddress.street) {
    updateAddressFields(selectedAddress);
  }
}

// Handle page navigation with address choice
document.querySelector(".place-order")?.addEventListener("click", async () => {
  const cartContainer = document.getElementById("cart-container");
  if (cartContainer && cartContainer.innerHTML.includes("Error loading cart")) {
    alert(
      "Cannot place order: There was an error loading your cart. Please try again."
    );
    return;
  }

  if (!cartItemsCache || cartItemsCache.length === 0) {
    alert("Cannot place order: Your cart is empty or not loaded.");
    return;
  }

  const selectedAddress = JSON.parse(
    localStorage.getItem("selectedAddress") || "{}"
  );
  if (
    selectedAddress.street &&
    selectedAddress.city &&
    selectedAddress.state &&
    selectedAddress.zip_code &&
    selectedAddress.country &&
    selectedAddress.id
  ) {
    window.location.href = "../pages/customer-details.html";
  } else {
    const userChoice = confirm(
      "No address selected. Would you like to use your current location? Click 'OK' for yes, or 'Cancel' to set an address manually."
    );

    if (userChoice) {
      if (!("geolocation" in navigator)) {
        alert("Geolocation is not supported by your browser.");
        return;
      }

      try {
        const position = await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 10000,
          })
        );

        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;

        const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`;
        const response = await fetch(nominatimUrl, {
          headers: {
            "User-Agent": "BookstoreApp/1.0 (your-email@example.com)",
          },
        });

        if (!response.ok)
          throw new Error("Failed to fetch address from Nominatim API");

        const data = await response.json();
        if (!data || !data.address)
          throw new Error("No address found for the given coordinates");

        const address = {
          street: data.address.road || data.address.street || "",
          city:
            data.address.city ||
            data.address.town ||
            data.address.village ||
            "",
          state: data.address.state || data.address.region || "",
          zip_code: data.address.postcode || "00000",
          country: data.address.country || "",
        };

        const savedAddress = await saveCurrentLocationToBackend(address);
        updateAddressFields(savedAddress);
        localStorage.setItem("selectedAddress", JSON.stringify(savedAddress));
        localStorage.setItem("selectedAddressId", savedAddress.id);

        window.location.href = "../pages/customer-details.html";
      } catch (error) {
        console.error("Place order geolocation error:", error.message);
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
