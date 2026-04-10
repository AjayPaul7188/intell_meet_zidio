import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import Navbar from "../components/Navbar";
import axios from "axios";

export default function Lobby() {
  const navigate = useNavigate();

  const [roomId, setRoomId] = useState("");
  const [title, setTitle] = useState("");
  const [meeting, setMeeting] = useState<any>(null);

  // Join existing meeting
  const handleJoin = () => {
    if (!roomId.trim()) return;
    navigate(`/room/${roomId}`);
  };

  // Create meeting
  const handleCreate = async () => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        console.log("No token found");
        return;
      }

      const res = await axios.post(
        "http://localhost:5000/api/meetings",
        { title },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setMeeting(res.data);
    } catch (err) {
      console.error("Create meeting error:", err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />

      <div className="flex flex-col items-center justify-center mt-20 px-4">
        <h1 className="text-4xl font-bold mb-8">
          Welcome to IntelliMeet
        </h1>

        <div className="grid md:grid-cols-2 gap-8 w-full max-w-4xl">
          <div className="bg-slate-800 p-6 rounded-xl shadow">
            <h2 className="text-xl mb-4">Join Meeting</h2>

            <Input
              placeholder="Enter Meeting ID"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
            />

            <Button className="w-full mt-4" onClick={handleJoin}>
              Join
            </Button>
          </div>

          <div className="bg-slate-800 p-6 rounded-xl shadow">
            <h2 className="text-xl mb-4">Create Meeting</h2>

            <Input
              placeholder="Enter Meeting Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <Button
              variant="secondary"
              className="w-full mt-4"
              onClick={handleCreate}
            >
              Create
            </Button>
          </div>
        </div>

        {meeting && (
          <div className="mt-8 bg-slate-800 p-6 rounded-xl w-full max-w-md">
            <h3 className="text-lg font-semibold mb-3">
              Meeting Created
            </h3>

            <p><strong>ID:</strong> {meeting._id}</p>
            <p><strong>Title:</strong> {meeting.title}</p>
            <p><strong>Host:</strong> {meeting.host?.username || "You"}</p>

            <Button
              className="w-full mt-4 bg-green-600"
              onClick={() => navigate(`/room/${meeting._id}`)}
            >
              Join Now
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}