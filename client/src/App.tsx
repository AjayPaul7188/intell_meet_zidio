import ProtectedRoute from "./components/ProtectedRoute";
import VideoRoom from "./pages/VideoRoom";

function App() {
  return (
    <ProtectedRoute>
      <VideoRoom />
    </ProtectedRoute>
  );
}

export default App;