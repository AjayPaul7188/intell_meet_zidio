import { Server, Socket } from "socket.io";

interface User {
  id: string;
  roomId: string;
  name: string;
  avatar: string;
  muted: boolean;
}

export const handleSocket = (io: Server) => {
  const users: Record<string, User> = {};

  io.on("connection", (socket: Socket) => {
    console.log("User connected:", socket.id);

    // JOIN ROOM
    socket.on("join-room", ({ roomId, name, avatar }) => {
      if (users[socket.id]) return;

      socket.join(roomId);

      users[socket.id] = {
        id: socket.id,
        roomId,
        name,
        avatar,
        muted: false,
      };

      const existingUsers = Object.values(users).filter(
        (u) => u.roomId === roomId && u.id !== socket.id
      );

      socket.emit("existing-users", existingUsers);

      socket.to(roomId).emit("user-joined", users[socket.id]);

      // SEND PARTICIPANT LIST
      io.to(roomId).emit(
        "participant-list",
        Object.values(users).filter((u) => u.roomId === roomId)
      );
    });

    // WEBRTC
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

    // CHAT
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

    // MUTE SYNC
    socket.on("toggle-mute", ({ muted }) => {
      if (users[socket.id]) {
        users[socket.id].muted = muted;

        io.to(users[socket.id].roomId).emit(
          "participant-updated",
          users[socket.id]
        );
      }
    });

    // LEAVE ROOM
    socket.on("leave-room", () => {
      const user = users[socket.id];
      if (!user) return;

      socket.to(user.roomId).emit("user-left", socket.id);

      delete users[socket.id];

      io.to(user.roomId).emit(
        "participant-list",
        Object.values(users).filter((u) => u.roomId === user.roomId)
      );
    });

    // DISCONNECT
    socket.on("disconnect", () => {
      const user = users[socket.id];
      if (!user) return;

      socket.to(user.roomId).emit("user-left", socket.id);

      delete users[socket.id];

      io.to(user.roomId).emit(
        "participant-list",
        Object.values(users).filter((u) => u.roomId === user.roomId)
      );
    });
  });
};