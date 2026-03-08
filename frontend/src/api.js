import axios from 'axios';

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'https://synory.tech/api',
});

// SEGURIDAD: Interceptor para agregar token de autenticación
api.interceptors.request.use((config) => {
    const userData = localStorage.getItem('user');
    if (userData) {
        try {
            const user = JSON.parse(userData);
            if (user.token) {
                config.headers['Authorization'] = `Bearer ${user.token}`;
            }
        } catch (e) {}
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            const currentPath = window.location.pathname;
            if (currentPath === '/dashboard') {
                localStorage.removeItem('user');
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

// ==========================================
// ENDPOINTS PÚBLICOS
// ==========================================
export const getServices = async () => { return (await api.get('/services')).data; };
export const getSchedules = async () => { return (await api.get('/schedules')).data; };
export const getBookedTimes = async (date) => { return (await api.get(`/appointments/booked?date=${date}`)).data; };
export const createAppointment = async (data) => { return (await api.post('/appointments', data)).data; };
export const login = async (phone, password) => { return (await api.post('/auth/login', { phone, password })).data; };

// ==========================================
// ENDPOINTS PROTEGIDOS
// ==========================================
// Servicios
export const addService = async (data) => { return (await api.post('/services', data)).data; };
export const updateService = async (id, data) => { return (await api.put(`/services/${id}`, data)).data; };
export const deleteService = async (id) => { return (await api.delete(`/services/${id}`)).data; };

// Horarios
export const addSchedule = async (time) => { return (await api.post('/schedules', { time })).data; };
export const deleteSchedule = async (id) => { return (await api.delete(`/schedules/${id}`)).data; };

// Turnos
export const getAppointments = async () => { return (await api.get('/appointments')).data; };
export const createManualAppointment = async (data) => { return (await api.post('/appointments/manual', data)).data; };
export const updateAppointmentStatus = async (id, status) => { return (await api.put(`/appointments/${id}/status`, { status })).data; };
export const deleteAppointment = async (id) => { return (await api.delete(`/appointments/${id}`)).data; };

// WhatsApp
export const getWhatsAppStatus = async () => { try { return (await api.get('/whatsapp/status')).data; } catch(e) { return { ready: false, qrUrl: null }; } };
export const startWhatsAppConnection = async () => { try { return (await api.post('/whatsapp/start')).data; } catch(e) { return { success: false }; } };
export const unlinkWhatsAppAPI = async () => { try { return (await api.post('/whatsapp/unlink')).data; } catch(e) { return { success: false }; } };

// Mercado Pago
export const getMpToken = async () => { try { return (await api.get('/settings/mercadopago')).data; } catch(e) { return { token: '' }; } };
export const saveMpToken = async (token) => { try { return (await api.post('/settings/mercadopago', { token })).data; } catch(e) { return { success: false }; } };
export const unlinkMpToken = async () => { try { return (await api.delete('/settings/mercadopago')).data; } catch(e) { return { success: false }; } };

// ==========================================
// NUEVAS FUNCIONALIDADES
// ==========================================

// Bloqueo de Horarios
export const getBlockedTimes = async () => { return (await api.get('/blocked-times')).data; };
export const addBlockedTime = async (data) => { return (await api.post('/blocked-times', data)).data; };
export const deleteBlockedTime = async (id) => { return (await api.delete(`/blocked-times/${id}`)).data; };

// Ficha de Cliente
export const getClientHistory = async (phone) => { return (await api.get(`/clients/${encodeURIComponent(phone)}/history`)).data; };
export const getClientNotes = async (phone) => { return (await api.get(`/clients/${encodeURIComponent(phone)}/notes`)).data; };
export const addClientNote = async (phone, note) => { return (await api.post(`/clients/${encodeURIComponent(phone)}/notes`, { note })).data; };
export const deleteClientNote = async (id) => { return (await api.delete(`/clients/notes/${id}`)).data; };

// Gastos
export const getExpenses = async (month, year) => {
    const params = month && year ? `?month=${month}&year=${year}` : '';
    return (await api.get(`/expenses${params}`)).data;
};
export const addExpense = async (data) => { return (await api.post('/expenses', data)).data; };
export const deleteExpense = async (id) => { return (await api.delete(`/expenses/${id}`)).data; };

// Buffer de Limpieza
export const getBufferMinutes = async () => { try { return (await api.get('/settings/buffer')).data; } catch(e) { return { minutes: 0 }; } };
export const saveBufferMinutes = async (minutes) => { return (await api.post('/settings/buffer', { minutes })).data; };

// Estadísticas
export const getStatsPeaks = async () => { return (await api.get('/stats/peaks')).data; };
