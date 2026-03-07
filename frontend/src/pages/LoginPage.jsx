import { useState, useEffect } from 'react';
import { Lock, Phone, User, LogIn, ArrowLeft } from 'lucide-react';
import { login } from '../api';
import { useNavigate } from 'react-router-dom';

const LoginPage = () => {
    const [phoneNumber, setPhoneNumber] = useState('');
    const [password, setPassword] = useState('');
    const [rememberPhone, setRememberPhone] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const savedPhone = localStorage.getItem('savedPhone');
        if (savedPhone) {
            setPhoneNumber(savedPhone);
        }
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');

        if (phoneNumber && password) {
            try {
                const userData = await login(phoneNumber, password);
                if (userData) {
                    if (rememberPhone) {
                        localStorage.setItem('savedPhone', phoneNumber);
                    } else {
                        localStorage.removeItem('savedPhone');
                    }
                    localStorage.setItem('user', JSON.stringify(userData));
                    navigate('/dashboard');
                }
            } catch (err) {
                setError('Credenciales incorrectas');
            }
        }
    };

    return (
        <div className="container" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div className="card glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '400px', textAlign: 'center', padding: '40px 30px' }}>
                <button
                    onClick={() => navigate('/')}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', marginBottom: '20px', fontSize: '0.9rem', padding: 0 }}
                >
                    <ArrowLeft size={16} /> Volver al Inicio
                </button>

                <h1 style={{ marginBottom: '10px', color: 'var(--accent-primary)', fontSize: '2rem' }}>Portal de Acceso</h1>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '30px' }}>Ingresa con tu número de WhatsApp y contraseña.</p>

                {error && <div style={{ color: 'var(--error)', marginBottom: '15px' }}>{error}</div>}

                <form onSubmit={handleLogin}>
                    <div style={{ marginBottom: '20px', textAlign: 'left' }}>
                        <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Phone size={16} /> Número de WhatsApp
                        </label>
                        <input
                            type="tel"
                            className="input-field"
                            placeholder="+549111234567"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            required
                        />
                    </div>

                    <div style={{ marginBottom: '20px', textAlign: 'left' }}>
                        <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Lock size={16} /> Contraseña
                        </label>
                        <input
                            type="password"
                            className="input-field"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    <div style={{ marginBottom: '30px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <input 
                            type="checkbox" 
                            id="remember" 
                            checked={rememberPhone} 
                            onChange={(e) => setRememberPhone(e.target.checked)} 
                            style={{ accentColor: 'var(--accent-primary)', width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                        <label htmlFor="remember" style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', cursor: 'pointer' }}>
                            Recordar mi número
                        </label>
                    </div>

                    <button type="submit" className="btn-primary" style={{ width: '100%' }}>
                        Ingresar <LogIn size={18} />
                    </button>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;
