document.addEventListener('DOMContentLoaded', () => {
    const cartItemsContainer = document.getElementById('cart-items');
    const orderSummary = document.getElementById('order-summary');
    const placeOrderBtn = document.getElementById('place-order');

    // Sample backend data
    const cartData = [
        {
            title: "Don't Make Me Think",
            author: "Steve Krug",
            price: 1500,
            quantity: 1,
            imageUrl: "path/to/book-image.jpg" // Replace with actual image URL
        }
    ];

    function displayCartItems() {
        cartData.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.innerHTML = `
                <img src="${item.imageUrl}" alt="${item.title}" style="width:50px;height:70px;">
                <p>${item.title} by ${item.author}</p>
                <p>Rs. ${item.price}</p>
                <input type="number" value="${item.quantity}" min="1" id="quantity-${item.title.replace(/\s+/g, '')}">
                <button class="remove-item" onclick="removeItem('${item.title}')">Remove</button>
            `;
            cartItemsContainer.appendChild(itemDiv);
        });

        updateOrderSummary();
    }

    function updateOrderSummary() {
        const total = cartData.reduce((acc, item) => acc + item.price * item.quantity, 0);
        orderSummary.innerText = `Total Amount: Rs. ${total}`;
    }

    window.removeItem = (title) => {
        // Logic to remove item
        alert(`Remove item: ${title}`);
        // Update the view
        updateOrderSummary(); // Refresh the order summary
    };

    placeOrderBtn.addEventListener('click', () => {
        // Logic to place the order (send data to your backend)
        alert("Order placed!");
    });

    displayCartItems(); // Initial display of cart items
});