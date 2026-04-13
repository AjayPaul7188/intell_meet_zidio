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
  const screenStreamRef = useRef<MediaStream | null>(null);

  const [participants, setParticipants] = useState<any[]>([]);

  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<any>(null);

  const [activeTab, setActiveTab] = useState<"participants" | "chat" | "transcript">("participants");
  const [showMenu, setShowMenu] = useState(false);

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

  const startSpeechRecognition = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();

    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let text = "";

      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }

      setTranscript(text);
    };

    recognition.onend = () => {
      if (recognitionRef.current) {
        recognition.start();
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
  };

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

    // DETACH TRACKS FROM PEERS FIRST
    Object.values(peers.current).forEach((pc) => {
      pc.getSenders().forEach((sender) => {
        try {
          sender.replaceTrack(null); 
        } catch {}
      });
    });

    // STOP SCREEN SHARE TRACKS
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      screenStreamRef.current = null;
    }

    // STOP LOCAL CAMERA + MIC
    if (localStream.current) {
      localStream.current.getTracks().forEach((track) => {
        track.stop();
      });
      localStream.current = null;
    }

    // NOW CLOSE PEERS
    Object.values(peers.current).forEach((pc) => {
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.onconnectionstatechange = null;

      try {
        pc.close();
      } catch {}
    });

    peers.current = {};

    // CLEAR VIDEO ELEMENT HARD RESET
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
      localVideoRef.current.removeAttribute("src");
      localVideoRef.current.load();
    }

    // STEP 6: FORCE GC (important for Chrome)
    setTimeout(() => {
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
    }, 0);

    // STEP 7: STOP RECORDING
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    // STEP 8: RESET STATE
    setRemoteStreams([]);
    setUserMap({});
    setMessages([]);
    setIsScreenSharing(false);
    setIsRecording(false);

    // STEP 9: SOCKET CLEANUP
    socket.off();
    socket.disconnect();

    // STEP 10: NAVIGATE
    navigate("/");
  };

  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
        });

        screenStreamRef.current = screenStream;

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
    const cameraTrack = localStream.current?.getVideoTracks()[0];

    // 1. STOP SCREEN TRACK FIRST
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => {
        t.stop();
        t.enabled = false;
      });
      screenStreamRef.current = null;
    }

    // 2. RESTORE CAMERA TRACK TO PEERS (CRITICAL)
    if (cameraTrack) {
      Object.values(peers.current).forEach((pc: RTCPeerConnection) => {
        const sender = pc
          .getSenders()
          .find((s) => s.track?.kind === "video");

        if (sender) {
          sender.replaceTrack(cameraTrack);
        }
      });
    }

    // 3. RESTORE LOCAL VIDEO
    if (localVideoRef.current && localStream.current) {
      localVideoRef.current.srcObject = localStream.current;
    }

    setIsScreenSharing(false);
  };

  const toggleRecording = () => {
    if (!isRecording) {
      if (!localStream.current) return;

      // START SPEECH
      startSpeechRecognition();

      // START RECORDING
      const recorder = new MediaRecorder(localStream.current, {
        mimeType: "video/webm",
      });

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
      // STOP SPEECH
      stopSpeechRecognition();

      // STOP RECORDING
      mediaRecorderRef.current?.stop();
      mediaRecorderRef.current = null;

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
      
      {/* LEFT PANEL */}
      <div className="absolute top-4 right-4 w-80 bg-slate-900 rounded-lg shadow-lg flex flex-col">

        {/* HEADER */}
        <div className="flex items-center justify-between p-2 border-b border-slate-700">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="text-sm bg-slate-700 px-2 py-1 rounded"
          >
            ☰
          </button>

          <h2 className="text-sm capitalize">{activeTab}</h2>
        </div>

        {/* DROPDOWN MENU */}
        {showMenu && (
          <div className="absolute top-10 left-2 bg-slate-800 rounded shadow-md z-10">
            <button
              onClick={() => {
                setActiveTab("participants");
                setShowMenu(false);
              }}
              className="block px-3 py-2 hover:bg-slate-700 w-full text-left"
            >
              Participants
            </button>

            <button
              onClick={() => {
                setActiveTab("chat");
                setShowMenu(false);
              }}
              className="block px-3 py-2 hover:bg-slate-700 w-full text-left"
            >
              Chat
            </button>

            <button
              onClick={() => {
                setActiveTab("transcript");
                setShowMenu(false);
              }}
              className="block px-3 py-2 hover:bg-slate-700 w-full text-left"
            >
              Transcription
            </button>
          </div>
        )}

        {/* CONTENT */}
        <div className="p-2 h-64 overflow-y-auto">

          {/* PARTICIPANTS */}
          {activeTab === "participants" && (
            <>
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
            </>
          )}

          {/* CHAT */}
          {activeTab === "chat" && (
            <div className="flex flex-col h-full">

              {/* MESSAGES (SCROLLABLE) */}
              <div className="flex-1 overflow-y-auto space-y-2 mb-2">
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

              {/* INPUT (FIXED BOTTOM) */}
              <div className="flex gap-2 border-t border-slate-700 pt-2">
                <input
                  className="flex-1 p-2 rounded text-black text-sm"
                  value={message}
                  onChange={(e) => {
                    setMessage(e.target.value);
                    socket.emit("typing", { roomId });
                  }}
                />
                <button
                  onClick={sendMessage}
                  className="bg-blue-600 px-3 rounded text-sm"
                >
                  Send
                </button>
              </div>
            </div>
          )}

          {/* TRANSCRIPTION */}
          {activeTab === "transcript" && (
            <div className="text-sm text-gray-300 whitespace-pre-wrap">
              {transcript || "Start recording to generate transcription..."}
            </div>
          )}

        </div>
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
    </div>
  );
}