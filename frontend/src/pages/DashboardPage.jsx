import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, DollarSign, Users, Clock, Scissors, LogOut, Settings, Smartphone, CheckCircle, Edit, Trash2, Plus } from 'lucide-react';
import { getAppointments, getWhatsAppStatus, startWhatsAppConnection, getServices, addService, updateService, deleteService } from '../api';

const DashboardPage = () => {
    const [activeTab, setActiveTab] = useState('calendar'); // 'calendar', 'stats', 'config'
    const [appointments, setAppointments] = useState([]);
    const [services, setServices] = useState([]);
    const [editingService, setEditingService] = useState(null);
    const [newService, setNewService] = useState({ name: '', duration: '', price: '' });

    // WhatsApp State
    const [waStatus, setWaStatus] = useState({ ready: false, qrUrl: null });
    const [loadingWa, setLoadingWa] = useState(false);

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
    }, []);

    const loadServices = () => {
        getServices().then(data => setServices(data)).catch(err => console.error(err));
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

    const logout = () => {
        localStorage.removeItem('user');
        window.location.href = '/login';
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>
            {/* Sidebar */}
            <aside style={{ position: 'fixed', top: 0, left: 0, height: '100vh', width: '250px', backgroundColor: 'var(--bg-secondary)', padding: '30px 20px', display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,0.05)', zIndex: 10 }}>
                <h2 style={{ color: 'var(--accent-primary)', marginBottom: '40px', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Scissors /> Royal Panel
                </h2>

                <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <button
                        onClick={() => setActiveTab('calendar')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '10px', padding: '15px', borderRadius: '8px',
                            backgroundColor: activeTab === 'calendar' ? 'rgba(218, 165, 32, 0.1)' : 'transparent',
                            color: activeTab === 'calendar' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                            transition: 'var(--transition)',
                            width: '100%', textAlign: 'left', fontWeight: '500'
                        }}
                    >
                        <CalendarIcon size={20} /> Turnos de Hoy
                    </button>
                    <button
                        onClick={() => setActiveTab('stats')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '10px', padding: '15px', borderRadius: '8px',
                            backgroundColor: activeTab === 'stats' ? 'rgba(218, 165, 32, 0.1)' : 'transparent',
                            color: activeTab === 'stats' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                            transition: 'var(--transition)',
                            width: '100%', textAlign: 'left', fontWeight: '500'
                        }}
                    >
                        <DollarSign size={20} /> Ganancias
                    </button>
                    <button
                        onClick={() => setActiveTab('services')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '10px', padding: '15px', borderRadius: '8px',
                            backgroundColor: activeTab === 'services' ? 'rgba(218, 165, 32, 0.1)' : 'transparent',
                            color: activeTab === 'services' ? 'var(--accent-primary)' : 'var(--text-secondary)',
                            transition: 'var(--transition)',
                            width: '100%', textAlign: 'left', fontWeight: '500'
                        }}
                    >
                        <Scissors size={20} /> Servicios
                    </button>
                    <button
                        onClick={() => setActiveTab('config')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '10px', padding: '15px', borderRadius: '8px',
                            backgroundColor: activeTab === 'config' ? 'rgba(218, 165, 32, 0.1)' : 'transparent',
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
            <main style={{ flex: 1, padding: '40px', marginLeft: '250px' }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                    <div>
                        <h1 style={{ fontSize: '2rem', marginBottom: '5px' }}>Hola, <span style={{ color: 'var(--accent-primary)' }}>Juampi</span></h1>
                        <p style={{ color: 'var(--text-secondary)' }}>Te esperan {pendingAppointments} cortes para hoy.</p>
                    </div>
                    <div style={{ padding: '10px 20px', backgroundColor: 'var(--bg-secondary)', borderRadius: '30px', fontWeight: 'bold' }}>
                        {new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                </header>

                {activeTab === 'calendar' && (
                    <div className="animate-fade-in">
                        <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Clock color="var(--accent-primary)" /> Próximos Cortes
                        </h2>
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
                                        <span style={{
                                            padding: '5px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold',
                                            backgroundColor: app.status === 'completed' ? 'rgba(0, 204, 102, 0.1)' : 'rgba(218, 165, 32, 0.1)',
                                            color: app.status === 'completed' ? 'var(--success)' : 'var(--accent-primary)'
                                        }}>
                                            {app.status === 'completed' ? 'Completado' : 'Pendiente'}
                                        </span>
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
                                <div style={{ width: '50px', height: '50px', borderRadius: '50%', backgroundColor: 'rgba(218, 165, 32, 0.1)', margin: '0 auto 15px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                        <h2 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <Scissors color="var(--accent-primary)" /> Mis Servicios
                        </h2>

                        <div className="card glass-panel" style={{ marginBottom: '30px' }}>
                            <h3 style={{ marginBottom: '15px' }}>{editingService ? 'Editar Servicio' : 'Nuevo Servicio'}</h3>
                            <form onSubmit={handleSaveService} style={{ display: 'flex', flexWrap: 'wrap', gap: '15px', alignItems: 'end' }}>
                                <div style={{ flex: '1 1 200px' }}>
                                    <label className="input-label" style={{ marginBottom: '5px', display: 'block' }}>Nombre</label>
                                    <input type="text" className="input-field" placeholder="Ej: Corte Clásico" value={newService.name} onChange={(e) => setNewService({...newService, name: e.target.value})} required style={{ padding: '12px' }} />
                                </div>
                                <div style={{ flex: '1 1 100px' }}>
                                    <label className="input-label" style={{ marginBottom: '5px', display: 'block' }}>Duración (min)</label>
                                    <input type="number" className="input-field" placeholder="30" value={newService.duration} onChange={(e) => setNewService({...newService, duration: e.target.value})} required style={{ padding: '12px' }} />
                                </div>
                                <div style={{ flex: '1 1 120px' }}>
                                    <label className="input-label" style={{ marginBottom: '5px', display: 'block' }}>Precio ($)</label>
                                    <input type="number" className="input-field" placeholder="5000" value={newService.price} onChange={(e) => setNewService({...newService, price: e.target.value})} required style={{ padding: '12px' }} />
                                </div>
                                <div style={{ display: 'flex', gap: '10px', flex: '1 1 100%' }}>
                                    <button type="submit" className="btn-primary" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        {editingService ? <Edit size={18} /> : <Plus size={18} />} {editingService ? 'Guardar' : 'Agregar'}
                                    </button>
                                    {editingService && (
                                        <button type="button" onClick={() => { setEditingService(null); setNewService({ name: '', duration: '', price: '' }); }} style={{ padding: '12px', background: 'transparent', color: 'var(--text-secondary)', border: 'none', cursor: 'pointer' }}>
                                            Cancelar
                                        </button>
                                    )}
                                </div>
                            </form>
                        </div>

                        <div style={{ display: 'grid', gap: '15px' }}>
                            {services.map(s => (
                                <div key={s.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <h3 style={{ fontSize: '1.2rem', marginBottom: '5px' }}>{s.name}</h3>
                                        <p style={{ color: 'var(--text-secondary)' }}>{s.duration} min • <span style={{ color: 'var(--accent-primary)', fontWeight: 'bold' }}>${s.price}</span></p>
                                    </div>
                                    <div style={{ display: 'flex', gap: '10px' }}>
                                        <button onClick={() => { setEditingService(s); setNewService({ name: s.name, duration: s.duration, price: s.price }); }} style={{ padding: '10px', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: 'none', cursor: 'pointer', transition: 'var(--transition)' }}>
                                            <Edit size={18} />
                                        </button>
                                        <button onClick={() => handleDeleteService(s.id)} style={{ padding: '10px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--error)', border: 'none', cursor: 'pointer', transition: 'var(--transition)' }}>
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
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
                    </div>
                )}

            </main>
        </div>
    );
};

export default DashboardPage;
