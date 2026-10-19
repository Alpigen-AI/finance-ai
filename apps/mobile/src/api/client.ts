import axios from "axios";
import { auth } from "../config/firebase";

const API_BASE_URL = "https://alpigen-api-187360943592.us-central1.run.app";

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 200000,
    headers: {
        "ngrok-skip-browser-warning": "true",
        "Content-Type": "application/json",
    },
});

api.interceptors.request.use(async (config) => {
    const user = auth.currentUser;
    if (user) {
        const token = await user.getIdToken(true);
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;