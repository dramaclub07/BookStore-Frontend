document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM fully loaded, fetching books...");
    // Check if returning from book details with a review update
    if (localStorage.getItem("reviewSubmitted") === "true") {
        console.log("Review submitted previously, refreshing books...");
        localStorage.removeItem("reviewSubmitted"); // Clear flag
        fetchBooks(); // Refresh data
    } else {
        fetchBooks(); // Initial fetch
    }

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
});

// Global Variables for Pagination
let currentPage = 1;
let totalPages = 1;
const API_BASE_URL = "http://127.0.0.1:3000/api/v1/books";

// Fetch Books from API (unchanged)
async function fetchBooks(sortBy = "relevance", page = 1) {
    const bookContainer = document.getElementById("book-list");
    const prevButton = document.getElementById("prev-page");
    const nextButton = document.getElementById("next-page");
    const totalBooksElement = document.getElementById("total-books");

    if (!bookContainer) {
        console.error("Error: 'book-list' element not found in the DOM.");
        return;
    }

    bookContainer.innerHTML = "<p>Loading books...</p>";
    if (prevButton) prevButton.disabled = true;
    if (nextButton) nextButton.disabled = true;

    try {
        const url = `${API_BASE_URL}?sort=${sortBy}&page=${page}`;
        console.log("Fetching books from:", url);

        const response = await fetch(url);
        console.log("Response status:", response.status);

        if (!response.ok) {
            throw new Error(`HTTP Error ${response.status}: Unable to fetch books`);
        }

        const data = await response.json();
        console.log("API Response:", data);

        if (!data.success || !data.books || data.books.length === 0) {
            console.warn("No books returned from API.");
            bookContainer.innerHTML = "<p>No books found.</p>";
            updatePagination(1, 1);
            return;
        }

        console.log("Sample books:", data.books.slice(0, 3));
        displayBooks(data.books);

        const totalPagesFromAPI = data.pagination?.total_pages || 1;
        const totalCount = data.pagination?.total_count || 0;

        if (totalBooksElement) totalBooksElement.textContent = totalCount;
        updatePagination(totalPagesFromAPI, page);

        if (prevButton) prevButton.disabled = page === 1;
        if (nextButton) nextButton.disabled = page >= totalPagesFromAPI;
    } catch (error) {
        console.error("Error fetching books:", error.message);
        bookContainer.innerHTML = "<p>Failed to load books. Please try again.</p>";
    }
}

// Display Books on the Page (unchanged)
function displayBooks(books) {
    const bookContainer = document.getElementById("book-list");
    bookContainer.innerHTML = "";

    console.log("Displaying books:", books.length);

    if (!books || books.length === 0) {
        bookContainer.innerHTML = "<p>No books found.</p>";
        return;
    }

    books.forEach(book => {
        const bookCard = document.createElement("div");
        bookCard.classList.add("book-card");

        const bookImage = book.book_image || "default-image.jpg";

        bookCard.innerHTML = `
            <img src="${bookImage}" alt="${book.book_name}" class="book-image">
            <div class="book-content">
                <h3>${book.book_name}</h3>
                <p>by ${book.author_name}</p>
                <div class="rating">
                    <span>${book.rating || "N/A"}</span> ★ 
                </div>
                <span class="rating-count">(${book.rating_count || "0"})</span>
                <div class="price-info">
                    <span class="price">Rs. ${book.discounted_price}</span>
                    <span class="old-price">Rs. ${book.book_mrp}</span>
                </div>
                <button onclick="viewBookDetails(${book.id})">Quick View</button>
            </div>
        `;

        bookContainer.appendChild(bookCard);
    });
}

// Update Pagination Controls (unchanged)
function updatePagination(totalPagesFromAPI, currentPageFromAPI) {
    totalPages = totalPagesFromAPI;
    currentPage = currentPageFromAPI;

    const currentPageElement = document.getElementById("current-page");
    const totalPagesElement = document.getElementById("total-pages");

    if (currentPageElement) currentPageElement.textContent = `Page ${currentPage}`;
    if (totalPagesElement) totalPagesElement.textContent = totalPages;

    const prevButton = document.getElementById("prev-page");
    const nextButton = document.getElementById("next-page");

    if (prevButton) prevButton.disabled = currentPage === 1;
    if (nextButton) nextButton.disabled = currentPage >= totalPages || totalPages === 0;
}

// Debounced Fetch Search Suggestions (unchanged)
let debounceTimer;
document.getElementById("search")?.addEventListener("input", (event) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        fetchSearchSuggestions(event.target.value);
    }, 300);
});

// Fetch Search Suggestions (unchanged)
async function fetchSearchSuggestions(query) {
    const suggestionsBox = document.getElementById("search-suggestions");

    if (!suggestionsBox || !query.trim()) {
        if (suggestionsBox) {
            suggestionsBox.innerHTML = "";
            suggestionsBox.classList.remove("visible");
        }
        return;
    }

    try {
        const encodedQuery = encodeURIComponent(query);
        const response = await fetch(`${API_BASE_URL}/search_suggestions?query=${encodedQuery}`);
        
        if (!response.ok) throw new Error(`Error ${response.status}: Unable to fetch suggestions`);
        
        const data = await response.json();
        console.log("Search Suggestions:", data);
        displaySuggestions(data.suggestions);
    } catch (error) {
        console.error("Error fetching search suggestions:", error);
    }
}

// Display Search Suggestions (unchanged)
function displaySuggestions(suggestions) {
    const suggestionsBox = document.getElementById("search-suggestions");
    suggestionsBox.innerHTML = "";

    if (!suggestions || suggestions.length === 0) {
        suggestionsBox.innerHTML = "<p>No suggestions found</p>";
        suggestionsBox.classList.remove("visible");
        return;
    }

    suggestionsBox.classList.add("visible");

    suggestions.forEach(suggestion => {
        const item = document.createElement("div");
        item.textContent = `${suggestion.book_name} by ${suggestion.author_name}`;
        item.classList.add("suggestion-item");
        item.style.cursor = "pointer";
        item.addEventListener("click", (event) => {
            event.stopPropagation();
            event.preventDefault();
            console.log("Suggestion clicked:", suggestion);
            if (suggestion.id) viewBookDetails(suggestion.id);
        });
        suggestionsBox.appendChild(item);
    });
}

// Fetch Books by Search Query (unchanged)
async function fetchBooksBySearch(query) {
    const bookContainer = document.getElementById("book-list");
    bookContainer.innerHTML = "<p>Loading search results...</p>";

    try {
        const encodedQuery = encodeURIComponent(query);
        const response = await fetch(`${API_BASE_URL}?query=${encodedQuery}`);
        
        if (!response.ok) throw new Error(`Error ${response.status}: Unable to fetch books`);

        const data = await response.json();
        console.log("Search Results:", data);
        displayBooks(data.books);
    } catch (error) {
        console.error("Error fetching search results:", error);
        bookContainer.innerHTML = "<p>Failed to load search results.</p>";
    }
}

// View Book Details (unchanged)
function viewBookDetails(bookId) {
    console.log("Navigating to book details with ID:", bookId);
    if (bookId) {
        window.location.href = `bookDetails.html?id=${bookId}`;
    } else {
        console.error("Book ID is undefined or invalid");
    }
}

// Pagination Event Listeners (unchanged)
document.getElementById("prev-page")?.addEventListener("click", () => {
    if (currentPage > 1) {
        console.log("Fetching previous page:", currentPage - 1);
        fetchBooks(document.getElementById("sort-books").value, currentPage - 1);
    }
});

document.getElementById("next-page")?.addEventListener("click", () => {
    if (currentPage < totalPages) {
        console.log("Fetching next page:", currentPage + 1);
        fetchBooks(document.getElementById("sort-books").value, currentPage + 1);
    }
});

// Search & Sort Event Listeners (unchanged)
document.getElementById("search")?.addEventListener("keypress", (event) => {
    if (event.key === "Enter") {
        console.log("Search triggered with query:", event.target.value);
        fetchBooksBySearch(event.target.value);
    }
});

document.getElementById("sort-books")?.addEventListener("change", (event) => {
    console.log("Sorting books by:", event.target.value);
    fetchBooks(event.target.value, 1);
});