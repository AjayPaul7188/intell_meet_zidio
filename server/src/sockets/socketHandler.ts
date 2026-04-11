import { Server, Socket } from "socket.io";

interface User {
  id: string;
  roomId: string;
  name: string;
  avatar: string;
}

export const handleSocket = (io: Server) => {
  const users: Record<string, User> = {};

  io.on("connection", (socket: Socket) => {
    console.log("User connected:", socket.id);

    socket.on("join-room", ({ roomId, name, avatar }) => {
      if (users[socket.id]) return;

      socket.join(roomId);

      users[socket.id] = {
        id: socket.id,
        roomId,
        name,
        avatar,
      };

      const existingUsers = Object.values(users).filter(
        (u) => u.roomId === roomId && u.id !== socket.id
      );

      socket.emit("existing-users", existingUsers);

      socket.to(roomId).emit("user-joined", users[socket.id]);
    });

    socket.on("offer", ({ to, offer }) => {
      io.to(to).emit("offer", { from: socket.id, offer });
    });

    socket.on("answer", ({ to, answer }) => {
      io.to(to).emit("answer", { from: socket.id, answer });
    });

    socket.on("ice-candidate", ({ to, candidate }) => {
      io.to(to).emit("ice-candidate", {
        from: socket.id,
        candidate,
      });
    });

    socket.on("send-message", ({ roomId, message }) => {
      const user = users[socket.id];
      if (!user) return;

      socket.to(roomId).emit("receive-message", {
        message,
        name: user.name,
        avatar: user.avatar,
      });
    });

    socket.on("typing", ({ roomId }) => {
      socket.to(roomId).emit("user-typing");
    });

    socket.on("disconnect", () => {
      const user = users[socket.id];
      if (!user) return;

      socket.to(user.roomId).emit("user-left", socket.id);
      delete users[socket.id];
    });
  });
};