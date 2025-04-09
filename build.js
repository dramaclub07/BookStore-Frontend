const fs = require('fs').promises;
const path = require('path');

async function build() {
  // Remove public directory if it exists
  const publicPath = path.join(__dirname, 'public');
  if (await fs.access(publicPath).then(() => true).catch(() => false)) {
    await fs.rm(publicPath, { recursive: true, force: true });
  }

  // Create public directory
  await fs.mkdir(publicPath, { recursive: true });

  // Copy directories
  await fs.cp(path.join(__dirname, 'pages'), path.join(publicPath, 'pages'), { recursive: true });
  await fs.cp(path.join(__dirname, 'scripts'), path.join(publicPath, 'scripts'), { recursive: true });
  await fs.cp(path.join(__dirname, 'styles'), path.join(publicPath, 'styles'), { recursive: true });
  await fs.cp(path.join(__dirname, 'assets'), path.join(publicPath, 'assets'), { recursive: true }).catch(() => {
    console.warn('assets/ not found, skipping');
  }); // Skip if assets/ is missing
}

build().catch(console.error);