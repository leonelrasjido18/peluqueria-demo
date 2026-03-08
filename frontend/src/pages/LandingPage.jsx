import { ArrowRight, Star, Clock, Smartphone, Scissors } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const LandingPage = () => {
    const navigate = useNavigate();

    return (
        <div style={{ minHeight: '100vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)' }}>
            {/* Navbar Minimalista */}
            <nav className="landing-navbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.5rem', fontWeight: '800', letterSpacing: '1px' }}>
                    <Scissors color="var(--accent-primary)" size={28} /> YSY BARBER
                </div>
                <button className="btn-secondary" onClick={() => navigate('/login')} style={{ fontSize: '0.9rem', padding: '10px 24px', borderRadius: '100px' }}>
                    Acceso Staff
                </button>
            </nav>

            <main className="landing-main" style={{ flex: 1, display: 'flex', alignItems: 'stretch', minHeight: 0 }}>
                {/* Left Side: Content */}
                <div className="animate-fade-in landing-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>

                    <div className="landing-bagde" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', backgroundColor: 'rgba(192, 123, 247, 0.05)', border: '1px solid rgba(192, 123, 247, 0.15)', borderRadius: '100px', marginBottom: '30px', color: 'var(--accent-primary)', fontWeight: '600', letterSpacing: '1px', fontSize: '0.8rem', width: 'fit-content' }}>
                        <Star size={14} fill="var(--accent-primary)" /> ESTILO DE ALTA GAMA
                    </div>

                    <h1 className="landing-title" style={{ fontWeight: '800', lineHeight: '1.05', marginBottom: '20px', letterSpacing: '-1.5px', textTransform: 'uppercase' }}>
                        Tu <span style={{ color: 'var(--accent-primary)' }}>Estilo,</span> <br />
                        <span style={{ color: 'var(--text-secondary)' }}>Sin Esperas.</span>
                    </h1>

                    <p style={{ fontSize: '1.15rem', color: 'var(--text-secondary)', marginBottom: '35px', maxWidth: '500px', lineHeight: '1.7', fontWeight: '300' }}>
                        Reserva tu lugar en segundos. Selecciona a tu barbero, elije tu horario y recibe notificaciones directo a tu WhatsApp.
                    </p>

                    <button className="btn-primary landing-btn" onClick={() => navigate('/reserva')} style={{ padding: '20px 40px', fontSize: '1.1rem', width: 'fit-content', borderRadius: '100px', boxShadow: '0 15px 30px -10px rgba(192,123,247,0.5)' }}>
                        RESERVAR AHORA <ArrowRight size={22} className="ml-2" />
                    </button>

                    <div className="landing-features" style={{ display: 'flex', gap: '30px', marginTop: '35px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '25px', paddingBottom: '10px' }}>
                        <div className="landing-feature-item" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div style={{ width: '50px', height: '50px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Smartphone color="var(--text-primary)" size={22} />
                            </div>
                            <div>
                                <h4 style={{ fontSize: '0.95rem', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px' }}>Alertas vía WhatsApp</h4>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '300' }}>Confirmación instantánea</span>
                            </div>
                        </div>
                        <div className="landing-feature-item" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div style={{ width: '50px', height: '50px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Clock color="var(--text-primary)" size={22} />
                            </div>
                            <div>
                                <h4 style={{ fontSize: '0.95rem', fontWeight: '700', textTransform: 'uppercase', marginBottom: '2px' }}>Rápido y Fácil</h4>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '300' }}>Agenda en 1 minuto</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Side: Image */}
                <div className="animate-fade-in landing-img-container" style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                    <div style={{ width: '100%', height: '100%', borderRadius: '30px', overflow: 'hidden', position: 'relative', border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 30px 60px -15px rgba(0,0,0,0.8)', backgroundColor: 'transparent' }}>
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, var(--bg-primary) 0%, transparent 20%)', zIndex: 1 }} />
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, var(--bg-primary) 0%, transparent 25%)', zIndex: 1 }} />
                        <img
                            src="/logo.jpg"
                            alt="Estudio YSY Barber"
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                    </div>
                </div>
            </main>

            {/* Footer Minimalista */}
            <footer style={{ 
                padding: '20px 50px', 
                borderTop: '1px solid rgba(255,255,255,0.05)', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                backgroundColor: 'var(--bg-primary)',
                flexWrap: 'wrap',
                gap: '15px'
            }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    © {new Date().getFullYear()} <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>YSY BARBER</span>. Todos los derechos reservados.
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'flex', gap: '20px' }}>
                    <span>📍 Salta, Argentina</span>
                    <a href="https://synory.dev" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', fontWeight: '700', textDecoration: 'none' }}>
                        Creado por synory.dev
                    </a>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
