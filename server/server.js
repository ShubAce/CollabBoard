import "dotenv/config";
import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");

import http from "http";
import app from "./src/app.js";
import { connectDB } from "./src/config/db.js";
import { initSocket } from "./src/config/socket.js";

const PORT = process.env.PORT || 5000;
const startServer = async () => {
	await connectDB();
	const httpServer = http.createServer(app);
	const io = await initSocket(httpServer);
	app.set("io", io);
	httpServer.listen(PORT, () => console.log(`Server on ${PORT}`));
};

startServer().catch((err) => {
	console.error("Failed to start server:", err);
	process.exit(1);
});
