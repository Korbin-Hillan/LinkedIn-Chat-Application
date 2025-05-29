// src/App.js
import React, { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LinkedInLogin from "./components/LinkedInLogin";
import LinkedInCallback from "./components/LinkedInCallback";
import Chat from "./components/Chat";
import api from "./api/api";

function RequireAuth({ children }) {
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    setAuthenticated(!!token);
    setChecking(false);
  }, []);

  if (checking) {
    return <div>Loading...</div>;
  }

  if (!authenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function App() {
  const [user, setUser] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const token = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");

    if (token && savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);

        // Set default auth header
        api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      } catch (error) {
        console.error("Error parsing saved user:", error);
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      }
    }

    setLoadingProfile(false);
  }, []);

  const handleAuthSuccess = (userData) => {
    setUser(userData);
  };

  if (loadingProfile) {
    return (
      <div style={{ textAlign: "center", marginTop: "2rem" }}>
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public home/login page */}
        <Route
          path="/"
          element={user ? <Navigate to="/chat" replace /> : <LinkedInLogin />}
        />

        {/* OAuth callback route */}
        <Route
          path="/auth/linkedin/callback"
          element={<LinkedInCallback onAuthSuccess={handleAuthSuccess} />}
        />

        {/* Protected chat route */}
        <Route
          path="/chat"
          element={
            <RequireAuth>
              <Chat />
            </RequireAuth>
          }
        />

        {/* Catch-all redirects to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
