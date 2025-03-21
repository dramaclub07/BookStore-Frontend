document.addEventListener("DOMContentLoaded", function () {
    const wishlistContainer = document.getElementById("wishlist-container");

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
                if (!data || data.length === 0) {
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
                                <button class="remove-btn" data-id="${item.book_id}">Remove</button>
                            </div>
                        </a>
                    `;

                    wishlistContainer.appendChild(bookElement);
                });

                // Add event listeners for remove buttons
                document.querySelectorAll(".remove-btn").forEach(button => {
                    button.addEventListener("click", function (event) {
                        event.preventDefault(); // Prevent the link from navigating
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
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Error ${response.status}: Unable to toggle wishlist`);
                }
                return response.json();
            })
            .then(data => {
                alert(data.message || "Wishlist updated successfully!");
                fetchWishlist(); // Refresh wishlist
            })
            .catch(error => {
                console.error("Error toggling wishlist:", error);
                alert(`Failed to update wishlist: ${error.message}`);
            });
    }

    fetchWishlist(); // Initial fetch when page loads
});