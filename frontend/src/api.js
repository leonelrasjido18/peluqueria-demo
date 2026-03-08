import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'https://synory.tech/api',
});

export const getServices = async () => {
    const response = await api.get('/services');
    return response.data;
};

export const addService = async (serviceData) => {
    const response = await api.post('/services', serviceData);
    return response.data;
};

export const updateService = async (id, serviceData) => {
    const response = await api.put(`/services/${id}`, serviceData);
    return response.data;
};

export const deleteService = async (id) => {
    const response = await api.delete(`/services/${id}`);
    return response.data;
};

export const getSchedules = async () => {
    const response = await api.get('/schedules');
    return response.data;
};

export const addSchedule = async (time) => {
    const response = await api.post('/schedules', { time });
    return response.data;
};

export const deleteSchedule = async (id) => {
    const response = await api.delete(`/schedules/${id}`);
    return response.data;
};

export const createAppointment = async (appointmentData) => {
    const response = await api.post('/appointments', appointmentData);
    return response.data;
};

export const createManualAppointment = async (appointmentData) => {
    const response = await api.post('/appointments/manual', appointmentData);
    return response.data;
};

export const getBookedTimes = async (date) => {
    const response = await api.get(`/appointments/booked?date=${date}`);
    return response.data;
};

export const login = async (phone, password) => {
    const response = await api.post('/auth/login', { phone, password });
    return response.data;
};

export const getAppointments = async () => {
    const response = await api.get('/appointments');
    return response.data;
};

export const updateAppointmentStatus = async (id, status) => {
    const response = await api.put(`/appointments/${id}/status`, { status });
    return response.data;
};

export const deleteAppointment = async (id) => {
    const response = await api.delete(`/appointments/${id}`);
    return response.data;
};

export const getWhatsAppStatus = async () => {
    try {
        const res = await api.get('/whatsapp/status');
        return res.data;
    } catch (error) {
        console.error("Error obtaining WhatsApp status", error);
        return { ready: false, qrUrl: null };
    }
};

export const startWhatsAppConnection = async () => {
    try {
        const res = await api.post('/whatsapp/start');
        return res.data;
    } catch (error) {
        console.error("Error starting WhatsApp", error);
        return { success: false };
    }
};

export const unlinkWhatsAppAPI = async () => {
    try {
        const res = await api.post('/whatsapp/unlink');
        return res.data;
    } catch (error) {
        console.error("Error unlinking WhatsApp", error);
        return { success: false };
    }
};

export const getMpToken = async () => {
    try {
        const res = await api.get('/settings/mercadopago');
        return res.data;
    } catch (error) {
        console.error("Error getting MP token", error);
        return { token: '' };
    }
};

export const saveMpToken = async (token) => {
    try {
        const res = await api.post('/settings/mercadopago', { token });
        return res.data;
    } catch (error) {
        console.error("Error saving MP token", error);
        return { success: false };
    }
};

export const unlinkMpToken = async () => {
    try {
        const res = await api.delete('/settings/mercadopago');
        return res.data;
    } catch (error) {
        console.error("Error deleting MP token", error);
        return { success: false };
    }
};
