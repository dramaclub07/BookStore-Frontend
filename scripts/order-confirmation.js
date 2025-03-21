// order-confirmation.js
const API_BASE_URL = 'http://127.0.0.1:3000/api/v1';

function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}

document.addEventListener("DOMContentLoaded", async function () {
    const token = localStorage.getItem('token');
    if (!token) {
        alert("Please log in to view order confirmation.");
        window.location.href = '../pages/login.html';
        return;
    }

    try {
        await loadUserProfile();
        await fetchOrderDetails();

        document.querySelector('.continue-button').addEventListener('click', function() {
            window.location.href = '../pages/homePage.html';
        });
    } catch (error) {
        console.error("Initialization error:", error);
        document.querySelector('.success-message').innerHTML = `
            <p>Error loading confirmation details. Please try again later.</p>
        `;
    }
});

async function loadUserProfile() {
    try {
        const response = await fetch(`${API_BASE_URL}/users/profile`, {
            headers: getAuthHeaders()
        });
        if (!response.ok) {
            if (response.status === 401) {
                alert("Session expired. Please log in again.");
                localStorage.removeItem('token');
                window.location.href = '/pages/login.html';
                return;
            }
            throw new Error(`Profile fetch failed with status: ${response.status}`);
        }
        const userData = await response.json();
        if (userData.success) {
            const profileElement = document.getElementById('profile-link');
            if (profileElement) {
                profileElement.innerHTML = `<i class="fa-solid fa-user"></i> ${userData.name || 'User'}`;
            }
        }
    } catch (error) {
        console.error("Profile fetch error:", error.message);
    }
}

async function fetchOrderDetails() {
    try {
        const orderResponse = await fetch(`${API_BASE_URL}/orders`, {
            headers: getAuthHeaders()
        });

        if (orderResponse.status === 401) {
            handleUnauthorized();
            return;
        }
        if (!orderResponse.ok) {
            throw new Error(`Failed to fetch orders: ${orderResponse.status}`);
        }

        const orderData = await orderResponse.json();
        console.log("Orders Response:", orderData);

        if (orderData.success && orderData.orders && orderData.orders.length > 0) {
            const latestOrder = orderData.orders.sort((a, b) => 
                new Date(b.created_at) - new Date(a.created_at)
            )[0];
            console.log("Latest Order:", latestOrder);

            const orderIdElement = document.getElementById('order-id');
            if (orderIdElement) {
                orderIdElement.innerText = `#${latestOrder.id}`;
            } else {
                console.error("Order ID element not found");
            }

            // Update status to "processing" if not already a completed status
            if (!["processing", "shipped", "delivered"].includes(latestOrder.status)) {
                const statusResponse = await fetch(`${API_BASE_URL}/orders/${latestOrder.id}/update_status`, {
                    method: "PATCH",
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ status: "processing" }) // Use a valid status
                });

                if (statusResponse.status === 401) {
                    handleUnauthorized();
                    return;
                }
                if (!statusResponse.ok) {
                    const errorData = await statusResponse.json();
                    throw new Error(`Failed to update order status: ${errorData.error || statusResponse.status}`);
                }

                const updatedOrderData = await statusResponse.json();
                console.log("Updated Order:", updatedOrderData);
                if (updatedOrderData.success && updatedOrderData.order) {
                    displayOrderDetails(updatedOrderData.order);
                } else {
                    throw new Error("Invalid response from status update");
                }
            } else {
                displayOrderDetails(latestOrder);
            }
        } else {
            console.error("No orders found in response");
            document.querySelector('.success-message').innerHTML = `
                <p>No recent order found. Please place an order first.</p>
            `;
        }
    } catch (error) {
        console.error("Error in fetchOrderDetails:", error);
        document.querySelector('.success-message').innerHTML = `
            <p>Error loading order details: ${error.message}</p>
        `;
    }
}

function displayOrderDetails(order) {
    document.querySelector(".success-message").innerHTML = `
        <h1>Order Placed Successfully</h1>
        <p>Hurray!!! Your order is confirmed <br> 
           The order ID is <strong id="order-id">#${order.id}</strong>. 
           Save the order ID for further communication.
        </p>
        <p>Order #${order.id} is successfully placed.</p>
    `;

    const myOrdersList = document.createElement("ul");
    myOrdersList.id = "my-orders";
    myOrdersList.innerHTML = `
        <li>Order #${order.id} - Status: ${order.status}</li>
    `;
    document.querySelector('.success-container').appendChild(myOrdersList);
}

function handleUnauthorized() {
    alert("Session expired. Please log in again.");
    localStorage.removeItem('token');
    console.log("Redirecting to login page due to 401");
    window.location.href = '../pages/login.html';
}