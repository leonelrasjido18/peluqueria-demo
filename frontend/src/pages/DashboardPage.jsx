import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, DollarSign, Users, Clock, Scissors, LogOut, Settings, Smartphone, CheckCircle, Edit, Trash2, Plus, Menu, X, Ban, FileText, TrendingUp, Wallet, Star, Gift, Tag, Download, QrCode, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { getAppointments, getWhatsAppStatus, startWhatsAppConnection, getServices, addService, updateService, deleteService, getSchedules, addSchedule, deleteSchedule, deleteAppointment, createManualAppointment, getMpToken, saveMpToken, unlinkWhatsAppAPI, unlinkMpToken, getBlockedTimes, addBlockedTime, deleteBlockedTime, getClientHistory, getClientNotes, addClientNote, deleteClientNote, getExpenses, addExpense, deleteExpense, getBufferMinutes, saveBufferMinutes, getStatsPeaks, getNetRevenue, getWeekAppointments, exportAppointmentsCSV, getReviews, deleteReview, getClients, addClient, updateClient, deleteClient, getUpcomingBirthdays, getFavoriteService, getPromotions, addPromotion, togglePromotion, deletePromotion, markAppointmentCompleted } from '../api';

const DashboardPage = () => {
    const [activeTab, setActiveTab] = useState('calendar'); // 'calendar', 'stats', 'config'
    const [appointments, setAppointments] = useState([]);
    const [services, setServices] = useState([]);
    const [editingService, setEditingService] = useState(null);
    const [newService, setNewService] = useState({ name: '', duration: '', price: '' });
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
    const [schedules, setSchedules] = useState([]);
    const [newSchedule, setNewSchedule] = useState('');
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);
    const [newManualAppointment, setNewManualAppointment] = useState({ clientName: '', clientPhone: '', serviceId: '', appointmentDate: '', appointmentTime: '' });
    const [lastAppointmentCount, setLastAppointmentCount] = useState(0);
    const [showToast, setShowToast] = useState(false);
    const [toastMessage, setToastMessage] = useState('');

    // WhatsApp State
    const [waStatus, setWaStatus] = useState({ ready: false, qrUrl: null });
    const [loadingWa, setLoadingWa] = useState(false);

    // Mercado Pago State
    const [mpToken, setMpToken] = useState('');
    const [isSavingMp, setIsSavingMp] = useState(false);
    const [mpSavedMessage, setMpSavedMessage] = useState('');

    // Bloqueo de Horarios State
    const [blockedTimes, setBlockedTimes] = useState([]);
    const [newBlock, setNewBlock] = useState({ blockedDate: '', timeFrom: '', timeTo: '', reason: '', fullDay: false });

    // Ficha de Cliente State
    const [clientModal, setClientModal] = useState(null); // { phone, name }
    const [clientHistory, setClientHistory] = useState([]);
    const [clientNotes, setClientNotes] = useState([]);
    const [newNote, setNewNote] = useState('');

    // Gastos State
    const [expenses, setExpenses] = useState([]);
    const [newExpense, setNewExpense] = useState({ description: '', amount: '', expenseDate: new Date().toISOString().split('T')[0] });

    // Buffer State
    const [bufferMinutes, setBufferMinutesState] = useState(0);

    // Estadísticas State
    const [peakStats, setPeakStats] = useState({ byDay: [], byHour: [], byMonth: [] });

    // PWA Install State
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [showInstallBtn, setShowInstallBtn] = useState(false);

    // Weekly Agenda State
    const [weekStart, setWeekStart] = useState(() => {
        const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1);
        return d.toISOString().split('T')[0];
    });
    const [weekAppointments, setWeekAppointments] = useState([]);

    // Gallery State


    // Reviews State
    const [reviews, setReviews] = useState([]);

    // Clients/Birthday State
    const [clients, setClients] = useState([]);
    const [newClient, setNewClient] = useState({ phone: '', name: '', birthday: '' });
    const [upcomingBirthdays, setUpcomingBirthdays] = useState([]);

    // Promotions State
    const [promotions, setPromotions] = useState([]);
    const [newPromo, setNewPromo] = useState({ code: '', description: '', discountPercent: '', maxUses: '', validUntil: '' });

    // Net Revenue State
    const [netRevenueData, setNetRevenueData] = useState([]);

    // Favorite Service State
    const [favoriteService, setFavoriteService] = useState(null);

    // Derived stats
    const todayAppointments = appointments.length;
    const completedAppointments = appointments.filter(a => a.status === 'completed').length;
    const pendingAppointments = appointments.filter(a => a.status === 'scheduled').length;
    const todayRevenue = appointments.filter(a => a.status === 'completed').reduce((sum, a) => sum + a.price, 0);

    useEffect(() => {
        getAppointments().then(data => {
            setAppointments(data);
            setLastAppointmentCount(data.length);
        }).catch(err => console.error(err));
        
        loadServices();
        loadSchedules();
        loadMpToken();
        loadBlockedTimes();
        loadExpenses();
        loadBuffer();
        loadPeakStats();

        // Check for MP oauth returns
        const params = new URLSearchParams(window.location.search);
        if (params.get('mp_success') === 'true') {
            alert('¡Mercado Pago vinculado correctamente!');
            window.history.replaceState({}, document.title, window.location.pathname);
            activeTab !== 'config' && setActiveTab('config');
            } else if (params.get('mp_error')) {
                alert('Error vinculando Mercado Pago: ' + params.get('mp_error'));
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        }, []);

    useEffect(() => {
        const handler = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setShowInstallBtn(true);
        };

        window.addEventListener('beforeinstallprompt', handler);

        // También mostrar instrucciones si es iOS (donde no hay beforeinstallprompt)
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
        if (isIOS && !isStandalone) {
            setShowInstallBtn(true);
        }

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) {
            // Si es iOS, mostrar alerta con instrucciones
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
            if (isIOS) {
                alert("Para instalar en iPhone:\n1. Tocá el botón de Compartir (el cuadradito con flecha)\n2. Elegí 'Agregar a inicio'");
            }
            return;
        }
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
            setShowInstallBtn(false);
        }
    };

    const loadMpToken = async () => {
        const data = await getMpToken();
        if (data && data.token) setMpToken(data.token);
    };

    const loadServices = () => {
        getServices().then(data => setServices(data)).catch(err => console.error(err));
    };

    const loadSchedules = () => {
        getSchedules().then(data => setSchedules(data)).catch(err => console.error(err));
    };

    const handleSaveSchedule = async (e) => {
        e.preventDefault();
        if(!newSchedule) return;
        await addSchedule(newSchedule);
        setNewSchedule('');
        loadSchedules();
    };

    const handleDeleteScheduleObj = async (id) => {
        if(window.confirm('¿Seguro que querés eliminar este horario?')) {
            await deleteSchedule(id);
            loadSchedules();
        }
    };

    const handleDeleteAppointmentObj = async (id) => {
        if(window.confirm('¿Eliminar este turno? (Esto liberará el horario)')) {
            await deleteAppointment(id);
            getAppointments().then(data => setAppointments(data));
        }
    };

    const handleSaveManualAppointment = async (e) => {
        e.preventDefault();
        try {
            await createManualAppointment(newManualAppointment);
            setNewManualAppointment({ clientName: '', clientPhone: '', serviceId: '', appointmentDate: '', appointmentTime: '' });
            setIsManualModalOpen(false);
            const data = await getAppointments();
            setAppointments(data);
        } catch (error) {
            console.error(error);
            alert("Error al crear turno manual");
        }
    };

    const handleSaveService = async (e) => {
        e.preventDefault();
        if (editingService) {
            await updateService(editingService.id, newService);
            setEditingService(null);
        } else {
            await addService({ ...newService, duration: parseInt(newService.duration), price: parseFloat(newService.price) });
        }
        setNewService({ name: '', duration: '', price: '' });
        setIsServiceModalOpen(false);
        loadServices();
    };

    const handleDeleteService = async (id) => {
        if(window.confirm('¿Seguro que querés eliminar este servicio?')) {
            await deleteService(id);
            loadServices();
        }
    };

    // Polling WhatsApp Status when in Config Tab
    useEffect(() => {
        let interval;
        if (activeTab === 'config') {
            checkWaStatus(); // Check immediately
            interval = setInterval(checkWaStatus, 3000); // Check every 3 seconds
        }
        return () => clearInterval(interval);
    }, [activeTab]);

    const checkWaStatus = async () => {
        const status = await getWhatsAppStatus();
        setWaStatus(status);
        if (status.ready || status.qrUrl) {
            setLoadingWa(false);
        }
    };

    const handleStartWhatsApp = async () => {
        setLoadingWa(true);
        await startWhatsAppConnection();
    };

    // --- Lógica de Notificaciones Sonoras y Visuales ---
    const playNotificationSound = () => {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // La5
            oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.4); // La4

            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);

            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.4);
        } catch (e) {
            console.error("Audio block by browser or not supported", e);
        }
    };

    // Polling de nuevos turnos para notificaciones
    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const data = await getAppointments();
                
                // Si hay más turnos que antes (y no es el inicio)
                if (lastAppointmentCount > 0 && data.length > lastAppointmentCount) {
                    const newApp = data[0]; // El más reciente
                    setToastMessage(`¡Nuevo turno: ${newApp.clientName} (${newApp.serviceName})!`);
                    setShowToast(true);
                    playNotificationSound();
                    
                    // Ocultar mensaje después de 6 segundos
                    setTimeout(() => setShowToast(false), 6000);
                }
                
                setAppointments(data);
                setLastAppointmentCount(data.length);
            } catch (err) {
                console.error("Error polling appointments:", err);
            }
        }, 15000); // Consultar cada 15 segundos

        return () => clearInterval(interval);
    }, [lastAppointmentCount]);
    // --------------------------------------------------

    const handleUnlinkWhatsApp = async () => {
        if(window.confirm('¿Seguro que querés desvincular WhatsApp?')) {
            setLoadingWa(true);
            await unlinkWhatsAppAPI();
            setWaStatus({ ready: false, qrUrl: null });
            setLoadingWa(false);
        }
    };

    const handleSaveMpToken = async () => {
        setIsSavingMp(true);
        setMpSavedMessage('');
        const res = await saveMpToken(mpToken);
        setIsSavingMp(false);
        if (res && res.success) {
            setMpSavedMessage('Token guardado correctamente!');
            setTimeout(() => setMpSavedMessage(''), 3000);
        } else {
            setMpSavedMessage('Error al guardar el token.');
        }
    };

    const handleUnlinkMp = async () => {
        if(window.confirm('¿Seguro que querés desvincular Mercado Pago?')) {
            await unlinkMpToken();
            setMpToken('');
            alert('Mercado Pago desvinculado correctamente');
        }
    };

    const logout = () => {
        localStorage.removeItem('user');
        window.location.href = '/login';
    };

    // --- Nuevas funciones ---
    const loadBlockedTimes = () => {
        getBlockedTimes().then(setBlockedTimes).catch(console.error);
    };
    const handleAddBlock = async (e) => {
        e.preventDefault();
        await addBlockedTime(newBlock);
        setNewBlock({ blockedDate: '', timeFrom: '', timeTo: '', reason: '', fullDay: false });
        loadBlockedTimes();
    };
    const handleDeleteBlock = async (id) => {
        if (window.confirm('¿Eliminar este bloqueo?')) { await deleteBlockedTime(id); loadBlockedTimes(); }
    };

    const openClientModal = async (phone, name) => {
        setClientModal({ phone, name });
        setNewNote('');
        const [hist, notes] = await Promise.all([getClientHistory(phone), getClientNotes(phone)]);
        setClientHistory(hist);
        setClientNotes(notes);
    };
    const handleAddNote = async () => {
        if (!newNote.trim() || !clientModal) return;
        await addClientNote(clientModal.phone, newNote);
        setNewNote('');
        setClientNotes(await getClientNotes(clientModal.phone));
    };
    const handleDeleteNote = async (id) => {
        await deleteClientNote(id);
        if (clientModal) setClientNotes(await getClientNotes(clientModal.phone));
    };

    const loadExpenses = () => {
        const now = new Date();
        getExpenses(String(now.getMonth() + 1), String(now.getFullYear())).then(setExpenses).catch(console.error);
    };
    const handleAddExpense = async (e) => {
        e.preventDefault();
        if (!newExpense.description || !newExpense.amount) return;
        await addExpense(newExpense);
        setNewExpense({ description: '', amount: '', expenseDate: new Date().toISOString().split('T')[0] });
        loadExpenses();
    };
    const handleDeleteExpense = async (id) => {
        if (window.confirm('¿Eliminar este gasto?')) { await deleteExpense(id); loadExpenses(); }
    };

    const loadBuffer = async () => {
        const data = await getBufferMinutes();
        setBufferMinutesState(data.minutes || 0);
    };
    const handleSaveBuffer = async () => {
        await saveBufferMinutes(bufferMinutes);
        alert('Buffer de limpieza guardado: ' + bufferMinutes + ' minutos');
    };

    const loadPeakStats = () => {
        getStatsPeaks().then(setPeakStats).catch(console.error);
    };

    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    // ---- NEW FUNCTIONS ----
    const loadWeekAppointments = async (start) => {
        const s = new Date(start + 'T00:00:00');
        const e = new Date(s); e.setDate(e.getDate() + 6);
        const endStr = e.toISOString().split('T')[0];
        try { const data = await getWeekAppointments(start, endStr); setWeekAppointments(data); } catch(err) { console.error(err); }
    };
    const changeWeek = (dir) => {
        const d = new Date(weekStart + 'T00:00:00');
        d.setDate(d.getDate() + (dir * 7));
        const newStart = d.toISOString().split('T')[0];
        setWeekStart(newStart);
        loadWeekAppointments(newStart);
    };
    const getWeekDays = () => {
        const days = []; const s = new Date(weekStart + 'T00:00:00');
        const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
        for (let i = 0; i < 7; i++) {
            const d = new Date(s); d.setDate(d.getDate() + i);
            days.push({ date: d.toISOString().split('T')[0], label: dayNames[i], day: d.getDate() });
        }
        return days;
    };

    const handleMarkCompleted = async (id) => {
        await markAppointmentCompleted(id);
        const data = await getAppointments();
        setAppointments(data);
    };



    const loadReviews = () => { getReviews().then(setReviews).catch(console.error); };
    const handleDeleteReview = async (id) => {
        if (window.confirm('¿Eliminar esta reseña?')) { await deleteReview(id); loadReviews(); }
    };

    const loadClients = () => { getClients().then(setClients).catch(console.error); };
    const loadBirthdays = () => { getUpcomingBirthdays().then(setUpcomingBirthdays).catch(console.error); };
    const handleAddClient = async (e) => {
        e.preventDefault();
        if (!newClient.phone || !newClient.name) return;
        await addClient(newClient);
        setNewClient({ phone: '', name: '', birthday: '' });
        loadClients(); loadBirthdays();
    };
    const handleDeleteClient = async (id) => {
        if (window.confirm('¿Eliminar este cliente?')) { await deleteClient(id); loadClients(); }
    };

    const loadPromotions = () => { getPromotions().then(setPromotions).catch(console.error); };
    const handleAddPromo = async (e) => {
        e.preventDefault();
        if (!newPromo.code || !newPromo.discountPercent) return;
        const res = await addPromotion(newPromo);
        if (res.success) {
            setNewPromo({ code: '', description: '', discountPercent: '', maxUses: '', validUntil: '' });
            loadPromotions();
        } else { alert(res.error || 'Error al crear'); }
    };
    const handleTogglePromo = async (id) => { await togglePromotion(id); loadPromotions(); };
    const handleDeletePromo = async (id) => {
        if (window.confirm('¿Eliminar esta promoción?')) { await deletePromotion(id); loadPromotions(); }
    };

    const loadNetRevenue = () => { getNetRevenue().then(setNetRevenueData).catch(console.error); };

    const handleExportCSV = () => {
        const now = new Date();
        exportAppointmentsCSV(String(now.getMonth() + 1), String(now.getFullYear()));
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
            {/* Visual Notification (Toast) */}
            {showToast && (
                <div 
                    className="animate-fade-in"
                    style={{
                        position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
                        backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--accent-primary)',
                        padding: '15px 25px', borderRadius: '12px', boxShadow: 'var(--shadow-glow)',
                        display: 'flex', alignItems: 'center', gap: '15px', color: 'var(--text-primary)'
                    }}
                >
                    <div style={{ backgroundColor: 'rgba(192, 123, 247, 0.1)', padding: '10px', borderRadius: '50%' }}>
                        <CalendarIcon color="var(--accent-primary)" size={24} />
                    </div>
                    <div>
                        <b style={{ display: 'block', color: 'var(--accent-primary)' }}>¡NUEVA RESERVA!</b>
                        <span style={{ fontSize: '0.9rem' }}>{toastMessage}</span>
                    </div>
                    <button onClick={() => setShowToast(false)} style={{ marginLeft: '10px', color: 'var(--text-secondary)' }}>
                        <X size={18} />
                    </button>
                </div>
            )}

            {/* Mobile Overlay */}
            <div 
                className={`mobile-overlay ${isMobileMenuOpen ? 'mobile-open' : ''}`}
                onClick={() => setIsMobileMenuOpen(false)}
            ></div>

            {/* Sidebar */}
            <aside className={`dashboard-sidebar ${isMobileMenuOpen ? 'mobile-open' : ''}`} style={{ position: 'fixed', top: 0, left: 0, height: '100vh', width: '250px', backgroundColor: 'var(--bg-secondary)', padding: '30px 20px', display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,0.05)', zIndex: 10, overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                    <h2 style={{ color: 'var(--accent-primary)', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                        <Scissors /> YSY Panel
                    </h2>
                    <button 
                        className="mobile-menu-btn" 
                        onClick={() => setIsMobileMenuOpen(false)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '5px' }}
                    >
                        <X size={24} />
                    </button>
                </div>
                <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                    {/* ---- AGENDA ---- */}
                    <div style={{ fontSize: '0.65rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1.5px', padding: '10px 15px 5px', opacity: 0.5 }}>Agenda</div>
                    {[
                        { id: 'calendar', icon: <CalendarIcon size={18} />, label: 'Turnos de Hoy', action: () => {} },
                        { id: 'week', icon: <CalendarIcon size={18} />, label: 'Agenda Semanal', action: () => loadWeekAppointments(weekStart) },
                        { id: 'stats', icon: <DollarSign size={18} />, label: 'Ganancias', action: () => {} },
                    ].map(t => (
                        <button key={t.id} onClick={() => { setActiveTab(t.id); setIsMobileMenuOpen(false); t.action(); }}
                            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 15px', borderRadius: '8px',
                                backgroundColor: activeTab === t.id ? 'rgba(192, 123, 247, 0.1)' : 'transparent',
                                color: activeTab === t.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                transition: 'var(--transition)', width: '100%', textAlign: 'left', fontWeight: '500', fontSize: '0.9rem' }}>
                            {t.icon} {t.label}
                        </button>
                    ))}

                    {/* ---- NEGOCIO ---- */}
                    <div style={{ fontSize: '0.65rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1.5px', padding: '15px 15px 5px', opacity: 0.5 }}>Negocio</div>
                    {[
                        { id: 'services', icon: <Scissors size={18} />, label: 'Servicios', action: () => {} },
                        { id: 'schedules', icon: <Clock size={18} />, label: 'Horarios', action: () => {} },
                        { id: 'blocked', icon: <Ban size={18} />, label: 'Días Libres', action: () => {} },
                        { id: 'expenses', icon: <Wallet size={18} />, label: 'Gastos', action: () => {} },
                        { id: 'peaks', icon: <TrendingUp size={18} />, label: 'Estadísticas', action: () => { loadPeakStats(); loadNetRevenue(); } },
                    ].map(t => (
                        <button key={t.id} onClick={() => { setActiveTab(t.id); setIsMobileMenuOpen(false); t.action(); }}
                            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 15px', borderRadius: '8px',
                                backgroundColor: activeTab === t.id ? 'rgba(192, 123, 247, 0.1)' : 'transparent',
                                color: activeTab === t.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                transition: 'var(--transition)', width: '100%', textAlign: 'left', fontWeight: '500', fontSize: '0.9rem' }}>
                            {t.icon} {t.label}
                        </button>
                    ))}

                    {/* ---- MARKETING ---- */}
                    <div style={{ fontSize: '0.65rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1.5px', padding: '15px 15px 5px', opacity: 0.5 }}>Marketing</div>
                    {[
                        { id: 'reviews', icon: <Star size={18} />, label: 'Reseñas', action: () => loadReviews() },
                        { id: 'clients', icon: <Gift size={18} />, label: 'Clientes', action: () => { loadClients(); loadBirthdays(); } },
                        { id: 'promos', icon: <Tag size={18} />, label: 'Promociones', action: () => loadPromotions() },
                    ].map(t => (
                        <button key={t.id} onClick={() => { setActiveTab(t.id); setIsMobileMenuOpen(false); t.action(); }}
                            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 15px', borderRadius: '8px',
                                backgroundColor: activeTab === t.id ? 'rgba(192, 123, 247, 0.1)' : 'transparent',
                                color: activeTab === t.id ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                transition: 'var(--transition)', width: '100%', textAlign: 'left', fontWeight: '500', fontSize: '0.9rem' }}>
                            {t.icon} {t.label}
                        </button>
                    ))}

                    {/* ---- SISTEMA ---- */}
                    <div style={{ fontSize: '0.65rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1.5px', padding: '15px 15px 5px', opacity: 0.5 }}>Sistema</div>
                    <button onClick={() => { setActiveTab('config'); setIsMobileMenuOpen(false); }}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 15px', borderRadius: '8px',
                            backgroundColor: activeTab === 'config' ? 'rgba(192, 123, 247, 0.1)' : 'transparent',
                            color: activeTab === 'config' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                            transition: 'var(--transition)', width: '100%', textAlign: 'left', fontWeight: '500', fontSize: '0.9rem' }}>
                        <Settings size={18} /> Configuración
                    </button>
                </nav>

                <button
                    onClick={logout}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--error)', padding: '12px 15px', fontWeight: '500', fontSize: '0.9rem', marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '15px' }}
                >
                    <LogOut size={18} /> Cerrar Sesión
                </button>
            </aside>

            {/* Main Content */}
            <main className="dashboard-main" style={{ flex: 1, padding: '40px', marginLeft: '250px' }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', flexWrap: 'wrap', gap: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <button 
                            className="mobile-menu-btn" 
                            onClick={() => setIsMobileMenuOpen(true)}
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-primary)', cursor: 'pointer', padding: '10px', borderRadius: '8px' }}
                        >
                            <Menu size={24} />
                        </button>
                        <div>
                            <h1 style={{ fontSize: '2rem', marginBottom: '5px' }}>Hola, <span style={{ color: 'var(--accent-primary)' }}>Juampi</span></h1>
                            <p style={{ color: 'var(--text-secondary)' }}>Te esperan {pendingAppointments} cortes para hoy.</p>
                        </div>
                    </div>
                    <div style={{ padding: '10px 20px', backgroundColor: 'var(--bg-secondary)', borderRadius: '30px', fontWeight: 'bold' }}>
                        {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                </header>

                {activeTab === 'calendar' && (
                    <div className="animate-fade-in">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
                            <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                                <Clock color="var(--accent-primary)" /> Próximos Cortes
                            </h2>
                            <button
                                onClick={() => setIsManualModalOpen(true)}
                                className="btn-primary"
                                style={{ width: 'auto', padding: '10px 20px', display: 'flex', gap: '8px', alignItems: 'center' }}
                            >
                                <Plus size={18} /> Turno Manual
                            </button>
                            <button
                                onClick={handleExportCSV}
                                className="btn-secondary"
                                style={{ width: 'auto', padding: '10px 20px', display: 'flex', gap: '8px', alignItems: 'center', border: '1px solid rgba(255,255,255,0.1)' }}
                            >
                                <Download size={18} /> Exportar CSV
                            </button>
                        </div>
                        <div style={{ display: 'grid', gap: '15px' }}>
                            {appointments.map(app => (
                                <div key={app.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                        <div style={{ width: '80px', textAlign: 'center' }}>
                                            <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-primary)', display: 'block' }}>{app.appointmentTime}</span>
                                            <small style={{ color: 'var(--accent-primary)' }}>{app.appointmentDate}</small>
                                        </div>
                                        <div style={{ width: '1px', height: '50px', backgroundColor: 'rgba(255,255,255,0.1)' }}></div>
                                        <div>
                                            <h3 style={{ fontSize: '1.2rem', marginBottom: '5px' }}>{app.clientName}</h3>
                                            <p style={{ color: 'var(--accent-primary)' }}>{app.serviceName}</p>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '10px' }}>
                                            ${app.price}
                                        </div>
                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'flex-end' }}>
                                            <span style={{
                                                padding: '5px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold',
                                                backgroundColor: app.status === 'completed' ? 'rgba(0, 204, 102, 0.1)' : app.status === 'pending_payment' ? 'rgba(245, 158, 11, 0.1)' : app.status === 'cancelled' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(192, 123, 247, 0.1)',
                                                color: app.status === 'completed' ? 'var(--success)' : app.status === 'pending_payment' ? '#f59e0b' : app.status === 'cancelled' ? 'var(--error)' : 'var(--accent-primary)'
                                            }}>
                                                {app.status === 'completed' ? 'Completado' : app.status === 'pending_payment' ? 'Abonando Seña...' : app.status === 'cancelled' ? 'Cancelado' : 'Confirmado'}
                                            </span>
                                            {app.clientPhone && (
                                                <button 
                                                    onClick={() => openClientModal(app.clientPhone, app.clientName)}
                                                    style={{ padding: '6px 10px', borderRadius: '20px', backgroundColor: 'rgba(192, 123, 247, 0.1)', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600' }}
                                                    title="Ver ficha del cliente"
                                                >
                                                    <FileText size={14} />
                                                </button>
                                            )}
                                            {app.status === 'scheduled' && (
                                                <button 
                                                    onClick={() => handleMarkCompleted(app.id)}
                                                    style={{ padding: '6px 10px', borderRadius: '20px', backgroundColor: 'rgba(0, 204, 102, 0.1)', border: 'none', color: 'var(--success)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600' }}
                                                    title="Marcar como completado"
                                                >
                                                    <CheckCircle size={14} />
                                                </button>
                                            )}
                                            <button 
                                                onClick={() => handleDeleteAppointmentObj(app.id)}
                                                style={{ padding: '6px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: 'none', color: 'var(--error)', cursor: 'pointer' }}
                                                title="Eliminar turno"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'stats' && (
                    <div className="animate-fade-in">
                        <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <DollarSign color="var(--accent-primary)" /> Resumen del Día
                        </h2>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                            <div className="card glass-panel" style={{ textAlign: 'center' }}>
                                <div style={{ width: '50px', height: '50px', borderRadius: '50%', backgroundColor: 'rgba(192, 123, 247, 0.1)', margin: '0 auto 15px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <DollarSign size={24} color="var(--accent-primary)" />
                                </div>
                                <h3 style={{ color: 'var(--text-secondary)', marginBottom: '5px' }}>Ganancias de Hoy</h3>
                                <div style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>${todayRevenue}</div>
                            </div>

                            <div className="card glass-panel" style={{ textAlign: 'center' }}>
                                <div style={{ width: '50px', height: '50px', borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.05)', margin: '0 auto 15px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Users size={24} color="var(--text-primary)" />
                                </div>
                                <h3 style={{ color: 'var(--text-secondary)', marginBottom: '5px' }}>Total de Clientes</h3>
                                <div style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>{todayAppointments}</div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'services' && (
                    <div className="animate-fade-in">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                                <Scissors color="var(--accent-primary)" /> Mis Servicios
                            </h2>
                            <button 
                                onClick={() => { setEditingService(null); setNewService({ name: '', duration: '', price: '' }); setIsServiceModalOpen(true); }}
                                className="btn-primary" 
                                style={{ padding: '10px 15px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}
                            >
                                <Plus size={18} /> Nuevo
                            </button>
                        </div>

                        <div style={{ display: 'grid', gap: '15px' }}>
                            {services.map(s => (
                                <div key={s.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <h3 style={{ fontSize: '1.2rem', marginBottom: '5px' }}>{s.name}</h3>
                                        <p style={{ color: 'var(--text-secondary)' }}>{s.duration} min • <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>${s.price}</span></p>
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button onClick={() => { setEditingService(s); setNewService({ name: s.name, duration: s.duration, price: s.price }); setIsServiceModalOpen(true); }} style={{ padding: '10px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: 'none', cursor: 'pointer', transition: 'var(--transition)' }}>
                                            <Edit size={18} />
                                        </button>
                                        <button onClick={() => handleDeleteService(s.id)} style={{ padding: '10px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', border: 'none', cursor: 'pointer', transition: 'var(--transition)' }}>
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {services.length === 0 && (
                                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '20px' }}>No tienes servicios registrados.</p>
                            )}
                        </div>

                        {/* Modal para Servicio */}
                        {isServiceModalOpen && (
                            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                                <div className="card glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '500px', padding: '30px', position: 'relative' }}>
                                    <button 
                                        onClick={() => setIsServiceModalOpen(false)}
                                        style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                                    >
                                        <X size={24} />
                                    </button>
                                    <h3 style={{ marginBottom: '20px', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-primary)' }}>
                                        {editingService ? <Edit size={24} color="var(--accent-primary)" /> : <Plus size={24} color="var(--accent-primary)" />} 
                                        {editingService ? 'Editar Servicio' : 'Nuevo Servicio'}
                                    </h3>
                                    <form onSubmit={handleSaveService} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                        <div>
                                            <label className="input-label" style={{ marginBottom: '8px', display: 'block' }}>Nombre del Servicio</label>
                                            <input type="text" className="input-field" placeholder="Ej: Corte Clásico" value={newService.name} onChange={(e) => setNewService({...newService, name: e.target.value})} required style={{ padding: '12px' }} />
                                        </div>
                                        <div style={{ display: 'flex', gap: '15px' }}>
                                            <div style={{ flex: 1 }}>
                                                <label className="input-label" style={{ marginBottom: '8px', display: 'block' }}>Duración (minutos)</label>
                                                <input type="number" className="input-field" placeholder="30" value={newService.duration} onChange={(e) => setNewService({...newService, duration: e.target.value})} required style={{ padding: '12px' }} min="1" />
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <label className="input-label" style={{ marginBottom: '8px', display: 'block' }}>Precio ($)</label>
                                                <input type="number" className="input-field" placeholder="5000" value={newService.price} onChange={(e) => setNewService({...newService, price: e.target.value})} required style={{ padding: '12px' }} min="0" />
                                            </div>
                                        </div>
                                        <button type="submit" className="btn-primary" style={{ padding: '15px', marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontSize: '1.1rem' }}>
                                            {editingService ? 'Guardar Cambios' : 'Crear Servicio'} <CheckCircle size={20} /> 
                                        </button>
                                    </form>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'schedules' && (
                    <div className="animate-fade-in">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                                <Clock color="var(--accent-primary)" /> Mis Horarios
                            </h2>
                        </div>

                        <div className="card glass-panel" style={{ marginBottom: '30px', maxWidth: '400px' }}>
                            <h3 style={{ marginBottom: '15px' }}>Agregar Horario</h3>
                            <form onSubmit={handleSaveSchedule} style={{ display: 'flex', gap: '10px' }}>
                                <input 
                                    type="time" 
                                    className="input-field" 
                                    value={newSchedule} 
                                    onChange={(e) => setNewSchedule(e.target.value)} 
                                    required 
                                    style={{ flex: 1, padding: '12px' }} 
                                />
                                <button type="submit" className="btn-primary" style={{ padding: '0 20px', borderRadius: '8px' }}>
                                    <Plus size={20} />
                                </button>
                            </form>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '15px' }}>
                            {schedules.map(s => (
                                <div key={s.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px' }}>
                                    <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{s.time}</span>
                                    <button onClick={() => handleDeleteScheduleObj(s.id)} style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', border: 'none', cursor: 'pointer', transition: 'var(--transition)' }}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                            {schedules.length === 0 && (
                                <p style={{ color: 'var(--text-secondary)', gridColumn: '1 / -1' }}>No hay horarios configurados.</p>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'config' && (
                    <div className="animate-fade-in">
                        <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Settings color="var(--accent-primary)" /> Configuración
                        </h2>

                        {/* PWA Install Banner */}
                        {showInstallBtn && (
                            <div className="card glass-panel animate-fade-in" style={{ 
                                marginBottom: '30px', 
                                padding: '20px', 
                                background: 'linear-gradient(135deg, rgba(192, 123, 247, 0.2) 0%, rgba(10, 10, 10, 0.5) 100%)',
                                border: '1px solid var(--accent-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '20px',
                                flexWrap: 'wrap'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                    <div style={{ backgroundColor: 'var(--accent-primary)', padding: '10px', borderRadius: '12px' }}>
                                        <Smartphone size={24} color="white" />
                                    </div>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Instalar YSY Panel en tu Celular</h3>
                                        <p style={{ margin: '5px 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                            Accedé al panel directamente desde tu pantalla de inicio como una aplicación.
                                        </p>
                                    </div>
                                </div>
                                <button onClick={handleInstallClick} className="btn-primary" style={{ width: 'auto', padding: '10px 25px' }}>
                                    {/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream ? 'Ver Instrucciones' : 'Instalar Ahora'}
                                </button>
                            </div>
                        )}

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '30px', alignItems: 'flex-start' }}>
                            <div className="card glass-panel" style={{ flex: '1 1 300px', margin: 0 }}>
                            <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '15px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Smartphone size={24} color="var(--accent-primary)" /> Conexión con WhatsApp
                            </h3>

                            <div style={{ textAlign: 'center', padding: '20px 0' }}>
                                {waStatus.ready ? (
                                    <div className="animate-fade-in">
                                        <CheckCircle size={60} color="var(--success)" style={{ margin: '0 auto 15px' }} />
                                        <h2 style={{ color: 'var(--success)' }}>¡Sincronización Exitosa!</h2>
                                        <p style={{ color: 'var(--text-secondary)', marginTop: '10px' }}>Tu bot de WhatsApp está conectado y listo para mandar mensajes de forma automática a tus clientes.</p>
                                        <button 
                                            onClick={handleUnlinkWhatsApp}
                                            style={{ marginTop: '15px', background: 'transparent', color: 'var(--error)', border: 'none', cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline' }}
                                        >
                                            Desvincular WhatsApp
                                        </button>
                                    </div>
                                ) : (
                                    <div className="animate-fade-in">
                                        <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
                                            Vinculá tu WhatsApp para que el sistema mande mensajes automáticos de confirmación y recordatorios de turnos.
                                        </p>

                                        {!loadingWa && !waStatus.qrUrl && (
                                            <button
                                                onClick={handleStartWhatsApp}
                                                className="btn-primary"
                                                style={{ width: 'auto', padding: '12px 30px' }}
                                            >
                                                Vincular WhatsApp (Abrir código QR)
                                            </button>
                                        )}

                                        {loadingWa && !waStatus.qrUrl && (
                                            <p style={{ color: 'var(--accent-primary)' }}>Generando enlace seguro con WhatsApp... Por favor, esperá.</p>
                                        )}

                                        {waStatus.qrUrl && !waStatus.ready && (
                                            <div style={{ backgroundColor: '#fff', padding: '15px', borderRadius: '15px', display: 'inline-block', margin: '20px auto' }}>
                                                <img src={waStatus.qrUrl} alt="WhatsApp QR Code" style={{ width: '250px', height: '250px', display: 'block' }} />
                                                <p style={{ color: '#000', fontWeight: 'bold', marginTop: '10px' }}>Escaneá este código desde tu celular</p>
                                                <button 
                                                    onClick={handleUnlinkWhatsApp}
                                                    style={{ marginTop: '10px', background: 'transparent', color: '#dc3545', border: 'none', cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline' }}
                                                >
                                                    Cancelar y Desvincular
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="card glass-panel" style={{ flex: '1 1 300px', margin: 0 }}>
                            <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '15px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <DollarSign size={24} color="var(--accent-primary)" /> Integración Mercado Pago
                            </h3>
                            <div style={{ padding: '10px 0', textAlign: 'center' }}>
                                <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
                                    Al vincular tu cuenta, la plataforma tendrá permiso para cobrar señas automáticamente a los clientes y <b>depositar el dinero de forma segura directamente en tu Mercado Pago</b>. Cero comisiones ocultas.
                                </p>

                                {mpToken && mpToken.startsWith('APP_USR') ? (
                                    <div className="animate-fade-in" style={{ backgroundColor: 'rgba(0, 204, 102, 0.1)', border: '1px solid rgba(0, 204, 102, 0.3)', padding: '20px', borderRadius: '15px' }}>
                                        <CheckCircle size={40} color="var(--success)" style={{ margin: '0 auto 10px' }} />
                                        <h3 style={{ color: 'var(--success)' }}>Cuenta de Mercado Pago Integrada</h3>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '10px' }}>Estás listo para recibir las señas de forma automática en tu celular.</p>
                                        <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '15px' }}>
                                            <button 
                                                onClick={() => {
                                                    const url = `https://auth.mercadopago.com/authorization?client_id=6481671956476050&response_type=code&platform_id=mp&state=config&redirect_uri=https://synory.tech/api/webhooks/mercadopago/auth`;
                                                    window.location.href = url;
                                                }}
                                                style={{ background: 'transparent', color: '#009ee3', border: 'none', cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline' }}
                                            >
                                                Cambiar de cuenta
                                            </button>
                                            <button 
                                                onClick={handleUnlinkMp}
                                                style={{ background: 'transparent', color: 'var(--error)', border: 'none', cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline' }}
                                            >
                                                Desvincular
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <button 
                                        className="btn-primary" 
                                        onClick={() => {
                                            const url = `https://auth.mercadopago.com/authorization?client_id=6481671956476050&response_type=code&platform_id=mp&state=config&redirect_uri=https://synory.tech/api/webhooks/mercadopago/auth`;
                                            window.location.href = url;
                                        }}
                                        style={{ backgroundColor: '#009ee3', color: 'white', padding: '15px 30px', fontSize: '1.2rem', display: 'flex', gap: '10px', alignItems: 'center', margin: '0 auto' }}
                                    >
                                        Vincular Mercado Pago (Cobrar Señas)
                                    </button>
                                )}
                            </div>
                        </div>
                        </div>

                    </div>
                )}

            {/* Modal de Turno Manual */}
            {isManualModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div className="card glass-panel" style={{ width: '90%', maxWidth: '500px', padding: '30px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2>Nuevo Turno Manual</h2>
                            <button onClick={() => setIsManualModalOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveManualAppointment}>
                            <div style={{ marginBottom: '15px' }}>
                                <label className="input-label">Nombre del Cliente</label>
                                <input type="text" className="input-field" value={newManualAppointment.clientName} onChange={e => setNewManualAppointment({ ...newManualAppointment, clientName: e.target.value })} required />
                            </div>
                            <div style={{ marginBottom: '15px' }}>
                                <label className="input-label">Teléfono (Opcional)</label>
                                <input type="text" className="input-field" placeholder="3875..." value={newManualAppointment.clientPhone} onChange={e => setNewManualAppointment({ ...newManualAppointment, clientPhone: e.target.value })} />
                            </div>
                            <div style={{ marginBottom: '15px' }}>
                                <label className="input-label">Servicio</label>
                                <select className="input-field" value={newManualAppointment.serviceId} onChange={e => setNewManualAppointment({ ...newManualAppointment, serviceId: e.target.value })} required>
                                    <option value="">Seleccione...</option>
                                    {services.map(s => <option key={s.id} value={s.id}>{s.name} - ${s.price}</option>)}
                                </select>
                            </div>
                            <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
                                <div style={{ flex: 1 }}>
                                    <label className="input-label">Fecha</label>
                                    <input type="date" className="input-field" value={newManualAppointment.appointmentDate} onChange={e => setNewManualAppointment({ ...newManualAppointment, appointmentDate: e.target.value })} required />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label className="input-label">Horario</label>
                                    <select className="input-field" value={newManualAppointment.appointmentTime} onChange={e => setNewManualAppointment({ ...newManualAppointment, appointmentTime: e.target.value })} required>
                                        <option value="">Seleccione...</option>
                                        {schedules.map(s => <option key={s.id} value={s.time}>{s.time}</option>)}
                                    </select>
                                </div>
                            </div>
                            <button type="submit" className="btn-primary">Guardar Turno</button>
                        </form>
                    </div>
                </div>
            )}

                {/* ====== TAB: DÍAS LIBRES ====== */}
                {activeTab === 'blocked' && (
                    <div className="animate-fade-in">
                        <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                            <Ban color="var(--accent-primary)" /> Días Libres / Bloqueo de Horarios
                        </h2>

                        <form onSubmit={handleAddBlock} className="card" style={{ marginBottom: '20px' }}>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                <div style={{ flex: 1, minWidth: '150px' }}>
                                    <label className="input-label">Fecha</label>
                                    <input type="date" className="input-field" value={newBlock.blockedDate} onChange={e => setNewBlock({...newBlock, blockedDate: e.target.value})} required />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 0' }}>
                                    <input type="checkbox" checked={newBlock.fullDay} onChange={e => setNewBlock({...newBlock, fullDay: e.target.checked})} style={{ accentColor: 'var(--accent-primary)', width: '18px', height: '18px' }} />
                                    <label style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>Día Completo</label>
                                </div>
                                {!newBlock.fullDay && (
                                    <>
                                        <div style={{ minWidth: '120px' }}>
                                            <label className="input-label">Desde</label>
                                            <input type="time" className="input-field" value={newBlock.timeFrom} onChange={e => setNewBlock({...newBlock, timeFrom: e.target.value})} />
                                        </div>
                                        <div style={{ minWidth: '120px' }}>
                                            <label className="input-label">Hasta</label>
                                            <input type="time" className="input-field" value={newBlock.timeTo} onChange={e => setNewBlock({...newBlock, timeTo: e.target.value})} />
                                        </div>
                                    </>
                                )}
                                <div style={{ minWidth: '150px', flex: 1 }}>
                                    <label className="input-label">Motivo (opcional)</label>
                                    <input className="input-field" placeholder="Ej: Trámite personal" value={newBlock.reason} onChange={e => setNewBlock({...newBlock, reason: e.target.value})} />
                                </div>
                                <button type="submit" className="btn-primary" style={{ padding: '12px 20px', width: 'auto', whiteSpace: 'nowrap' }}>
                                    <Plus size={16} /> Bloquear
                                </button>
                            </div>
                        </form>

                        <div style={{ display: 'grid', gap: '10px' }}>
                            {blockedTimes.length === 0 && <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '30px' }}>No hay bloqueos. ¡Todos los días disponibles!</p>}
                            {blockedTimes.map(b => (
                                <div key={b.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <div style={{ width: '45px', height: '45px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Ban size={20} color="var(--error)" />
                                        </div>
                                        <div>
                                            <h3 style={{ marginBottom: '4px' }}>{b.blockedDate}</h3>
                                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                                {b.fullDay ? '🚫 Día Completo' : `⏰ ${b.timeFrom} - ${b.timeTo}`}
                                                {b.reason && ` • ${b.reason}`}
                                            </p>
                                        </div>
                                    </div>
                                    <button onClick={() => handleDeleteBlock(b.id)} style={{ padding: '8px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: 'none', color: 'var(--error)', cursor: 'pointer' }}>
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ====== TAB: GASTOS ====== */}
                {activeTab === 'expenses' && (
                    <div className="animate-fade-in">
                        <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                            <Wallet color="var(--accent-primary)" /> Registro de Gastos
                        </h2>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
                            <div className="card glass-panel" style={{ textAlign: 'center' }}>
                                <h4 style={{ color: 'var(--text-secondary)', marginBottom: '5px' }}>Ingresos del Mes</h4>
                                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--success)' }}>${todayRevenue}</div>
                            </div>
                            <div className="card glass-panel" style={{ textAlign: 'center' }}>
                                <h4 style={{ color: 'var(--text-secondary)', marginBottom: '5px' }}>Gastos del Mes</h4>
                                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--error)' }}>-${totalExpenses}</div>
                            </div>
                            <div className="card glass-panel" style={{ textAlign: 'center' }}>
                                <h4 style={{ color: 'var(--text-secondary)', marginBottom: '5px' }}>Ganancia Neta</h4>
                                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: (todayRevenue - totalExpenses) >= 0 ? 'var(--success)' : 'var(--error)' }}>${todayRevenue - totalExpenses}</div>
                            </div>
                        </div>

                        <form onSubmit={handleAddExpense} className="card" style={{ marginBottom: '20px' }}>
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                <div style={{ flex: 2, minWidth: '200px' }}>
                                    <label className="input-label">Descripción</label>
                                    <input className="input-field" placeholder="Ej: Cuchillas nuevas" value={newExpense.description} onChange={e => setNewExpense({...newExpense, description: e.target.value})} required />
                                </div>
                                <div style={{ flex: 1, minWidth: '120px' }}>
                                    <label className="input-label">Monto ($)</label>
                                    <input type="number" className="input-field" placeholder="5000" value={newExpense.amount} onChange={e => setNewExpense({...newExpense, amount: e.target.value})} required />
                                </div>
                                <div style={{ flex: 1, minWidth: '150px' }}>
                                    <label className="input-label">Fecha</label>
                                    <input type="date" className="input-field" value={newExpense.expenseDate} onChange={e => setNewExpense({...newExpense, expenseDate: e.target.value})} required />
                                </div>
                                <button type="submit" className="btn-primary" style={{ padding: '12px 20px', width: 'auto', whiteSpace: 'nowrap' }}>
                                    <Plus size={16} /> Agregar
                                </button>
                            </div>
                        </form>

                        <div style={{ display: 'grid', gap: '10px' }}>
                            {expenses.length === 0 && <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '30px' }}>¡No hay gastos registrados este mes!</p>}
                            {expenses.map(e => (
                                <div key={e.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <h3 style={{ marginBottom: '4px' }}>{e.description}</h3>
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{e.expenseDate}</p>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--error)' }}>-${e.amount}</span>
                                        <button onClick={() => handleDeleteExpense(e.id)} style={{ padding: '6px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: 'none', color: 'var(--error)', cursor: 'pointer' }}><X size={16} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ====== TAB: ESTADÍSTICAS ====== */}
                {activeTab === 'peaks' && (
                    <div className="animate-fade-in">
                        <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                            <TrendingUp color="var(--accent-primary)" /> Estadísticas de Picos
                        </h2>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px' }}>
                            <div className="card">
                                <h3 style={{ marginBottom: '15px', color: 'var(--accent-primary)' }}>📅 Turnos por Día de la Semana</h3>
                                {peakStats.byDay.length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>Sin datos aún</p> : (
                                    <div style={{ display: 'grid', gap: '8px' }}>
                                        {peakStats.byDay.map(d => {
                                            const maxDay = Math.max(...peakStats.byDay.map(x => x.total));
                                            return (
                                                <div key={d.dayNum} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <span style={{ width: '90px', fontSize: '0.9rem', fontWeight: '600' }}>{d.dayName}</span>
                                                    <div style={{ flex: 1, height: '24px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '12px', overflow: 'hidden' }}>
                                                        <div style={{ height: '100%', width: `${(d.total / maxDay) * 100}%`, backgroundColor: 'var(--accent-primary)', borderRadius: '12px', transition: 'width 0.5s ease', minWidth: '30px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '8px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                                            {d.total}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="card">
                                <h3 style={{ marginBottom: '15px', color: 'var(--accent-primary)' }}>⏰ Turnos por Horario</h3>
                                {peakStats.byHour.length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>Sin datos aún</p> : (
                                    <div style={{ display: 'grid', gap: '8px' }}>
                                        {peakStats.byHour.map(h => {
                                            const maxHour = Math.max(...peakStats.byHour.map(x => x.total));
                                            return (
                                                <div key={h.hour} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <span style={{ width: '55px', fontSize: '0.9rem', fontWeight: '600' }}>{h.hour}</span>
                                                    <div style={{ flex: 1, height: '24px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '12px', overflow: 'hidden' }}>
                                                        <div style={{ height: '100%', width: `${(h.total / maxHour) * 100}%`, backgroundColor: 'var(--accent-primary)', borderRadius: '12px', transition: 'width 0.5s ease', minWidth: '30px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '8px', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                                            {h.total}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="card" style={{ gridColumn: '1 / -1' }}>
                                <h3 style={{ marginBottom: '15px', color: 'var(--accent-primary)' }}>💰 Resumen Mensual</h3>
                                {peakStats.byMonth.length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>Sin datos aún</p> : (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px' }}>
                                        {peakStats.byMonth.map(m => (
                                            <div key={m.month} className="glass-panel" style={{ padding: '15px', textAlign: 'center', borderRadius: '12px' }}>
                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>{m.month}</div>
                                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--success)' }}>${m.totalRevenue}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{m.totalAppointments} turnos</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Ganancia Neta Mensual */}
                            <div className="card" style={{ gridColumn: '1 / -1' }}>
                                <h3 style={{ marginBottom: '15px', color: 'var(--accent-primary)' }}>📊 Ganancia Neta Mensual (Ingresos - Gastos)</h3>
                                {netRevenueData.length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>Sin datos aún</p> : (
                                    <div style={{ display: 'grid', gap: '12px' }}>
                                        {netRevenueData.map(m => {
                                            const maxVal = Math.max(...netRevenueData.map(x => x.totalRevenue), 1);
                                            return (
                                                <div key={m.month} style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '15px', alignItems: 'center' }}>
                                                    <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>{m.month}</span>
                                                    <div>
                                                        <div style={{ display: 'flex', gap: '8px', marginBottom: '4px', fontSize: '0.8rem' }}>
                                                            <span style={{ color: 'var(--success)' }}>+${m.totalRevenue}</span>
                                                            <span style={{ color: 'var(--error)' }}>-${m.totalExpenses}</span>
                                                            <span style={{ color: m.netRevenue >= 0 ? 'var(--success)' : 'var(--error)', fontWeight: 'bold' }}> = ${m.netRevenue}</span>
                                                        </div>
                                                        <div style={{ height: '20px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '10px', overflow: 'hidden', position: 'relative' }}>
                                                            <div style={{ height: '100%', width: `${(m.totalRevenue / maxVal) * 100}%`, backgroundColor: 'rgba(0, 204, 102, 0.3)', borderRadius: '10px', position: 'absolute' }}></div>
                                                            <div style={{ height: '100%', width: `${(m.totalExpenses / maxVal) * 100}%`, backgroundColor: 'rgba(239, 68, 68, 0.4)', borderRadius: '10px', position: 'absolute' }}></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ====== TAB: AGENDA SEMANAL ====== */}
                {activeTab === 'week' && (
                    <div className="animate-fade-in">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px' }}>
                            <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                                <CalendarIcon color="var(--accent-primary)" /> Agenda Semanal
                            </h2>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <button onClick={() => changeWeek(-1)} style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}><ChevronLeft size={20} /></button>
                                <span style={{ fontWeight: '600', minWidth: '200px', textAlign: 'center' }}>{weekStart}</span>
                                <button onClick={() => changeWeek(1)} style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}><ChevronRight size={20} /></button>
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                            {getWeekDays().map(d => {
                                const dayAppts = weekAppointments.filter(a => a.appointmentDate === d.date);
                                const isToday = d.date === new Date().toISOString().split('T')[0];
                                return (
                                    <div key={d.date} className="card" style={{ padding: '15px', borderTop: isToday ? '3px solid var(--accent-primary)' : '3px solid transparent', minHeight: '150px' }}>
                                        <div style={{ textAlign: 'center', marginBottom: '10px' }}>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '600' }}>{d.label}</div>
                                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: isToday ? 'var(--accent-primary)' : 'var(--text-primary)' }}>{d.day}</div>
                                        </div>
                                        {dayAppts.length === 0 ? (
                                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', textAlign: 'center' }}>Sin turnos</p>
                                        ) : dayAppts.map(a => (
                                            <div key={a.id} style={{ padding: '6px 8px', backgroundColor: a.status === 'completed' ? 'rgba(0,204,102,0.1)' : a.status === 'cancelled' ? 'rgba(239,68,68,0.08)' : 'rgba(192,123,247,0.1)', borderRadius: '6px', marginBottom: '6px', fontSize: '0.8rem', opacity: a.status === 'cancelled' ? 0.7 : 1 }}>
                                                <div style={{ fontWeight: '600' }}>{a.appointmentTime}</div>
                                                <div style={{ color: 'var(--text-secondary)' }}>{a.clientName}</div>
                                                <div style={{ color: 'var(--accent-primary)', fontSize: '0.75rem' }}>{a.serviceName}</div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}



                {/* ====== TAB: RESEÑAS ====== */}
                {activeTab === 'reviews' && (
                    <div className="animate-fade-in">
                        <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                            <Star color="var(--accent-primary)" /> Reseñas de Clientes
                        </h2>
                        {reviews.length === 0 ? (
                            <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
                                <Star size={40} color="var(--text-secondary)" style={{ margin: '0 auto 15px' }} />
                                <p style={{ color: 'var(--text-secondary)' }}>Aún no hay reseñas. Los clientes pueden dejarte una desde la página pública.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gap: '15px' }}>
                                {reviews.map(r => (
                                    <div key={r.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                                                <h3 style={{ margin: 0 }}>{r.clientName}</h3>
                                                <div style={{ color: '#fbbf24' }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</div>
                                            </div>
                                            {r.comment && <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>"{r.comment}"</p>}
                                            <small style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{new Date(r.createdAt).toLocaleDateString('es-ES')}</small>
                                        </div>
                                        <button onClick={() => handleDeleteReview(r.id)} style={{ padding: '6px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: 'none', color: 'var(--error)', cursor: 'pointer' }}><Trash2 size={14} /></button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ====== TAB: CLIENTES / CUMPLEAÑOS ====== */}
                {activeTab === 'clients' && (
                    <div className="animate-fade-in">
                        <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                            <Gift color="var(--accent-primary)" /> Clientes y Cumpleaños
                        </h2>

                        {upcomingBirthdays.length > 0 && (
                            <div className="card glass-panel" style={{ marginBottom: '20px', border: '1px solid rgba(251, 191, 36, 0.3)', background: 'linear-gradient(135deg, rgba(251,191,36,0.1) 0%, transparent 100%)' }}>
                                <h3 style={{ color: '#fbbf24', marginBottom: '10px' }}>🎂 Cumpleaños esta semana</h3>
                                <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                                    {upcomingBirthdays.map(b => (
                                        <div key={b.id} style={{ padding: '10px 15px', backgroundColor: b.isToday ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.03)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ fontSize: '1.5rem' }}>{b.isToday ? '🎉' : '🎂'}</span>
                                            <div>
                                                <div style={{ fontWeight: '600' }}>{b.name}</div>
                                                <small style={{ color: 'var(--text-secondary)' }}>{b.isToday ? '¡HOY!' : b.birthday}</small>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleAddClient} className="card" style={{ marginBottom: '20px' }}>
                            <h3 style={{ marginBottom: '15px' }}>Agregar Cliente</h3>
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                <div style={{ flex: 1, minWidth: '150px' }}>
                                    <label className="input-label">Nombre</label>
                                    <input className="input-field" placeholder="Juan Pérez" value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} required />
                                </div>
                                <div style={{ flex: 1, minWidth: '150px' }}>
                                    <label className="input-label">Teléfono</label>
                                    <input className="input-field" placeholder="+5493875..." value={newClient.phone} onChange={e => setNewClient({...newClient, phone: e.target.value})} required />
                                </div>
                                <div style={{ flex: 1, minWidth: '150px' }}>
                                    <label className="input-label">Cumpleaños</label>
                                    <input type="date" className="input-field" value={newClient.birthday} onChange={e => setNewClient({...newClient, birthday: e.target.value})} />
                                </div>
                                <button type="submit" className="btn-primary" style={{ padding: '12px 20px', width: 'auto' }}><Plus size={16} /> Agregar</button>
                            </div>
                        </form>

                        <div style={{ display: 'grid', gap: '10px' }}>
                            {clients.length === 0 && <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '30px' }}>No hay clientes registrados aún.</p>}
                            {clients.map(c => (
                                <div key={c.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <div style={{ width: '45px', height: '45px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-primary), rgba(192,123,247,0.5))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.1rem' }}>
                                            {c.name ? c.name.charAt(0).toUpperCase() : '?'}
                                        </div>
                                        <div>
                                            <h3 style={{ margin: 0, marginBottom: '3px' }}>{c.name}</h3>
                                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                                                📞 {c.phone} {c.birthday && <span>• 🎂 {c.birthday}</span>}
                                            </p>
                                        </div>
                                    </div>
                                    <button onClick={() => handleDeleteClient(c.id)} style={{ padding: '8px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: 'none', color: 'var(--error)', cursor: 'pointer' }}><Trash2 size={16} /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ====== TAB: PROMOCIONES ====== */}
                {activeTab === 'promos' && (
                    <div className="animate-fade-in">
                        <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                            <Tag color="var(--accent-primary)" /> Promociones y Descuentos
                        </h2>

                        <form onSubmit={handleAddPromo} className="card" style={{ marginBottom: '20px' }}>
                            <h3 style={{ marginBottom: '15px' }}>Crear Promoción</h3>
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                <div style={{ minWidth: '120px' }}>
                                    <label className="input-label">Código</label>
                                    <input className="input-field" placeholder="PROMO10" value={newPromo.code} onChange={e => setNewPromo({...newPromo, code: e.target.value})} required style={{ textTransform: 'uppercase' }} />
                                </div>
                                <div style={{ flex: 1, minWidth: '150px' }}>
                                    <label className="input-label">Descripción</label>
                                    <input className="input-field" placeholder="10% en tu primer corte" value={newPromo.description} onChange={e => setNewPromo({...newPromo, description: e.target.value})} />
                                </div>
                                <div style={{ minWidth: '80px' }}>
                                    <label className="input-label">% Desc.</label>
                                    <input type="number" className="input-field" placeholder="10" min="1" max="100" value={newPromo.discountPercent} onChange={e => setNewPromo({...newPromo, discountPercent: e.target.value})} required />
                                </div>
                                <div style={{ minWidth: '80px' }}>
                                    <label className="input-label">Usos máx.</label>
                                    <input type="number" className="input-field" placeholder="0=∞" value={newPromo.maxUses} onChange={e => setNewPromo({...newPromo, maxUses: e.target.value})} />
                                </div>
                                <div style={{ minWidth: '150px' }}>
                                    <label className="input-label">Válido hasta</label>
                                    <input type="date" className="input-field" value={newPromo.validUntil} onChange={e => setNewPromo({...newPromo, validUntil: e.target.value})} />
                                </div>
                                <button type="submit" className="btn-primary" style={{ padding: '12px 20px', width: 'auto' }}><Plus size={16} /> Crear</button>
                            </div>
                        </form>

                        <div style={{ display: 'grid', gap: '10px' }}>
                            {promotions.length === 0 && <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '30px' }}>No hay promociones creadas.</p>}
                            {promotions.map(p => (
                                <div key={p.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: p.active ? 1 : 0.5 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                        <div style={{ padding: '10px 15px', backgroundColor: 'rgba(192,123,247,0.1)', borderRadius: '10px', fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--accent-primary)', letterSpacing: '1px' }}>
                                            {p.code}
                                        </div>
                                        <div>
                                            <h3 style={{ margin: 0, marginBottom: '3px' }}>{p.discountPercent}% OFF</h3>
                                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: 0 }}>
                                                {p.description || 'Sin descripción'} • Usos: {p.usageCount}{p.maxUses > 0 ? `/${p.maxUses}` : '/∞'}
                                                {p.validUntil && ` • Hasta: ${p.validUntil}`}
                                            </p>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button onClick={() => handleTogglePromo(p.id)} style={{ padding: '6px 12px', borderRadius: '20px', backgroundColor: p.active ? 'rgba(0,204,102,0.1)' : 'rgba(239,68,68,0.1)', border: 'none', color: p.active ? 'var(--success)' : 'var(--error)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600' }}>
                                            {p.active ? 'Activa' : 'Inactiva'}
                                        </button>
                                        <button onClick={() => handleDeletePromo(p.id)} style={{ padding: '6px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: 'none', color: 'var(--error)', cursor: 'pointer' }}><Trash2 size={14} /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            </main>

            {/* ====== MODAL FICHA DE CLIENTE ====== */}
            {clientModal && (
                <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
                    <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '550px', maxHeight: '80vh', overflow: 'auto', padding: '30px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                                <FileText color="var(--accent-primary)" /> Ficha: {clientModal.name}
                            </h2>
                            <button onClick={() => setClientModal(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={24} /></button>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>📞 {clientModal.phone}</p>

                        <h4 style={{ color: 'var(--accent-primary)', marginBottom: '10px' }}>📅 Historial ({clientHistory.length})</h4>
                        {clientHistory.length === 0 ? <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Sin visitas previas</p> : (
                            <div style={{ display: 'grid', gap: '8px', marginBottom: '20px', maxHeight: '150px', overflow: 'auto' }}>
                                {clientHistory.map(h => (
                                    <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '8px', fontSize: '0.85rem' }}>
                                        <span>{h.appointmentDate} {h.appointmentTime}</span>
                                        <span style={{ color: 'var(--accent-primary)' }}>{h.serviceName}</span>
                                        <span style={{ color: h.status === 'completed' ? 'var(--success)' : 'var(--text-secondary)' }}>{h.status === 'completed' ? '✅' : h.status === 'cancelled' ? '❌' : '📅'}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        <h4 style={{ color: 'var(--accent-primary)', marginBottom: '10px' }}>📝 Notas</h4>
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                            <input className="input-field" placeholder="Ej: Le gusta degradado al 0..." value={newNote} onChange={e => setNewNote(e.target.value)} style={{ flex: 1 }} />
                            <button onClick={handleAddNote} className="btn-primary" style={{ padding: '10px 20px', width: 'auto' }}>Agregar</button>
                        </div>
                        {clientNotes.map(n => (
                            <div key={n.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '8px', marginBottom: '8px' }}>
                                <span style={{ fontSize: '0.9rem' }}>{n.note}</span>
                                <button onClick={() => handleDeleteNote(n.id)} style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '4px' }}><X size={14} /></button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

        </div>
    );
};

export default DashboardPage;

