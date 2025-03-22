// API Base URL
const API_BASE_URL = 'http://127.0.0.1:3000/api/v1';

document.addEventListener("DOMContentLoaded", () => {
    const profileLink = document.getElementById("profile-link");
    const cartLink = document.getElementById("cart-link");
    const usernameElement = document.querySelector(".username");
    const cartCountElement = document.getElementById("cart-count");

    // Check if user is logged in
    const token = localStorage.getItem("token");
    const isLoggedIn = !!token;
    const username = localStorage.getItem("username") || "User";

    // Set the username in the navbar
    if (usernameElement) {
        usernameElement.textContent = isLoggedIn ? username : "Profile";
    }

    // Dropdown menu state
    let dropdownMenu = null;
    let isDropdownOpen = false;

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

    if (cartLink) {
        cartLink.addEventListener("click", (event) => {
            event.preventDefault();
            if (!isLoggedIn) {
                console.log("User not logged in, redirecting to please login page");
                window.location.href = "pleaseLogin.html";
            } else {
                console.log("Redirecting to cart page");
                window.location.href = "cart.html";
            }
        });
    }

    // Function to open the dropdown
    function openDropdown() {
        if (dropdownMenu) {
            dropdownMenu.remove();
        }

        dropdownMenu = document.createElement("div");
        dropdownMenu.classList.add("profile-dropdown");

        if (isLoggedIn) {
            dropdownMenu.innerHTML = `
                <div class="dropdown-item dropdown-header">Hello ${username},</div>
                <div class="dropdown-item" id="dropdown-profile">
                    <span class="dropdown-icon"><i class="fas fa-user"></i></span>
                    Profile
                </div>
                <div class="dropdown-item" id="dropdown-orders">
                    <span class="dropdown-icon"><i class="fas fa-box"></i></span>
                    My Orders
                </div>
                <div class="dropdown-item" id="dropdown-wishlist">
                    <span class="dropdown-icon"><i class="fas fa-heart"></i></span>
                    My Wishlist
                </div>
                <div class="dropdown-item">
                    <button id="dropdown-logout" class="logout-button">
                        Logout
                    </button>
                </div>
            `;
        } else {
            dropdownMenu.innerHTML = `
                <div class="dropdown-item dropdown-header">Welcome</div>
                <div class="dropdown-item dropdown-subheader">To access account and manage orders</div>
                <div class="dropdown-item">
                    <button id="dropdown-login-signup" class="login-signup-button">LOGIN/SIGNUP</button>
                </div>
                <div class="dropdown-item" id="dropdown-orders">
                    <span class="dropdown-icon"><i class="fas fa-box"></i></span>
                    My Orders
                </div>
                <div class="dropdown-item" id="dropdown-wishlist">
                    <span class="dropdown-icon"><i class="fas fa-heart"></i></span>
                    Wishlist
                </div>
            `;
        }

        profileLink.parentElement.appendChild(dropdownMenu);

        if (isLoggedIn) {
            document.getElementById("dropdown-profile").addEventListener("click", () => {
                console.log("Redirecting to profile page");
                window.location.href = "profile.html";
                closeDropdown();
            });

            document.getElementById("dropdown-orders").addEventListener("click", () => {
                console.log("Redirecting to orders page");
                window.location.href = "orders.html";
                closeDropdown();
            });

            document.getElementById("dropdown-wishlist").addEventListener("click", () => {
                console.log("Redirecting to wishlist page");
                window.location.href = "wishlist.html";
                closeDropdown();
            });

            document.getElementById("dropdown-logout").addEventListener("click", () => {
                console.log("Logging out...");
                localStorage.clear();
                window.location.href = "login.html";
                closeDropdown();
            });
        } else {
            document.getElementById("dropdown-login-signup").addEventListener("click", () => {
                console.log("Redirecting to login page");
                window.location.href = "login.html";
                closeDropdown();
            });

            document.getElementById("dropdown-orders").addEventListener("click", () => {
                console.log("User not logged in, redirecting to please login page");
                window.location.href = "pleaseLogin.html";
                closeDropdown();
            });

            document.getElementById("dropdown-wishlist").addEventListener("click", () => {
                console.log("User not logged in, redirecting to please login page");
                window.location.href = "pleaseLogin.html";
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

    // Search Functionality
    const SEARCH_API_BASE_URL = "http://127.0.0.1:3000/api/v1/books";

    // Debounced Fetch Search Suggestions
    let debounceTimer;
    document.getElementById("search")?.addEventListener("input", (event) => {
        clearTimeout(debounceTimer);
        const query = event.target.value.trim();
        if (query.length < 2) { // Minimum query length to reduce unnecessary requests
            const suggestionsBox = document.getElementById("search-suggestions");
            if (suggestionsBox) {
                suggestionsBox.innerHTML = "";
                suggestionsBox.classList.remove("visible");
            }
            return;
        }
        debounceTimer = setTimeout(() => {
            fetchSearchSuggestions(query);
        }, 300);
    });

    // Fetch Search Suggestions with Error Handling
    async function fetchSearchSuggestions(query) {
        const suggestionsBox = document.getElementById("search-suggestions");
        if (!suggestionsBox) return;

        suggestionsBox.innerHTML = "<div class='suggestion-item'>Loading...</div>";
        suggestionsBox.classList.add("visible");

        try {
            const encodedQuery = encodeURIComponent(query);
            const response = await fetch(`${SEARCH_API_BASE_URL}/search_suggestions?query=${encodedQuery}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error("No suggestions found");
                } else if (response.status === 500) {
                    throw new Error("Server error, please try again later");
                }
                throw new Error(`Error ${response.status}: Unable to fetch suggestions`);
            }

            const data = await response.json();
            console.log("Search Suggestions:", data);
            if (!data.suggestions || data.suggestions.length === 0) {
                suggestionsBox.innerHTML = "<div class='suggestion-item'>No suggestions found</div>";
                return;
            }
            displaySuggestions(data.suggestions);
        } catch (error) {
            console.error("Error fetching search suggestions:", error.message);
            suggestionsBox.innerHTML = `<div class='suggestion-item'>${error.message}</div>`;
        }
    }

    // Display Search Suggestions
    function displaySuggestions(suggestions) {
        const suggestionsBox = document.getElementById("search-suggestions");
        suggestionsBox.innerHTML = "";

        if (!suggestions || suggestions.length === 0) {
            suggestionsBox.innerHTML = "<div class='suggestion-item'>No suggestions found</div>";
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
        try {
            const encodedQuery = encodeURIComponent(query);
            const response = await fetch(`${SEARCH_API_BASE_URL}?query=${encodedQuery}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Error ${response.status}: Unable to fetch books`);
            }

            const data = await response.json();
            console.log("Search Results:", data);
            window.location.href = `homePage.html?query=${encodedQuery}`;
        } catch (error) {
            console.error("Error fetching search results:", error);
        }
    }

    // View Book Details
    function viewBookDetails(bookId) {
        console.log("Navigating to book details with ID:", bookId);
        if (bookId) {
            window.location.href = `bookDetails.html?id=${bookId}`;
        } else {
            console.error("Book ID is undefined or invalid");
        }
    }

    // Search Event Listener
    document.getElementById("search")?.addEventListener("keypress", (event) => {
        if (event.key === "Enter") {
            console.log("Search triggered with query:", event.target.value);
            fetchBooksBySearch(event.target.value);
        }
    });

    // Cart Functionality

    // Get auth headers
    function getAuthHeaders() {
        const token = localStorage.getItem('token');
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        };
    }

    // Update cart count in UI
    function updateCartCount(count) {
        if (cartCountElement) {
            cartCountElement.textContent = count;
        }
    }

    // Fetch and update cart count
    async function loadCartItems() {
        if (!isLoggedIn) {
            updateCartCount(0);
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/cart`, {
                method: 'GET',
                headers: getAuthHeaders()
            });

            if (!response.ok) {
                if (response.status === 401) {
                    console.log("Session expired, redirecting to login.");
                    localStorage.removeItem('token');
                    window.location.href = 'login.html';
                    return;
                }
                throw new Error(`Error ${response.status}: Failed to fetch cart items`);
            }

            const data = await response.json();
            const cartItems = data.cart || [];
            updateCartCount(cartItems.length);
        } catch (error) {
            console.error('Error fetching cart items:', error);
            updateCartCount(0);
        }
    }

    // Initialize cart count on page load
    loadCartItems();
});