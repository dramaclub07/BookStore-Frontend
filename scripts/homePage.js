document.addEventListener("DOMContentLoaded", () => {
    fetchBooks(); // Initial fetch when page loads
});

// Global Variables for Pagination
let currentPage = 1;
let totalPages = 1;
const API_BASE_URL = "http://127.0.0.1:3000/api/v1/books";

// Fetch Books from API
async function fetchBooks(sortBy = "relevance", page = 1) {
    const bookContainer = document.getElementById("book-list");
    const prevButton = document.getElementById("prev-page");
    const nextButton = document.getElementById("next-page");
    const totalBooksElement = document.getElementById("total-books");

    if (!bookContainer) {
        console.error("Error: 'book-list' element not found in the DOM.");
        return;
    }

    // Show loading message & disable pagination buttons
    bookContainer.innerHTML = "<p>Loading books...</p>";
    if (prevButton) prevButton.disabled = true;
    if (nextButton) nextButton.disabled = true;

    try {
        if (!API_BASE_URL) throw new Error("API_BASE_URL is not defined");

        console.log(`Fetching: ${API_BASE_URL}?sort=${sortBy}&page=${page}`);
        const response = await fetch(`${API_BASE_URL}?sort=${sortBy}&page=${page}`);

        if (!response.ok) throw new Error(`Error ${response.status}: Unable to fetch books`);

        const data = await response.json();
        console.log("API Response:", data);

        if (!data.books || data.books.length === 0) {
            bookContainer.innerHTML = "<p>No books found.</p>";
            return;
        }

        displayBooks(data.books);

        // Handle missing pagination data safely
        const totalPages = data.pagination?.total_pages || 1;
        const totalCount = data.pagination?.total_count || 0;

        if (totalBooksElement) totalBooksElement.textContent = totalCount;

        updatePagination(totalPages, page);

        // Enable pagination buttons only when necessary
        if (prevButton) prevButton.disabled = (page === 1);
        if (nextButton) nextButton.disabled = (page >= totalPages);
    } catch (error) {
        console.error("Error fetching books:", error);
        bookContainer.innerHTML = "<p>Failed to load books. Please try again.</p>";
    }
}


// Display Books on the Page
function displayBooks(books) {
    const bookContainer = document.getElementById("book-list");
    bookContainer.innerHTML = "";

    console.log("Books received:", books);

    if (!books || books.length === 0) {
        bookContainer.innerHTML = "<p>No books found.</p>";
        return;
    }

    books.forEach(book => {
        const bookCard = document.createElement("div");
        bookCard.classList.add("book-card");

        const bookImage = book.book_image || "default-image.jpg"; // Fallback image

        bookCard.innerHTML = `
            <img src="${bookImage}" alt="${book.book_name}" class="book-image">
            <div class="book-content">
                <h3>${book.book_name}</h3>
                <p>by ${book.author_name}</p>
                <div class="rating">
                    <span>${book.rating}</span> ★
                </div>
                <span class="rating-count">(${book.rating_count})</span>
                <div class="price-info">
                    <span class="price">Rs. ${book.discounted_price}</span>
                    <span class="old-price">Rs. ${book.book_mrp}</span>
                </div>
                <button onclick="viewBookDetails(${book.id})">View Details</button>
            </div>
        `;

        bookContainer.appendChild(bookCard);
    });
}


// Update Pagination Controls
function updatePagination(totalPagesFromAPI, currentPageFromAPI) {
    totalPages = totalPagesFromAPI;
    currentPage = currentPageFromAPI;

    document.getElementById("current-page").textContent = `Page ${currentPage}`;
    document.getElementById("total-pages").textContent = totalPages;

    document.getElementById("prev-page").disabled = (currentPage === 1);
    document.getElementById("next-page").disabled = (currentPage === totalPages || totalPages === 0);
}

// Debounced Fetch Search Suggestions
let debounceTimer;
document.getElementById("search").addEventListener("input", (event) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        fetchSearchSuggestions(event.target.value);
    }, 300);
});

// Fetch Search Suggestions
async function fetchSearchSuggestions(query) {
    const suggestionsBox = document.getElementById("search-suggestions");

    if (!query.trim()) {
        suggestionsBox.innerHTML = "";
        return;
    }

    try {
        const encodedQuery = encodeURIComponent(query);
        const response = await fetch(`${API_BASE_URL}/search_suggestions?query=${encodedQuery}`);
        
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
    const encodedQuery = encodeURIComponent(query);
    
    try {
        console.log(`Searching: ${API_BASE_URL}?query=${encodedQuery}`);
        const response = await fetch(`${API_BASE_URL}?query=${encodedQuery}`);
        
        if (!response.ok) throw new Error(`Error ${response.status}: Unable to fetch books`);

        const data = await response.json();
        console.log("Search API Response:", data);
        displayBooks(data.books);
    } catch (error) {
        console.error("Error fetching search results:", error);
    }
}

// View Book Details
function viewBookDetails(bookId) {
    window.location.href = `bookDetails.html?id=${bookId}`;
}

// Pagination Event Listeners
document.getElementById("prev-page").addEventListener("click", () => {
    if (currentPage > 1) {
        fetchBooks(document.getElementById("sort-books").value, currentPage - 1);
    }
});

document.getElementById("next-page").addEventListener("click", () => {
    if (currentPage < totalPages) {
        fetchBooks(document.getElementById("sort-books").value, currentPage + 1);
    }
});

// Search & Sort Event Listeners
document.getElementById("search").addEventListener("keypress", (event) => {
    if (event.key === "Enter") fetchBooksBySearch(event.target.value);
});

document.getElementById("sort-books").addEventListener("change", (event) => {
    fetchBooks(event.target.value, 1);
});
