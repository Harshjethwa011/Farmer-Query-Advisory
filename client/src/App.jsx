
import { Routes, Route, Navigate } from "react-router-dom";

import { useAuth } from "./context/AuthContext";

import ProtectedRoute from "./components/ProtectedRoute";

import AppShell from "./components/AppShell";

import Landing from "./pages/Landing";

import Auth from "./pages/Auth";

import Dashboard from "./pages/Dashboard";

import Assistant from "./pages/Assistant";

import CropAdvisory from "./pages/CropAdvisory";

import DiseaseDetection from "./pages/DiseaseDetection";

import Weather from "./pages/Weather";

import History from "./pages/History";

import Profile from "./pages/Profile";

import Admin from "./pages/Admin";
export default function App() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route
        path="/"
        element={user ? <Navigate to="/dashboard" replace /> : <Landing />}
      />
      <Route
        path="/login"
        element={user ? <Navigate to="/dashboard" replace /> : <Auth />}
      />
      <Route
        path="/register"
        element={
          user ? <Navigate to="/dashboard" replace /> : <Auth mode="register" />
        }
      />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          
          <Route path="/dashboard" element={<Dashboard />} />
          
          <Route path="/assistant" element={<Assistant />} />
          
          <Route path="/crop-advisory" element={<CropAdvisory />} />
          
          <Route path="/disease-detection" element={<DiseaseDetection />} />
          
          <Route path="/weather" element={<Weather />} />
          
          <Route path="/history" element={<History />} />
          
          <Route path="/profile" element={<Profile />} />
        </Route>

      </Route>

     
      <Route element={<ProtectedRoute admin />}>
     
        <Route element={<AppShell />}>
     
          <Route path="/admin" element={<Admin />} />
     
        </Route>
     
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
