// API Base URL and Pagination Settings
const API_BASE_URL = "http://127.0.0.1:3000/api/v1";
let currentPage = 1;
let totalPages = 1;
const booksPerPage = 12;

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

document.addEventListener("DOMContentLoaded", async () => {
    console.log("DOM fully loaded, initializing homepage...");
    console.log("Token on load:", localStorage.getItem("token"));

    // No redirect here; allow unauthenticated users to browse books
    const isLoggedIn = isAuthenticated();

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

    // Load user profile and cart count
    await loadUserProfile();
    await updateCartCount();

    // Dropdown menu state and event listeners
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

    // Simplified search redirect (no fetch)
    document.getElementById("search")?.addEventListener("keypress", (event) => {
        if (event.key === "Enter") {
            const query = event.target.value.trim();
            if (query) {
                console.log("Search triggered with query:", query);
                window.location.href = `homePage.html?query=${encodeURIComponent(query)}`;
            }
        }
    });

    // Function to open the dropdown
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

    // Function to close the dropdown
    function closeDropdown() {
        if (dropdownMenu) {
            dropdownMenu.remove();
            dropdownMenu = null;
        }
        isDropdownOpen = false;
    }
});

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
            localStorage.setItem("username", username); // Update localStorage
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
        cartCountElement.style.display = totalItems > 0 ? "flex" : "none"; // Show/hide based on count
    } catch (error) {
        console.error("Error fetching cart count:", error);
        cartCountElement.textContent = "0";
        cartCountElement.style.display = "none";
    }
}

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
    localStorage.clear(); // Consistent with navbar.js
    alert("Logged out successfully.");
    window.location.href = "../pages/login.html"; // Redirect to login page
}

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

        const response = await fetch(url, {
            method: "GET",
            headers: getAuthHeaders(),
        });
        console.log("Response status:", response.status);
        console.log("Response headers:", response.headers);

        if (!response.ok) {
            if (response.status === 401) {
                alert("Session expired. Please log in again.");
                localStorage.removeItem("token");
                window.location.href = "../pages/login.html";
                return;
            }
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
    if (nextButton) nextButton.disabled = currentPage >= totalPages || totalPages === 0;
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

document.getElementById("sort-books")?.addEventListener("change", (event) => {
    console.log("Sorting books by:", event.target.value);
    fetchBooks(event.target.value, 1);
});