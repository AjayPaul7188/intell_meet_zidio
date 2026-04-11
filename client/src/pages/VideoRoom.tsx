import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { socket } from "../services/socket";

export default function VideoRoom() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const user = JSON.parse(sessionStorage.getItem("authUser") || "{}");

  const [userMap, setUserMap] = useState<any>({});
  const [remoteStreams, setRemoteStreams] = useState<
    { stream: MediaStream; userId: string }[]
  >([]);

  const [messages, setMessages] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [typing, setTyping] = useState("");

  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStream = useRef<MediaStream | null>(null);
  const peers = useRef<any>({});
  const pendingCandidates = useRef<any>({});

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

      socket.connect();

      socket.emit("join-room", {
        roomId,
        name: user.name,
        avatar: user.avatar || null,
      });
    };

    init();

    // ================= EXISTING USERS =================
    const handleExistingUsers = (users: any[]) => {
      const map: any = {};

      users.forEach((u: any) => {
        map[u.id] = u;
        createPeer(u.id, true);
      });

      setUserMap(map);
    };

    socket.on("existing-users", handleExistingUsers);

    // ================= NEW USER =================
    const handleUserJoined = (u: any) => {
      setUserMap((prev: any) => ({
        ...prev,
        [u.id]: u,
      }));

      createPeer(u.id, false);
    };

    socket.on("user-joined", handleUserJoined);

    // ================= OFFER =================
    socket.on("offer", async ({ from, offer }) => {
      let pc = peers.current[from];

      if (!pc) {
        pc = createPeer(from, false);
      }

      if (pc.signalingState !== "stable") return;

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
      } catch (err: any) {
        console.log("Ignored offer error:", err.message);
        return;
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("answer", { to: from, answer });

      flushCandidates(from);
    });

    // ================= ANSWER =================
    socket.on("answer", async ({ from, answer }) => {
      const pc = peers.current[from];
      if (!pc) return;

      if (pc.signalingState !== "have-local-offer") return;

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (err: any) {
        console.log("Ignored setRemoteDescription error:", err.message);
      }

      flushCandidates(from);
    });

    // ================= ICE =================
    socket.on("ice-candidate", async ({ from, candidate }) => {
      const pc = peers.current[from];
      if (!pc) return;

      if (pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch {
          console.log("ICE ignored");
        }
      } else {
        if (!pendingCandidates.current[from]) {
          pendingCandidates.current[from] = [];
        }
        pendingCandidates.current[from].push(candidate);
      }
    });

    // ================= CHAT =================
    const handleReceiveMessage = (data: any) => {
      setMessages((prev) => [
        ...prev,
        {
          self: false,
          message: data.message,
          name: data.name,
          avatar: data.avatar,
        },
      ]);
    };

    socket.on("receive-message", handleReceiveMessage);

    // ================= TYPING =================
    const handleTyping = () => {
      setTyping("Someone is typing...");
      setTimeout(() => setTyping(""), 2000);
    };

    socket.on("user-typing", handleTyping);

    // ================= USER LEFT =================
    socket.on("user-left", (id) => {
      peers.current[id]?.close();
      delete peers.current[id];

      setRemoteStreams((prev) =>
        prev.filter((s) => s.userId !== id)
      );
    });

    return () => {
      socket.off("existing-users", handleExistingUsers);
      socket.off("user-joined", handleUserJoined);
      socket.off("receive-message", handleReceiveMessage);
      socket.off("user-typing", handleTyping);

      if (localStream.current) {
        localStream.current.getTracks().forEach((track) => track.stop());
      }

      // close peers
      Object.values(peers.current).forEach((pc: any) => pc.close());

      peers.current = {};


      socket.disconnect();
    };
  }, [roomId]);

  // ================= CREATE PEER =================
  const createPeer = (userId: string, initiator: boolean) => {
    if (peers.current[userId]) return peers.current[userId];

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    peers.current[userId] = pc;

    localStream.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localStream.current!);
    });

    pc.ontrack = (event) => {
      setRemoteStreams((prev) => {
        const exists = prev.find((s) => s.userId === userId);
        if (exists) return prev;

        return [...prev, { stream: event.streams[0], userId }];
      });
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", {
          to: userId,
          candidate: event.candidate,
        });
      }
    };

    if (initiator) {
      pc.createOffer().then(async (offer) => {
        if (pc.signalingState !== "stable") return;

        await pc.setLocalDescription(offer);
        socket.emit("offer", { to: userId, offer });
      });
    }

    return pc;
  };

  // ================= FLUSH ICE =================
  const flushCandidates = async (userId: string) => {
    const pc = peers.current[userId];
    const candidates = pendingCandidates.current[userId];

    if (!pc || !candidates) return;

    for (const c of candidates) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      } catch {}
    }

    pendingCandidates.current[userId] = [];
  };

  // ================= CONTROLS =================
  const toggleMute = () => {
    const track = localStream.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = isMuted;
      setIsMuted(!isMuted);
    }
  };

  const toggleCamera = () => {
    const track = localStream.current?.getVideoTracks()[0];
    if (track) {
      track.enabled = isCameraOff;
      setIsCameraOff(!isCameraOff);
    }
  };

  // ================= CHAT =================
  const sendMessage = () => {
    if (!message.trim()) return;

    socket.emit("send-message", { roomId, message });

    setMessages((prev) => [
      ...prev,
      {
        self: true,
        message,
        name: user.name,
        avatar: user.avatar,
      },
    ]);

    setMessage("");
  };

  const leaveMeeting = () => {
    // Stop camera + mic
    if (localStream.current) {
      localStream.current.getTracks().forEach((track) => {
        track.stop();
      });
    }

    // Close all peer connections
    (Object.values(peers.current) as RTCPeerConnection[]).forEach((pc) => {
      pc.close();
    });

    peers.current = {};

    // Clear remote streams
    setRemoteStreams([]);

    // Notify server
    socket.emit("leave-room", roomId);

    // Disconnect socket
    socket.disconnect();

    // Navigate away
    navigate("/");
  };

  return (
    <div className="h-screen bg-black text-white flex flex-col">
      {/* VIDEO */}
      <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-4 p-4">
        <div className="relative">
          <video ref={localVideoRef} autoPlay muted className="rounded w-full" />
          <p className="absolute bottom-1 left-1 bg-black px-2 text-sm">
            You ({user.name})
          </p>
        </div>

        {remoteStreams.map((item, i) => (
          <div key={i} className="relative">
            <video
              autoPlay
              ref={(video) => {
                if (video) video.srcObject = item.stream;
              }}
              className="rounded w-full"
            />
            <p className="absolute bottom-1 left-1 bg-black px-2 text-sm">
              {userMap[item.userId]?.name || "User"}
            </p>
          </div>
        ))}
      </div>

      {/* CONTROLS */}
      <div className="flex justify-center gap-4 p-4 bg-slate-900">
        <button onClick={toggleMute}>{isMuted ? "Unmute" : "Mute"}</button>
        <button onClick={toggleCamera}>
          {isCameraOff ? "Camera On" : "Camera Off"}
        </button>
        <button onClick={leaveMeeting} className="bg-red-500 px-3">
          Leave
        </button>
      </div>

      {/* CHAT */}
      <div className="bg-slate-800 p-3">
        <div className="h-32 overflow-y-auto mb-2 space-y-2">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2 ${msg.self ? "justify-end" : ""}`}>
              {!msg.self && msg.avatar && (
                <img src={msg.avatar} className="w-6 h-6 rounded-full" />
              )}

              <div>
                <p className="text-xs text-gray-400">{msg.name}</p>
                <p className="bg-slate-700 px-3 py-1 rounded-lg">
                  {msg.message}
                </p>
              </div>

              {msg.self && msg.avatar && (
                <img src={msg.avatar} className="w-6 h-6 rounded-full" />
              )}
            </div>
          ))}
          <p className="text-gray-400 text-sm">{typing}</p>
        </div>

        <div className="flex gap-2">
          <input
            className="flex-1 p-2 rounded text-black"
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              socket.emit("typing", { roomId });
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