import axios from "axios";
import { auth } from "../config/firebase";

const API_BASE_URL = " https://gulflike-wai-unawares.ngrok-free.dev";

const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 15000,
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