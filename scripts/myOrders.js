// Modified JavaScript
const API_BASE_URL = 'http://127.0.0.1:3000/api/v1';

document.addEventListener("DOMContentLoaded", async function () {
    const ordersContainer = document.getElementById("orders-container");
    const token = localStorage.getItem("token");

    if (!token) {
        alert("Please log in to view your orders.");
        window.location.href = "/pages/login.html";
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/orders`, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        const data = await response.json();
        console.log("Orders Data:", data);

        if (data.success && data.orders.length > 0) {
            ordersContainer.innerHTML = "";

            for (const order of data.orders) {
                try {
                    const bookResponse = await fetch(`${API_BASE_URL}/books/${order.book_id}`, {
                        headers: {
                            "Authorization": `Bearer ${token}`
                        }
                    });
                    const bookData = await bookResponse.json();
                    console.log("Book Data:", bookData);

                    const orderElement = document.createElement("div");
                    orderElement.classList.add("order-item");

                    orderElement.innerHTML = `
                        <div class="order-item-container">
                            <img class="book-image" src="${bookData.book_image || '../assets/1.png'}" alt="${bookData.book_name}" />
                            <div class="order-details">
                                <div class="order-main-details">
                                    <h3>Order #${order.id}</h3>
                                    <p>Book: <strong>${bookData.book_name}</strong></p>
                                    <p>Author: ${bookData.author_name}</p>
                                    <p>Total Price: ₹${order.total_price}</p>
                                </div>
                                <div class="order-date">
                                    <p>Placed on: ${new Date(order.created_at).toLocaleDateString()}</p>
                                </div>
                            </div>
                        </div>
                    `;

                    ordersContainer.appendChild(orderElement);
                } catch (bookError) {
                    console.error("Error fetching book details:", bookError);
                }
            }
        } else {
            ordersContainer.innerHTML = `<p>No orders found. Place an order first.</p>`;
        }
    } catch (error) {
        console.error("Error fetching orders:", error);
        ordersContainer.innerHTML = `<p>Error loading orders. Please try again later.</p>`;
    }
});