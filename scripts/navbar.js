// navbar.js
document.addEventListener("DOMContentLoaded", () => {
    const profileLink = document.getElementById("profile-link");
    const cartLink = document.getElementById("cart-link");
    const usernameElement = document.querySelector(".username");

    // Set the username in the navbar
    const username = localStorage.getItem("username") || "User";
    if (usernameElement) {
        usernameElement.textContent = username;
    }

    // Dropdown menu state
    let dropdownMenu = null;
    let isDropdownOpen = false;

    if (profileLink) {
        profileLink.addEventListener("click", (event) => {
            event.preventDefault();
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

    if (cartLink) {
        cartLink.addEventListener("click", () => {
            console.log("Redirecting to cart page");
            window.location.href = "cart.html";
        });
    }

    // Function to open the dropdown
    function openDropdown() {
        // If dropdown already exists, remove it first
        if (dropdownMenu) {
            dropdownMenu.remove();
        }

        // Create dropdown menu
        dropdownMenu = document.createElement("div");
        dropdownMenu.classList.add("profile-dropdown");

        // Dropdown content
        dropdownMenu.innerHTML = `
            <div class="dropdown-item dropdown-header">Hello ${username},</div>
            <div class="dropdown-item" id="dropdown-profile">Profile</div>
            <div class="dropdown-item" id="dropdown-orders">My Orders</div>
            <div class="dropdown-item" id="dropdown-wishlist">My Wishlist</div>
            <div class="dropdown-item">
                <button id="dropdown-logout" class="logout-button">Logout</button>
            </div>
        `;

        // Append dropdown to the profile link's parent
        profileLink.parentElement.appendChild(dropdownMenu);

        // Add event listeners to dropdown items
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
    const API_BASE_URL = "http://127.0.0.1:3000/api/v1/books";

    // Debounced Fetch Search Suggestions
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
            const response = await fetch(`${API_BASE_URL}/search_suggestions?query=${encodedQuery}`);
            
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
            const response = await fetch(`${API_BASE_URL}?query=${encodedQuery}`);
            
            if (!response.ok) throw new Error(`Error ${response.status}: Unable to fetch books`);

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
});