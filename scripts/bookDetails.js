document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const bookId = urlParams.get("id");
    if (bookId) {
        fetchBookDetails(bookId);
        fetchReviews(bookId);
    } else {
        console.error("No book ID found in URL");
        document.querySelector(".book-details").innerHTML = "<p>Book not found.</p>";
    }

    // Setup event listeners
    setupEventListeners();
});

// API Base URL
const API_BASE_URL = "http://127.0.0.1:3000/api/v1";

// Fetch Book Details with Authentication
async function fetchBookDetails(bookId) {
    const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAuthToken()}`
    };

    try {
        const response = await fetch(`${API_BASE_URL}/books/${bookId}`, { headers });
        if (!response.ok) throw new Error(`Error ${response.status}: Unable to fetch book details`);

        const book = await response.json();
        displayBookDetails(book);
    } catch (error) {
        console.error("Error fetching book details:", error);
        document.querySelector(".book-details").innerHTML = "<p>Failed to load book details. Please try again or log in.</p>";
    }
}

// Display Book Details
function displayBookDetails(book) {
    document.getElementById("book-title").textContent = book.book_name;
    document.getElementById("book-author").textContent = `by ${book.author_name}`;
    document.getElementById("book-rating-value").textContent = book.rating;
    document.getElementById("book-rating-count").textContent = `(${book.rating_count})`;
    document.getElementById("book-price").textContent = `Rs. ${book.discounted_price}`;
    document.getElementById("book-old-price").textContent = `Rs. ${book.book_mrp}`;
    document.getElementById("book-description").textContent = book.description || "No description available.";
    document.querySelector(".book-image").src = book.book_image || "default-image.jpg";
}

// Fetch Reviews with Authentication
async function fetchReviews(bookId) {
    const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAuthToken()}`
    };

    try {
        const response = await fetch(`${API_BASE_URL}/books/${bookId}/reviews`, { headers });
        if (!response.ok) throw new Error(`Error ${response.status}: Unable to fetch reviews`);

        const reviews = await response.json();
        displayReviews(reviews);
    } catch (error) {
        console.error("Error fetching reviews:", error);
        document.getElementById("reviews-list").innerHTML = "<p>Failed to load reviews. Please try again or log in.</p>";
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

    reviews.forEach(review => {
        const reviewDiv = document.createElement("div");
        reviewDiv.classList.add("review");
        reviewDiv.innerHTML = `
            <p class="review-author">${review.user_name}</p>
            <div class="review-stars">${"★".repeat(review.rating)}</div>
            <p class="review-text">${review.comment}</p>
        `;
        reviewsList.appendChild(reviewDiv);
    });
}

// Setup Event Listeners
function setupEventListeners() {
    // Search Suggestions
    const searchBar = document.getElementById("search");
    searchBar.addEventListener("input", () => {
        fetchSearchSuggestions(searchBar.value);
    });

    searchBar.addEventListener("keypress", (event) => {
        if (event.key === "Enter") fetchBooksBySearch(searchBar.value);
    });

    // Add to Bag
    document.getElementById("add-to-bag").addEventListener("click", async () => {
        if (!isAuthenticated()) {
            alert("Please log in to add to bag.");
            return;
        }

        const bookId = new URLSearchParams(window.location.search).get("id");
        try {
            const response = await fetch(`${API_BASE_URL}/cart/add`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${getAuthToken()}`
                },
                body: JSON.stringify({ book_id: bookId, quantity: 1 })
            });

            if (!response.ok) throw new Error("Failed to add to bag");
            alert("Book added to bag successfully!");
        } catch (error) {
            console.error("Error adding to bag:", error);
            alert("Failed to add to bag. Please try again.");
        }
    });

    // Add to Wishlist (Toggle)
    document.getElementById("add-to-wishlist").addEventListener("click", async () => {
        if (!isAuthenticated()) {
            alert("Please log in to add to wishlist.");
            return;
        }

        const bookId = new URLSearchParams(window.location.search).get("id");
        try {
            const response = await fetch(`${API_BASE_URL}/wishlists/toggle/${bookId}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${getAuthToken()}`
                }
            });

            if (!response.ok) throw new Error("Failed to toggle wishlist");
            const result = await response.json();
            alert(result.message || "Wishlist updated successfully!");
        } catch (error) {
            console.error("Error adding to wishlist:", error);
            alert("Failed to update wishlist. Please try again.");
        }
    });

    // Submit Review
    document.getElementById("review-form").addEventListener("submit", async (event) => {
        event.preventDefault();

        if (!isAuthenticated()) {
            alert("Please log in to submit a review.");
            return;
        }

        const bookId = new URLSearchParams(window.location.search).get("id");
        const reviewText = document.getElementById("review-text").value;
        const rating = 5; // You can add a rating input if needed (currently hardcoded)

        try {
            const response = await fetch(`${API_BASE_URL}/books/${bookId}/reviews`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${getAuthToken()}`
                },
                body: JSON.stringify({ rating, comment: reviewText })
            });

            if (!response.ok) throw new Error("Failed to submit review");
            alert("Review submitted successfully!");
            document.getElementById("review-text").value = "";
            fetchReviews(bookId); // Refresh reviews
        } catch (error) {
            console.error("Error submitting review:", error);
            alert("Failed to submit review. Please try again.");
        }
    });
}

// Fetch Search Suggestions
async function fetchSearchSuggestions(query) {
    const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAuthToken()}`
    };
    const suggestionsBox = document.getElementById("search-suggestions");

    if (!query.trim()) {
        suggestionsBox.innerHTML = "";
        return;
    }

    try {
        const encodedQuery = encodeURIComponent(query);
        const response = await fetch(`${API_BASE_URL}/books/search_suggestions?query=${encodedQuery}`, { headers });
        if (!response.ok) throw new Error(`Error ${response.status}: Unable to fetch suggestions`);
        
        const data = await response.json();
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
        item.addEventListener("click", () => {
            document.getElementById("search").value = suggestion.book_name;
            suggestionsBox.innerHTML = "";
            fetchBooksBySearch(suggestion.book_name);
        });
        suggestionsBox.appendChild(item);
    });
}

// Fetch Books by Search Query
async function fetchBooksBySearch(query) {
    const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAuthToken()}`
    };
    const encodedQuery = encodeURIComponent(query);
    try {
        const response = await fetch(`${API_BASE_URL}/books/search?query=${encodedQuery}`, { headers });
        if (!response.ok) throw new Error(`Error ${response.status}: Unable to fetch books`);
        const data = await response.json();
        if (data.books && data.books.length > 0) {
            window.location.href = `book_details.html?id=${data.books[0].id}`;
        }
    } catch (error) {
        console.error("Error fetching search results:", error);
    }
}

// Authentication Check
function isAuthenticated() {
    // Replace with actual authentication check (e.g., check for token in localStorage)
    return localStorage.getItem("authToken") !== null;
}

// Get Auth Token
function getAuthToken() {
    // Replace with actual token retrieval
    return localStorage.getItem("authToken") || "";
}