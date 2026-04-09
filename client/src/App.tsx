import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";

import Lobby from "./pages/Lobby";
import VideoRoom from "./pages/VideoRoom";

function App() {
  return (
    <BrowserRouter>
      <ProtectedRoute>
        <Routes>
          <Route path="/" element={<Lobby />} />
          <Route path="/room/:roomId" element={<VideoRoom />} />
        </Routes>
      </ProtectedRoute>
    </BrowserRouter>
  );
}

export default App;