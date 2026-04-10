import { useNavigate } from "react-router-dom";

export default function Navbar() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/auth");
  };

  return (
    <div className="flex justify-between items-center px-6 py-4 bg-slate-900 text-white shadow">
      <h1
        className="text-xl font-bold cursor-pointer"
        onClick={() => navigate("/")}
      >
        IntelliMeet
      </h1>

      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("/")}
          className="hover:text-blue-400"
        >
          Lobby
        </button>

        <button
          onClick={handleLogout}
          className="bg-red-500 px-3 py-1 rounded hover:bg-red-600"
        >
          Logout
        </button>
      </div>
    </div>
  );
}