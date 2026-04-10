import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { socket } from "../services/socket";

export default function VideoRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStream = useRef<MediaStream | null>(null);
  const peers = useRef<{ [key: string]: RTCPeerConnection }>({});

  const [remoteStreams, setRemoteStreams] = useState<MediaStream[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [typing, setTyping] = useState("");

  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  useEffect(() => {
    const init = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      localStream.current = stream;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      socket.emit("join-room", {
        roomId,
        userId: socket.id,
      });
    };

    init();

    // EXISTING USERS → YOU INITIATE
    socket.on("existing-users", async (users) => {
      for (let userId of users) {
        createPeer(userId, true);
      }
    });

    // NEW USER JOINED → DO NOTHING (IMPORTANT)
    socket.on("user-joined", (userId) => {
      console.log("User joined:", userId);
    });

    // OFFER
    socket.on("offer", async ({ from, offer }) => {
      console.log("Offer received from", from);
      createPeer(from, false, offer);
    });

    // ANSWER
    socket.on("answer", async ({ from, answer }) => {
      console.log("Answer received from", from);
      await peers.current[from]?.setRemoteDescription(answer);
    });

    // ICE
    socket.on("ice-candidate", async ({ from, candidate }) => {
      try {
        await peers.current[from]?.addIceCandidate(candidate);
      } catch (err) {
        console.error("ICE error:", err);
      }
    });

    // CHAT
    socket.on("receive-message", (data) => {
      setMessages((prev) => [...prev, { self: false, message: data.message }]);
    });

    // TYPING
    socket.on("user-typing", () => {
      setTyping("Someone is typing...");
      setTimeout(() => setTyping(""), 2000);
    });

    // USER LEFT
    socket.on("user-left", (id) => {
      peers.current[id]?.close();
      delete peers.current[id];

      setRemoteStreams((prev) =>
        prev.filter((stream) => stream.id !== id)
      );
    });

    return () => {
      Object.values(peers.current).forEach((pc) => pc.close());

      socket.off("existing-users");
      socket.off("user-joined");
      socket.off("offer");
      socket.off("answer");
      socket.off("ice-candidate");
      socket.off("receive-message");
      socket.off("user-typing");
      socket.off("user-left");
    };
  }, [roomId]);

  const createPeer = async (
    userId: string,
    initiator: boolean,
    offer?: any
  ) => {
    if (peers.current[userId]) return; 

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    peers.current[userId] = pc;

    // ADD LOCAL TRACKS
    localStream.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localStream.current!);
    });

    // RECEIVE REMOTE STREAM
    pc.ontrack = (event) => {
      const stream = event.streams[0];

      setRemoteStreams((prev) => {
        if (prev.find((s) => s.id === stream.id)) return prev;
        return [...prev, stream];
      });
    };

    // ICE
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", {
          to: userId,
          candidate: event.candidate,
        });
      }
    };

    // INITIATOR
    if (initiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit("offer", { to: userId, offer });
    } else if (offer) {
      await pc.setRemoteDescription(offer);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("answer", { to: userId, answer });
    }
  };

  // MUTE
  const toggleMute = () => {
    const track = localStream.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = isMuted;
      setIsMuted(!isMuted);
    }
  };

  // CAMERA
  const toggleCamera = () => {
    const track = localStream.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = isCameraOff;
      setIsCameraOff(!isCameraOff);
    }
  };

  // SEND MESSAGE
  const sendMessage = () => {
    if (!message.trim()) return;

    socket.emit("send-message", {
      roomId,
      message,
      userId: socket.id,
    });

    setMessages((prev) => [...prev, { self: true, message }]);
    setMessage("");
  };

  const handleTyping = () => {
    socket.emit("typing", {
      roomId,
      userId: socket.id,
    });
  };

  // LEAVE
  const leaveMeeting = () => {
    socket.emit("leave-room", roomId);
    socket.disconnect();
    navigate("/");
  };

  return (
    <div className="h-screen bg-black text-white flex flex-col">
      <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-4 p-4">
        <video ref={localVideoRef} autoPlay muted className="rounded w-full" />

        {remoteStreams.map((stream, i) => (
          <video
            key={i}
            autoPlay
            ref={(video) => {
              if (video) video.srcObject = stream;
            }}
            className="rounded w-full"
          />
        ))}
      </div>

      <div className="flex justify-center gap-4 p-4 bg-slate-900">
        <button onClick={toggleMute} className="bg-slate-700 px-4 py-2 rounded">
          {isMuted ? "Unmute" : "Mute"}
        </button>

        <button
          onClick={toggleCamera}
          className="bg-slate-700 px-4 py-2 rounded"
        >
          {isCameraOff ? "Camera On" : "Camera Off"}
        </button>

        <button
          onClick={leaveMeeting}
          className="bg-red-500 px-4 py-2 rounded"
        >
          Leave
        </button>
      </div>

      <div className="bg-slate-800 p-3">
        <div className="h-32 overflow-y-auto mb-2">
          {messages.map((msg, i) => (
            <p key={i} className={msg.self ? "text-right" : ""}>
              {msg.message}
            </p>
          ))}
          <p className="text-gray-400 text-sm">{typing}</p>
        </div>

        <div className="flex gap-2">
          <input
            className="flex-1 p-2 rounded text-black"
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              handleTyping();
            }}
          />
          <button onClick={sendMessage} className="bg-blue-600 px-4 rounded">
            Send
          </button>
        </div>
      </div>
    </div>
  );
}