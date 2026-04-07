import { useEffect, useRef } from "react";
import { socket } from "../lib/socket";
import { createPeerConnection } from "../lib/webrtc";

const VideoRoom = () => {
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);

  let peer: RTCPeerConnection;

  useEffect(() => {
    peer = createPeerConnection();

    // Get camera & mic
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
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
    socket.emit("join-room", "room1");

    // When another user joins
    socket.on("user-joined", async () => {
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
      await peer.addIceCandidate(candidate);
    });

    return () => {
      socket.disconnect();
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