const fs = require("fs");
const path = require("path");

const env = {
  GOOGLE_CLIENT_ID:
    "487636959884-qpcsgvs3m6vcmjtmmt60mnpjb66bv2uj.apps.googleusercontent.com",
  GITHUB_CLIENT_ID: "Ov23liI3VxGwFnrQoeL1",
  API_BASE_URL: process.env.BACKEND_URL || "https://bookstore-backend-p7e1.onrender.com/api/v1" // This is the single source of truth
};

const content = `window.env = ${JSON.stringify(env, null, 2)};`;
fs.writeFileSync(path.join(__dirname, "scripts", "env.js"), content);
console.log("Generated env.js");
