import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { postLinkedInCode } from "../api/api";

const LinkedInCallback = ({ onAuthSuccess }) => {
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const hasProcessed = useRef(false); // Prevent double processing

  useEffect(() => {
    const handleCallback = async () => {
      if (hasProcessed.current) return;
      hasProcessed.current = true;
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        const state = params.get("state");
        const err = params.get("error");

        console.log("LinkedIn Callback:", {
          code: code ? "present" : "missing",
          codeLength: code?.length,
          state,
          err,
        });

        if (err) {
          console.error("LinkedIn returned error:", err);
          setError(`LinkedIn error: ${err}`);
          return;
        }

        const savedState = sessionStorage.getItem("linkedin_oauth_state");
        if (state !== savedState) {
          console.error("State mismatch:", {
            received: state,
            saved: savedState,
          });
          setError("Invalid state - possible CSRF");
          return;
        }

        if (!code) {
          setError("No authorization code received");
          return;
        }

        console.log("Authorization Code:", code);
        console.log("Attempting to exchange code for token...");
        console.log(
          "API URL:",
          process.env.REACT_APP_API_URL || "http://localhost:5000",
        );
        console.log(
          "Making request to:",
          `${process.env.REACT_APP_API_URL || "http://localhost:5000"}/api/auth/linkedin`,
        );

        try {
          const { data } = await postLinkedInCode(code);

          console.log("✅ Authentication successful:", data);

          localStorage.setItem("token", data.token);
          localStorage.setItem("user", JSON.stringify(data.user));

          if (onAuthSuccess) {
            onAuthSuccess(data.user);
          }

          navigate("/chat");
        } catch (apiError) {
          console.error("❌ API call failed:", apiError);
          console.error("Response status:", apiError.response?.status);
          console.error("Response data:", apiError.response?.data);
          console.error("Request config:", apiError.config);
          throw apiError;
        }
      } catch (e) {
        console.error("Authentication error:", e);
        console.error("Error details:", {
          message: e.message,
          response: e.response,
          request: e.request,
          config: e.config,
        });

        // More detailed error handling
        if (e.message === "Network Error") {
          setError(
            "Cannot connect to server. Please ensure the backend is running on port 5002.",
          );
        } else if (e.response) {
          // Server responded with error
          console.error("Server error response:", e.response.data);
          setError(
            e.response.data?.error || `Server error: ${e.response.status}`,
          );
        } else if (e.request) {
          // Request was made but no response
          setError(
            "No response from server. Check if backend is running on port 5002.",
          );
        } else {
          setError(e.message || "Unknown error occurred");
        }
      } finally {
        setLoading(false);
      }
    };

    handleCallback();
  }, [navigate, onAuthSuccess]);

  // Auto-redirect after error
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => navigate("/"), 5000);
      return () => clearTimeout(timer);
    }
  }, [error, navigate]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", marginTop: "3rem" }}>
        <p>Authenticating… please wait.</p>
      </div>
    );
  }

  return (
    <div style={{ textAlign: "center", marginTop: "3rem" }}>
      <p style={{ color: "red" }}>Error: {error}</p>
      <p>Redirecting to login in 5 seconds...</p>
      <button onClick={() => navigate("/")}>Go to Login Now</button>
    </div>
  );
};

export default LinkedInCallback;
