import { useState, useEffect } from "react";
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

  const [user, setUser] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    const storedUser = JSON.parse(sessionStorage.getItem("authUser") || "{}");
    setUser(storedUser);
  }, []);

  // Upload Avatar
  const uploadAvatar = async () => {
    if (!file) return;

    try {
      const token = sessionStorage.getItem("token");

      const formData = new FormData();
      formData.append("avatar", file);

      const res = await axios.post(
        "http://localhost:5000/api/auth/avatar",
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const updatedUser = { ...user, avatar: res.data.avatar };
      setUser(updatedUser);
      sessionStorage.setItem("authUser", JSON.stringify(updatedUser));
    } catch (err) {
      console.error("Avatar upload error:", err);
    }
  };

  const handleJoin = () => {
    if (!roomId.trim()) return;
    navigate(`/room/${roomId}`);
  };

  const handleCreate = async () => {
    try {
      const token = sessionStorage.getItem("token");

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
      console.error(err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <Navbar />

      <div className="flex flex-col items-center mt-10 gap-6 px-4">

        {/* PROFILE SECTION */}
        {user && (
          <div className="bg-slate-800 p-6 rounded-xl w-full max-w-md">
            <h2 className="text-xl mb-4">Your Profile</h2>

            <div className="flex items-center gap-4">
              <img
                src={user.avatar || "https://via.placeholder.com/100"}
                className="w-16 h-16 rounded-full object-cover"
              />

              <div>
                <p className="font-semibold">{user.name}</p>
                <p className="text-sm text-gray-400">{user.email}</p>
              </div>
            </div>

            <input
              type="file"
              className="mt-4"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />

            <Button className="mt-2 w-full" onClick={uploadAvatar}>
              Upload Avatar
            </Button>
          </div>
        )}

        {/* JOIN / CREATE */}
        <div className="grid md:grid-cols-2 gap-8 w-full max-w-4xl">
          <div className="bg-slate-800 p-6 rounded-xl">
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

          <div className="bg-slate-800 p-6 rounded-xl">
            <h2 className="text-xl mb-4">Create Meeting</h2>

            <Input
              placeholder="Meeting Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <Button className="w-full mt-4" onClick={handleCreate}>
              Create
            </Button>
          </div>
        </div>

        {meeting && (
          <div className="bg-slate-800 p-6 rounded-xl w-full max-w-md">
            <p>ID: {meeting._id}</p>

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