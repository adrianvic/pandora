import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = process.env.PORT || 3200;

// Resolve __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static assets from the public folder
app.use(express.static(path.join(__dirname, "docs")));

// Start static file server
app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(` Pandora Chat Static Server is running!`);
    console.log(` URL: http://localhost:${PORT}`);
    console.log(`==================================================`);
});