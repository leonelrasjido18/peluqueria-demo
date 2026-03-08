import { ArrowRight, Star, Clock, Smartphone, Scissors, Image, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { getGallery, getReviews, addReview } from '../api';

const LandingPage = () => {
    const navigate = useNavigate();
    const [gallery, setGallery] = useState([]);
    const [reviews, setReviews] = useState([]);
    const [showReviewForm, setShowReviewForm] = useState(false);
    const [reviewForm, setReviewForm] = useState({ clientName: '', rating: 5, comment: '' });
    const [reviewMsg, setReviewMsg] = useState('');

    useEffect(() => {
        getGallery().then(setGallery).catch(() => {});
        getReviews().then(setReviews).catch(() => {});
    }, []);

    const handleSubmitReview = async (e) => {
        e.preventDefault();
        if (!reviewForm.clientName) return;
        const res = await addReview(reviewForm);
        if (res.success) {
            setReviewMsg('¡Gracias por tu reseña!');
            setReviewForm({ clientName: '', rating: 5, comment: '' });
            setShowReviewForm(false);
            getReviews().then(setReviews).catch(() => {});
            setTimeout(() => setReviewMsg(''), 3000);
        }
    };

    const avgRating = reviews.length > 0 ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '0';

    return (
        <div style={{ backgroundColor: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            {/* Navbar Minimalista */}
            <nav className="landing-navbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '20px 50px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.5rem', fontWeight: '800', letterSpacing: '1px' }}>
                    <Scissors color="var(--accent-primary)" size={28} /> YSY BARBER
                </div>
                <button className="btn-secondary" onClick={() => navigate('/login')} style={{ fontSize: '0.9rem', padding: '10px 24px', borderRadius: '100px' }}>
                    Acceso Staff
                </button>
            </nav>

            <main className="landing-main" style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '60px 0' }}>
                {/* Left Side: Content */}
                <div className="animate-fade-in landing-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 80px' }}>

                    <div className="landing-bagde" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', backgroundColor: 'rgba(192, 123, 247, 0.05)', border: '1px solid rgba(192, 123, 247, 0.15)', borderRadius: '100px', marginBottom: '30px', color: 'var(--accent-primary)', fontWeight: '600', letterSpacing: '1px', fontSize: '0.8rem', width: 'fit-content' }}>
                        <Star size={14} fill="var(--accent-primary)" /> ESTILO DE ALTA GAMA
                    </div>

                    <h1 className="landing-title" style={{ fontWeight: '800', lineHeight: '1.05', marginBottom: '20px', letterSpacing: '-1.5px', textTransform: 'uppercase', fontSize: '4.2rem' }}>
                        Tu <span style={{ color: 'var(--accent-primary)' }}>Estilo,</span> <br />
                        <span style={{ color: 'var(--text-secondary)' }}>Sin Esperas.</span>
                    </h1>

                    <p style={{ fontSize: '1.15rem', color: 'var(--text-secondary)', marginBottom: '35px', maxWidth: '500px', lineHeight: '1.7', fontWeight: '300' }}>
                        Reserva tu lugar en segundos. Selecciona a tu barbero, elije tu horario y recibe notificaciones directo a tu WhatsApp.
                    </p>

                    <button className="btn-primary landing-btn" onClick={() => navigate('/reserva')} style={{ padding: '20px 40px', fontSize: '1.1rem', width: 'fit-content', borderRadius: '100px', boxShadow: '0 15px 30px -10px rgba(192,123,247,0.5)' }}>
                        RESERVAR AHORA <ArrowRight size={22} className="ml-2" />
                    </button>

                    <div className="landing-features" style={{ display: 'flex', gap: '30px', marginTop: '45px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '25px' }}>
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
                <div className="animate-fade-in landing-img-container" style={{ flex: 1, display: 'flex', alignItems: 'center', paddingRight: '40px' }}>
                    <div style={{ width: '100%', height: '550px', borderRadius: '30px', overflow: 'hidden', position: 'relative', border: '1px solid rgba(255,255,255,0.05)', boxShadow: '0 30px 60px -15px rgba(0,0,0,0.8)', backgroundColor: 'transparent' }}>
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

            {/* ====== GALERÍA DE TRABAJOS ====== */}
            {gallery.length > 0 && (
                <section style={{ padding: '60px 50px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                        <h2 style={{ fontSize: '2.2rem', fontWeight: '800', marginBottom: '10px' }}>
                            <Image size={28} color="var(--accent-primary)" style={{ verticalAlign: 'middle', marginRight: '10px' }} />
                            Nuestros <span style={{ color: 'var(--accent-primary)' }}>Trabajos</span>
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Mirá lo que podemos hacer por vos</p>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px', maxWidth: '1200px', margin: '0 auto' }}>
                        {gallery.slice(0, 6).map(g => (
                            <div key={g.id} style={{ borderRadius: '15px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)', transition: 'transform 0.3s ease', cursor: 'pointer' }}
                                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.03)'}
                                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                            >
                                <img src={g.imageUrl} alt={g.caption} style={{ width: '100%', height: '250px', objectFit: 'cover' }} />
                                {g.caption && <div style={{ padding: '12px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{g.caption}</div>}
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* ====== RESEÑAS ====== */}
            <section style={{ padding: '60px 50px', borderTop: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(255,255,255,0.01)' }}>
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <h2 style={{ fontSize: '2.2rem', fontWeight: '800', marginBottom: '10px' }}>
                        Lo Que Dicen Nuestros <span style={{ color: 'var(--accent-primary)' }}>Clientes</span>
                    </h2>
                    {reviews.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '10px' }}>
                            <span style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fbbf24' }}>{avgRating}</span>
                            <div style={{ color: '#fbbf24', fontSize: '1.2rem' }}>{'★'.repeat(Math.round(avgRating))}</div>
                            <span style={{ color: 'var(--text-secondary)' }}>({reviews.length} reseña{reviews.length > 1 ? 's' : ''})</span>
                        </div>
                    )}
                </div>

                {reviewMsg && <div style={{ textAlign: 'center', padding: '15px', backgroundColor: 'rgba(0,204,102,0.1)', borderRadius: '10px', color: 'var(--success)', marginBottom: '20px', maxWidth: '600px', margin: '0 auto 20px' }}>{reviewMsg}</div>}

                {reviews.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', maxWidth: '1000px', margin: '0 auto 30px' }}>
                        {reviews.slice(0, 6).map(r => (
                            <div key={r.id} style={{ padding: '25px', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ color: '#fbbf24', marginBottom: '10px' }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</div>
                                {r.comment && <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: '15px', lineHeight: '1.6' }}>"{r.comment}"</p>}
                                <div style={{ fontWeight: '600' }}>— {r.clientName}</div>
                            </div>
                        ))}
                    </div>
                )}

                <div style={{ textAlign: 'center' }}>
                    {!showReviewForm ? (
                        <button onClick={() => setShowReviewForm(true)} className="btn-secondary" style={{ padding: '12px 30px', borderRadius: '100px', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)' }}>
                            ⭐ Dejá tu Reseña
                        </button>
                    ) : (
                        <form onSubmit={handleSubmitReview} style={{ maxWidth: '500px', margin: '0 auto', padding: '30px', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <h3 style={{ marginBottom: '20px' }}>Tu Opinión Importa</h3>
                            <div style={{ marginBottom: '15px' }}>
                                <label className="input-label" style={{ display: 'block', marginBottom: '8px' }}>Tu Nombre</label>
                                <input className="input-field" placeholder="Ej: Juan" value={reviewForm.clientName} onChange={e => setReviewForm({...reviewForm, clientName: e.target.value})} required style={{ padding: '12px' }} />
                            </div>
                            <div style={{ marginBottom: '15px' }}>
                                <label className="input-label" style={{ display: 'block', marginBottom: '8px' }}>Calificación</label>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    {[1,2,3,4,5].map(n => (
                                        <button key={n} type="button" onClick={() => setReviewForm({...reviewForm, rating: n})}
                                            style={{ fontSize: '1.8rem', background: 'none', border: 'none', cursor: 'pointer', color: n <= reviewForm.rating ? '#fbbf24' : 'rgba(255,255,255,0.1)' }}>★</button>
                                    ))}
                                </div>
                            </div>
                            <div style={{ marginBottom: '15px' }}>
                                <label className="input-label" style={{ display: 'block', marginBottom: '8px' }}>Comentario (opcional)</label>
                                <textarea className="input-field" placeholder="Contanos tu experiencia..." value={reviewForm.comment} onChange={e => setReviewForm({...reviewForm, comment: e.target.value})} rows={3} style={{ padding: '12px', resize: 'vertical' }} />
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button type="submit" className="btn-primary" style={{ flex: 1, padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    <Send size={16} /> Enviar Reseña
                                </button>
                                <button type="button" onClick={() => setShowReviewForm(false)} style={{ padding: '12px 20px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                    Cancelar
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </section>

            {/* Footer Minimalista */}
            <footer style={{ 
                padding: '40px 50px', 
                borderTop: '1px solid rgba(255,255,255,0.05)', 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                backgroundColor: 'rgba(255,255,255,0.02)',
                flexWrap: 'wrap',
                gap: '20px'
            }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    © {new Date().getFullYear()} <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>YSY BARBER</span>. Todos los derechos reservados.
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', display: 'flex', gap: '30px', alignItems: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>📍 Salta, Argentina</span>
                    <a href="https://synory.dev" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-primary)', fontWeight: '800', textDecoration: 'none', padding: '8px 16px', border: '1px solid var(--accent-primary)', borderRadius: '50px', fontSize: '0.8rem' }}>
                        CREADO POR SYNORY.DEV
                    </a>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
