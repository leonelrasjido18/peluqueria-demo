import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, DollarSign, Users, Clock, Scissors, LogOut, Settings, Smartphone, CheckCircle, Edit, Trash2, Plus, Menu, X } from 'lucide-react';
import { getAppointments, getWhatsAppStatus, startWhatsAppConnection, getServices, addService, updateService, deleteService, getSchedules, addSchedule, deleteSchedule, deleteAppointment, createManualAppointment, getMpToken, saveMpToken } from '../api';

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

    // WhatsApp State
    const [waStatus, setWaStatus] = useState({ ready: false, qrUrl: null });
    const [loadingWa, setLoadingWa] = useState(false);

    // Mercado Pago State
    const [mpToken, setMpToken] = useState('');
    const [isSavingMp, setIsSavingMp] = useState(false);
    const [mpSavedMessage, setMpSavedMessage] = useState('');

    // Derived stats
    const todayAppointments = appointments.length;
    const completedAppointments = appointments.filter(a => a.status === 'completed').length;
    const pendingAppointments = appointments.filter(a => a.status === 'scheduled').length;
    const todayRevenue = appointments.filter(a => a.status === 'completed').reduce((sum, a) => sum + a.price, 0);

    useEffect(() => {
        getAppointments().then(data => {
            setAppointments(data);
        }).catch(err => console.error(err));
        
        loadServices();
        loadSchedules();
        loadMpToken();

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

    const logout = () => {
        localStorage.removeItem('user');
        window.location.href = '/login';
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
            {/* Mobile Overlay */}
            <div 
                className={`mobile-overlay ${isMobileMenuOpen ? 'mobile-open' : ''}`}
                onClick={() => setIsMobileMenuOpen(false)}
            ></div>

            {/* Sidebar */}
            <aside className={`dashboard-sidebar ${isMobileMenuOpen ? 'mobile-open' : ''}`} style={{ position: 'fixed', top: 0, left: 0, height: '100vh', width: '250px', backgroundColor: 'var(--bg-secondary)', padding: '30px 20px', display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,0.05)', zIndex: 10 }}>
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

                <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <button
                        onClick={() => { setActiveTab('calendar'); setIsMobileMenuOpen(false); }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '10px', padding: '15px', borderRadius: '8px',
                            backgroundColor: activeTab === 'calendar' ? 'rgba(192, 123, 247, 0.1)' : 'transparent',
                            color: activeTab === 'calendar' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                            transition: 'var(--transition)',
                            width: '100%', textAlign: 'left', fontWeight: '500'
                        }}
                    >
                        <CalendarIcon size={20} /> Turnos de Hoy
                    </button>
                    <button
                        onClick={() => { setActiveTab('stats'); setIsMobileMenuOpen(false); }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '10px', padding: '15px', borderRadius: '8px',
                            backgroundColor: activeTab === 'stats' ? 'rgba(192, 123, 247, 0.1)' : 'transparent',
                            color: activeTab === 'stats' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                            transition: 'var(--transition)',
                            width: '100%', textAlign: 'left', fontWeight: '500'
                        }}
                    >
                        <DollarSign size={20} /> Ganancias
                    </button>
                    <button
                        onClick={() => { setActiveTab('services'); setIsMobileMenuOpen(false); }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '10px', padding: '15px', borderRadius: '8px',
                            backgroundColor: activeTab === 'services' ? 'rgba(192, 123, 247, 0.1)' : 'transparent',
                            color: activeTab === 'services' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                            transition: 'var(--transition)',
                            width: '100%', textAlign: 'left', fontWeight: '500'
                        }}
                    >
                        <Scissors size={20} /> Servicios
                    </button>
                    <button
                        onClick={() => { setActiveTab('schedules'); setIsMobileMenuOpen(false); }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '10px', padding: '15px', borderRadius: '8px',
                            backgroundColor: activeTab === 'schedules' ? 'rgba(192, 123, 247, 0.1)' : 'transparent',
                            color: activeTab === 'schedules' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                            transition: 'var(--transition)',
                            width: '100%', textAlign: 'left', fontWeight: '500'
                        }}
                    >
                        <Clock size={20} /> Horarios
                    </button>
                    <button
                        onClick={() => { setActiveTab('config'); setIsMobileMenuOpen(false); }}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '10px', padding: '15px', borderRadius: '8px',
                            backgroundColor: activeTab === 'config' ? 'rgba(192, 123, 247, 0.1)' : 'transparent',
                            color: activeTab === 'config' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                            transition: 'var(--transition)',
                            width: '100%', textAlign: 'left', fontWeight: '500'
                        }}
                    >
                        <Settings size={20} /> Configuración
                    </button>
                </nav>

                <button
                    onClick={logout}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--error)', padding: '15px', fontWeight: '500' }}
                >
                    <LogOut size={20} /> Cerrar Sesión
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
                                                backgroundColor: app.status === 'completed' ? 'rgba(0, 204, 102, 0.1)' : app.status === 'pending_payment' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(192, 123, 247, 0.1)',
                                                color: app.status === 'completed' ? 'var(--success)' : app.status === 'pending_payment' ? '#f59e0b' : 'var(--accent-primary)'
                                            }}>
                                                {app.status === 'completed' ? 'Completado' : app.status === 'pending_payment' ? 'Abonando Seña...' : 'Confirmado'}
                                            </span>
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

                        <div className="card glass-panel" style={{ maxWidth: '600px' }}>
                            <h3 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '15px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Smartphone size={24} color="var(--accent-primary)" /> Conexión con WhatsApp
                            </h3>

                            <div style={{ textAlign: 'center', padding: '20px 0' }}>
                                {waStatus.ready ? (
                                    <div className="animate-fade-in">
                                        <CheckCircle size={60} color="var(--success)" style={{ margin: '0 auto 15px' }} />
                                        <h2 style={{ color: 'var(--success)' }}>¡Sincronización Exitosa!</h2>
                                        <p style={{ color: 'var(--text-secondary)', marginTop: '10px' }}>Tu bot de WhatsApp está conectado y listo para mandar mensajes de forma automática a tus clientes.</p>
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
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="card glass-panel" style={{ maxWidth: '600px', marginTop: '30px' }}>
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
                                        <button 
                                            onClick={() => {
                                                const url = `https://auth.mercadopago.com/authorization?client_id=6481671956476050&response_type=code&platform_id=mp&state=config&redirect_uri=https://synory.tech/api/webhooks/mercadopago/auth`;
                                                window.location.href = url;
                                            }}
                                            style={{ marginTop: '15px', background: 'transparent', color: '#009ee3', border: 'none', cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline' }}
                                        >
                                            Cambiar de cuenta / Revincular
                                        </button>
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
                )}

            </main>

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

        </div>
    );
};

export default DashboardPage;
