import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5002";
const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add token to requests if it exists
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle token expiration
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/";
    }
    return Promise.reject(error);
  }
);

// Auth endpoints
export const postLinkedInCode = (code) => {
  return api.post("/api/auth/linkedin", { code });
};

export const getProfile = () => {
  return api.get("/api/auth/profile");
};

export const postLogout = () => {
  return api.post("/api/auth/logout");
};

// Message endpoints
export const fetchContacts = () => {
  return api.get("/api/messages/users/all");
};

export const fetchChatHistory = (userId) => {
  return api.get(`/api/messages/${userId}`);
};

export const postMessage = (receiverId, content) => {
  return api.post("/api/messages", { receiverId, content });
};

export default api;
