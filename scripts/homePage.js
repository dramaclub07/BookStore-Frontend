const API_BASE_URL = window.config.API_BASE_URL;; // Backend URL
const PROXY_URL = "http://127.0.0.1:4000/api/v1"; // Proxy URL for local testing
let currentPage = 1;
let totalPages = 1;
const booksPerPage = 12;

// Search dropdown state
let searchDropdown = null;
let isSearchDropdownOpen = false;

// Admin tools modal state
let adminToolsModal = null;
let isAdminToolsModalOpen = false; 

// Edit book modal state
let editBookModal = null;
let isEditBookModalOpen = false;

// Theme constants
const THEME_KEY = "theme";
const LIGHT_MODE = "light";
const DARK_MODE = "dark";

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
                body: JSON.stringify({ refresh_token: refreshToken })
            });
            const data = await response.json();
            if (response.ok && data.access_token) {
                localStorage.setItem("access_token", data.access_token);
                localStorage.setItem("token_expires_in", Date.now() + (data.expires_in * 1000));
                return true;
            }
        } catch (error) {
            console.log(`Subtle refresh failure at ${url}:`, error.message);
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
            try {
                return await fetch(fetchUrl, options);
            } catch (error) {
                console.log(`Subtle unauthenticated fetch error at ${fetchUrl}:`, error.message);
                continue;
            }
        }

        const expiresIn = localStorage.getItem("token_expires_in");
        if (expiresIn && Date.now() >= expiresIn) {
            const refreshed = await refreshAccessToken();
            if (!refreshed) return null;
        }

        options.headers = { ...options.headers, ...getAuthHeaders() };

        try {
            let response = await fetch(fetchUrl, options);
            if (!response.ok && response.status === 401) {
                const refreshed = await refreshAccessToken();
                if (refreshed) {
                    options.headers = { ...options.headers, ...getAuthHeaders() };
                    response = await fetch(fetchUrl, options);
                } else {
                    return null;
                }
            }
            if (response.ok) return response;
        } catch (error) {
            console.log(`Subtle fetch error at ${fetchUrl}:`, error.message);
        }
    }
    return null;
}

// Toggle theme function
function toggleTheme() {
    const currentTheme = localStorage.getItem(THEME_KEY) || LIGHT_MODE;
    const newTheme = currentTheme === LIGHT_MODE ? DARK_MODE : LIGHT_MODE;
    document.body.classList.toggle(DARK_MODE, newTheme === DARK_MODE);
    localStorage.setItem(THEME_KEY, newTheme);
}

// DOMContentLoaded Event and other functions remain unchanged up to fetchBooks
document.addEventListener("DOMContentLoaded", async () => {
    const isLoggedIn = isAuthenticated();
    const userIsAdmin = isAdmin();

    if (userIsAdmin) {
        document.querySelector(".admin-actions").style.display = "block";
        document.getElementById("admin-tools-link").style.display = "inline-flex";
        const cartLink = document.getElementById("cart-link");
        if (cartLink) cartLink.style.display = "none";
    } else {
        const cartLink = document.getElementById("cart-link");
        if (cartLink) cartLink.style.display = "inline-flex";
    }

    const sortBooks = document.getElementById("sort-books");
    const initialSortOption = sortBooks?.value || "relevance";

    if (localStorage.getItem("justLoggedIn") === "true") {
        localStorage.removeItem("justLoggedIn");
        fetchBooks(initialSortOption, 1, true);
    } else if (localStorage.getItem("reviewSubmitted") === "true") {
        localStorage.removeItem("reviewSubmitted");
        fetchBooks(initialSortOption, 1, true);
    } else if (localStorage.getItem("bookAdded") === "true") {
        localStorage.removeItem("bookAdded");
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
    const adminToolsLink = document.getElementById("admin-tools-link");

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

    if (adminToolsLink && userIsAdmin) {
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

    const addBookBtn = document.getElementById("add-book-btn");
    if (addBookBtn && userIsAdmin) {
        addBookBtn.addEventListener("click", () => {
            window.location.href = "../pages/addBook.html";
        });
    }

    if (userIsAdmin) {
        editBookModal = document.getElementById("edit-book-modal");
        if (editBookModal) {
            const closeBtn = editBookModal.querySelector(".close-btn");
            const editBookForm = document.getElementById("edit-book-form");

            if (closeBtn) {
                closeBtn.addEventListener("click", (event) => {
                    event.stopPropagation();
                    closeEditBookModal();
                });
            }
            if (editBookForm) {
                editBookForm.addEventListener("submit", async (event) => {
                    event.preventDefault();
                    const bookId = editBookForm.dataset.bookId;
                    await updateBook(bookId);
                });
            }
            document.addEventListener("click", (event) => {
                if (
                    isEditBookModalOpen &&
                    !editBookModal.querySelector(".modal-content").contains(event.target) &&
                    !event.target.classList.contains("edit-book") &&
                    !event.target.closest(".edit-book")
                ) {
                    closeEditBookModal();
                }
            });
        }
    }

    const searchInput = document.getElementById("search");
    if (searchInput) {
        const debounce = (func, delay) => {
            let timeoutId;
            return (...args) => {
                clearTimeout(timeoutId);
                timeoutId = setTimeout(() => func(...args), delay);
            };
        };

        searchInput.addEventListener("input", debounce(async (event) => {
            const query = event.target.value.trim();
            if (query.length < 2) {
                closeSearchDropdown();
                return;
            }
            await fetchSearchSuggestions(query);
        }, 300));

        searchInput.addEventListener("keypress", (event) => {
            if (event.key === "Enter") {
                const query = event.target.value.trim();
                if (query) {
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
                closeSearchDropdown();
            }
        });
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
        const response = await fetchWithAuth(`${API_BASE_URL}users/profile`);
        if (!response) return;

        if (!response.ok) throw new Error(`Profile fetch failed with status: ${response.status}`);
        const userData = await response.json();
        const username = userData.name || "User";
        profileNameElement.textContent = username;
        localStorage.setItem("username", username);
        localStorage.setItem("user_role", userData.role || "user");
    } catch (error) {
        profileNameElement.textContent = localStorage.getItem("username") || "User";
    }
}

async function updateCartCount() {
    const cartCountElement = document.querySelector("#cart-link .cart-count");
    if (!cartCountElement) return;

    const isLoggedIn = isAuthenticated();
    if (!isLoggedIn) {
        cartCountElement.textContent = "0";
        cartCountElement.style.display = "none";
        return;
    }

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}carts`);
        if (!response) return;

        if (!response.ok) throw new Error("Failed to fetch cart");
        const data = await response.json();

        const cartItems = data.cart || data.cart_items || [];
        const totalItems = cartItems.reduce((sum, item) => sum + (item.quantity || 1), 0) || 0;
        cartCountElement.textContent = totalItems;
        cartCountElement.style.display = totalItems > 0 ? "flex" : "none";
    } catch (error) {
        cartCountElement.textContent = "0";
        cartCountElement.style.display = "none";
    }
}

async function handleSignOut() {
    const provider = localStorage.getItem("socialProvider");
    const homePath = "../pages/homePage.html";

    try {
        await fetchWithAuth(`${API_BASE_URL}logout`, {
            method: "POST",
            headers: getAuthHeaders()
        });
    } catch (error) {}

    try {
        if (provider === "google" && typeof google !== "undefined" && google.accounts) {
            google.accounts.id.disableAutoSelect();
            await new Promise((resolve) => {
                google.accounts.id.revoke(localStorage.getItem("socialEmail") || "", () => resolve());
            });
        } else if (provider === "facebook" && typeof FB !== "undefined") {
            await new Promise((resolve) => {
                FB.getLoginStatus(function (response) {
                    if (response.status === "connected") {
                        FB.logout(function () { resolve(); });
                    } else {
                        resolve();
                    }
                });
            });
        }

        localStorage.clear();
        window.location.replace(homePath);
        setTimeout(() => {
            if (!window.location.pathname.includes("homePage.html")) {
                window.location.href = homePath;
            }
            alert("Logged out successfully.");
        }, 500);
    } catch (error) {
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
        console.log("Subtle note: Book container not found");
        return;
    }

    bookContainer.innerHTML = "";
    if (bookLoader) bookLoader.style.display = "block";
    if (prevButton) prevButton.disabled = true;
    if (nextButton) nextButton.disabled = true;

    try {
        const searchQuery = new URLSearchParams(window.location.search).get("query") || "";
        let url = `${API_BASE_URL}books?page=${page}&per_page=${booksPerPage}&sort=${sortBy}&force_refresh=${forceRefresh}`;
        if (searchQuery) url = `${API_BASE_URL}books/search?page=${page}&per_page=${booksPerPage}&sort=${sortBy}&query=${encodeURIComponent(searchQuery)}&force_refresh=${forceRefresh}`;

        console.log("Subtly fetching books from:", url);
        const response = await fetchWithAuth(url, { method: "GET" });
        if (!response) {
            console.log("Subtle note: No response received");
            bookContainer.innerHTML = "<p>No books loaded. Please try again.</p>";
            return;
        }

        const data = await response.json();
        console.log("Subtle data received:", data.books.length, "books");

        if (!response.ok) {
            throw new Error(`HTTP Error ${response.status}: ${data.error || "Unknown error"}`);
        }

        let books = data.books || [];
        if (!books.length) {
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
        console.log("Subtle fetchBooks error:", error.message);
        bookContainer.innerHTML = "<p>Failed to load books. Please try again.</p>";
    } finally {
        if (bookLoader) bookLoader.style.display = "none";
        if (prevButton) prevButton.disabled = currentPage === 1;
        if (nextButton) nextButton.disabled = currentPage >= totalPages;
    }
}

function displayBooks(books) {
    const bookContainer = document.getElementById("book-list");
    if (!bookContainer) return;

    bookContainer.innerHTML = "";

    if (!books || books.length === 0) {
        bookContainer.innerHTML = "<p>No books found.</p>";
        return;
    }

    const userIsAdmin = isAdmin();

    books.forEach(book => {
        const bookCard = document.createElement("div");
        bookCard.classList.add("book-card");

        const bookImage = book.book_image || "default-image.jpg";
        const isOutOfStock = book.quantity === 0;

        let adminButtons = '';
        if (userIsAdmin) {
            adminButtons = `
                <div class="admin-buttons">
                    <button class="edit-book" data-id="${book.id}" title="Edit Book">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="delete-book" data-id="${book.id}" title="Delete Book">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
        }

        const outOfStockBanner = isOutOfStock
            ? `<div class="out-of-stock-banner">Out of Stock</div>`
            : '';

        bookCard.innerHTML = `
            ${outOfStockBanner}
            <img src="${bookImage}" alt="${book.book_name}" class="book-image">
            <button class="quick-view" data-id="${book.id}" ${isOutOfStock ? 'disabled' : ''}>Quick View</button>
            ${adminButtons}
            <div class="book-content">
                <h3>${book.book_name}</h3>
                <p>${book.author_name}</p>
                <div>
                    <span class="rating">★ ${book.rating || "0.0"}</span>
                    <span class="rating-count">(${book.rating_count || "0"})</span>
                </div>
                <div class="price-info">
                    <span class="price">Rs. ${book.discounted_price || 0}</span>
                    <span class="old-price">Rs. ${book.book_mrp || 0}</span>
                </div>
            </div>
        `;

        bookContainer.appendChild(bookCard);

        const quickViewButton = bookCard.querySelector(".quick-view");
        if (quickViewButton) {
            quickViewButton.addEventListener("click", () => {
                if (!isOutOfStock) viewBookDetails(book.id);
            });
        }

        if (userIsAdmin) {
            const editButton = bookCard.querySelector(".edit-book");
            const deleteButton = bookCard.querySelector(".delete-book");

            if (editButton) {
                editButton.addEventListener("click", async () => {
                    await openEditBookModal(book.id);
                });
            }

            if (deleteButton) {
                deleteButton.addEventListener("click", async () => {
                    if (confirm(`Are you sure you want to delete "${book.book_name}"?`)) {
                        await deleteBook(book.id);
                    }
                });
            }
        }
    });
}

async function openEditBookModal(bookId) {
    editBookModal = document.getElementById("edit-book-modal");
    if (!editBookModal) return;

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}books/${bookId}`);
        if (!response) return;

        if (!response.ok) throw new Error(`Error ${response.status}: Unable to fetch book details`);
        const book = await response.json();

        document.getElementById("edit-book-name").value = book.book_name || "";
        document.getElementById("edit-author-name").value = book.author_name || "";
        document.getElementById("edit-discounted-price").value = book.discounted_price || "";
        document.getElementById("edit-book-mrp").value = book.book_mrp || "";
        document.getElementById("edit-description").value = book.description || "";
        document.getElementById("edit-book-image").value = book.book_image || "";

        const editBookForm = document.getElementById("edit-book-form");
        editBookForm.dataset.bookId = bookId;

        editBookModal.style.display = "flex";
        isEditBookModalOpen = true;
    } catch (error) {
        alert("Failed to load book details for editing.");
    }
}

function closeEditBookModal() {
    if (editBookModal) editBookModal.style.display = "none";
    isEditBookModalOpen = false;
}

async function updateBook(bookId) {
    const bookData = {
        book_name: document.getElementById("edit-book-name").value,
        author_name: document.getElementById("edit-author-name").value,
        discounted_price: parseFloat(document.getElementById("edit-discounted-price").value),
        book_mrp: parseFloat(document.getElementById("edit-book-mrp").value),
        description: document.getElementById("edit-description").value,
        book_image: document.getElementById("edit-book-image").value || null
    };

    try {
        const response = await fetchWithAuth(`${API_BASE_URL}books/${bookId}`, {
            method: "PUT",
            body: JSON.stringify(bookData)
        });

        if (!response) return;
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Failed to update book");
        }

        alert("Book updated successfully!");
        closeEditBookModal();
        fetchBooks(document.getElementById("sort-books").value, currentPage, true);
    } catch (error) {
        alert(`Failed to update book: ${error.message}`);
    }
}

async function deleteBook(bookId) {
    try {
        const response = await fetchWithAuth(`${API_BASE_URL}books/${bookId}`, {
            method: "DELETE"
        });

        if (!response) {
            alert("Failed to delete book. Please try again.");
            return;
        }

        if (response.ok) {
            alert("Book deleted successfully!");
            fetchBooks(document.getElementById("sort-books").value, currentPage, true);
        } else {
            const errorData = await response.json();
            alert(`Failed to delete book: ${errorData.error || "Unknown error"}`);
        }
    } catch (error) {
        alert("Failed to delete book. Please try again.");
    }
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
    if (bookId) window.location.href = `../pages/bookDetails.html?id=${bookId}`;
}

async function fetchSearchSuggestions(query) {
    try {
        const url = `${API_BASE_URL}books/search_suggestions?query=${encodeURIComponent(query)}`;
        const response = await fetchWithAuth(url, { method: "GET" });
        if (!response) return;

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP Error ${response.status}: ${errorText}`);
        }

        const data = await response.json();

        let suggestions = (data.suggestions || []).map(suggestion => ({
            id: suggestion.id,
            book_name: suggestion.book_name,
            author_name: suggestion.author_name
        }));

        displaySearchSuggestions(suggestions);
    } catch (error) {
        closeSearchDropdown();
    }
}

function displaySearchSuggestions(suggestions) {
    const searchInput = document.getElementById("search");
    if (!searchInput) return;

    closeSearchDropdown();

    if (!suggestions || suggestions.length === 0) return;

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
            searchInput.value = suggestion.book_name;
            closeSearchDropdown();
            if (suggestion.id) {
                window.location.href = `../pages/bookDetails.html?id=${suggestion.id}`;
            } else {
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
        searchDropdown.remove();
        searchDropdown = null;
    }
    isSearchDropdownOpen = false;
}

document.getElementById("prev-page")?.addEventListener("click", () => {
    if (currentPage > 1) {
        fetchBooks(document.getElementById("sort-books").value, currentPage - 1);
    }
});

document.getElementById("next-page")?.addEventListener("click", () => {
    if (currentPage < totalPages) {
        fetchBooks(document.getElementById("sort-books").value, currentPage + 1);
    }
});

document.getElementById("sort-books")?.addEventListener("change", (event) => {
    fetchBooks(event.target.value, 1);
});