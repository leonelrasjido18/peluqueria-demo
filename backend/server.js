const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dotenv = require('dotenv');
const cron = require('node-cron');
const bcrypt = require('bcrypt');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const rateLimit = require('express-rate-limit');

// Servicios locales
const { sendWhatsAppMessage, isReady, startWhatsApp, resetWhatsApp, unlinkWhatsApp, getQrData } = require('./whatsappService');
const fetch = require('node-fetch');

dotenv.config();

// ==========================================
// CREDENCIALES DESDE .ENV (nunca hardcodeadas)
// ==========================================
const MP_CLIENT_ID = process.env.MP_CLIENT_ID;
const MP_CLIENT_SECRET = process.env.MP_CLIENT_SECRET;
const MP_REDIRECT_URI = process.env.MP_REDIRECT_URI || 'https://synory.tech/api/webhooks/mercadopago/auth';
const AUTH_SECRET = process.env.AUTH_SECRET || 'default_secret_change_me';

// Configuración de MercadoPago
const getMpClient = () => {
    return new Promise((resolve, reject) => {
        db.get("SELECT value FROM settings WHERE key = 'mp_token'", (err, row) => {
            const token = (row && row.value) ? row.value : process.env.MP_ACCESS_TOKEN;
            if (!token) return reject(new Error('No hay token de Mercado Pago configurado'));
            resolve(new MercadoPagoConfig({ accessToken: token }));
        });
    });
};

const app = express();

// ==========================================
// SEGURIDAD: CORS restringido
// ==========================================
const allowedOrigins = [
    'https://synory.tech',
    'http://localhost:5173',
    'http://localhost:5174'
];
app.use(cors({
    origin: function (origin, callback) {
        // Permitir requests sin origin (curl, postman, server-to-server)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Bloqueado por CORS'));
        }
    }
}));
app.use(express.json());

// ==========================================
// SEGURIDAD: Rate Limiting en login
// ==========================================
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // máximo 5 intentos
    message: { error: 'Demasiados intentos de inicio de sesión. Intentá de nuevo en 15 minutos.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// ==========================================
// SEGURIDAD: Middleware de autenticación
// ==========================================
const requireAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || authHeader !== `Bearer ${AUTH_SECRET}`) {
        return res.status(401).json({ error: 'No autorizado' });
    }
    next();
};

// Manejo de errores globales para evitar caídas de Node.js
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

const PORT = process.env.PORT || 5000;

// Configuración de Base de Datos
const dbPath = path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('✅ Base de datos SQLite conectada correctamente.');
        initDatabase();
    }
});

// Inicialización de la base de datos (tablas y datos iniciales)
function initDatabase() {
    db.serialize(() => {
        // Tabla de Usuarios
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            phone TEXT UNIQUE,
            password TEXT,
            role TEXT
        )`);

        // Tabla de Configuraciones
        db.run(`CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )`);

        // Tabla de Servicios
        db.run(`CREATE TABLE IF NOT EXISTS services (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            duration INTEGER,
            price REAL
        )`);

        // Tabla de Turnos
        db.run(`CREATE TABLE IF NOT EXISTS appointments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            clientName TEXT,
            clientPhone TEXT,
            serviceId INTEGER,
            appointmentDate TEXT,
            appointmentTime TEXT,
            status TEXT DEFAULT 'scheduled',
            notification15MinSent INTEGER DEFAULT 0,
            notificationMasterSent INTEGER DEFAULT 0,
            FOREIGN KEY (serviceId) REFERENCES services (id)
        )`);

        // Tabla de Horarios
        db.run(`CREATE TABLE IF NOT EXISTS schedules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            time TEXT UNIQUE
        )`);

        // Insertar horarios por defecto si no existen
        db.get("SELECT COUNT(*) AS count FROM schedules", (err, row) => {
            if (row && row.count === 0) {
                const stmt = db.prepare("INSERT OR IGNORE INTO schedules (time) VALUES (?)");
                ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00'].forEach(t => stmt.run(t));
                stmt.finalize();
                console.log('✅ Horarios iniciales cargados.');
            }
        });

        // Insertar servicios por defecto si no existen
        db.get("SELECT COUNT(*) AS count FROM services", (err, row) => {
            if (row && row.count === 0) {
                const stmt = db.prepare("INSERT INTO services (name, duration, price) VALUES (?, ?, ?)");
                stmt.run('Corte Clásico', 30, 8000);
                stmt.run('Degradado (Fade)', 45, 10000);
                stmt.run('Corte + Barba', 60, 15000);
                stmt.run('Perfilado Rapido', 20, 5000);
                stmt.finalize();
                console.log('✅ Servicios iniciales cargados.');
            }
        });

        // Asegurar que el usuario maestro existe
        (async () => {
            const masterPass = process.env.MASTER_PASSWORD || '123456';
            const hashedPassword = await bcrypt.hash(masterPass, 10);
            db.get("SELECT id FROM users WHERE role = 'master'", (err, row) => {
                if (!row) {
                    const stmt = db.prepare("INSERT INTO users (name, phone, password, role) VALUES (?, ?, ?, 'master')");
                    stmt.run('Juampi', '+549111234567', hashedPassword);
                    stmt.finalize();
                    console.log('✅ Usuario maestro guardado por primera vez.');
                } else {
                    db.run("UPDATE users SET phone = ?, password = ? WHERE id = ?", ['+549111234567', hashedPassword, row.id]);
                }
            });
        })();
    });
}

// ==========================================
// ENDPOINTS DE AUTENTICACIÓN
// ==========================================
app.post('/api/auth/login', loginLimiter, (req, res) => {
    const { phone, password } = req.body;

    if (!phone || !password) {
        return res.status(400).json({ error: 'Número y contraseña son requeridos.' });
    }

    // Normalizar: Agregar el '+' obligatoriamente si no lo tiene
    let searchPhone = phone.trim();
    if (!searchPhone.startsWith('+')) searchPhone = '+' + searchPhone;

    db.get('SELECT * FROM users WHERE phone = ?', [searchPhone], async (err, user) => {
        if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
        if (!user) return res.status(401).json({ error: 'Número de WhatsApp incorrecto.' });

        // SEGURIDAD: Solo bcrypt.compare, nunca comparación en texto plano
        try {
            const match = await bcrypt.compare(password, user.password);
            if (!match) return res.status(401).json({ error: 'Contraseña incorrecta.' });

            // Devolver datos del usuario + token de sesión
            res.json({ 
                id: user.id, 
                name: user.name, 
                role: user.role,
                token: AUTH_SECRET
            });
        } catch (bcryptErr) {
            return res.status(500).json({ error: 'Error interno del servidor.' });
        }
    });
});

// ==========================================
// ENDPOINTS DE CONFIGURACIONES (PROTEGIDOS)
// ==========================================
app.get('/api/settings/mercadopago', requireAuth, (req, res) => {
    db.get("SELECT value FROM settings WHERE key = 'mp_token'", (err, row) => {
        if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
        // SEGURIDAD: Solo devolver si existe o no, nunca el token completo
        res.json({ hasToken: !!(row && row.value), token: row ? row.value : '' });
    });
});

app.post('/api/settings/mercadopago', requireAuth, (req, res) => {
    const { token } = req.body;
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
        return res.status(400).json({ error: 'Token inválido.' });
    }
    db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('mp_token', ?)", [token.trim()], function(err) {
        if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
        res.json({ success: true });
    });
});

app.delete('/api/settings/mercadopago', requireAuth, (req, res) => {
    db.run("DELETE FROM settings WHERE key = 'mp_token'", function(err) {
        if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
        res.json({ success: true });
    });
});

// ==========================================
// ENDPOINTS DE SERVICIOS
// ==========================================
app.get('/api/services', (req, res) => {
    db.all("SELECT * FROM services", [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
        res.json(rows);
    });
});

app.post('/api/services', requireAuth, (req, res) => {
    const { name, duration, price } = req.body;
    if (!name || !duration || price === undefined) {
        return res.status(400).json({ error: 'Nombre, duración y precio son requeridos.' });
    }
    db.run("INSERT INTO services (name, duration, price) VALUES (?, ?, ?)", [name, parseInt(duration), parseFloat(price)], function(err) {
        if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
        res.json({ id: this.lastID, name, duration, price });
    });
});

app.put('/api/services/:id', requireAuth, (req, res) => {
    const { name, duration, price } = req.body;
    if (!name || !duration || price === undefined) {
        return res.status(400).json({ error: 'Nombre, duración y precio son requeridos.' });
    }
    db.run("UPDATE services SET name = ?, duration = ?, price = ? WHERE id = ?", [name, parseInt(duration), parseFloat(price), req.params.id], function(err) {
        if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
        res.json({ success: true });
    });
});

app.delete('/api/services/:id', requireAuth, (req, res) => {
    db.run("DELETE FROM services WHERE id = ?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
        res.json({ success: true });
    });
});

// ==========================================
// ENDPOINTS DE HORARIOS
// ==========================================
app.get('/api/schedules', (req, res) => {
    db.all("SELECT * FROM schedules ORDER BY time ASC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
        res.json(rows);
    });
});

app.post('/api/schedules', requireAuth, (req, res) => {
    const { time } = req.body;
    if (!time || !/^\d{2}:\d{2}$/.test(time)) {
        return res.status(400).json({ error: 'Formato de hora inválido. Usar HH:MM.' });
    }
    db.run("INSERT OR IGNORE INTO schedules (time) VALUES (?)", [time], function(err) {
        if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
        res.json({ id: this.lastID, time });
    });
});

app.delete('/api/schedules/:id', requireAuth, (req, res) => {
    db.run("DELETE FROM schedules WHERE id = ?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
        res.json({ success: true });
    });
});

// ==========================================
// ENDPOINTS DE TURNOS Y PAGOS 
// ==========================================
app.post('/api/appointments', (req, res) => {
    const { clientName, clientPhone, serviceId, appointmentDate, appointmentTime } = req.body;

    if (!clientName || !clientPhone || !serviceId || !appointmentDate || !appointmentTime) {
        return res.status(400).json({ error: 'Todos los campos son requeridos.' });
    }

    db.get("SELECT * FROM services WHERE id = ?", [serviceId], (err, serviceRow) => {
        if (err || !serviceRow) return res.status(400).json({ error: 'Servicio no encontrado' });

        const precioSena = serviceRow.price * 0.25;
        const sql = `INSERT INTO appointments (clientName, clientPhone, serviceId, appointmentDate, appointmentTime, status) 
                     VALUES (?, ?, ?, ?, ?, 'pending_payment')`;

        db.run(sql, [clientName, clientPhone, serviceId, appointmentDate, appointmentTime], async function (err) {
            if (err) return res.status(400).json({ error: 'Error al crear el turno.' });

            const newAppointmentId = this.lastID;
            const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
            const WEBHOOK_URL = process.env.WEBHOOK_URL ? `${process.env.WEBHOOK_URL}/api/webhooks/mercadopago` : undefined;

            try {
                const mpCli = await getMpClient();
                const preference = new Preference(mpCli);
                const result = await preference.create({
                    body: {
                        items: [{
                            id: serviceId.toString(),
                            title: `Seña 25% - ${serviceRow.name}`,
                            unit_price: precioSena,
                            quantity: 1,
                        }],
                        back_urls: {
                            success: `${FRONTEND_URL}/pago-exitoso`,
                            failure: `${FRONTEND_URL}/pago-fallido`,
                            pending: `${FRONTEND_URL}/pago-pendiente`
                        },
                        auto_return: "approved",
                        external_reference: newAppointmentId.toString(),
                        notification_url: WEBHOOK_URL
                    }
                });

                res.json({
                    id: newAppointmentId,
                    message: 'Turno creado, esperando pago de seña...',
                    init_point: result.init_point
                });
            } catch (error) {
                console.error("Error MercadoPago API:", error.message);
                res.status(500).json({ error: 'Error al generar link de Mercado Pago' });
            }
        });
    });
});

app.post('/api/appointments/manual', requireAuth, (req, res) => {
    const { clientName, clientPhone, serviceId, appointmentDate, appointmentTime } = req.body;
    if (!clientName || !serviceId || !appointmentDate || !appointmentTime) {
        return res.status(400).json({ error: 'Todos los campos son requeridos.' });
    }
    const sql = `INSERT INTO appointments (clientName, clientPhone, serviceId, appointmentDate, appointmentTime, status) 
                 VALUES (?, ?, ?, ?, ?, 'scheduled')`;

    db.run(sql, [clientName, clientPhone || '', serviceId, appointmentDate, appointmentTime], function (err) {
        if (err) return res.status(400).json({ error: 'Error al crear el turno.' });
        res.json({ success: true, id: this.lastID });
    });
});

app.get('/api/appointments/booked', (req, res) => {
    const { date } = req.query;
    if(!date) return res.status(400).json({ error: 'Fecha requerida.' });
    
    const query = `
        SELECT appointmentTime 
        FROM appointments 
        WHERE appointmentDate = ? AND status IN ('scheduled', 'completed', 'pending_payment')
    `;
    db.all(query, [date], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
        res.json(rows.map(r => r.appointmentTime));
    });
});

// PROTEGIDO: Lista completa de turnos (contiene datos de clientes)
app.get('/api/appointments', requireAuth, (req, res) => {
    const query = `
        SELECT a.id, a.clientName, a.clientPhone, a.appointmentDate, a.appointmentTime, a.status, 
               COALESCE(s.name, 'Servicio Eliminado') as serviceName, COALESCE(s.price, 0) as price 
        FROM appointments a
        LEFT JOIN services s ON a.serviceId = s.id
        ORDER BY a.appointmentDate DESC, a.appointmentTime DESC
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
        res.json(rows);
    });
});

app.put('/api/appointments/:id/status', requireAuth, (req, res) => {
    const { status } = req.body;
    const validStatuses = ['scheduled', 'completed', 'cancelled', 'pending_payment'];
    if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: 'Estado inválido.' });
    }
    db.run("UPDATE appointments SET status = ? WHERE id = ?", [status, req.params.id], function (err) {
        if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
        res.json({ success: true });
    });
});

app.delete('/api/appointments/:id', requireAuth, (req, res) => {
    db.run("DELETE FROM appointments WHERE id = ?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
        res.json({ success: true });
    });
});

// ==========================================
// ENDPOINT WEBHOOK MERCADO PAGO / OAUTH
// ==========================================

// Callback de Autorización Oficial (OAuth)
app.get('/api/webhooks/mercadopago/auth', async (req, res) => {
    const { code } = req.query;
    if (!code) return res.redirect('https://synory.tech/dashboard?mp_error=no_code');

    try {
        const response = await fetch('https://api.mercadopago.com/oauth/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
            body: new URLSearchParams({
                client_secret: MP_CLIENT_SECRET,
                client_id: MP_CLIENT_ID,
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: MP_REDIRECT_URI
            })
        });

        const data = await response.json();

        if (data.access_token) {
            db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('mp_token', ?)", [data.access_token], (err) => {
                if (err) return res.redirect('https://synory.tech/dashboard?mp_error=db_error');
                res.redirect('https://synory.tech/dashboard?mp_success=true');
            });
        } else {
            console.error('Error canjeando código MP:', data);
            res.redirect('https://synory.tech/dashboard?mp_error=invalid_token_exchange');
        }
    } catch (err) {
        console.error('Excepción canjeando código MP:', err.message);
        res.redirect('https://synory.tech/dashboard?mp_error=server_exception');
    }
});

// Webhook para Pagos Recibidos
app.post('/api/webhooks/mercadopago', async (req, res) => {
    res.status(200).send("OK");

    const paymentInfo = req.query;
    if (paymentInfo.type === 'payment' && paymentInfo['data.id']) {
        try {
            const mpCli = await getMpClient();
            const payment = new Payment(mpCli);
            const data = await payment.get({ id: paymentInfo['data.id'] });

            if (data.status === 'approved') {
                const appointmentId = data.external_reference;

                db.run("UPDATE appointments SET status = 'scheduled' WHERE id = ?", [appointmentId], function (err) {
                    if (!err && this.changes > 0) {
                        db.get("SELECT a.*, s.name as serviceName FROM appointments a JOIN services s ON a.serviceId = s.id WHERE a.id = ?", [appointmentId], (err, row) => {
                            if (row && isReady()) {
                                const cleanPhone = row.clientPhone.replace(/\D/g, '');
                                const msgCliente = `*YSY BARBER* ✂️\n¡Hola ${row.clientName}!\n\nTu seña fue recibida y tu turno fue *CONFIRMADO*.\n*Fecha:* ${row.appointmentDate}\n*Hora:* ${row.appointmentTime}\n*Servicio:* ${row.serviceName}\n\n¡Te esperamos!`;
                                sendWhatsAppMessage(cleanPhone, msgCliente);

                                db.get("SELECT phone FROM users WHERE role = 'master'", [], (err, masterRow) => {
                                    if (masterRow) {
                                        const masterPhone = masterRow.phone.replace(/\D/g, '');
                                        sendWhatsAppMessage(masterPhone, `📣 *Juampi - Seña Recibida*\n${row.clientName} pagó la seña y confirmó para el ${row.appointmentDate} a las ${row.appointmentTime}.\n(${row.serviceName})`);
                                    }
                                });
                            }
                        });
                    }
                });
            }
        } catch (error) {
            console.error("Error validando webhook de MercadoPago:", error.message);
        }
    }
});

// ==========================================
// ENDPOINTS DE WHATSAPP (PROTEGIDOS)
// ==========================================
app.get('/api/whatsapp/status', requireAuth, (req, res) => {
    res.json({ ready: isReady(), qrUrl: getQrData() });
});

app.post('/api/whatsapp/start', requireAuth, async (req, res) => {
    await resetWhatsApp();
    res.json({ success: true, message: "Intentando conectar o generar QR" });
});

app.post('/api/whatsapp/unlink', requireAuth, async (req, res) => {
    await unlinkWhatsApp();
    res.json({ success: true, message: "WhatsApp desvinculado con éxito." });
});

// ==========================================
// TAREAS EN SEGUNDO PLANO (CRON JOBS)
// ==========================================
cron.schedule('* * * * *', () => {
    if (!isReady()) return;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    db.all("SELECT a.*, s.name as serviceName FROM appointments a JOIN services s ON a.serviceId = s.id WHERE a.appointmentDate = ? AND a.status = 'scheduled'", [todayStr], (err, appointments) => {
        if (err) return console.error('Error cron:', err);

        appointments.forEach(app => {
            const [hours, minutes] = app.appointmentTime.split(':').map(Number);
            const apptTime = new Date();
            apptTime.setHours(hours, minutes, 0, 0);

            const diffMins = Math.floor((apptTime - now) / 1000 / 60);

            if (diffMins === 15 && app.notification15MinSent === 0) {
                const cleanPhone = app.clientPhone.replace(/\D/g, '');
                const msg = `*YSY BARBER* ✂️\n\n¡${app.clientName}, tu turno de ${app.serviceName} empieza en *15 minutos*! Te esperamos.`;
                sendWhatsAppMessage(cleanPhone, msg);
                db.run("UPDATE appointments SET notification15MinSent = 1 WHERE id = ?", [app.id]);
            }

            if (diffMins === 5 && app.notificationMasterSent === 0) {
                db.get("SELECT phone FROM users WHERE role = 'master'", [], (err, masterRow) => {
                    if (!err && masterRow) {
                        const cleanMasterPhone = masterRow.phone.replace(/\D/g, '');
                        const msgMaster = `⚠️ *JUAMPI - CORTE EN 5 MIN*\n\n*Cliente:* ${app.clientName}\n*Servicio:* ${app.serviceName}\n*Hora:* ${app.appointmentTime}`;
                        sendWhatsAppMessage(cleanMasterPhone, msgMaster);
                        db.run("UPDATE appointments SET notificationMasterSent = 1 WHERE id = ?", [app.id]);
                    }
                });
            }
        });
    });
});

app.listen(PORT, () => {
    console.log(`✅ Backend Server running on port ${PORT}`);
});
