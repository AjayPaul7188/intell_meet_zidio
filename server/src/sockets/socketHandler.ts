import { Server, Socket } from "socket.io";

interface User {
  userId: string;
  roomId: string;
}

export const handleSocket = (io: Server) => {
  const users: Record<string, User> = {};

  io.on("connection", (socket: Socket) => {
    console.log("User connected:", socket.id);

    // Join room + notification
    socket.on("join-room", ({ roomId, userId }: { roomId: string; userId: string }) => {
      if (!roomId || !userId) return;

      socket.join(roomId);
      users[socket.id] = { userId, roomId };

      // Notify others
      socket.to(roomId).emit("user-joined", {
        socketId: socket.id,
        userId,
        message: `${userId} joined the meeting`,
      });

      // Send confirmation to current user
      socket.emit("joined-success", { roomId });
    });

    // WebRTC signaling
    socket.on("offer", ({ offer, roomId }: { offer: any; roomId: string }) => {
      socket.to(roomId).emit("offer", offer);
    });

    socket.on("answer", ({ answer, roomId }: { answer: any; roomId: string }) => {
      socket.to(roomId).emit("answer", answer);
    });

    socket.on("ice-candidate", ({ candidate, roomId }: { candidate: any; roomId: string }) => {
      socket.to(roomId).emit("ice-candidate", candidate);
    });

    // Chat functionality 
    socket.on(
      "send-message",
      ({ roomId, message, userId }: { roomId: string; message: string; userId: string }) => {
        if (!roomId || !message) return;

        const chatData = {
          message,
          userId,
          time: new Date(),
        };

        // Send message to everyone in room
        io.to(roomId).emit("receive-message", chatData);

        // Notification for new message 
        socket.to(roomId).emit("new-message-notification", {
          userId,
          info: "New message received",
        });
      }
    );

    // Typing indicator 
    socket.on("typing", ({ roomId, userId }: { roomId: string; userId: string }) => {
      socket.to(roomId).emit("user-typing", { userId });
    });

    socket.on("stop-typing", ({ roomId, userId }: { roomId: string; userId: string }) => {
      socket.to(roomId).emit("user-stop-typing", { userId });
    });

    // Disconnect handling + notification
    socket.on("disconnecting", () => {
      const user = users[socket.id];

      if (user) {
        socket.to(user.roomId).emit("user-left", {
          socketId: socket.id,
          userId: user.userId,
          message: `${user.userId} left the meeting`,
        });

        delete users[socket.id];
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });
};