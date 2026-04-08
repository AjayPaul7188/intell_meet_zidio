import app from "./app";
import http from "http";
import { Server } from "socket.io";
import { connectDB } from "./config/db";
import dotenv from "dotenv";
import dns from "dns";

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


const users: any = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Join meeting room
  socket.on("join-room", ({ roomId, userId }) => {
    socket.join(roomId);

    users[socket.id] = { userId, roomId };

    socket.to(roomId).emit("user-joined", {
      socketId: socket.id,
      userId,
    });
  });

  // WebRTC signaling
  socket.on("offer", ({ offer, roomId }) => {
    socket.to(roomId).emit("offer", offer);
  });

  socket.on("answer", ({ answer, roomId }) => {
    socket.to(roomId).emit("answer", answer);
  });

  socket.on("ice-candidate", ({ candidate, roomId }) => {
    socket.to(roomId).emit("ice-candidate", candidate);
  });

  // Chat 
  socket.on("send-message", ({ roomId, message }) => {
    socket.to(roomId).emit("receive-message", message);
  });

  // Disconnect
  socket.on("disconnect", () => {
    const user = users[socket.id];

    if (user) {
      socket.to(user.roomId).emit("user-left", socket.id);
      delete users[socket.id];
    }

    console.log("User disconnected:", socket.id);
  });
});


server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

