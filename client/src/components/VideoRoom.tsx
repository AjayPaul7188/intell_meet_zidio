import { useEffect, useRef } from "react";
import { socket } from "../services/socket";
import { createPeerConnection } from "../lib/webrtc";

const VideoRoom = () => {
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);

  let peer: RTCPeerConnection;

useEffect(() => {
  const peer = createPeerConnection(); // ✅ FIX: use const inside hook

  let localStream: MediaStream;

  // Get camera & mic
  navigator.mediaDevices
    .getUserMedia({ video: true, audio: true })
    .then((stream) => {
      localStream = stream;

      if (localVideo.current) {
        localVideo.current.srcObject = stream;
      }

      stream.getTracks().forEach((track) => {
        peer.addTrack(track, stream);
      });
    });

  // Receive remote stream
  peer.ontrack = (event) => {
    if (remoteVideo.current) {
      remoteVideo.current.srcObject = event.streams[0];
    }
  };

  // ICE candidates
  peer.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("ice-candidate", {
        candidate: event.candidate,
        roomId: "room1",
      });
    }
  };

  // Join room
  socket.emit("join-room", {
    roomId: "room1",
    userId: "user123",
  });

  // When another user joins
  socket.on("user-joined", async ({ socketId }) => {
    console.log("User joined:", socketId);

    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);

    socket.emit("offer", {
      offer,
      roomId: "room1",
    });
  });

  // Receive offer
  socket.on("offer", async (offer) => {
    await peer.setRemoteDescription(offer);

    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);

    socket.emit("answer", {
      answer,
      roomId: "room1",
    });
  });

  // Receive answer
  socket.on("answer", async (answer) => {
    await peer.setRemoteDescription(answer);
  });

  // Receive ICE
  socket.on("ice-candidate", async (candidate) => {
    try {
      await peer.addIceCandidate(candidate);
    } catch (err) {
      console.error("ICE error:", err);
    }
  });

  // Handle user leave
  socket.on("user-left", () => {
    console.log("User left");

    if (remoteVideo.current) {
      remoteVideo.current.srcObject = null;
    }
  });

  //  CLEANUP 
  return () => {
    peer.close();
    socket.off("user-joined");
    socket.off("offer");
    socket.off("answer");
    socket.off("ice-candidate");
    socket.off("user-left");
  };
}, []);

  return (
    <div>
      <h2>Video Room</h2>

      <video
        ref={localVideo}
        autoPlay
        muted
        style={{ width: "300px" }}
      />

      <video
        ref={remoteVideo}
        autoPlay
        style={{ width: "300px" }}
      />
    </div>
  );
};

export default VideoRoom;