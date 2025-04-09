const fs = require("fs");
const path = require("path");

const env = {
  GOOGLE_CLIENT_ID:
    "487636959884-qpcsgvs3m6vcmjtmmt60mnpjb66bv2uj.apps.googleusercontent.com",
  GITHUB_CLIENT_ID: "Ov23liI3VxGwFnrQoeL1",
  BACKEND_URL: process.env.BACKEND_URL || "http://localhost:3000", // Fallback if undefined
};

try {
  const jsDir = path.join(__dirname, "js");
  // Create 'js/' directory if it doesn’t exist
  if (!fs.existsSync(jsDir)) {
    fs.mkdirSync(jsDir, { recursive: true }); // recursive ensures parent dirs are created if needed
    console.log("Created js/ directory");
  }

  const content = `window.env = ${JSON.stringify(env, null, 2)};`;
  fs.writeFileSync(path.join(jsDir, "env.js"), content);
  console.log("Generated env.js successfully");
} catch (error) {
  console.error("Error generating env.js:", error.message);
  process.exit(1); // Exit with failure code
}
