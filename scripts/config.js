window.config = {
  API_BASE_URL:
    process.env.API_BASE_URL ||
    "https://bookstore-backend-p7e1.onrender.com/api/v1/",
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID || "Ov23liI3VxGwFnrQoeL1",
  GITHUB_REDIRECT_URI:
    process.env.GITHUB_REDIRECT_URI || "http://127.0.0.1:5500/pages/login.html",
};