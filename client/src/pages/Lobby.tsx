import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";

export default function Lobby() {
  const [roomId, setRoomId] = useState("");
  const navigate = useNavigate();

  const handleJoin = () => {
    if (!roomId.trim()) return;
    navigate(`/room/${roomId}`);
  };

  const handleCreate = () => {
    const id = Math.random().toString(36).substring(2, 8);
    navigate(`/room/${id}`);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white">
      <h1 className="text-3xl mb-6">Meeting Lobby</h1>

      <div className="w-[300px] space-y-3">
        <Input
          placeholder="Enter Room ID"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
        />

        <Button className="w-full" onClick={handleJoin}>
          Join Meeting
        </Button>

        <Button variant="secondary" className="w-full" onClick={handleCreate}>
          Create New Meeting
        </Button>
      </div>
    </div>
  );
}