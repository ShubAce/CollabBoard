import "dotenv/config";
import app from "./src/app.js";
import { connectDB } from "./src/config/db.js";

const PORT = process.env.PORT || 5000;
const startServer = async () => {
	await connectDB();
	app.listen(PORT, () => console.log(`Server on ${PORT}`));
};

startServer().catch((err) => {
	console.error("Failed to start server:", err);
	process.exit(1);
});
