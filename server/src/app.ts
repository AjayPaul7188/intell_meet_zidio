import express from "express";
import cors from "cors";
import helmet from "helmet";
import authRoutes from "./modules/auth/auth.routes";
import meetingRoutes from "./modules/meeting/meeting.routes";

const app = express();

app.use(cors());
app.use(helmet());
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/meetings", meetingRoutes);

app.get("/", (req, res) => {
  res.send("API Running");
});

// app.get("/test", (req, res) => {
//   res.send("Test route working");
// });


export default app;