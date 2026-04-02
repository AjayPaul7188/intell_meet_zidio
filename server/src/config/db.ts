import mongoose from "mongoose";

export const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI as string);
        console.log("MongoDb Connected");
    } catch (error) {
        console.error("DB Error", error);
        process.exit(1);
    }
}