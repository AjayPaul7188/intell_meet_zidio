import { Server, Socket } from "socket.io";

interface User {
  userId: string;
  roomId: string;
}

export const handleSocket = (io: Server) => {
  const users: Record<string, User> = {};

  io.on("connection", (socket: Socket) => {
    console.log("User connected:", socket.id);

    // JOIN ROOM
    socket.on("join-room", ({ roomId, userId }) => {
      if (!roomId || !userId) return;

      socket.join(roomId);
      users[socket.id] = { userId, roomId };

      const existingUsers = Object.keys(users).filter(
        (id) => id !== socket.id && users[id].roomId === roomId
      );

      socket.emit("existing-users", existingUsers);

      socket.to(roomId).emit("user-joined", socket.id);
    });

    // OFFER
    socket.on("offer", ({ to, offer }) => {
      io.to(to).emit("offer", {
        from: socket.id,
        offer,
      });
    });

    // ANSWER
    socket.on("answer", ({ to, answer }) => {
      io.to(to).emit("answer", {
        from: socket.id,
        answer,
      });
    });

    // ICE
    socket.on("ice-candidate", ({ to, candidate }) => {
      io.to(to).emit("ice-candidate", {
        from: socket.id,
        candidate,
      });
    });

    // CHAT
    socket.on("send-message", ({ roomId, message, userId }) => {
      if (!roomId || !message) return;

      socket.to(roomId).emit("receive-message", {
        message,
        userId,
        time: new Date(),
      });
    });

    // TYPING
    socket.on("typing", ({ roomId, userId }) => {
      socket.to(roomId).emit("user-typing", { userId });
    });

    // LEAVE
    socket.on("leave-room", (roomId) => {
      socket.leave(roomId);
    });

    // DISCONNECT
    socket.on("disconnecting", () => {
      const user = users[socket.id];

      if (user) {
        socket.to(user.roomId).emit("user-left", socket.id);
        delete users[socket.id];
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });
};