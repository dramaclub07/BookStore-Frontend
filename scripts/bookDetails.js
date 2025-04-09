const API_BASE_URL = window.config.API_BASE_URL;; // Backend URL
const PROXY_URL = "http://127.0.0.1:4000/api/v1"; // Proxy URL for local testing

// Theme constants
const THEME_KEY = "theme";
const LIGHT_MODE = "light";
const DARK_MODE = "dark";

// Admin tools modal state
let adminToolsModal = null;
let isAdminToolsModalOpen = false;

document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const bookId = urlParams.get("id");

  if (bookId) {
    fetchBookDetails(bookId);
    fetchReviews(bookId);
    checkWishlistStatus(bookId);
  } else {
    document.querySelector(".book-details").innerHTML =
      "<p>Book not found.</p>";
  }

  await loadUserProfile();
  await updateCartCount();
  setupHeaderEventListeners();
  setupEventListeners();

  if (isAdmin()) {
    document.getElementById("admin-tools-link").style.display = "inline-flex";
    const adminActions = document.getElementById("admin-actions");
    if (adminActions) adminActions.style.display = "block";
    const cartLink = document.getElementById("cart-link");
    if (cartLink) cartLink.style.display = "none";
  } else {
    document.getElementById("admin-tools-link").style.display = "none";
    const adminActions = document.getElementById("admin-actions");
    if (adminActions) adminActions.style.display = "none";
    const cartLink = document.getElementById("cart-link");
    if (cartLink) cartLink.style.display = "inline-flex";
  }
});

// Get auth headers
function getAuthHeaders() {
  const accessToken = localStorage.getItem("access_token");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  };
}

// Authentication Functions
function isAuthenticated() {
  const accessToken = localStorage.getItem("access_token");
  return accessToken !== null;
}

function isAdmin() {
  const userRole = localStorage.getItem("user_role");
  return userRole === "admin";
}

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem("refresh_token");
  if (!refreshToken) return false;

  const urls = [`${PROXY_URL}refresh`, `${API_BASE_URL}refresh`]; // Try proxy first, then backend

  for (const url of urls) {
    try {
      const response = await fetch(url, {
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
    } catch (error) {
      console.log(`Refresh failed at ${url}:`, error.message);
    }
  }

  localStorage.clear();
  alert("Session expired. Please log in again.");
  window.location.href = "../pages/login.html";
  return false;
}

async function fetchWithAuth(url, options = {}) {
  const urls = [url.replace(API_BASE_URL, PROXY_URL), url]; // Try proxy first, then backend

  for (const fetchUrl of urls) {
    if (!isAuthenticated()) {
      window.location.href = "../pages/pleaseLogin.html";
      return null;
    }

    const expiresIn = localStorage.getItem("token_expires_in");
    if (expiresIn && Date.now() >= expiresIn) {
      const refreshed = await refreshAccessToken();
      if (!refreshed) return null;
    }

    options.headers = { ...options.headers, ...getAuthHeaders() };

    try {
      const response = await fetch(fetchUrl, options);
      if (!response.ok && response.status === 401) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          options.headers = { ...options.headers, ...getAuthHeaders() };
          return await fetch(fetchUrl, options);
        }
        return null;
      }
      if (response.ok) return response;
      throw new Error(`Fetch failed with status: ${response.status}`);
    } catch (error) {
      console.log(`Fetch error at ${fetchUrl}:`, error.message);
    }
  }
  return null;
}

async function fetchWithoutAuth(url, options = {}) {
  const urls = [url.replace(API_BASE_URL, PROXY_URL), url]; // Try proxy first, then backend

  for (const fetchUrl of urls) {
    try {
      const response = await fetch(fetchUrl, options);
      if (response.ok) return response;
      throw new Error(`Fetch failed with status: ${response.status}`);
    } catch (error) {
      console.log(`Fetch without auth error at ${fetchUrl}:`, error.message);
    }
  }
  return null;
}

// Toggle theme function
function toggleTheme() {
  const currentTheme = localStorage.getItem(THEME_KEY) || LIGHT_MODE;
  const newTheme = currentTheme === LIGHT_MODE ? DARK_MODE : LIGHT_MODE;
  document.body.classList.toggle("dark", newTheme === DARK_MODE);
  localStorage.setItem(THEME_KEY, newTheme);
}

// Fetch and display user profile
async function loadUserProfile() {
  const profileNameElement = document.querySelector(".profile-name");
  const isLoggedIn = isAuthenticated();

  if (!profileNameElement) return;

  if (!isLoggedIn) {
    profileNameElement.textContent = "Profile";
    return;
  }

  try {
    const response = await fetchWithAuth(`${API_BASE_URL}users/profile`);
    if (!response) return;

    const userData = await response.json();
    const username = userData.name || "User";
    profileNameElement.textContent = username;
    localStorage.setItem("username", username);
    localStorage.setItem("user_role", userData.role || "user");
  } catch (error) {
    profileNameElement.textContent = localStorage.getItem("username") || "User";
  }
}

// Update cart count in UI
async function updateCartCount() {
  const cartCountElement = document.querySelector("#cart-link .cart-count");
  if (!cartCountElement) return;

  if (!isAuthenticated() || isAdmin()) {
    cartCountElement.textContent = "0";
    cartCountElement.style.display = "none";
    return;
  }

  try {
    const response = await fetchWithAuth(`${API_BASE_URL}carts/summary`);
    if (!response) return;

    const cartData = await response.json();
    const totalItems = cartData.total_items || cartData.total_price || 0;
    cartCountElement.textContent = totalItems;
    cartCountElement.style.display = totalItems > 0 ? "flex" : "none";
  } catch (error) {
    cartCountElement.textContent = "0";
    cartCountElement.style.display = "none";
  }
}

// Setup Header Event Listeners with Admin Tools Modal
function setupHeaderEventListeners() {
  let dropdownMenu = null;
  let isDropdownOpen = false;
  const profileLink = document.getElementById("profile-link");
  const cartLink = document.getElementById("cart-link");
  const adminToolsLink = document.getElementById("admin-tools-link");
  const logo = document.querySelector(".logo");
  const isLoggedIn = isAuthenticated();

  if (logo) {
    logo.addEventListener("click", (event) => {
      event.preventDefault();
      window.location.href = "../pages/homePage.html";
    });
  }

  if (profileLink) {
    profileLink.addEventListener("click", (event) => {
      event.preventDefault();
      if (isDropdownOpen) closeDropdown();
      else openDropdown();
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
      if (!isLoggedIn) {
        window.location.href = "../pages/pleaseLogin.html";
      } else {
        window.location.href = "../pages/cart.html";
      }
    });
  }

  if (adminToolsLink && isAdmin()) {
    adminToolsLink.addEventListener("click", (event) => {
      event.preventDefault();
      if (isAdminToolsModalOpen) closeAdminToolsModal();
      else openAdminToolsModal();
    });

    document.addEventListener("click", (event) => {
      if (
        isAdminToolsModalOpen &&
        !adminToolsLink.contains(event.target) &&
        adminToolsModal &&
        !adminToolsModal.contains(event.target) &&
        !event.target.classList.contains("close-btn")
      ) {
        closeAdminToolsModal();
      }
    });

    adminToolsModal = document.getElementById("admin-tools-modal");
    if (adminToolsModal) {
      const toggleThemeBtn = document.getElementById("toggle-theme");
      const registerUserBtn = document.getElementById("register-user");
      const closeBtn = adminToolsModal.querySelector(".close-btn");

      if (toggleThemeBtn) {
        toggleThemeBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          toggleTheme();
          closeAdminToolsModal();
        });
      }
      if (registerUserBtn) {
        registerUserBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          window.location.href = "../pages/signup.html?adminMode=true";
          closeAdminToolsModal();
        });
      }
      if (closeBtn) {
        closeBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          closeAdminToolsModal();
        });
      }
    }
  }

  document.getElementById("search")?.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
      const query = event.target.value.trim();
      if (query) {
        window.location.href = `../pages/homePage.html?query=${encodeURIComponent(
          query
        )}`;
      }
    }
  });

  function openDropdown() {
    if (dropdownMenu) dropdownMenu.remove();

    dropdownMenu = document.createElement("div");
    dropdownMenu.classList.add("dropdown-menu");
    const username = localStorage.getItem("username") || "User";

    dropdownMenu.innerHTML = isLoggedIn
      ? `
                <div class="dropdown-item dropdown-header">Hello ${username},</div>
                <div class="dropdown-item" id="dropdown-profile">Profile</div>
                <div class="dropdown-item" id="dropdown-orders">My Orders</div>
                <div class="dropdown-item" id="dropdown-wishlist">My Wishlist</div>
                <div class="dropdown-item"><button id="dropdown-logout">Logout</button></div>
            `
      : `
                <div class="dropdown-item dropdown-header">Welcome</div>
                <div class="dropdown-item dropdown-subheader">To access account</div>
                <div class="dropdown-item"><button id="dropdown-login-signup">LOGIN/SIGNUP</button></div>
                <div class="dropdown-item" id="dropdown-orders">My Orders</div>
                <div class="dropdown-item" id="dropdown-wishlist">Wishlist</div>
            `;

    profileLink.parentElement.appendChild(dropdownMenu);

    if (isLoggedIn) {
      document
        .getElementById("dropdown-profile")
        .addEventListener("click", () => {
          window.location.href = "../pages/profile.html";
          closeDropdown();
        });
      document
        .getElementById("dropdown-orders")
        .addEventListener("click", () => {
          window.location.href = "../pages/myOrders.html";
          closeDropdown();
        });
      document
        .getElementById("dropdown-wishlist")
        .addEventListener("click", () => {
          window.location.href = "../pages/wishlist.html";
          closeDropdown();
        });
      document
        .getElementById("dropdown-logout")
        .addEventListener("click", () => {
          handleSignOut();
          closeDropdown();
        });
    } else {
      document
        .getElementById("dropdown-login-signup")
        .addEventListener("click", () => {
          window.location.href = "../pages/login.html";
          closeDropdown();
        });
      document
        .getElementById("dropdown-orders")
        .addEventListener("click", () => {
          window.location.href = "../pages/pleaseLogin.html";
          closeDropdown();
        });
      document
        .getElementById("dropdown-wishlist")
        .addEventListener("click", () => {
          window.location.href = "../pages/pleaseLogin.html";
          closeDropdown();
        });
    }

    isDropdownOpen = true;
  }

  function closeDropdown() {
    if (dropdownMenu) {
      dropdownMenu.remove();
      dropdownMenu = null;
    }
    isDropdownOpen = false;
  }

  function openAdminToolsModal() {
    adminToolsModal = document.getElementById("admin-tools-modal");
    if (!adminToolsModal) return;
    adminToolsModal.style.display = "flex";
    isAdminToolsModalOpen = true;
  }

  function closeAdminToolsModal() {
    if (adminToolsModal) adminToolsModal.style.display = "none";
    isAdminToolsModalOpen = false;
  }
}

// Sign Out (Logout) functionality
async function handleSignOut() {
  const provider = localStorage.getItem("socialProvider");

  try {
    await fetchWithAuth(`${API_BASE_URL}logout`, {
      method: "POST",
      headers: getAuthHeaders(),
    });
  } catch (error) {}

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
        FB.logout(function () {});
      }
    });
  }

  localStorage.clear();
  alert("Logged out successfully.");
  window.location.href = "../pages/login.html";
}

// Fetch Book Details
async function fetchBookDetails(bookId) {
  try {
    const response = await fetchWithoutAuth(`${API_BASE_URL}books/${bookId}`);
    if (!response) throw new Error("No response from server");
    const book = await response.json();
    displayBookDetails(book);
  } catch (error) {
    document.querySelector(".book-details").innerHTML =
      "<p>Failed to load book details.</p>";
  }
}

// Display Book Details
function displayBookDetails(book) {
  document.getElementById("book-title").textContent =
    book.book_name || "Unknown Title";
  document.getElementById("book-author").textContent = `by ${
    book.author_name || "Unknown Author"
  }`;
  document.getElementById("book-rating-value").textContent =
    book.rating || "0.0";
  document.getElementById("book-rating-count").textContent = `(${
    book.rating_count || 0
  })`;
  document.getElementById("book-price").textContent = `Rs. ${
    book.discounted_price || 0
  }`;
  document.getElementById("book-old-price").textContent = `Rs. ${
    book.book_mrp || 0
  }`;
  document.getElementById("book-description").textContent =
    book.description || "No description available.";
  document.querySelector(".book-image").src =
    book.book_image || "default-image.jpg";

  if (isAdmin()) {
    document.getElementById("edit-book-name").value = book.book_name || "";
    document.getElementById("edit-author-name").value = book.author_name || "";
    document.getElementById("edit-discounted-price").value =
      book.discounted_price || "";
    document.getElementById("edit-book-mrp").value = book.book_mrp || "";
    document.getElementById("edit-description").value = book.description || "";
    document.getElementById("edit-book-image").value = book.book_image || "";
  }
}

// Fetch Reviews
async function fetchReviews(bookId) {
  try {
    const response = await fetchWithoutAuth(
      `${API_BASE_URL}books/${bookId}/reviews`
    );
    if (!response) throw new Error("No response from server");
    const reviews = await response.json();
    displayReviews(Array.isArray(reviews) ? reviews : []);
  } catch (error) {
    document.getElementById("reviews-list").innerHTML =
      "<p>Failed to load reviews.</p>";
  }
}

// Display Reviews
function displayReviews(reviews) {
  const reviewsList = document.getElementById("reviews-list");
  reviewsList.innerHTML = "";

  if (!reviews || reviews.length === 0) {
    reviewsList.innerHTML = "<p>No reviews yet.</p>";
    return;
  }

  const currentUser = getCurrentUserFromToken();
  const currentUserId = currentUser?.user_id;

  reviews.forEach((review) => {
    const reviewDiv = document.createElement("div");
    reviewDiv.classList.add("review");

    const reviewAuthor = review.user_name || "Anonymous";
    const isCurrentUserReview =
      currentUserId && review.user_id === currentUserId;
    const isAdminUser = isAdmin();

    let deleteButton = "";
    if (isCurrentUserReview || isAdminUser) {
      deleteButton = `
                <button class="delete-review-btn" data-review-id="${review.id}">
                    <i class="fa-solid fa-trash"></i> Delete
                </button>
            `;
    }

    reviewDiv.innerHTML = `
            <div class="review-header">
                <p class="review-author">${reviewAuthor}</p>
                ${deleteButton}
            </div>
            <div class="review-stars">${"★".repeat(review.rating || 0)}</div>
            <p class="review-text">${review.comment || "No comment"}</p>
        `;

    reviewsList.appendChild(reviewDiv);

    if (isCurrentUserReview || isAdminUser) {
      const deleteBtn = reviewDiv.querySelector(".delete-review-btn");
      deleteBtn.addEventListener("click", () => deleteReview(review.id));
    }
  });
}

// Delete Review
async function deleteReview(reviewId) {
  if (!confirm("Are you sure you want to delete this review?")) return;

  const bookId = new URLSearchParams(window.location.search).get("id");
  try {
    const response = await fetchWithAuth(
      `${API_BASE_URL}books/${bookId}/reviews/${reviewId}`,
      {
        method: "DELETE",
      }
    );

    if (!response) return;
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to delete review");
    }

    alert("Review deleted successfully!");
    fetchReviews(bookId);
    fetchBookDetails(bookId);
  } catch (error) {
    alert(`Failed to delete review: ${error.message}`);
  }
}

// Delete All Ratings
async function deleteAllRatings(bookId) {
  if (!confirm("Are you sure you want to delete all ratings for this book?"))
    return;

  try {
    const response = await fetchWithoutAuth(
      `${API_BASE_URL}books/${bookId}/reviews`
    );
    if (!response) throw new Error("No response from server");
    const reviews = await response.json();

    if (!reviews || reviews.length === 0) {
      alert("No reviews to delete.");
      return;
    }

    const deletePromises = reviews.map((review) =>
      fetchWithAuth(`${API_BASE_URL}books/${bookId}/reviews/${review.id}`, {
        method: "DELETE",
      }).then((res) => {
        if (!res.ok) throw new Error(`Failed to delete review ${review.id}`);
        return res;
      })
    );

    await Promise.all(deletePromises);
    alert("All ratings deleted successfully!");
    fetchReviews(bookId);
    fetchBookDetails(bookId);
  } catch (error) {
    alert(`Failed to delete all ratings: ${error.message}`);
  }
}

// Delete Book
async function deleteBook(bookId) {
  if (!confirm("Are you sure you want to delete this book?")) return;

  try {
    const response = await fetchWithAuth(`${API_BASE_URL}books/${bookId}`, {
      method: "DELETE",
    });

    if (!response) return;
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to delete book");
    }

    alert("Book deleted successfully!");
    window.location.href = "../pages/homePage.html";
  } catch (error) {
    alert(`Failed to delete book: ${error.message}`);
  }
}

// Update Book
async function updateBook(bookId) {
  const bookData = {
    book_name: document.getElementById("edit-book-name").value,
    author_name: document.getElementById("edit-author-name").value,
    discounted_price: parseFloat(
      document.getElementById("edit-discounted-price").value
    ),
    book_mrp: parseFloat(document.getElementById("edit-book-mrp").value),
    description: document.getElementById("edit-description").value,
    book_image: document.getElementById("edit-book-image").value || null,
  };

  try {
    const response = await fetchWithAuth(`${API_BASE_URL}books/${bookId}`, {
      method: "PUT",
      body: JSON.stringify(bookData),
    });

    if (!response) return;
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to update book");
    }

    alert("Book updated successfully!");
    fetchBookDetails(bookId);
    closeEditModal();
  } catch (error) {
    alert(`Failed to update book: ${error.message}`);
  }
}

// Check Wishlist Status on Page Load
async function checkWishlistStatus(bookId) {
  if (!isAuthenticated()) return;

  try {
    const response = await fetchWithAuth(`${API_BASE_URL}wishlists`);
    if (!response) return;

    const wishlistData = await response.json();
    const wishlist = Array.isArray(wishlistData)
      ? wishlistData
      : wishlistData.wishlist || [];
    const isWishlisted = wishlist.some(
      (item) => item.book_id === parseInt(bookId)
    );
    const wishlistButton = document.getElementById("add-to-wishlist");
    wishlistButton.classList.toggle("wishlisted", isWishlisted);
  } catch (error) {}
}

// Get Current User from Token
function getCurrentUserFromToken() {
  const token = localStorage.getItem("access_token");
  if (!token) return null;

  try {
    const payload = token.split(".")[1];
    const decodedPayload = atob(payload);
    return JSON.parse(decodedPayload);
  } catch (error) {
    return null;
  }
}

// Check if item exists in cart and get its quantity
async function getCartItemQuantity(bookId) {
  if (!isAuthenticated()) return 0;

  try {
    const response = await fetchWithAuth(`${API_BASE_URL}carts`);
    if (!response) return 0;

    const cartData = await response.json();
    const cart = Array.isArray(cartData) ? cartData : cartData.cart_items || [];
    const cartItem = cart.find((item) => item.book_id === parseInt(bookId));
    return cartItem ? cartItem.quantity : 0;
  } catch (error) {
    return 0;
  }
}

// Update cart item quantity
async function updateCartItemQuantity(bookId, newQuantity) {
  try {
    const response = await fetchWithAuth(`${API_BASE_URL}carts/${bookId}`, {
      method: "PATCH",
      body: JSON.stringify({ quantity: newQuantity }),
    });
    if (!response) return;

    const result = await response.json();
    if (!response.ok)
      throw new Error(
        `Failed to update quantity: ${result.error || "Unknown error"}`
      );
    return result;
  } catch (error) {
    throw error;
  }
}

// Setup Event Listeners for Book Details
function setupEventListeners() {
  const addToBagBtn = document.getElementById("add-to-bag");
  const quantityControl = document.getElementById("quantity-control");
  const quantityDisplay = document.getElementById("quantity-display");
  const incrementBtn = document.getElementById("increment");
  const decrementBtn = document.getElementById("decrement");
  const bookId = new URLSearchParams(window.location.search).get("id");
  let currentQuantity = 0;

  if (isAuthenticated() && !isAdmin()) {
    getCartItemQuantity(bookId)
      .then((quantity) => {
        currentQuantity = quantity;
        updateQuantityUI(quantity);
      })
      .catch(() => updateQuantityUI(0));
  }

  if (addToBagBtn) {
    addToBagBtn.addEventListener("click", async () => {
      if (!isAuthenticated()) {
        alert("Please log in to add to bag.");
        window.location.href = "../pages/pleaseLogin.html";
        return;
      }

      if (isAdmin()) {
        alert("Admins cannot add items to the cart.");
        return;
      }

      try {
        if (currentQuantity === 0) {
          const response = await fetchWithAuth(
            `${API_BASE_URL}carts/${bookId}`,
            {
              method: "POST",
              body: JSON.stringify({ quantity: 1 }),
            }
          );
          if (!response) return;

          const result = await response.json();
          if (!response.ok)
            throw new Error(
              `Failed to add to bag: ${result.error || "Unknown error"}`
            );
          currentQuantity = 1;
          updateQuantityUI(currentQuantity);
          alert("Book added to bag successfully!");
          await updateCartCount();
        }
      } catch (error) {
        alert(`Failed to add to bag: ${error.message}`);
      }
    });
  }

  if (incrementBtn) {
    incrementBtn.addEventListener("click", async () => {
      if (isAdmin()) return;

      try {
        currentQuantity++;
        await updateCartItemQuantity(bookId, currentQuantity);
        updateQuantityUI(currentQuantity);
        await updateCartCount();
      } catch (error) {
        currentQuantity--;
        updateQuantityUI(currentQuantity);
        alert(`Failed to update quantity: ${error.message}`);
      }
    });
  }

  if (decrementBtn) {
    decrementBtn.addEventListener("click", async () => {
      if (isAdmin()) return;

      try {
        if (currentQuantity <= 1) {
          const response = await fetchWithAuth(
            `${API_BASE_URL}carts/${bookId}/delete`,
            {
              method: "PATCH",
            }
          );
          if (!response) return;

          if (!response.ok) {
            const result = await response.json();
            throw new Error(
              `Failed to remove from cart: ${result.error || "Unknown error"}`
            );
          }
          currentQuantity = 0;
          updateQuantityUI(currentQuantity);
          await updateCartCount();
          alert("Book removed from cart successfully!");
        } else {
          currentQuantity--;
          await updateCartItemQuantity(bookId, currentQuantity);
          updateQuantityUI(currentQuantity);
          await updateCartCount();
        }
      } catch (error) {
        if (currentQuantity > 1) currentQuantity++;
        updateQuantityUI(currentQuantity);
        alert(`Failed to update cart: ${error.message}`);
      }
    });
  }

  const wishlistBtn = document.getElementById("add-to-wishlist");
  if (wishlistBtn) {
    wishlistBtn.addEventListener("click", async () => {
      if (!isAuthenticated()) {
        window.location.href = "../pages/pleaseLogin.html";
        return;
      }

      if (isAdmin()) {
        alert("Admins cannot modify wishlist.");
        return;
      }

      const wishlistButton = document.getElementById("add-to-wishlist");
      const wasWishlisted = wishlistButton.classList.contains("wishlisted");

      try {
        const response = await fetchWithAuth(`${API_BASE_URL}wishlists`, {
          method: wasWishlisted ? "DELETE" : "POST",
          body: wasWishlisted
            ? null
            : JSON.stringify({ book_id: parseInt(bookId) }),
        });
        if (!response) return;

        const result = await response.json();
        if (!response.ok)
          throw new Error(
            `Failed to toggle wishlist: ${result.error || "Unknown error"}`
          );

        const isWishlisted = !wasWishlisted;
        wishlistButton.classList.toggle("wishlisted", isWishlisted);
        alert(
          isWishlisted
            ? "Book added to wishlist!"
            : "Book removed from wishlist!"
        );
      } catch (error) {
        alert(`Failed to update wishlist: ${error.message}`);
      }
    });
  }

  let selectedRating = 0;
  const stars = document.querySelectorAll("#rating-stars .star");
  stars.forEach((star) => {
    star.addEventListener("click", () => {
      selectedRating = parseInt(star.getAttribute("data-value"));
      updateStarDisplay(selectedRating);
    });

    star.addEventListener("mouseover", () => {
      const hoverValue = parseInt(star.getAttribute("data-value"));
      updateStarDisplay(hoverValue);
    });

    star.addEventListener("mouseout", () => {
      updateStarDisplay(selectedRating);
    });
  });

  const reviewForm = document.getElementById("review-form");
  if (reviewForm) {
    reviewForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!isAuthenticated()) {
        alert("Please log in to submit a review.");
        window.location.href = "../pages/pleaseLogin.html";
        return;
      }

      if (isAdmin()) {
        alert("Admins cannot submit reviews.");
        return;
      }

      const reviewText = document.getElementById("review-text").value;
      const rating = selectedRating || 0;

      if (rating === 0) {
        alert("Please select a rating.");
        return;
      }

      try {
        const response = await fetchWithAuth(
          `${API_BASE_URL}books/${bookId}/reviews`,
          {
            method: "POST",
            body: JSON.stringify({ rating, comment: reviewText }),
          }
        );
        if (!response) return;

        const result = await response.json();
        if (!response.ok)
          throw new Error(
            `Failed to submit review: ${result.error || "Unknown error"}`
          );
        alert("Review submitted successfully!");
        document.getElementById("review-text").value = "";
        selectedRating = 0;
        updateStarDisplay(0);
        fetchReviews(bookId);
        fetchBookDetails(bookId);
        localStorage.setItem("reviewSubmitted", "true");
      } catch (error) {
        alert(`Failed to submit review: ${error.message}`);
      }
    });
  }

  if (isAdmin()) {
    const editBookBtn = document.getElementById("edit-book-btn");
    const deleteBookBtn = document.getElementById("delete-book-btn");
    const deleteRatingsBtn = document.getElementById("delete-ratings-btn");

    if (editBookBtn) {
      editBookBtn.addEventListener("click", () => {
        document.getElementById("edit-book-modal").style.display = "flex";
      });
    }

    if (deleteBookBtn) {
      deleteBookBtn.addEventListener("click", () => {
        deleteBook(bookId);
      });
    }

    if (deleteRatingsBtn) {
      deleteRatingsBtn.addEventListener("click", () => {
        deleteAllRatings(bookId);
      });
    }

    const editBookForm = document.getElementById("edit-book-form");
    if (editBookForm) {
      editBookForm.addEventListener("submit", (event) => {
        event.preventDefault();
        updateBook(bookId);
      });
    }

    const editModalCloseBtn = document.querySelector(
      "#edit-book-modal .close-btn"
    );
    if (editModalCloseBtn) {
      editModalCloseBtn.addEventListener("click", () => {
        closeEditModal();
      });
    }

    document.addEventListener("click", (event) => {
      const modal = document.getElementById("edit-book-modal");
      if (
        modal?.style.display === "flex" &&
        !modal.querySelector(".modal-content").contains(event.target) &&
        event.target.id !== "edit-book-btn"
      ) {
        closeEditModal();
      }
    });
  }
}

// Update Star Display
function updateStarDisplay(rating) {
  const stars = document.querySelectorAll("#rating-stars .star");
  stars.forEach((star) => {
    const starValue = parseInt(star.getAttribute("data-value"));
    star.classList.toggle("active", starValue <= rating);
  });
}

// Helper function to update quantity UI
function updateQuantityUI(quantity) {
  const addToBagBtn = document.getElementById("add-to-bag");
  const quantityControl = document.getElementById("quantity-control");
  const quantityDisplay = document.getElementById("quantity-display");

  if (!addToBagBtn || !quantityControl || !quantityDisplay) return;

  if (quantity > 0) {
    addToBagBtn.style.display = "none";
    quantityControl.style.display = "flex";
    quantityDisplay.textContent = quantity;
  } else {
    addToBagBtn.style.display = "flex";
    quantityControl.style.display = "none";
  }
}

// Close Edit Modal
function closeEditModal() {
  const modal = document.getElementById("edit-book-modal");
  if (modal) modal.style.display = "none";
}