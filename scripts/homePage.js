// API Base URL and Pagination Settings
const API_BASE_URL = "http://127.0.0.1:4000/api/v1";
let currentPage = 1;
let totalPages = 1;
const booksPerPage = 12;

// Search dropdown state
let searchDropdown = null;
let isSearchDropdownOpen = false;

// Get auth headers
function getAuthHeaders() {
    const accessToken = localStorage.getItem("access_token");
    return {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`
    };
}

// Authentication Functions
function isAuthenticated() {
    const accessToken = localStorage.getItem("access_token");
    return accessToken !== null;
}

async function refreshAccessToken() {
    const refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken) {
        console.error("No refresh token available");
        return false;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: refreshToken })
        });

        const data = await response.json();
        if (response.ok && data.access_token) {
            localStorage.setItem("access_token", data.access_token);
            localStorage.setItem("token_expires_in", Date.now() + (data.expires_in * 1000));
            console.log("Access token refreshed successfully");
            return true;
        } else {
            console.error("Failed to refresh token:", data.error);
            localStorage.clear();
            alert("Session expired. Please log in again.");
            window.location.href = "../pages/login.html";
            return false;
        }
    } catch (error) {
        console.error("Error refreshing token:", error);
        localStorage.clear();
        window.location.href = "../pages/login.html";
        return false;
    }
}

async function fetchWithAuth(url, options = {}) {
    if (!isAuthenticated()) {
        console.log("User not authenticated, proceeding without auth for public routes");
        return fetch(url, options); // Allow public routes without redirect
    }

    const expiresIn = localStorage.getItem("token_expires_in");
    if (expiresIn && Date.now() >= expiresIn) {
        const refreshed = await refreshAccessToken();
        if (!refreshed) return null;
    }

    options.headers = { ...options.headers, ...getAuthHeaders() };
    let response = await fetch(url, options);

    if (response.status === 401) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
            options.headers = { ...options.headers, ...getAuthHeaders() };
            response = await fetch(url, options);
        } else {
            return null;
        }
    }

    return response;
}

document.addEventListener("DOMContentLoaded", async () => {
    console.log("DOM fully loaded, initializing homepage...");
    console.log("Access Token on load:", localStorage.getItem("access_token"));

    const isLoggedIn = isAuthenticated();

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

    await loadUserProfile();
    await updateCartCount();

    let dropdownMenu = null;
    let isDropdownOpen = false;
    const profileLink = document.getElementById("profile-link");
    const cartLink = document.getElementById("cart-link");

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

    const searchInput = document.getElementById("search");
    if (searchInput) {
        console.log("Search input found, setting up event listeners");
        const debounce = (func, delay) => {
            let timeoutId;
            return (...args) => {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => func(...args), delay);
            };
        };

        searchInput.addEventListener("input", debounce(async (event) => {
            const query = event.target.value.trim();
            console.log("Input event triggered with query:", query);
            if (query.length < 2) {
                console.log("Query too short, closing dropdown");
                closeSearchDropdown();
                return;
            }
            await fetchSearchSuggestions(query);
        }, 300));

        searchInput.addEventListener("keypress", (event) => {
            if (event.key === "Enter") {
                const query = event.target.value.trim();
                if (query) {
                    console.log("Enter pressed, searching for:", query);
                    closeSearchDropdown();
                    window.location.href = `homePage.html?query=${encodeURIComponent(query)}`;
                }
            }
        });

        document.addEventListener("click", (event) => {
            if (
                isSearchDropdownOpen &&
                !searchInput.contains(event.target) &&
                searchDropdown &&
                !searchDropdown.contains(event.target)
            ) {
                console.log("Clicked outside, closing search dropdown");
                closeSearchDropdown();
            }
        });
    } else {
        console.error("Search input not found in DOM");
    }

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
                <div class="dropdown-item"><button id="dropdown-login-signup">LOGIN/SIGNUP</ Schild>
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
                console.log("Logout button clicked");
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
});

async function loadUserProfile() {
    const profileNameElement = document.querySelector(".profile-name");
    const isLoggedIn = isAuthenticated();

    if (!profileNameElement) return;

    if (!isLoggedIn) {
        profileNameElement.textContent = "Profile";
        return;
    }

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}/users/profile`);
        if (!response) return;

        if (!response.ok) throw new Error(`Profile fetch failed with status: ${response.status}`);
        const userData = await response.json();
        const username = userData.name || "User";
        profileNameElement.textContent = username;
        localStorage.setItem("username", username);
    } catch (error) {
        console.error("Profile fetch error:", error.message);
        profileNameElement.textContent = localStorage.getItem("username") || "User";
    }
}

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
        const response = await fetchWithAuth(`${API_BASE_URL}/carts`);
        if (!response) return;

        if (!response.ok) throw new Error("Failed to fetch cart");
        const data = await response.json();
        console.log("Cart API response:", data);

        // Extract the cart array from the response, default to empty array if not present
        const cartItems = data.cart || [];
        const totalItems = cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0) || 0;
        cartCountElement.textContent = totalItems;
        cartCountElement.style.display = totalItems > 0 ? "flex" : "none";
    } catch (error) {
        console.error("Error fetching cart count:", error);
        cartCountElement.textContent = "0";
        cartCountElement.style.display = "none";
    }
}

async function handleSignOut() {
    console.log("=== Starting logout process ===");
    const provider = localStorage.getItem("socialProvider");
    const homePath = "../pages/homePage.html";

    try {
        if (provider === "google" && typeof google !== "undefined" && google.accounts) {
            console.log("Attempting Google logout");
            google.accounts.id.disableAutoSelect();
            await new Promise((resolve) => {
                google.accounts.id.revoke(localStorage.getItem("socialEmail") || "", () => {
                    console.log("Google session revoked");
                    resolve();
                });
            });
        } else if (provider === "facebook" && typeof FB !== "undefined") {
            console.log("Attempting Facebook logout");
            await new Promise((resolve) => {
                FB.getLoginStatus(function (response) {
                    if (response.status === "connected") {
                        FB.logout(function (response) {
                            console.log("Facebook session revoked");
                            resolve();
                        });
                    } else {
                        resolve();
                    }
                });
            });
        }

        console.log("Clearing local storage");
        localStorage.clear();
        
        window.location.replace(homePath);
        setTimeout(() => {
            if (!window.location.pathname.includes("homePage.html")) {
                window.location.href = homePath;
            }
            alert("Logged out successfully.");
        }, 500);
    } catch (error) {
        console.error("Logout error:", error);
        localStorage.clear();
        window.location = homePath;
        alert("Logged out successfully (with error handling)");
    }
}

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

    bookContainer.innerHTML = "";
    if (bookLoader) bookLoader.style.display = "block";
    if (prevButton) prevButton.disabled = true;
    if (nextButton) nextButton.disabled = true;

    try {
        const searchQuery = new URLSearchParams(window.location.search).get("query") || "";
        let url = `${API_BASE_URL}/books?page=${page}&per_page=${booksPerPage}&sort=${sortBy}&force_refresh=${forceRefresh}`;
        if (searchQuery) url = `${API_BASE_URL}/books/search?page=${page}&per_page=${booksPerPage}&sort=${sortBy}&query=${encodeURIComponent(searchQuery)}&force_refresh=${forceRefresh}`;
        console.log("Fetching books from:", url);

        const response = await fetchWithAuth(url, { method: "GET" });
        if (!response) return;

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP Error ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log("API Response:", data);

        let books = [];
        if (searchQuery) {
            books = data.books || [];
        } else {
            books = data.books || [];
        }

        if (!books || books.length === 0) {
            console.warn("No books returned from API.");
            bookContainer.innerHTML = "<p>No books found.</p>";
            updatePagination(1, 1);
            if (totalBooksElement) totalBooksElement.textContent = "0";
            return;
        }

        displayBooks(books);

        const totalBooks = data.pagination?.total_count || books.length;
        totalPages = data.pagination?.total_pages || Math.ceil(totalBooks / booksPerPage);
        currentPage = page;

        if (totalBooksElement) totalBooksElement.textContent = totalBooks;
        updatePagination(totalPages, currentPage);
    } catch (error) {
        console.error("Error fetching books:", error.message);
        bookContainer.innerHTML = "<p>Failed to load books. Please try again.</p>";
    } finally {
        if (bookLoader) bookLoader.style.display = "none";
        if (prevButton) prevButton.disabled = currentPage === 1;
        if (nextButton) nextButton.disabled = currentPage >= totalPages;
    }
}

function displayBooks(books) {
    const bookContainer = document.getElementById("book-list");
    if (!bookContainer) {
        console.error("Error: 'book-list' element not found in the DOM.");
        return;
    }

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

        bookCard.querySelector(".quick-view").addEventListener("click", () => {
            viewBookDetails(book.id);
        });
    });
}

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

function viewBookDetails(bookId) {
    console.log("Navigating to book details with ID:", bookId);
    if (bookId) {
        window.location.href = `../pages/bookDetails.html?id=${bookId}`;
    } else {
        console.error("Book ID is undefined or invalid");
    }
}

async function fetchSearchSuggestions(query) {
    console.log("Fetching suggestions for query:", query);
    try {
        const url = `${API_BASE_URL}/books/search_suggestions?query=${encodeURIComponent(query)}`;
        const response = await fetchWithAuth(url, { method: "GET" });
        if (!response) return;

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP Error ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log("Raw API response:", data);

        let suggestions = [];
        if (data.suggestions && Array.isArray(data.suggestions)) {
            suggestions = data.suggestions.map(suggestion => ({
                id: suggestion.id,
                book_name: suggestion.book_name,
                author_name: suggestion.author_name
            }));
        }

        console.log("Parsed suggestions:", suggestions);
        displaySearchSuggestions(suggestions);
    } catch (error) {
        console.error("Error fetching search suggestions:", error.message);
        closeSearchDropdown();
    }
}

function displaySearchSuggestions(suggestions) {
    const searchInput = document.getElementById("search");
    if (!searchInput) {
        console.error("Search input not found for displaying suggestions");
        return;
    }

    closeSearchDropdown();

    if (!suggestions || suggestions.length === 0) {
        console.log("No suggestions to display");
        return;
    }

    console.log("Displaying suggestions:", suggestions);
    searchDropdown = document.createElement("div");
    searchDropdown.classList.add("search-dropdown-menu");
    searchDropdown.style.position = "absolute";
    searchDropdown.style.top = `${searchInput.offsetTop + searchInput.offsetHeight}px`;
    searchDropdown.style.left = `${searchInput.offsetLeft}px`;
    searchDropdown.style.width = `${searchInput.offsetWidth}px`;

    suggestions.forEach((suggestion) => {
        const suggestionItem = document.createElement("div");
        suggestionItem.classList.add("search-dropdown-item");

        suggestionItem.innerHTML = `
            <div class="suggestion-book-name">${suggestion.book_name}</div>
            <div class="suggestion-author-name">${suggestion.author_name}</div>
        `;

        suggestionItem.addEventListener("click", () => {
            console.log("Suggestion clicked:", suggestion.book_name, "ID:", suggestion.id);
            searchInput.value = suggestion.book_name;
            closeSearchDropdown();
            if (suggestion.id) {
                window.location.href = `../pages/bookDetails.html?id=${suggestion.id}`;
            } else {
                console.warn("No book ID in suggestion, falling back to search");
                window.location.href = `homePage.html?query=${encodeURIComponent(suggestion.book_name)}`;
            }
        });

        searchDropdown.appendChild(suggestionItem);
    });

    searchInput.parentElement.appendChild(searchDropdown);
    isSearchDropdownOpen = true;
}

function closeSearchDropdown() {
    if (searchDropdown) {
        console.log("Closing search dropdown");
        searchDropdown.remove();
        searchDropdown = null;
    }
    isSearchDropdownOpen = false;
}

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

document.getElementById("sort-books")?.addEventListener("change", (event) => {
    console.log("Sorting books by:", event.target.value);
    fetchBooks(event.target.value, 1);
});