import axios from "axios";

export const api = axios.create({
  baseURL: "http://localhost:5000/api",
});

// Attach token automatically
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("token"); // ✅ FIX

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});