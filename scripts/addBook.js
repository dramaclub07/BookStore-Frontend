const API_BASE_URL = window.config.API_BASE_URL;;

function getAuthHeaders() {
    const accessToken = localStorage.getItem("access_token");
    return {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json" // Ensure this is included for JSON requests
    };
}

function isAuthenticated() {
    return localStorage.getItem("access_token") !== null;
}

function isAdmin() {
    const user = JSON.parse(localStorage.getItem("user")); // Parse the user object
    return user?.role === "admin"; // Check role within user object
}

async function fetchWithAuth(url, options = {}) {
    if (!isAuthenticated()) {
        alert("You must be logged in to perform this action.");
        window.location.href = "../pages/login.html";
        return null;
    }

    options.headers = { ...options.headers, ...getAuthHeaders() };
    const response = await fetch(url, options);

    if (response.status === 401) {
        alert("Session expired or unauthorized. Please log in again.");
        localStorage.clear();
        window.location.replace("../pages/login.html");
        return null;
    }

    return response;
}

document.addEventListener("DOMContentLoaded", () => {
    if (!isAuthenticated() || !isAdmin()) {
        alert("You must be an admin to access this page.");
        window.location.replace("../pages/homePage.html");
        return;
    }

    const singleBookForm = document.getElementById("single-book-form");
    singleBookForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const formData = new FormData(singleBookForm);
        const bookData = {
            book: {
                book_name: formData.get("book_name"),
                author_name: formData.get("author_name"),
                book_mrp: parseFloat(formData.get("book_mrp")),
                discounted_price: formData.get("discounted_price") ? parseFloat(formData.get("discounted_price")) : null,
                quantity: formData.get("quantity") ? parseInt(formData.get("quantity")) : null,
                book_details: formData.get("book_details") || null,
                genre: formData.get("genre") || null,
                book_image: formData.get("book_image") || null,
                is_deleted: false // Explicitly set to false
            }
        };

        try {
            const response = await fetchWithAuth(`${API_BASE_URL}/books`, {
                method: "POST",
                headers: getAuthHeaders(), // Already includes Content-Type
                body: JSON.stringify(bookData)
            });

            if (!response) return;

            const result = await response.json();
            if (response.ok) {
                alert("Book added successfully!");
                singleBookForm.reset();
                localStorage.setItem("bookAdded", "true"); // Flag for homePage.js
                setTimeout(() => {
                    window.location.replace("../pages/homePage.html");
                }, 500);
            } else {
                alert(`Failed to add book: ${result.errors?.join(", ") || "Unknown error"}`);
            }
        } catch (error) {
           
            alert("An error occurred while adding the book.");
        }
    });

    const csvUploadForm = document.getElementById("csv-upload-form");
    csvUploadForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const formData = new FormData(csvUploadForm);
        const file = formData.get("file");

        if (!file) {
            alert("Please select a CSV file to upload.");
            return;
        }

        try {
            // Remove Content-Type header for FormData (let browser set it)
            const headers = getAuthHeaders();
            delete headers["Content-Type"]; // FormData sets its own boundary
            const response = await fetchWithAuth(`${API_BASE_URL}/books`, {
                method: "POST",
                headers: headers,
                body: formData
            });

            if (!response) return;

            const result = await response.json();
            if (response.ok) {
                alert("Books uploaded successfully from CSV!");
                csvUploadForm.reset();
                localStorage.setItem("bookAdded", "true");
                setTimeout(() => {
                    window.location.replace("../pages/homePage.html");
                }, 500);
            } else {
                alert(`Failed to upload CSV: ${result.errors?.join(", ") || "Unknown error"}`);
            }
        } catch (error) {
     
            alert("An error occurred while uploading the CSV.");
        }
    });
});