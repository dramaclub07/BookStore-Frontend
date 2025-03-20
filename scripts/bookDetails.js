document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const bookId = urlParams.get("id");
    const profileLink = document.getElementById("profile-link");
    const cartLink = document.getElementById("cart-link");

    if (profileLink) {
        profileLink.addEventListener("click", () => {
            console.log("Redirecting to profile page");
            window.location.href = "profile.html";
        });
    }

    if (cartLink) {
        cartLink.addEventListener("click", () => {
            console.log("Redirecting to cart page");
            window.location.href = "cart.html";
        });
    }

    if (bookId) {
        fetchBookDetails(bookId);
        fetchReviews(bookId);
    } else {
        console.error("No book ID found in URL");
        document.querySelector(".book-details").innerHTML = "<p>Book not found.</p>";
    }
    setupEventListeners();
});

// API Base URL
const API_BASE_URL = "http://127.0.0.1:3000/api/v1";

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
    console.log("Current user ID from token:", currentUserId);

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
    if (!confirm("Are you sure you want to delete this review?")) {
        return;
    }

    const bookId = new URLSearchParams(window.location.search).get("id");
    const token = getAuthToken();

    try {
        const response = await fetch(`${API_BASE_URL}/books/${bookId}/reviews/${reviewId}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Failed to delete review");
        }

        alert("Review deleted successfully!");
        fetchReviews(bookId); // Refresh reviews
        fetchBookDetails(bookId); // Refresh book rating
    } catch (error) {
        console.error("Error deleting review:", error);
        alert(`Failed to delete review: ${error.message}`);
    }
}

// Get Current User from Token
function getCurrentUserFromToken() {
    const token = localStorage.getItem("token");
    if (!token) {
        console.log("No token found in localStorage");
        return null;
    }

    try {
        const payload = token.split(".")[1];
        const decodedPayload = atob(payload);
        const userData = JSON.parse(decodedPayload);
        console.log("Decoded user data from token:", userData);
        return userData; // Should include { id, full_name }
    } catch (error) {
        console.error("Error decoding token:", error);
        return null;
    }
}

// Setup Event Listeners
function setupEventListeners() {
    const searchBar = document.getElementById("search");
    searchBar?.addEventListener("input", () => fetchSearchSuggestions(searchBar.value));
    searchBar?.addEventListener("keypress", (event) => {
        if (event.key === "Enter") fetchBooksBySearch(searchBar.value);
    });

    document.getElementById("add-to-bag")?.addEventListener("click", async () => {
        if (!isAuthenticated()) {
            alert("Please log in to add to bag.");
            return;
        }

        const bookId = new URLSearchParams(window.location.search).get("id");
        const token = getAuthToken();

        try {
            const response = await fetch(`${API_BASE_URL}/cart/add`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ book_id: bookId, quantity: 1 })
            });

            const result = await response.json();
            if (!response.ok) throw new Error(`Failed to add to bag: ${result.error || "Unknown error"}`);
            alert("Book added to bag successfully!");
        } catch (error) {
            console.error("Error adding to bag:", error);
            alert(`Failed to add to bag: ${error.message}`);
        }
    });

    document.getElementById("add-to-wishlist")?.addEventListener("click", async () => {
        if (!isAuthenticated()) {
            window.location.href = "pleaseLogin.html";
            return;
        }

        const bookId = new URLSearchParams(window.location.search).get("id");
        const token = getAuthToken();

        try {
            const response = await fetch(`${API_BASE_URL}/wishlists/toggle/${bookId}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                }
            });

            const result = await response.json();
            if (!response.ok) throw new Error(`Failed to toggle wishlist: ${result.error || "Unknown error"}`);
            alert(result.message || "Wishlist updated successfully!");
            window.location.href = "../pages/wishlist.html";
        } catch (error) {
            console.error("Error adding to wishlist:", error);
            alert(`Failed to update wishlist: ${error.message}`);
        }
    });

    let selectedRating = 0;
    const stars = document.querySelectorAll("#rating-stars .star");
    stars.forEach(star => {
        star.addEventListener("click", () => {
            selectedRating = parseInt(star.getAttribute("data-value"));
            updateStarDisplay(selectedRating);
            console.log("Selected rating:", selectedRating);
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
            return;
        }

        const bookId = new URLSearchParams(window.location.search).get("id");
        const reviewText = document.getElementById("review-text").value;
        const rating = selectedRating || 0;

        if (rating === 0) {
            alert("Please select a rating.");
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/books/${bookId}/reviews`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${getAuthToken()}`
                },
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
            console.log("Review submitted, flag set in localStorage");
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

// Fetch Search Suggestions
async function fetchSearchSuggestions(query) {
    const suggestionsBox = document.getElementById("search-suggestions");
    if (!query.trim()) {
        suggestionsBox.innerHTML = "";
        return;
    }

    try {
        const encodedQuery = encodeURIComponent(query);
        const response = await fetch(`${API_BASE_URL}/books/search_suggestions?query=${encodedQuery}`);
        if (!response.ok) throw new Error(`Error ${response.status}: Unable to fetch suggestions`);
        const data = await response.json();
        console.log("Search Suggestions:", data);
        displaySuggestions(data.suggestions);
    } catch (error) {
        console.error("Error fetching search suggestions:", error);
    }
}

// Display Search Suggestions
function displaySuggestions(suggestions) {
    const suggestionsBox = document.getElementById("search-suggestions");
    suggestionsBox.innerHTML = "";

    if (!suggestions || suggestions.length === 0) {
        suggestionsBox.innerHTML = "<p>No suggestions found</p>";
        return;
    }

    suggestions.forEach(suggestion => {
        const item = document.createElement("div");
        item.textContent = `${suggestion.book_name} by ${suggestion.author_name}`;
        item.classList.add("suggestion-item");
        item.style.cursor = "pointer";
        item.addEventListener("click", () => {
            console.log("Suggestion clicked:", suggestion);
            if (suggestion.id) window.location.href = `bookDetails.html?id=${suggestion.id}`;
        });
        suggestionsBox.appendChild(item);
    });
}

// Fetch Books by Search Query
async function fetchBooksBySearch(query) {
    const encodedQuery = encodeURIComponent(query);
    try {
        const response = await fetch(`${API_BASE_URL}/books/search?query=${encodedQuery}`);
        if (!response.ok) throw new Error(`Error ${response.status}: Unable to fetch books`);
        const data = await response.json();
        if (data.books && data.books.length > 0) {
            window.location.href = `bookDetails.html?id=${data.books[0].id}`;
        }
    } catch (error) {
        console.error("Error fetching search results:", error);
    }
}

// Authentication Functions
function isAuthenticated() {
    const token = localStorage.getItem("token");
    console.log("Checking auth, token:", token);
    return token !== null;
}

function getAuthToken() {
    const token = localStorage.getItem("token") || "";
    console.log("Retrieved token:", token);
    return token;
}