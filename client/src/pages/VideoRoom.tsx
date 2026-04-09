import { useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { socket } from "../services/socket";

export default function VideoRoom() {
  const { roomId } = useParams();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const peerConnection = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    const init = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      // Show local video
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Create peer connection
      peerConnection.current = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });

      // Add tracks
      stream.getTracks().forEach((track) => {
        peerConnection.current?.addTrack(track, stream);
      });

      // Receive remote stream
      peerConnection.current.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };

      // ICE candidates
      peerConnection.current.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice-candidate", {
            roomId,
            candidate: event.candidate,
          });
        }
      };

      // Join room
      socket.emit("join-room", roomId);
    };

    init();

    // When another user joins > create offer
    socket.on("user-joined", async () => {
      const offer = await peerConnection.current?.createOffer();
      await peerConnection.current?.setLocalDescription(offer);

      socket.emit("offer", { roomId, offer });
    });

    // Receive offer > send answer
    socket.on("offer", async ({ offer }) => {
      await peerConnection.current?.setRemoteDescription(offer);

      const answer = await peerConnection.current?.createAnswer();
      await peerConnection.current?.setLocalDescription(answer);

      socket.emit("answer", { roomId, answer });
    });

    // Receive answer
    socket.on("answer", async ({ answer }) => {
      await peerConnection.current?.setRemoteDescription(answer);
    });

    // Receive ICE
    socket.on("ice-candidate", async ({ candidate }) => {
      try {
        await peerConnection.current?.addIceCandidate(candidate);
      } catch (err) {
        console.error(err);
      }
    });

    return () => {
      socket.disconnect();
      peerConnection.current?.close();
    };
  }, [roomId]);

  return (
    <div className="h-screen bg-black flex flex-col items-center justify-center gap-4">
      <video
        ref={localVideoRef}
        autoPlay
        muted
        className="w-[300px] rounded-lg border"
      />

      <video
        ref={remoteVideoRef}
        autoPlay
        className="w-[500px] rounded-lg border"
      />
    </div>
  );
}