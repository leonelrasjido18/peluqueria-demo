import { useState, useEffect } from 'react';
import { Clock, Scissors, ChevronRight, CheckCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getServices, createAppointment } from '../api';

const availableTimes = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

const BookingPage = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
    const [bookingData, setBookingData] = useState({
        serviceId: null,
        barberId: null,
        date: '',
        time: '',
        clientName: '',
        clientPhone: ''
    });

    const [services, setServices] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        getServices().then(data => {
            setServices(data);
            setIsLoading(false);
        }).catch(err => console.error(err));
    }, []);

    const updateData = (key, value) => {
        setBookingData({ ...bookingData, [key]: value });
    };

    const nextStep = () => setStep(step + 1);
    const prevStep = () => setStep(step > 1 ? step - 1 : 1);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const result = await createAppointment({
                clientName: bookingData.clientName,
                clientPhone: '+549' + bookingData.clientPhone,
                serviceId: bookingData.serviceId,
                appointmentDate: bookingData.date,
                appointmentTime: bookingData.time
            });

            if (result.init_point) {
                window.location.href = result.init_point;
            } else {
                setStep(4); // Success step
            }
        } catch (error) {
            console.error('Error booking:', error);
            alert("Hubo un error al generar la seña. Intenta de nuevo.");
        }
    };

    return (
        <div style={{ padding: '2vh 20px', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>

            <div style={{ width: '100%', maxWidth: '800px', marginBottom: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }} className="animate-fade-in">
                <button
                    onClick={() => step === 1 ? navigate('/') : prevStep()}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', width: 'fit-content', padding: '5px 0', fontSize: '0.9rem' }}
                >
                    <ArrowLeft size={16} /> Volver
                </button>

                <h1 style={{ fontSize: '2rem', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    RESERVA TU CITA
                </h1>

                {/* Progress Timeline */}
                {step < 4 && (
                    <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                        {[1, 2, 3].map(i => (
                            <div key={i} style={{
                                flex: 1, height: '4px', borderRadius: '4px',
                                backgroundColor: step >= i ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                                transition: 'var(--transition)'
                            }} />
                        ))}
                    </div>
                )}
            </div>

            <div style={{ width: '100%', maxWidth: '800px', marginTop: '20px' }}>

                {/* Step 1: Services */}
                {step === 1 && (
                    <div className="animate-fade-in">
                        <h2 style={{ fontSize: '1.1rem', fontWeight: '700', textTransform: 'uppercase', marginBottom: '15px', color: 'var(--text-primary)' }}>
                            PASO 1: ELIGE TU SERVICIO
                        </h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '15px' }}>
                            {services.map(s => (
                                <div
                                    key={s.id}
                                    onClick={() => updateData('serviceId', s.id)}
                                    style={{
                                        padding: '16px',
                                        borderRadius: '16px',
                                        border: `2px solid ${bookingData.serviceId === s.id ? 'var(--accent-primary)' : 'var(--bg-tertiary)'}`,
                                        backgroundColor: bookingData.serviceId === s.id ? 'rgba(192, 123, 247, 0.05)' : 'var(--bg-secondary)',
                                        cursor: 'pointer',
                                        display: 'flex', flexDirection: 'column', gap: '10px',
                                        transition: 'var(--transition)',
                                        boxShadow: bookingData.serviceId === s.id ? 'var(--shadow-glow)' : 'var(--shadow-subtle)'
                                    }}
                                >
                                    <div>
                                        <h3 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '4px' }}>{s.name}</h3>
                                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>{s.duration} min de sesion</p>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '5px' }}>
                                        <div style={{ fontWeight: '800', fontSize: '1.2rem', color: 'var(--accent-primary)' }}>
                                            ${s.price}
                                        </div>
                                        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: '500' }}>{s.duration} min</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div style={{ marginTop: '20px' }}>
                            <button
                                className="btn-primary"
                                disabled={!bookingData.serviceId}
                                style={{ opacity: !bookingData.serviceId ? 0.3 : 1, width: 'fit-content', padding: '12px 24px' }}
                                onClick={nextStep}
                            >
                                SIGUIENTE <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 2: Date & Time */}
                {step === 2 && (
                    <div className="animate-fade-in">
                        <h2 style={{ fontSize: '1.1rem', fontWeight: '700', textTransform: 'uppercase', marginBottom: '15px' }}>
                            PASO 2: FECHA Y RELOJ
                        </h2>

                        <div className="card" style={{ marginBottom: '20px', padding: '20px' }}>
                            <label className="input-label" style={{ marginBottom: '10px' }}>Día Reservado</label>
                            <input
                                type="date"
                                className="input-field"
                                value={bookingData.date}
                                onClick={(e) => { try { e.target.showPicker(); } catch (err) { } }}
                                onChange={(e) => updateData('date', e.target.value)}
                                min={new Date().toISOString().split('T')[0]}
                                style={{ colorScheme: 'dark', padding: '15px', fontSize: '1rem', cursor: 'pointer' }}
                            />
                        </div>

                        {bookingData.date && (
                            <div className="animate-fade-in card" style={{ padding: '20px' }}>
                                <label className="input-label" style={{ marginBottom: '15px' }}>
                                    Horarios de Atención
                                </label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px' }}>
                                    {availableTimes.map(t => (
                                        <div
                                            key={t}
                                            onClick={() => updateData('time', t)}
                                            style={{
                                                padding: '12px', textAlign: 'center', borderRadius: '12px', cursor: 'pointer',
                                                border: `2px solid ${bookingData.time === t ? 'var(--accent-primary)' : 'var(--bg-tertiary)'}`,
                                                backgroundColor: bookingData.time === t ? 'var(--accent-primary)' : 'transparent',
                                                color: bookingData.time === t ? 'var(--text-inverse)' : 'var(--text-primary)',
                                                fontWeight: '700',
                                                fontSize: '1rem',
                                                transition: 'var(--transition)'
                                            }}
                                        >
                                            {t}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div style={{ marginTop: '20px' }}>
                            <button
                                className="btn-primary"
                                disabled={!bookingData.date || !bookingData.time}
                                style={{ opacity: (!bookingData.date || !bookingData.time) ? 0.3 : 1, padding: '12px 24px' }}
                                onClick={nextStep}
                            >
                                SIGUIENTE <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3: User Info */}
                {step === 3 && (
                    <div className="animate-fade-in">
                        <h2 style={{ fontSize: '1.1rem', fontWeight: '700', textTransform: 'uppercase', marginBottom: '15px' }}>
                            PASO 3: CONFIRMACIÓN
                        </h2>
                        <form onSubmit={handleSubmit} className="card" style={{ padding: '20px 30px' }}>
                            <div style={{ marginBottom: '20px' }}>
                                <label className="input-label">Nombre y Apellido</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="Ej: Martín Gómez"
                                    value={bookingData.clientName}
                                    onChange={(e) => updateData('clientName', e.target.value)}
                                    style={{ padding: '15px', fontSize: '1rem' }}
                                    required
                                />
                            </div>
                            <div style={{ marginBottom: '30px' }}>
                                <label className="input-label">Número de WhatsApp</label>
                                <div style={{ display: 'flex', alignItems: 'stretch', width: '100%', borderRadius: '8px', overflow: 'hidden' }}>
                                    <div style={{ 
                                        padding: '0 16px', 
                                        backgroundColor: 'rgba(255,255,255,0.03)', 
                                        border: '1px solid rgba(255, 255, 255, 0.1)', 
                                        borderRight: 'none',
                                        color: 'var(--text-primary)',
                                        fontSize: '1rem',
                                        fontWeight: '600',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}>
                                        <span style={{ fontSize: '1.2rem' }}>🇦🇷</span> 
                                        <span style={{ color: 'var(--text-secondary)' }}>+54 9</span>
                                    </div>
                                    <input
                                        type="tel"
                                        className="input-field"
                                        placeholder="11 1234 5678"
                                        value={bookingData.clientPhone}
                                        onChange={(e) => updateData('clientPhone', e.target.value.replace(/\D/g, ''))}
                                        style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, flex: 1 }}
                                        required
                                    />
                                </div>
                                <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '10px', fontSize: '0.85rem' }}>
                                    Recibirás alertas automatizadas en este número.
                                </small>
                            </div>

                            <button type="submit" className="btn-primary" style={{ width: '100%', padding: '15px', fontSize: '1.1rem' }}>
                                PAGAR SEÑA (25%) <CheckCircle size={20} />
                            </button>
                        </form>
                    </div>
                )}

                {/* Step 4: Success */}
                {step === 4 && (
                    <div className="animate-fade-in" style={{ textAlign: 'center', padding: '60px 0' }}>
                        <div style={{
                            width: '100px', height: '100px', borderRadius: '50%', backgroundColor: 'rgba(16, 185, 129, 0.1)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 30px',
                            border: '2px solid var(--success)'
                        }}>
                            <CheckCircle size={50} color="var(--success)" />
                        </div>
                        <h2 style={{ marginBottom: '15px', fontSize: '2.5rem', fontWeight: '800' }}>¡LISTO!</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '50px', fontSize: '1.2rem', maxWidth: '500px', margin: '0 auto 50px' }}>
                            Gracias, <span style={{ color: 'var(--text-primary)' }}>{bookingData.clientName}</span>. Tu turno ha sido agendado exitosamente. Recibirás tu confirmación y aviso directo por WhatsApp en el transcurso del día.
                        </p>
                        <button className="btn-primary" onClick={() => navigate('/')}>
                            VOLVER AL INICIO
                        </button>
                    </div>
                )}

            </div>
        </div>
    );
};

export default BookingPage;
