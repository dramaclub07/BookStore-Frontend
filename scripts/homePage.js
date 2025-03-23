document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM fully loaded, initializing homepage...");

    // Check for refresh triggers (e.g., after login or review submission)
    const sortBooks = document.getElementById("sort-books");
    const initialSortOption = sortBooks?.value || "relevance";

    if (localStorage.getItem("justLoggedIn") === "true") {
        console.log("User just logged in, forcing refresh of books...");
        localStorage.removeItem("justLoggedIn");
        fetchBooks(initialSortOption, 1, true);
    } else if (localStorage.getItem("reviewSubmitted") === "true") {
        console.log("Review submitted previously, forcing refresh of books...");
        localStorage.removeItem("reviewSubmitted");
        fetchBooks(initialSortOption, 1, true);
    } else {
        fetchBooks(initialSortOption, 1);
    }

    // Update cart count on page load
    updateCartCount();

    // Set up username in the navbar
    const usernameElement = document.getElementById("username");
    const dropdownUsernameElement = document.getElementById("dropdown-username");
    const username = localStorage.getItem("username") || "User";
    if (usernameElement) {
        usernameElement.textContent = username;
    }
    if (dropdownUsernameElement) {
        dropdownUsernameElement.textContent = `Hello, ${username}`;
    }

    // Dropdown menu state and event listeners
    let isDropdownOpen = false;
    const profileLink = document.getElementById("profile-link");
    const dropdownMenu = document.getElementById("profile-dropdown");

    if (profileLink) {
        profileLink.addEventListener("click", (event) => {
            event.preventDefault(); // Prevent default link behavior
            console.log("Profile link clicked, toggling dropdown");

            // Toggle dropdown visibility
            if (isDropdownOpen) {
                closeDropdown();
            } else {
                openDropdown();
            }
        });

        // Close dropdown if clicking outside
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

    // Cart link navigation
    const cartLink = document.getElementById("cart-link");
    if (cartLink) {
        cartLink.addEventListener("click", () => {
            console.log("Redirecting to cart page");
            window.location.href = "../pages/cart.html";
        });
    }

    // Function to open the dropdown
    function openDropdown() {
        if (dropdownMenu) {
            dropdownMenu.style.display = "block";
            isDropdownOpen = true;
        }
    }

    // Function to close the dropdown
    function closeDropdown() {
        if (dropdownMenu) {
            dropdownMenu.style.display = "none";
            isDropdownOpen = false;
        }
    }
});

// Sign Out (Logout) functionality
function handleSignOut() {
    console.log("Logging out...");
    const provider = localStorage.getItem("socialProvider");

    // Revoke Google session if applicable
    if (provider === "google" && typeof google !== "undefined" && google.accounts) {
        console.log("Logging out from Google");
        google.accounts.id.disableAutoSelect();
        google.accounts.id.revoke(localStorage.getItem("socialEmail") || "", () => {
            console.log("Google session revoked");
        });
    }

    // Revoke Facebook session if applicable
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

    // Clear localStorage
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    localStorage.removeItem("socialEmail");
    localStorage.removeItem("socialProvider");
    localStorage.removeItem("justLoggedIn");

    // Hide the sign-out container (optional, since we're redirecting)
    const signoutContainer = document.getElementById("signout-container");
    if (signoutContainer) {
        signoutContainer.style.display = "none";
    }

    alert("Logged out successfully.");
    window.location.href = "../pages/login.html"; // Redirect to login page
}

// API Base URL and Pagination Settings
const API_BASE_URL = "http://127.0.0.1:3000/api/v1";
let currentPage = 1;
let totalPages = 1;
const booksPerPage = 12;

// Fetch Books with Sorting, Pagination, and Optional Force Refresh
async function fetchBooks(sortBy = "relevance", page = 1, forceRefresh = false) {
    const bookContainer = document.getElementById("book-list");
    const bookLoader = document.getElementById("book-loader");
    const prevButton = document.getElementById("prev-page");
    const nextButton = document.getElementById("next-page");
    const totalBooksElement = document.getElementById("total-books");

    if (!bookContainer) {
        console.error("Error: 'book-list' element not found in the DOM.");
        return;
    }

    // Show loader while fetching books
    bookContainer.innerHTML = ""; // Clear previous content
    if (bookLoader) bookLoader.style.display = "block"; // Show loader
    if (prevButton) prevButton.disabled = true;
    if (nextButton) nextButton.disabled = true;

    try {
        // Construct the API URL with query parameters
        const searchQuery = new URLSearchParams(window.location.search).get("query") || "";
        let url = `${API_BASE_URL}/books?page=${page}&per_page=${booksPerPage}&sort=${sortBy}&force_refresh=${forceRefresh}`;
        if (searchQuery) url += `&query=${encodeURIComponent(searchQuery)}`;
        console.log("Fetching books from:", url);

        // Add authentication token to the request if available
        const token = localStorage.getItem("token");
        const headers = {
            "Content-Type": "application/json",
        };
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
            console.log("Including Authorization token in request:", token);
        } else {
            console.log("No token found in localStorage, proceeding without Authorization.");
        }

        const response = await fetch(url, {
            method: "GET",
            headers: headers,
        });
        console.log("Response status:", response.status);
        console.log("Response headers:", response.headers);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP Error ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log("API Response:", data);
        console.log("Books with ratings:", data.books?.map(b => ({ name: b.book_name, rating: b.rating, rating_count: b.rating_count })));

        if (!data.success || !data.books || data.books.length === 0) {
            console.warn("No books returned from API.");
            bookContainer.innerHTML = "<p>No books found.</p>";
            updatePagination(1, 1);
            if (totalBooksElement) totalBooksElement.textContent = "0";
            return;
        }

        console.log("Sample books:", data.books.slice(0, 3));
        displayBooks(data.books);

        const totalBooks = data.pagination?.total_count || 0;
        totalPages = data.pagination?.total_pages || 1;
        currentPage = page;

        if (totalBooksElement) totalBooksElement.textContent = totalBooks;
        updatePagination(totalPages, currentPage);
    } catch (error) {
        console.error("Error fetching books:", error.message);
        bookContainer.innerHTML = "<p>Failed to load books. Please try again.</p>";
    } finally {
        // Hide loader after fetching books
        if (bookLoader) bookLoader.style.display = "none";
        if (prevButton) prevButton.disabled = currentPage === 1;
        if (nextButton) nextButton.disabled = currentPage >= totalPages;
    }
}

// Display Books with Quick View Button Only
function displayBooks(books) {
    const bookContainer = document.getElementById("book-list");
    if (!bookContainer) {
        console.error("Error: 'book-list' element not found in the DOM.");
        return;
    }

    bookContainer.innerHTML = ""; // Clear previous books
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
            <button class="quick-view" data-id="${book.id}">Quick View</button>
            <div class="book-content">
                <h3>${book.book_name}</h3>
                <p>${book.author_name}</p>
                <div>
                    <span class="rating">★ ${book.rating || "0.0"}</span>
                    <span class="rating-count">(${book.rating_count || "0"})</span>
                </div>
                <div class="price-info">
                    <span class="price">Rs. ${book.discounted_price}</span>
                    <span class="old-price">Rs. ${book.book_mrp}</span>
                </div>
            </div>
        `;

        bookContainer.appendChild(bookCard);

        // Add event listener for Quick View button
        bookCard.querySelector(".quick-view").addEventListener("click", () => {
            viewBookDetails(book.id);
        });
    });
}

// Update Pagination UI
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
    if (nextButton) prevButton.disabled = currentPage >= totalPages || totalPages === 0;
}

// Debounce Search Input
let debounceTimer;
document.getElementById("search")?.addEventListener("input", (event) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        fetchSearchSuggestions(event.target.value);
    }, 300);
});

// Fetch Search Suggestions
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
        const response = await fetch(`${API_BASE_URL}/books/search_suggestions?query=${encodedQuery}`);
        
        if (!response.ok) throw new Error(`Error ${response.status}: Unable to fetch suggestions`);
        
        const data = await response.json();
        console.log("Search Suggestions:", data);
        displaySuggestions(data.suggestions);
    } catch (error) {
        console.error("Error fetching search suggestions:", error);
        if (suggestionsBox) {
            suggestionsBox.innerHTML = "<p>Failed to load suggestions.</p>";
        }
    }
}

// Display Search Suggestions
function displaySuggestions(suggestions) {
    const suggestionsBox = document.getElementById("search-suggestions");
    if (!suggestionsBox) return;

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

// Fetch Books by Search Query
async function fetchBooksBySearch(query) {
    const bookContainer = document.getElementById("book-list");
    const bookLoader = document.getElementById("book-loader");
    if (!bookContainer) return;

    // Show loader while fetching search results
    bookContainer.innerHTML = "";
    if (bookLoader) bookLoader.style.display = "block";

    try {
        const encodedQuery = encodeURIComponent(query);
        const response = await fetch(`${API_BASE_URL}/books?query=${encodedQuery}`);
        
        if (!response.ok) throw new Error(`Error ${response.status}: Unable to fetch books`);

        const data = await response.json();
        console.log("Search Results:", data);
        displayBooks(data.books || []);
        const totalBooks = data.pagination?.total_count || 0;
        totalPages = data.pagination?.total_pages || 1;
        currentPage = 1;

        const totalBooksElement = document.getElementById("total-books");
        if (totalBooksElement) totalBooksElement.textContent = totalBooks;
        updatePagination(totalPages, currentPage);
    } catch (error) {
        console.error("Error fetching search results:", error);
        bookContainer.innerHTML = "<p>Failed to load search results.</p>";
    } finally {
        if (bookLoader) bookLoader.style.display = "none";
    }
}

// Navigate to Book Details Page
function viewBookDetails(bookId) {
    console.log("Navigating to book details with ID:", bookId);
    if (bookId) {
        window.location.href = `../pages/bookDetails.html?id=${bookId}`;
    } else {
        console.error("Book ID is undefined or invalid");
    }
}

// Update Cart Count
async function updateCartCount() {
    const cartCountElement = document.getElementById("cart-count");
    if (!cartCountElement) return;

    if (!isAuthenticated()) {
        cartCountElement.textContent = "0";
        return;
    }

    try {
        const token = getAuthToken();
        const response = await fetch(`${API_BASE_URL}/cart`, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error("Failed to fetch cart");
        const cart = await response.json();
        const totalItems = cart.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
        cartCountElement.textContent = totalItems;
    } catch (error) {
        console.error("Error fetching cart count:", error);
        cartCountElement.textContent = "0";
    }
}

// Authentication Functions
function isAuthenticated() {
    const token = localStorage.getItem("token");
    return token !== null;
}

function getAuthToken() {
    return localStorage.getItem("token") || "";
}

// Event Listeners for Pagination and Sorting
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