document.addEventListener("DOMContentLoaded", function () {
    const wishlistContainer = document.getElementById("wishlist-container");
    const wishlistCountElement = document.getElementById("wishlist-count");

    function fetchWishlist() {
        const token = localStorage.getItem("token");
        if (!token) {
            window.location.href = "../pages/login.html"; // Redirect if not logged in
            return;
        }

        fetch("http://localhost:3000/api/v1/wishlists/fetch", {
            headers: { "Authorization": `Bearer ${token}` }
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Error ${response.status}: Unable to fetch wishlist`);
                }
                return response.json();
            })
            .then(data => {
                wishlistContainer.innerHTML = ""; // Clear previous data
                
                // Update wishlist count dynamically
                wishlistCountElement.textContent = data.length;

                if (data.length === 0) {
                    wishlistContainer.innerHTML = "<p>Your wishlist is empty.</p>";
                    return;
                }

                data.forEach(item => {
                    const bookElement = document.createElement("div");
                    bookElement.classList.add("wishlist-item");

                    bookElement.innerHTML = `
                        <a href="bookDetails.html?id=${item.id}" class="wishlist-main-container">
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

                // Add event listeners for remove buttons
                document.querySelectorAll(".remove-btn").forEach(button => {
                    button.addEventListener("click", function (event) {
                        event.preventDefault(); // Prevent page reload from <a> tag
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
        const token = localStorage.getItem("token");
        fetch(`http://localhost:3000/api/v1/wishlists/toggle/${bookId}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ book_id: bookId })
        })
            .then(response => response.json())
            .then(() => fetchWishlist()) // Refresh wishlist and update count
            .catch(error => console.error("Error toggling wishlist:", error));
    }

    fetchWishlist(); // Initial fetch when page loads
});