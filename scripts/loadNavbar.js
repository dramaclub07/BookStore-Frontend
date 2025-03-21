document.addEventListener("DOMContentLoaded", () => {
    const navbarContainer = document.getElementById("navbar");
    if (navbarContainer) {
        fetch("../pages/navbar.html")
            .then(response => response.text())
            .then(data => {
                navbarContainer.innerHTML = data;
                // Re-run navbar.js to initialize event listeners
                const script = document.createElement("script");
                script.src = "../scripts/navbar.js";
                document.body.appendChild(script);
            })
            .catch(error => console.error("Error loading navbar:", error));
    }
});