// console.log("navbar.js loaded");

// document.addEventListener("DOMContentLoaded", () => {
//     const profileLink = document.getElementById("profile-link");
//     const cartLink = document.getElementById("cart-link");
//     const usernameElement = document.querySelector(".username");
//     const cartCountElement = document.getElementById("cart-count");

//     console.log("Profile link element:", profileLink);

//     // User state
//     const token = localStorage.getItem("token");
//     const isLoggedIn = !!token;
//     const username = localStorage.getItem("username") || "User";

//     if (usernameElement) {
//         usernameElement.textContent = isLoggedIn ? username : "Profile";
//     }

//     // Dropdown state
//     let dropdownMenu = null;
//     let isDropdownOpen = false;

//     if (profileLink) {
//         profileLink.addEventListener("click", (event) => {
//             event.preventDefault();
//             console.log("Profile link clicked, toggling dropdown");
//             if (isDropdownOpen) {
//                 closeDropdown();
//             } else {
//                 openDropdown();
//             }
//         });

//         document.addEventListener("click", (event) => {
//             if (
//                 isDropdownOpen &&
//                 !profileLink.contains(event.target) &&
//                 dropdownMenu &&
//                 !dropdownMenu.contains(event.target)
//             ) {
//                 closeDropdown();
//             }
//         });
//     } else {
//         console.error("Profile link not found in DOM");
//     }

//     if (cartLink) {
//         cartLink.addEventListener("click", (event) => {
//             event.preventDefault();
//             if (!isLoggedIn) {
//                 console.log("User not logged in, redirecting to please login page");
//                 window.location.href = "../pages/pleaseLogin.html";
//             } else {
//                 console.log("Redirecting to cart page");
//                 window.location.href = "../pages/cart.html";
//             }
//         });
//     }

//     function openDropdown() {
//         if (dropdownMenu) dropdownMenu.remove();

//         dropdownMenu = document.createElement("div");
//         dropdownMenu.classList.add("profile-dropdown");

//         dropdownMenu.innerHTML = isLoggedIn
//             ? `
//                 <div class="dropdown-item dropdown-header">Hello ${username},</div>
//                 <div class="dropdown-item" id="dropdown-profile">Profile</div>
//                 <div class="dropdown-item" id="dropdown-orders">My Orders</div>
//                 <div class="dropdown-item" id="dropdown-wishlist">My Wishlist</div>
//                 <div class="dropdown-item"><button id="dropdown-logout">Logout</button></div>
//             `
//             : `
//                 <div class="dropdown-item dropdown-header">Welcome</div>
//                 <div class="dropdown-item dropdown-subheader">To access account</div>
//                 <div class="dropdown-item"><button id="dropdown-login-signup">LOGIN/SIGNUP</button></div>
//                 <div class="dropdown-item" id="dropdown-orders">My Orders</div>
//                 <div class="dropdown-item" id="dropdown-wishlist">Wishlist</div>
//             `;

//         profileLink.parentElement.appendChild(dropdownMenu);

//         if (isLoggedIn) {
//             document.getElementById("dropdown-profile").addEventListener("click", () => {
//                 window.location.href = "../pages/profile.html";
//                 closeDropdown();
//             });
//             document.getElementById("dropdown-orders").addEventListener("click", () => {
//                 window.location.href = "../pages/orders.html";
//                 closeDropdown();
//             });
//             document.getElementById("dropdown-wishlist").addEventListener("click", () => {
//                 window.location.href = "../pages/wishlist.html";
//                 closeDropdown();
//             });
//             document.getElementById("dropdown-logout").addEventListener("click", () => {
//                 console.log("Logging out...");
//                 localStorage.clear();
//                 window.location.href = "../pages/login.html";
//                 closeDropdown();
//             });
//         } else {
//             document.getElementById("dropdown-login-signup").addEventListener("click", () => {
//                 window.location.href = "../pages/login.html";
//                 closeDropdown();
//             });
//             document.getElementById("dropdown-orders").addEventListener("click", () => {
//                 window.location.href = "../pages/pleaseLogin.html";
//                 closeDropdown();
//             });
//             document.getElementById("dropdown-wishlist").addEventListener("click", () => {
//                 window.location.href = "../pages/pleaseLogin.html";
//                 closeDropdown();
//             });
//         }

//         isDropdownOpen = true;
//     }

//     function closeDropdown() {
//         if (dropdownMenu) {
//             dropdownMenu.remove();
//             dropdownMenu = null;
//         }
//         isDropdownOpen = false;
//     }

//     // Minimal Search (no fetch, just redirect)
//     document.getElementById("search")?.addEventListener("keypress", (event) => {
//         if (event.key === "Enter") {
//             const query = event.target.value.trim();
//             if (query) {
//                 console.log("Search triggered with query:", query);
//                 window.location.href = `homePage.html?query=${encodeURIComponent(query)}`;
//             }
//         }
//     });

//     // Cart Count (optional, simplified)
//     async function updateCartCount() {
//         if (!isLoggedIn || !cartCountElement) {
//             cartCountElement.textContent = "0";
//             return;
//         }
//         try {
//             const response = await fetch("http://127.0.0.1:3000/api/v1/cart", {
//                 headers: { "Authorization": `Bearer ${token}` }
//             });
//             if (!response.ok) throw new Error("Cart fetch failed");
//             const data = await response.json();
//             cartCountElement.textContent = data.cart?.length || 0;
//         } catch (error) {
//             console.error("Cart count error:", error);
//             cartCountElement.textContent = "0";
//         }
//     }
//     updateCartCount();
// });