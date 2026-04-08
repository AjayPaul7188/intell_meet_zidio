import app from "./app";
import http from "http";
import { Server } from "socket.io";
import { connectDB } from "./config/db";
import dotenv from "dotenv";
import dns from "dns";
import { handleSocket } from "./sockets/socketHandler";

dns.setDefaultResultOrder("ipv4first");

dotenv.config();
connectDB();

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});


handleSocket(io);


server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

