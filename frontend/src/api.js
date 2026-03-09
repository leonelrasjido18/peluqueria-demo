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
export const getNetRevenue = async () => { return (await api.get('/stats/net-revenue')).data; };

// Agenda Semanal
export const getWeekAppointments = async (startDate, endDate) => { return (await api.get(`/appointments/week?startDate=${startDate}&endDate=${endDate}`)).data; };

// Exportar CSV
export const exportAppointmentsCSV = async (month, year) => {
    const params = month && year ? `?month=${month}&year=${year}` : '';
    const response = await api.get(`/appointments/export${params}`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `turnos_${month || 'all'}_${year || 'all'}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
};

// Galería
export const getGallery = async () => { return (await api.get('/gallery')).data; };
export const addGalleryItem = async (data) => { return (await api.post('/gallery', data)).data; };
export const deleteGalleryItem = async (id) => { return (await api.delete(`/gallery/${id}`)).data; };

// Reseñas
export const getReviews = async () => { return (await api.get('/reviews')).data; };
export const addReview = async (data) => { return (await api.post('/reviews', data)).data; };
export const deleteReview = async (id) => { return (await api.delete(`/reviews/${id}`)).data; };

// Clientes (Cumpleaños)
export const getClients = async () => { return (await api.get('/clients')).data; };
export const addClient = async (data) => { return (await api.post('/clients', data)).data; };
export const updateClient = async (id, data) => { return (await api.put(`/clients/${id}`, data)).data; };
export const deleteClient = async (id) => { return (await api.delete(`/clients/${id}`)).data; };
export const getUpcomingBirthdays = async () => { try { return (await api.get('/clients/birthdays/upcoming')).data; } catch(e) { return []; } };
export const getFavoriteService = async (phone) => { return (await api.get(`/clients/${encodeURIComponent(phone)}/favorite-service`)).data; };

// Promociones
export const getPromotions = async () => { return (await api.get('/promotions')).data; };
export const addPromotion = async (data) => { return (await api.post('/promotions', data)).data; };
export const togglePromotion = async (id) => { return (await api.put(`/promotions/${id}/toggle`)).data; };
export const deletePromotion = async (id) => { return (await api.delete(`/promotions/${id}`)).data; };
export const validatePromoCode = async (code) => { try { return (await api.post('/promotions/validate', { code })).data; } catch(e) { return { valid: false, error: e.response?.data?.error || 'Código inválido' }; } };

// QR Reserva
export const getBookingQR = async () => { return (await api.get('/booking-qr')).data; };

// Cancelacion / Reagendado por token (públicos)
export const getAppointmentByToken = async (token) => { return (await api.get(`/appointments/cancel/${token}`)).data; };
export const cancelAppointmentByToken = async (token) => { return (await api.post(`/appointments/cancel/${token}`)).data; };
export const rescheduleAppointmentByToken = async (token, newDate, newTime) => { return (await api.post(`/appointments/reschedule/${token}`, { newDate, newTime })).data; };

// Marcar turno como completado
export const markAppointmentCompleted = async (id) => { return (await api.put(`/appointments/${id}/status`, { status: 'completed' })).data; };
