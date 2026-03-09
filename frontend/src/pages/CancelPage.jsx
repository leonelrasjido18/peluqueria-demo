import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getAppointmentByToken, cancelAppointmentByToken, rescheduleAppointmentByToken, getBookedTimes, getSchedules } from '../api';

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function formatFecha(dateStr) {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    return `${DIAS[d.getDay()]} ${day} de ${MESES[month - 1]} de ${year}`;
}

function getTodayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function CancelPage() {
    const { token } = useParams();
    const navigate = useNavigate();

    const [appointment, setAppointment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [view, setView] = useState('main'); // 'main' | 'cancel-confirm' | 'reschedule' | 'done'
    const [doneMsg, setDoneMsg] = useState('');

    // Estado reagendar
    const [newDate, setNewDate] = useState('');
    const [availableTimes, setAvailableTimes] = useState([]);
    const [allSchedules, setAllSchedules] = useState([]);
    const [newTime, setNewTime] = useState('');
    const [loadingTimes, setLoadingTimes] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [actionError, setActionError] = useState('');

    useEffect(() => {
        (async () => {
            try {
                const data = await getAppointmentByToken(token);
                setAppointment(data);
            } catch (e) {
                setError(e.response?.data?.error || 'Turno no encontrado.');
            } finally {
                setLoading(false);
            }
        })();
    }, [token]);

    useEffect(() => {
        if (!newDate) return;
        setLoadingTimes(true);
        setNewTime('');
        Promise.all([getBookedTimes(newDate), allSchedules.length ? Promise.resolve(allSchedules) : getSchedules()])
            .then(([booked, schedules]) => {
                if (!allSchedules.length) setAllSchedules(schedules);
                const free = schedules
                    .map(s => s.time)
                    .filter(t => !booked.includes(t));
                setAvailableTimes(free);
            })
            .catch(() => setAvailableTimes([]))
            .finally(() => setLoadingTimes(false));
    }, [newDate]);

    async function handleCancel() {
        setActionLoading(true);
        setActionError('');
        try {
            await cancelAppointmentByToken(token);
            setDoneMsg('Tu turno fue cancelado correctamente. Si pagaste seña, contactanos por WhatsApp para coordinar el reembolso.');
            setView('done');
        } catch (e) {
            setActionError(e.response?.data?.error || 'No se pudo cancelar el turno.');
        } finally {
            setActionLoading(false);
        }
    }

    async function handleReschedule() {
        if (!newDate || !newTime) {
            setActionError('Seleccioná una fecha y hora.');
            return;
        }
        setActionLoading(true);
        setActionError('');
        try {
            await rescheduleAppointmentByToken(token, newDate, newTime);
            setDoneMsg(`Tu turno fue reprogramado para el ${formatFecha(newDate)} a las ${newTime} hs. Te enviamos confirmación por WhatsApp.`);
            setView('done');
        } catch (e) {
            setActionError(e.response?.data?.error || 'No se pudo reprogramar el turno.');
        } finally {
            setActionLoading(false);
        }
    }

    const canOperate = appointment && appointment.hoursUntil >= 4
        && appointment.status !== 'cancelled'
        && appointment.status !== 'completed';

    return (
        <div style={styles.page}>
            <div style={styles.card}>
                <div style={styles.logo}>✂️ YSY BARBER</div>

                {loading && <p style={styles.secondary}>Cargando turno...</p>}

                {!loading && error && (
                    <div style={styles.errorBox}>
                        <p style={{ fontWeight: 600 }}>Turno no encontrado</p>
                        <p style={{ ...styles.secondary, marginTop: 4 }}>{error}</p>
                    </div>
                )}

                {!loading && appointment && view === 'main' && (
                    <>
                        <h1 style={styles.title}>Gestionar mi turno</h1>

                        <div style={styles.infoBox}>
                            <InfoRow label="Nombre" value={appointment.clientName} />
                            <InfoRow label="Servicio" value={appointment.serviceName} />
                            <InfoRow label="Fecha" value={formatFecha(appointment.appointmentDate)} />
                            <InfoRow label="Hora" value={`${appointment.appointmentTime} hs`} />
                        </div>

                        {appointment.status === 'cancelled' && (
                            <div style={styles.statusBadge('#EF4444')}>Este turno ya fue cancelado.</div>
                        )}
                        {appointment.status === 'completed' && (
                            <div style={styles.statusBadge('#10B981')}>Este turno ya fue completado.</div>
                        )}

                        {canOperate && appointment.hoursUntil < 24 && (
                            <div style={styles.warningBox}>
                                Tu turno es en menos de 24 horas. Podés gestionarlo hasta 4 horas antes.
                            </div>
                        )}

                        {!canOperate && appointment.status !== 'cancelled' && appointment.status !== 'completed' && (
                            <div style={styles.errorBox}>
                                No es posible cancelar o reprogramar con menos de 4 horas de anticipación.<br />
                                Contactanos directamente por WhatsApp.
                            </div>
                        )}

                        {canOperate && (
                            <div style={styles.actions}>
                                <button style={styles.btnSecondary} onClick={() => { setView('reschedule'); setActionError(''); }}>
                                    Reprogramar turno
                                </button>
                                <button style={styles.btnDanger} onClick={() => { setView('cancel-confirm'); setActionError(''); }}>
                                    Cancelar turno
                                </button>
                            </div>
                        )}
                    </>
                )}

                {!loading && appointment && view === 'cancel-confirm' && (
                    <>
                        <h1 style={styles.title}>¿Confirmás la cancelación?</h1>
                        <p style={styles.secondary}>
                            Vas a cancelar tu turno del <strong style={{ color: '#fff' }}>{formatFecha(appointment.appointmentDate)}</strong> a las <strong style={{ color: '#fff' }}>{appointment.appointmentTime} hs</strong>.
                        </p>
                        <p style={{ ...styles.secondary, marginTop: 8 }}>
                            Si pagaste seña, coordinaremos el reembolso por WhatsApp.
                        </p>

                        {actionError && <div style={styles.errorBox}>{actionError}</div>}

                        <div style={styles.actions}>
                            <button style={styles.btnSecondary} onClick={() => setView('main')} disabled={actionLoading}>
                                Volver
                            </button>
                            <button style={styles.btnDanger} onClick={handleCancel} disabled={actionLoading}>
                                {actionLoading ? 'Cancelando...' : 'Sí, cancelar'}
                            </button>
                        </div>
                    </>
                )}

                {!loading && appointment && view === 'reschedule' && (
                    <>
                        <h1 style={styles.title}>Reprogramar turno</h1>
                        <p style={styles.secondary}>Elegí la nueva fecha y hora para tu {appointment.serviceName}.</p>

                        <div style={styles.formGroup}>
                            <label style={styles.label}>Nueva fecha</label>
                            <input
                                type="date"
                                value={newDate}
                                min={getTodayStr()}
                                onChange={e => setNewDate(e.target.value)}
                                style={styles.input}
                            />
                        </div>

                        {newDate && (
                            <div style={styles.formGroup}>
                                <label style={styles.label}>Nuevo horario</label>
                                {loadingTimes ? (
                                    <p style={styles.secondary}>Cargando horarios...</p>
                                ) : availableTimes.length === 0 ? (
                                    <p style={{ ...styles.secondary, color: '#EF4444' }}>No hay horarios disponibles para ese día.</p>
                                ) : (
                                    <div style={styles.timesGrid}>
                                        {availableTimes.map(t => (
                                            <button
                                                key={t}
                                                style={newTime === t ? styles.timeSelected : styles.timeBtn}
                                                onClick={() => setNewTime(t)}
                                            >
                                                {t}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {actionError && <div style={styles.errorBox}>{actionError}</div>}

                        <div style={styles.actions}>
                            <button style={styles.btnSecondary} onClick={() => { setView('main'); setNewDate(''); setNewTime(''); setActionError(''); }} disabled={actionLoading}>
                                Volver
                            </button>
                            <button
                                style={newDate && newTime ? styles.btnPrimary : { ...styles.btnPrimary, opacity: 0.5, cursor: 'not-allowed' }}
                                onClick={handleReschedule}
                                disabled={actionLoading || !newDate || !newTime}
                            >
                                {actionLoading ? 'Guardando...' : 'Confirmar'}
                            </button>
                        </div>
                    </>
                )}

                {view === 'done' && (
                    <>
                        <div style={styles.doneIcon}>✅</div>
                        <h1 style={styles.title}>Listo</h1>
                        <p style={styles.secondary}>{doneMsg}</p>
                        <button style={{ ...styles.btnPrimary, marginTop: 24, width: '100%' }} onClick={() => navigate('/')}>
                            Volver al inicio
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

function InfoRow({ label, value }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #262626' }}>
            <span style={{ color: '#A1A1AA', fontSize: '0.9rem' }}>{label}</span>
            <span style={{ color: '#FAFAFA', fontWeight: 500 }}>{value}</span>
        </div>
    );
}

const styles = {
    page: {
        minHeight: '100vh',
        backgroundColor: '#0A0A0A',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        fontFamily: "'Outfit', sans-serif",
    },
    card: {
        backgroundColor: '#171717',
        borderRadius: '16px',
        padding: '40px 32px',
        width: '100%',
        maxWidth: '480px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
    },
    logo: {
        textAlign: 'center',
        fontSize: '1.1rem',
        fontWeight: 700,
        color: '#c07bf7',
        letterSpacing: '2px',
        marginBottom: '24px',
    },
    title: {
        fontSize: '1.5rem',
        fontWeight: 700,
        color: '#FAFAFA',
        marginBottom: '12px',
    },
    secondary: {
        color: '#A1A1AA',
        fontSize: '0.95rem',
        lineHeight: '1.6',
    },
    infoBox: {
        backgroundColor: '#262626',
        borderRadius: '12px',
        padding: '4px 16px',
        marginBottom: '20px',
        marginTop: '16px',
    },
    errorBox: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: '10px',
        padding: '12px 16px',
        color: '#EF4444',
        fontSize: '0.9rem',
        marginTop: '16px',
        lineHeight: '1.5',
    },
    warningBox: {
        backgroundColor: 'rgba(234, 179, 8, 0.1)',
        border: '1px solid rgba(234, 179, 8, 0.3)',
        borderRadius: '10px',
        padding: '12px 16px',
        color: '#EAB308',
        fontSize: '0.9rem',
        marginTop: '8px',
    },
    statusBadge: (color) => ({
        backgroundColor: `${color}1a`,
        border: `1px solid ${color}4d`,
        borderRadius: '10px',
        padding: '10px 16px',
        color: color,
        fontWeight: 600,
        textAlign: 'center',
        marginTop: '16px',
    }),
    actions: {
        display: 'flex',
        gap: '12px',
        marginTop: '24px',
    },
    btnPrimary: {
        flex: 1,
        padding: '14px',
        borderRadius: '10px',
        backgroundColor: '#c07bf7',
        color: '#fff',
        fontWeight: 600,
        fontSize: '1rem',
        border: 'none',
        cursor: 'pointer',
        fontFamily: "'Outfit', sans-serif",
    },
    btnSecondary: {
        flex: 1,
        padding: '14px',
        borderRadius: '10px',
        backgroundColor: '#262626',
        color: '#FAFAFA',
        fontWeight: 600,
        fontSize: '1rem',
        border: '1px solid #404040',
        cursor: 'pointer',
        fontFamily: "'Outfit', sans-serif",
    },
    btnDanger: {
        flex: 1,
        padding: '14px',
        borderRadius: '10px',
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        color: '#EF4444',
        fontWeight: 600,
        fontSize: '1rem',
        border: '1px solid rgba(239, 68, 68, 0.4)',
        cursor: 'pointer',
        fontFamily: "'Outfit', sans-serif",
    },
    formGroup: {
        marginTop: '20px',
    },
    label: {
        display: 'block',
        color: '#A1A1AA',
        fontSize: '0.85rem',
        marginBottom: '8px',
        fontWeight: 500,
    },
    input: {
        width: '100%',
        padding: '12px 14px',
        borderRadius: '10px',
        border: '1px solid #404040',
        backgroundColor: '#262626',
        color: '#FAFAFA',
        fontSize: '1rem',
        fontFamily: "'Outfit', sans-serif",
        outline: 'none',
    },
    timesGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '8px',
        marginTop: '4px',
    },
    timeBtn: {
        padding: '10px 0',
        borderRadius: '8px',
        backgroundColor: '#262626',
        color: '#FAFAFA',
        border: '1px solid #404040',
        cursor: 'pointer',
        fontSize: '0.9rem',
        fontFamily: "'Outfit', sans-serif",
    },
    timeSelected: {
        padding: '10px 0',
        borderRadius: '8px',
        backgroundColor: '#c07bf7',
        color: '#fff',
        border: '1px solid #c07bf7',
        cursor: 'pointer',
        fontSize: '0.9rem',
        fontWeight: 600,
        fontFamily: "'Outfit', sans-serif",
    },
    doneIcon: {
        fontSize: '3rem',
        textAlign: 'center',
        marginBottom: '12px',
    },
};
