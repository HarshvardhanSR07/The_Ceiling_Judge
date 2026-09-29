
import axios from "axios";

export const api = axios.create({
  baseURL: "/",
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("forge_session");
  if (token) {
    config.headers["X-Session"] = token;
  }
  return config;
});

