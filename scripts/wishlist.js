const API_BASE_URL = 'http://127.0.0.1:3000/api/v1';

document.addEventListener("DOMContentLoaded", function () {
    const wishlistContainer = document.getElementById("wishlist-container");
    const wishlistCountElement = document.getElementById("wishlist-count");

    const token = localStorage.getItem("token");
    if (!token) {
        window.location.href = "../pages/login.html";
        return;
    }

    // Initial fetches
    loadUserProfile();
    loadCartSummary();
    fetchWishlist();
    setupHeaderEventListeners();

    function getAuthHeaders() {
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };
    }

    async function loadUserProfile() {
        try {
            const response = await fetch(`${API_BASE_URL}/users/profile`, {
                headers: getAuthHeaders()
            });
            if (!response.ok) {
                if (response.status === 401) {
                    alert("Session expired. Please log in again.");
                    localStorage.removeItem('token');
                    window.location.href = '../pages/login.html';
                    return;
                }
                throw new Error(`Profile fetch failed with status: ${response.status}`);
            }
            const userData = await response.json();
            if (userData.success) {
                const profileElement = document.getElementById('profile-link');
                if (profileElement) {
                    profileElement.innerHTML = `<i class="fa-solid fa-user"></i> <span class="profile-name">${userData.name || 'User'}</span>`;
                    localStorage.setItem('username', userData.name || 'User');
                }
            }
        } catch (error) {
            console.error("Profile fetch error:", error.message);
        }
    }

    function updateCartCount(count) {
        const cartCount = document.querySelector('#cart-link .cart-count');
        if (cartCount) {
            cartCount.textContent = count;
            cartCount.style.display = count > 0 ? "flex" : "none";
        }
    }

    async function loadCartSummary() {
        try {
            const response = await fetch(`${API_BASE_URL}/cart/summary`, {
                headers: getAuthHeaders()
            });

            if (!response.ok) {
                if (response.status === 401) {
                    alert("Session expired. Please log in again.");
                    localStorage.removeItem('token');
                    window.location.href = '../pages/login.html';
                    return;
                }
                throw new Error("Failed to fetch cart summary");
            }

            const cartData = await response.json();
            updateCartCount(cartData.total_items || 0);
        } catch (error) {
            console.error("Error fetching cart summary:", error);
        }
    }

    function fetchWishlist() {
        fetch(`${API_BASE_URL}/wishlists/fetch`, {
            headers: getAuthHeaders()
        })
            .then(response => {
                if (!response.ok) {
                    if (response.status === 401) {
                        alert("Session expired. Please log in again.");
                        localStorage.removeItem('token');
                        window.location.href = '../pages/login.html';
                        return;
                    }
                    throw new Error(`Error ${response.status}: Unable to fetch wishlist`);
                }
                return response.json();
            })
            .then(data => {
                wishlistContainer.innerHTML = "";
                wishlistCountElement.textContent = data.length;

                if (data.length === 0) {
                    wishlistContainer.innerHTML = "<p>Your wishlist is empty.</p>";
                    return;
                }

                data.forEach(item => {
                    const bookElement = document.createElement("div");
                    bookElement.classList.add("wishlist-item");

                    bookElement.innerHTML = `
                        <a href="bookDetails.html?id=${item.book_id}" class="wishlist-main-container">
                            <div class="img-container">
                                <img src="${item.book_image}" alt="${item.book_name}">
                            </div>
                            <div class="wishlist-details">
                                <h3>${item.book_name}</h3>
                                <p>Author: ${item.author_name}</p>
                                <p>₹${item.discounted_price}</p>
                            </div>
                            <div class="btn-container">
                                <button class="remove-btn" data-id="${item.book_id}">
                                    <i class="fa fa-trash delete-icon" aria-hidden="true"></i>
                                </button>
                            </div>
                        </a>
                    `;

                    wishlistContainer.appendChild(bookElement);
                });

                document.querySelectorAll(".remove-btn").forEach(button => {
                    button.addEventListener("click", function (event) {
                        event.preventDefault();
                        toggleWishlist(this.getAttribute("data-id"));
                    });
                });
            })
            .catch(error => {
                console.error("Error fetching wishlist:", error);
                wishlistContainer.innerHTML = "<p>Failed to load wishlist. Please try again.</p>";
            });
    }

    function toggleWishlist(bookId) {
        fetch(`${API_BASE_URL}/wishlists/toggle/${bookId}`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ book_id: bookId })
        })
            .then(response => {
                if (!response.ok) {
                    if (response.status === 401) {
                        alert("Session expired. Please log in again.");
                        localStorage.removeItem('token');
                        window.location.href = '../pages/login.html';
                        return;
                    }
                    throw new Error("Failed to toggle wishlist");
                }
                return response.json();
            })
            .then(() => fetchWishlist())
            .catch(error => console.error("Error toggling wishlist:", error));
    }

    function setupHeaderEventListeners() {
        let dropdownMenu = null;
        let isDropdownOpen = false;
        const profileLink = document.getElementById("profile-link");
        const cartLink = document.getElementById("cart-link");
        const logo = document.querySelector(".logo"); // Added logo selector

        // Add logo click event listener
        if (logo) {
            logo.addEventListener("click", (event) => {
                event.preventDefault();
                console.log("Logo clicked, redirecting to homepage");
                window.location.href = "../pages/homePage.html";
            });
        } else {
            console.error("Logo element not found in DOM");
        }

        if (!profileLink) {
            console.error("Profile link element (#profile-link) not found in DOM");
            return;
        }

        profileLink.addEventListener("click", (event) => {
            event.preventDefault();
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

        if (cartLink) {
            cartLink.addEventListener("click", (event) => {
                event.preventDefault();
                window.location.href = '../pages/cart.html';
            });
        }

        const searchInput = document.getElementById("search");
        if (searchInput) {
            searchInput.addEventListener("keypress", (event) => {
                if (event.key === "Enter") {
                    const query = event.target.value.trim();
                    if (query) {
                        window.location.href = `../pages/homePage.html?query=${encodeURIComponent(query)}`;
                    }
                }
            });
        }

        function openDropdown() {
            if (dropdownMenu) dropdownMenu.remove();

            dropdownMenu = document.createElement("div");
            dropdownMenu.classList.add("dropdown-menu");
            const username = localStorage.getItem("username") || "User";

            dropdownMenu.innerHTML = `
                <div class="dropdown-item dropdown-header">Hello ${username},</div>
                <div class="dropdown-item" id="dropdown-profile">Profile</div>
                <div class="dropdown-item" id="dropdown-orders">My Orders</div>
                <div class="dropdown-item" id="dropdown-wishlist">My Wishlist</div>
                <div class="dropdown-item"><button id="dropdown-logout">Logout</button></div>
            `;

            profileLink.parentElement.appendChild(dropdownMenu);

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

            isDropdownOpen = true;
        }

        function closeDropdown() {
            if (dropdownMenu) {
                dropdownMenu.remove();
                dropdownMenu = null;
            }
            isDropdownOpen = false;
        }
    }

    function handleSignOut() {
        const provider = localStorage.getItem("socialProvider");

        if (provider === "google" && typeof google !== "undefined" && google.accounts) {
            google.accounts.id.disableAutoSelect();
            google.accounts.id.revoke(localStorage.getItem("socialEmail") || "", () => {
                console.log("Google session revoked");
            });
        }

        if (provider === "facebook" && typeof FB !== "undefined") {
            FB.getLoginStatus(function (response) {
                if (response.status === "connected") {
                    FB.logout(function (response) {
                        console.log("Facebook session revoked");
                    });
                }
            });
        }

        localStorage.clear();
        alert("Logged out successfully.");
        window.location.href = "../pages/login.html";
    }
});