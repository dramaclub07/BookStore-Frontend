// API Base URL
const API_BASE_URL = "http://127.0.0.1:3000/api/v1";

document.addEventListener("DOMContentLoaded", async () => {
    console.log("DOM fully loaded, initializing book details...");
    console.log("Token on load:", localStorage.getItem("token"));

    const urlParams = new URLSearchParams(window.location.search);
    const bookId = urlParams.get("id");

    if (bookId) {
        fetchBookDetails(bookId);
        fetchReviews(bookId);
        checkWishlistStatus(bookId);
    } else {
        console.error("No book ID found in URL");
        document.querySelector(".book-details").innerHTML = "<p>Book not found.</p>";
    }

    // Initialize header functionalities
    await loadUserProfile();
    await updateCartCount();
    setupHeaderEventListeners();
    setupEventListeners();
});

// Get auth headers
function getAuthHeaders() {
    const token = localStorage.getItem("token");
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
    };
}

// Authentication Functions
function isAuthenticated() {
    const token = localStorage.getItem("token");
    return token !== null;
}

function getAuthToken() {
    return localStorage.getItem("token") || "";
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
        const response = await fetch(`${API_BASE_URL}/users/profile`, {
            headers: getAuthHeaders()
        });
        if (!response.ok) {
            if (response.status === 401) {
                alert("Session expired. Please log in again.");
                localStorage.removeItem("token");
                window.location.href = "../pages/login.html";
                return;
            }
            throw new Error(`Profile fetch failed with status: ${response.status}`);
        }
        const userData = await response.json();
        if (userData.success) {
            const username = userData.name || "User";
            profileNameElement.textContent = username;
            localStorage.setItem("username", username);
        }
    } catch (error) {
        console.error("Profile fetch error:", error.message);
        profileNameElement.textContent = localStorage.getItem("username") || "User";
    }
}

// Update cart count in UI
async function updateCartCount() {
    const cartCountElement = document.querySelector("#cart-link .cart-count");
    if (!cartCountElement) return;

    const isLoggedIn = isAuthenticated();
    if (!isLoggedIn) {
        console.log("User not authenticated, setting cart count to 0");
        cartCountElement.textContent = "0";
        cartCountElement.style.display = "none";
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/cart`, {
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            if (response.status === 401) {
                alert("Session expired. Please log in again.");
                localStorage.removeItem("token");
                window.location.href = "../pages/login.html";
                return;
            }
            throw new Error("Failed to fetch cart");
        }
        const cart = await response.json();
        console.log("Cart API response:", cart);
        const totalItems = cart.cart?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 0;
        cartCountElement.textContent = totalItems;
        cartCountElement.style.display = totalItems > 0 ? "flex" : "none";
    } catch (error) {
        console.error("Error fetching cart count:", error);
        cartCountElement.textContent = "0";
        cartCountElement.style.display = "none";
    }
}

// Setup Header Event Listeners
function setupHeaderEventListeners() {
    let dropdownMenu = null;
    let isDropdownOpen = false;
    const profileLink = document.getElementById("profile-link");
    const cartLink = document.getElementById("cart-link");
    const isLoggedIn = isAuthenticated();

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
            if (!isLoggedIn) {
                console.log("User not logged in, redirecting to please login page");
                window.location.href = "../pages/pleaseLogin.html";
            } else {
                console.log("Redirecting to cart page");
                window.location.href = "../pages/cart.html";
            }
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
        } else {
            document.getElementById("dropdown-login-signup").addEventListener("click", () => {
                window.location.href = "../pages/login.html";
                closeDropdown();
            });
            document.getElementById("dropdown-orders").addEventListener("click", () => {
                window.location.href = "../pages/pleaseLogin.html";
                closeDropdown();
            });
            document.getElementById("dropdown-wishlist").addEventListener("click", () => {
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

    if (provider === "facebook") {
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
    window.location.href = "../pages/login.html";
}

// Fetch Book Details
async function fetchBookDetails(bookId) {
    try {
        const response = await fetch(`${API_BASE_URL}/books/${bookId}`);
        if (!response.ok) throw new Error(`Error ${response.status}: Unable to fetch book details`);
        const book = await response.json();
        displayBookDetails(book);
    } catch (error) {
        console.error("Error fetching book details:", error);
        document.querySelector(".book-details").innerHTML = "<p>Failed to load book details.</p>";
    }
}

// Display Book Details
function displayBookDetails(book) {
    document.getElementById("book-title").textContent = book.book_name;
    document.getElementById("book-author").textContent = `by ${book.author_name}`;
    document.getElementById("book-rating-value").textContent = book.rating || "0.0";
    document.getElementById("book-rating-count").textContent = `(${book.rating_count || 0})`;
    document.getElementById("book-price").textContent = `Rs. ${book.discounted_price}`;
    document.getElementById("book-old-price").textContent = `Rs. ${book.book_mrp}`;
    document.getElementById("book-description").textContent = book.description || "No description available.";
    document.querySelector(".book-image").src = book.book_image || "default-image.jpg";
}

// Fetch Reviews
async function fetchReviews(bookId) {
    try {
        const response = await fetch(`${API_BASE_URL}/books/${bookId}/reviews`);
        if (!response.ok) throw new Error(`Error ${response.status}: Unable to fetch reviews`);
        const reviews = await response.json();
        console.log("Fetched reviews:", reviews);
        displayReviews(reviews);
    } catch (error) {
        console.error("Error fetching reviews:", error);
        document.getElementById("reviews-list").innerHTML = "<p>Failed to load reviews.</p>";
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

    reviews.forEach(review => {
        const reviewDiv = document.createElement("div");
        reviewDiv.classList.add("review");

        const reviewAuthor = review.user_name || "Anonymous";
        const isCurrentUserReview = currentUserId && review.user_id === currentUserId;

        let deleteButton = '';
        if (isCurrentUserReview) {
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
            <div class="review-stars">${"★".repeat(review.rating)}</div>
            <p class="review-text">${review.comment}</p>
        `;

        reviewsList.appendChild(reviewDiv);

        if (isCurrentUserReview) {
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
        const response = await fetch(`${API_BASE_URL}/books/${bookId}/reviews/${reviewId}`, {
            method: "DELETE",
            headers: getAuthHeaders()
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Failed to delete review");
        }

        alert("Review deleted successfully!");
        fetchReviews(bookId);
        fetchBookDetails(bookId);
    } catch (error) {
        console.error("Error deleting review:", error);
        alert(`Failed to delete review: ${error.message}`);
    }
}

// Check Wishlist Status on Page Load
async function checkWishlistStatus(bookId) {
    if (!isAuthenticated()) return;

    try {
        const response = await fetch(`${API_BASE_URL}/wishlists/fetch`, {
            headers: getAuthHeaders()
        });

        if (!response.ok) throw new Error(`Failed to fetch wishlist: ${response.status}`);
        const wishlist = await response.json();
        const isWishlisted = wishlist.some(item => item.book_id === parseInt(bookId));
        const wishlistButton = document.getElementById("add-to-wishlist");
        wishlistButton.classList.toggle("wishlisted", isWishlisted);
    } catch (error) {
        console.error("Error checking wishlist status:", error);
    }
}

// Get Current User from Token
function getCurrentUserFromToken() {
    const token = localStorage.getItem("token");
    if (!token) return null;

    try {
        const payload = token.split(".")[1];
        const decodedPayload = atob(payload);
        return JSON.parse(decodedPayload);
    } catch (error) {
        console.error("Error decoding token:", error);
        return null;
    }
}

// Check if item exists in cart and get its quantity
async function getCartItemQuantity(bookId) {
    try {
        const response = await fetch(`${API_BASE_URL}/cart`, {
            headers: getAuthHeaders()
        });
        if (!response.ok) throw new Error("Failed to fetch cart");
        const cart = await response.json();
        const cartItem = cart.cart?.find(item => item.book_id === parseInt(bookId));
        return cartItem ? cartItem.quantity : 0;
    } catch (error) {
        console.error("Error checking cart item:", error);
        return 0;
    }
}

// Update cart item quantity
async function updateCartItemQuantity(bookId, newQuantity) {
    try {
        const response = await fetch(`${API_BASE_URL}/cart/update_quantity`, {
            method: "PATCH",
            headers: getAuthHeaders(),
            body: JSON.stringify({ book_id: bookId, quantity: newQuantity })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(`Failed to update quantity: ${result.error || "Unknown error"}`);
        return result;
    } catch (error) {
        console.error("Error updating cart item quantity:", error);
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
    let currentQuantity = 0;
    const bookId = new URLSearchParams(window.location.search).get("id");

    // Initial check for existing quantity
    if (isAuthenticated()) {
        getCartItemQuantity(bookId).then(quantity => {
            currentQuantity = quantity;
            if (quantity > 0) {
                updateQuantityUI(quantity);
            }
        });
    }

    addToBagBtn.addEventListener("click", async () => {
        if (!isAuthenticated()) {
            alert("Please log in to add to bag.");
            window.location.href = "../pages/pleaseLogin.html";
            return;
        }

        try {
            if (currentQuantity === 0) {
                // First time adding to cart
                const response = await fetch(`${API_BASE_URL}/cart/add`, {
                    method: "POST",
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ book_id: bookId, quantity: 1 })
                });
                const result = await response.json();
                if (!response.ok) throw new Error(`Failed to add to bag: ${result.error || "Unknown error"}`);
                currentQuantity = 1;
                updateQuantityUI(currentQuantity);
                alert("Book added to bag successfully!");
            }
            updateCartCount();
        } catch (error) {
            console.error("Error adding to cart:", error);
            alert(`Failed to add to bag: ${error.message}`);
        }
    });

    incrementBtn.addEventListener("click", async () => {
        try {
            currentQuantity++;
            await updateCartItemQuantity(bookId, currentQuantity);
            updateQuantityUI(currentQuantity);
            updateCartCount();
        } catch (error) {
            currentQuantity--; // Revert on error
            alert(`Failed to update quantity: ${error.message}`);
        }
    });

    decrementBtn.addEventListener("click", async () => {
        if (currentQuantity <= 1) {
            // Remove from cart when reaching 0
            try {
                await fetch(`${API_BASE_URL}/cart/remove`, {
                    method: "DELETE",
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ book_id: bookId })
                });
                currentQuantity = 0;
                updateQuantityUI(currentQuantity);
                updateCartCount();
            } catch (error) {
                alert(`Failed to remove from cart: ${error.message}`);
            }
        } else {
            try {
                currentQuantity--;
                await updateCartItemQuantity(bookId, currentQuantity);
                updateQuantityUI(currentQuantity);
                updateCartCount();
            } catch (error) {
                currentQuantity++; // Revert on error
                alert(`Failed to update quantity: ${error.message}`);
            }
        }
    });

    document.getElementById("add-to-wishlist")?.addEventListener("click", async () => {
        if (!isAuthenticated()) {
            window.location.href = "../pages/pleaseLogin.html";
            return;
        }

        const wishlistButton = document.getElementById("add-to-wishlist");
        const wasWishlisted = wishlistButton.classList.contains("wishlisted");

        try {
            const response = await fetch(`${API_BASE_URL}/wishlists/toggle/${bookId}`, {
                method: "POST",
                headers: getAuthHeaders()
            });

            const result = await response.json();
            if (!response.ok) throw new Error(`Failed to toggle wishlist: ${result.error || "Unknown error"}`);

            const isWishlisted = result.isWishlisted !== undefined ? result.isWishlisted : !wasWishlisted;
            wishlistButton.classList.toggle("wishlisted", isWishlisted);
            alert(isWishlisted ? "Book added to wishlist!" : "Book removed from wishlist!");
        } catch (error) {
            console.error("Error toggling wishlist:", error);
            alert(`Failed to update wishlist: ${error.message}`);
        }
    });

    let selectedRating = 0;
    const stars = document.querySelectorAll("#rating-stars .star");
    stars.forEach(star => {
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

    document.getElementById("review-form")?.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!isAuthenticated()) {
            alert("Please log in to submit a review.");
            window.location.href = "../pages/pleaseLogin.html";
            return;
        }

        const reviewText = document.getElementById("review-text").value;
        const rating = selectedRating || 0;

        if (rating === 0) {
            alert("Please select a rating.");
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/books/${bookId}/reviews`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify({ rating, comment: reviewText })
            });

            const result = await response.json();
            if (!response.ok) throw new Error(`Failed to submit review: ${result.error || "Unknown error"}`);
            alert("Review submitted successfully!");
            document.getElementById("review-text").value = "";
            selectedRating = 0;
            updateStarDisplay(0);
            fetchReviews(bookId);
            fetchBookDetails(bookId);
            localStorage.setItem("reviewSubmitted", "true");
        } catch (error) {
            console.error("Error submitting review:", error);
            alert(`Failed to submit review: ${error.message}`);
        }
    });
}

// Update Star Display
function updateStarDisplay(rating) {
    const stars = document.querySelectorAll("#rating-stars .star");
    stars.forEach(star => {
        const starValue = parseInt(star.getAttribute("data-value"));
        star.classList.toggle("active", starValue <= rating);
    });
}

// Helper function to update quantity UI
function updateQuantityUI(quantity) {
    const addToBagBtn = document.getElementById("add-to-bag");
    const quantityControl = document.getElementById("quantity-control");
    const quantityDisplay = document.getElementById("quantity-display");

    if (quantity > 0) {
        addToBagBtn.style.display = "none";
        quantityControl.style.display = "flex";
        quantityDisplay.textContent = quantity;
    } else {
        addToBagBtn.style.display = "flex";
        quantityControl.style.display = "none";
    }
}