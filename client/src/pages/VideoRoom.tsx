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

  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);

  const [messages, setMessages] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [typing, setTyping] = useState("");

  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStream = useRef<MediaStream | null>(null);
  const peers = useRef<Record<string, RTCPeerConnection>>({});
  const pendingCandidates = useRef<any>({});

  const [participants, setParticipants] = useState<any[]>([]);

  const stopLocalIfNoPeers = () => {
    const hasPeers = Object.keys(peers.current).length > 0;

    if (!hasPeers && localStream.current) {
      localStream.current.getTracks().forEach((track) => {
        track.stop();
        track.enabled = false;
      });

      localStream.current = null;

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
    }
  };

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

    // EXISTING USERS
    const handleExistingUsers = (users: any[]) => {
      const map: any = {};

      users.forEach((u: any) => {
        map[u.id] = u;
        createPeer(u.id, true);
      });

      setUserMap(map);
    };

    socket.on("existing-users", handleExistingUsers);

    // NEW USER
    const handleUserJoined = (u: any) => {
      setUserMap((prev: any) => ({
        ...prev,
        [u.id]: u,
      }));

      createPeer(u.id, false);
    };

    socket.on("user-joined", handleUserJoined);

    //OFFER
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

    // ANSWER
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

    // ICE 
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

    // CHAT
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

    // TYPING
    const handleTyping = () => {
      setTyping("Someone is typing...");
      setTimeout(() => setTyping(""), 2000);
    };

    socket.on("user-typing", handleTyping);

    // USER LEFT
    socket.on("user-left", (id) => {
      const pc = peers.current[id];

      if (pc) {
        // 1. STOP ALL SENDING TRACKS
        pc.getSenders().forEach((sender) => {
          if (sender.track) {
            sender.track.stop();
            sender.replaceTrack(null);
          }
        });

        // 2. STOP RECEIVING TRACKS
        pc.getReceivers().forEach((receiver) => {
          if (receiver.track) {
            receiver.track.stop();
          }
        });

        // 3. CLOSE PEER CONNECTION
        pc.ontrack = null;
        pc.onicecandidate = null;
        pc.onconnectionstatechange = null;
        pc.close();

        delete peers.current[id];
      }

      // 4. REMOVE STREAM FROM UI + STOP IT
      setRemoteStreams((prev) => {
        const leaving = prev.find((s) => s.userId === id);

        if (leaving) {
          leaving.stream.getTracks().forEach((track) => {
            track.stop();
            track.enabled = false;
          });
        }

        const updated = prev.filter((s) => s.userId !== id);

        // 5. CHECK IF WE CAN STOP LOCAL CAMERA SAFELY
        setTimeout(() => {
          stopLocalIfNoPeers();
        }, 0);

        return updated;
      });
    });

    socket.on("participant-list", (list) => {
      setParticipants(list);
    });

    socket.on("participant-updated", (user) => {
      setParticipants((prev) =>
        prev.map((p) => (p.id === user.id ? user : p))
      );
    });

    return () => {
      socket.off();

      // STOP CAMERA + MIC
      if (localStream.current) {
        localStream.current.getTracks().forEach((track) => {
          track.stop();
          track.enabled = false;
        });
        localStream.current = null;
      }

      // STOP SCREEN SHARE IF ANY
      const screenStream = localVideoRef.current?.srcObject as MediaStream;
      if (screenStream) {
        screenStream.getTracks().forEach((t) => t.stop());
      }

      // CLOSE PEERS
      Object.values(peers.current).forEach((pc) => pc.close());
      peers.current = {};

      socket.disconnect();
    };
  }, [roomId]);

  // CREATE PEER
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

    pc.onconnectionstatechange = () => {
      if (
        pc.connectionState === "disconnected" ||
        pc.connectionState === "failed" ||
        pc.connectionState === "closed"
      ) {
        pc.getSenders().forEach((sender) => {
          if (sender.track) {
            sender.track.stop();
            sender.replaceTrack(null);
          }
        });

        pc.close();
        delete peers.current[userId];
      }
    };

    return pc;
  };

  // FLUSH ICE
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

  // CONTROLS
  const toggleMute = () => {
    const track = localStream.current?.getAudioTracks()[0];
    if (track) {
      const newMuted = !isMuted;

      track.enabled = !newMuted;
      setIsMuted(newMuted);

      socket.emit("toggle-mute", { muted: newMuted });
    }
  };

  const toggleCamera = () => {
    const track = localStream.current?.getVideoTracks()[0];
    if (track) {
      const newState = !isCameraOff;

      track.enabled = !newState;
      setIsCameraOff(newState);
    }
  };

  // CHAT
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

  const leaveMeeting = async () => {
    socket.emit("leave-room", roomId);

    // 1. STOP ALL LOCAL STREAM TRACKS (camera + mic)
    if (localStream.current) {
      localStream.current.getTracks().forEach((track) => {
        track.stop();
        track.enabled = false;
      });
      localStream.current = null;
    }

    // 2. STOP SCREEN SHARE TRACKS
    const screenStream = localVideoRef.current?.srcObject as MediaStream;

    if (screenStream) {
      screenStream.getTracks().forEach((track) => {
        track.stop();
        track.enabled = false;
      });
    }

    // 3. CLEAR VIDEO ELEMENT PROPERLY
    if (localVideoRef.current) {
      localVideoRef.current.pause();
      localVideoRef.current.srcObject = null;
      localVideoRef.current.load();
    }

    // 4. CLOSE ALL PEERS + REMOVE TRACKS
    Object.values(peers.current).forEach((pc) => {
      pc.getSenders().forEach((sender) => {
        if (sender.track) {
          sender.track.stop();
          sender.replaceTrack(null);
        }
      });

      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.close();
    });

    peers.current = {};

    // 5. STOP MEDIA RECORDER
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    // 6. RESET STATE
    setRemoteStreams([]);
    setUserMap({});
    setMessages([]);
    setIsScreenSharing(false);
    setIsRecording(false);

    // 7. DISCONNECT SOCKET LAST (IMPORTANT FIX)
    socket.off(); // remove all listeners first
    socket.disconnect();

    // 8. NAVIGATE AWAY
    navigate("/");
  };

  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
        });

        const screenTrack = screenStream.getVideoTracks()[0];

        // Replace video track in all peers
        Object.values(peers.current).forEach((pc: RTCPeerConnection) => {
          const sender = pc
            .getSenders()
            .find((s) => s.track?.kind === "video");

          if (sender) sender.replaceTrack(screenTrack);
        });

        // Replace local video
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }

        // When user stops screen share manually
        screenTrack.onended = () => {
          stopScreenShare();
        };

        setIsScreenSharing(true);
      } else {
        stopScreenShare();
      }
    } catch (err) {
      console.error("Screen share error:", err);
    }
  };

  const stopScreenShare = () => {
    const videoTrack = localStream.current?.getVideoTracks()[0];

    if (!videoTrack) return;

    // stop screen stream
    if (localVideoRef.current?.srcObject) {
      const screenStream = localVideoRef.current.srcObject as MediaStream;
      screenStream.getTracks().forEach((t) => t.stop());
    }

    // Replace back camera
    Object.values(peers.current).forEach((pc: RTCPeerConnection) => {
      const sender = pc
        .getSenders()
        .find((s) => s.track?.kind === "video");

      if (sender) sender.replaceTrack(videoTrack);
    });

    // Restore local video
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream.current!;
    }

    setIsScreenSharing(false);
  };

  const toggleRecording = () => {
    if (!isRecording) {
      if (!localStream.current) return;

      const recorder = new MediaRecorder(localStream.current);

      recordedChunks.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunks.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(recordedChunks.current, {
          type: "video/webm",
        });

        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = "recording.webm";
        a.click();
      };

      recorder.start();
      mediaRecorderRef.current = recorder;

      setIsRecording(true);
    } else {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    }
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
                if (!video) return;
                if (video.srcObject !== item.stream) {
                  video.srcObject = item.stream;
                }
              }}
              className="rounded w-full"
            />
            <p className="absolute bottom-1 left-1 bg-black px-2 text-sm">
              {userMap[item.userId]?.name || "User"}
            </p>
          </div>
        ))}
      </div>

      {/* Participants */}
      <div className="bg-slate-900 p-3">
        <h2 className="text-lg mb-2">Participants</h2>

        {participants.map((p) => (
          <div key={p.id} className="flex items-center gap-2 mb-2">
            <img src={p.avatar} className="w-8 h-8 rounded-full" />

            <div className="flex-1">
              <p>{p.name}</p>
              <p className="text-xs text-gray-400">
                {p.muted ? "🔇 Muted" : "🎤 Live"}
              </p>
            </div>

            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          </div>
        ))}
      </div>

      {/* CONTROLS */}
      <div className="flex justify-center gap-4 p-4 bg-slate-900 flex-wrap">
        <button onClick={toggleMute}>
          {isMuted ? "Unmute" : "Mute"}
        </button>

        <button onClick={toggleCamera}>
          {isCameraOff ? "Camera On" : "Camera Off"}
        </button>

        <button onClick={toggleScreenShare}>
          {isScreenSharing ? "Stop Share" : "Share Screen"}
        </button>

        <button onClick={toggleRecording}>
          {isRecording ? "Stop Recording" : "Record"}
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