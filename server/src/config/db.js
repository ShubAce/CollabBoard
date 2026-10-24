import mongoose from "mongoose";

export const connectDB = async () => {
	if (!process.env.MONGO_URI) {
		throw new Error("MONGO_URI is not set. Add it to server/.env (see .env.example).");
	}
	try {
		await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
	} catch (err) {
		// querySrv ENOTFOUND = the Atlas hostname has no DNS record: the cluster was
		// deleted/renamed, or the network's DNS blocks SRV lookups.
		if (err.code === "ENOTFOUND" || /querySrv|ENOTFOUND/.test(err.message)) {
			const host = process.env.MONGO_URI.split("@").pop().split("/")[0];
			err.message = `Cannot resolve MongoDB host "${host}". The Atlas cluster may have been deleted or paused, or your network blocks SRV DNS lookups. Check MONGO_URI in server/.env. (${err.message})`;
		}
		throw err;
	}
	console.log(`MongoDB connected (${mongoose.connection.host}/${mongoose.connection.name})`);
};
