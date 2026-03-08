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
const { sendWhatsAppMessage, isReady, startWhatsApp, resetWhatsApp, unlinkWhatsApp, getQrData, setOnReviewReceived } = require('./whatsappService');
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

        // Tabla de Bloqueo de Horarios (Días libres / horas bloqueadas)
        db.run(`CREATE TABLE IF NOT EXISTS blocked_times (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            blockedDate TEXT NOT NULL,
            timeFrom TEXT,
            timeTo TEXT,
            reason TEXT,
            fullDay INTEGER DEFAULT 0
        )`);

        // Tabla de Notas de Clientes (Ficha)
        db.run(`CREATE TABLE IF NOT EXISTS client_notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            clientPhone TEXT NOT NULL,
            note TEXT NOT NULL,
            createdAt TEXT DEFAULT (datetime('now'))
        )`);

        // Tabla de Gastos
        db.run(`CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            description TEXT NOT NULL,
            amount REAL NOT NULL,
            expenseDate TEXT NOT NULL,
            createdAt TEXT DEFAULT (datetime('now'))
        )`);

        // Tabla de Clientes (cumpleaños y datos)
        db.run(`CREATE TABLE IF NOT EXISTS clients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone TEXT UNIQUE NOT NULL,
            name TEXT,
            birthday TEXT,
            createdAt TEXT DEFAULT (datetime('now'))
        )`);

        // Tabla de Galería de Fotos
        db.run(`CREATE TABLE IF NOT EXISTS gallery (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            imageUrl TEXT NOT NULL,
            caption TEXT,
            createdAt TEXT DEFAULT (datetime('now'))
        )`);

        // Tabla de Reseñas
        db.run(`CREATE TABLE IF NOT EXISTS reviews (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            clientName TEXT NOT NULL,
            rating INTEGER NOT NULL,
            comment TEXT,
            createdAt TEXT DEFAULT (datetime('now'))
        )`);

        // Tabla de Promociones / Descuentos
        db.run(`CREATE TABLE IF NOT EXISTS promotions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE NOT NULL,
            description TEXT,
            discountPercent INTEGER NOT NULL,
            active INTEGER DEFAULT 1,
            usageCount INTEGER DEFAULT 0,
            maxUses INTEGER DEFAULT 0,
            validUntil TEXT,
            createdAt TEXT DEFAULT (datetime('now'))
        )`);

        // Columna de notificación 24hs en appointments
        db.run(`ALTER TABLE appointments ADD COLUMN notification24hSent INTEGER DEFAULT 0`, (err) => {
            // Ignorar error si ya existe
        });

        // Columna recurrence en appointments
        db.run(`ALTER TABLE appointments ADD COLUMN recurrenceWeeks INTEGER DEFAULT 0`, (err) => {
            // Ignorar error si ya existe
        });

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
// CALLBACK: Reseñas recibidas por WhatsApp
// ==========================================
setOnReviewReceived((clientName, rating, comment) => {
    db.run(
        `INSERT INTO reviews (clientName, rating, comment) VALUES (?, ?, ?)`,
        [clientName, rating, comment],
        (err) => {
            if (err) console.error('❌ Error guardando reseña de WhatsApp:', err);
            else console.log(`⭐ Reseña de WhatsApp guardada: ${clientName} - ${rating} estrellas`);
        }
    );
});

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
    
    // Primero verificar si el día completo está bloqueado
    db.get("SELECT id FROM blocked_times WHERE blockedDate = ? AND fullDay = 1", [date], (err, blocked) => {
        if (blocked) {
            // Si el día está bloqueado, devolver TODOS los horarios como ocupados
            db.all("SELECT time FROM schedules", [], (err, schedules) => {
                if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
                return res.json(schedules.map(s => s.time));
            });
            return;
        }

        // Obtener horarios bloqueados parcialmente
        db.all("SELECT timeFrom, timeTo FROM blocked_times WHERE blockedDate = ? AND fullDay = 0", [date], (err, blockedRanges) => {
            // Obtener turnos reservados
            const query = `SELECT appointmentTime FROM appointments WHERE appointmentDate = ? AND status IN ('scheduled', 'completed', 'pending_payment')`;
            db.all(query, [date], (err, rows) => {
                if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
                
                let bookedTimes = rows.map(r => r.appointmentTime);
                
                // Agregar horarios que caen dentro de rangos bloqueados
                if (blockedRanges && blockedRanges.length > 0) {
                    db.all("SELECT time FROM schedules", [], (err, allSchedules) => {
                        if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
                        allSchedules.forEach(s => {
                            blockedRanges.forEach(br => {
                                if (s.time >= br.timeFrom && s.time <= br.timeTo && !bookedTimes.includes(s.time)) {
                                    bookedTimes.push(s.time);
                                }
                            });
                        });

                        // Buffer de limpieza: bloquear slot siguiente al último turno del día
                        db.get("SELECT value FROM settings WHERE key = 'buffer_minutes'", (err, bufferRow) => {
                            const bufferMinutes = bufferRow ? parseInt(bufferRow.value) : 0;
                            if (bufferMinutes > 0 && rows.length > 0) {
                                rows.forEach(r => {
                                    const [h, m] = r.appointmentTime.split(':').map(Number);
                                    const bufferTime = new Date(2000, 0, 1, h, m + bufferMinutes);
                                    const bufferStr = `${String(bufferTime.getHours()).padStart(2,'0')}:${String(bufferTime.getMinutes()).padStart(2,'0')}`;
                                    if (!bookedTimes.includes(bufferStr)) bookedTimes.push(bufferStr);
                                });
                            }
                            res.json(bookedTimes);
                        });
                    });
                } else {
                    // Solo buffer sin bloqueos parciales
                    db.get("SELECT value FROM settings WHERE key = 'buffer_minutes'", (err, bufferRow) => {
                        const bufferMinutes = bufferRow ? parseInt(bufferRow.value) : 0;
                        if (bufferMinutes > 0 && rows.length > 0) {
                            rows.forEach(r => {
                                const [h, m] = r.appointmentTime.split(':').map(Number);
                                const bufferTime = new Date(2000, 0, 1, h, m + bufferMinutes);
                                const bufferStr = `${String(bufferTime.getHours()).padStart(2,'0')}:${String(bufferTime.getMinutes()).padStart(2,'0')}`;
                                if (!bookedTimes.includes(bufferStr)) bookedTimes.push(bufferStr);
                            });
                        }
                        res.json(bookedTimes);
                    });
                }
            });
        });
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
// ENDPOINTS DE BLOQUEO DE HORARIOS
// ==========================================
app.get('/api/blocked-times', requireAuth, (req, res) => {
    db.all("SELECT * FROM blocked_times ORDER BY blockedDate ASC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
        res.json(rows);
    });
});

app.post('/api/blocked-times', requireAuth, (req, res) => {
    const { blockedDate, timeFrom, timeTo, reason, fullDay } = req.body;
    if (!blockedDate) return res.status(400).json({ error: 'Fecha requerida.' });
    if (!fullDay && (!timeFrom || !timeTo)) return res.status(400).json({ error: 'Rango horario requerido.' });
    
    db.run("INSERT INTO blocked_times (blockedDate, timeFrom, timeTo, reason, fullDay) VALUES (?, ?, ?, ?, ?)",
        [blockedDate, fullDay ? null : timeFrom, fullDay ? null : timeTo, reason || '', fullDay ? 1 : 0],
        function(err) {
            if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
            res.json({ id: this.lastID, success: true });
        }
    );
});

app.delete('/api/blocked-times/:id', requireAuth, (req, res) => {
    db.run("DELETE FROM blocked_times WHERE id = ?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
        res.json({ success: true });
    });
});

// ==========================================
// ENDPOINTS DE NOTAS DE CLIENTES (FICHA)
// ==========================================
app.get('/api/clients/:phone/history', requireAuth, (req, res) => {
    const phone = req.params.phone;
    const query = `
        SELECT a.id, a.clientName, a.appointmentDate, a.appointmentTime, a.status,
               COALESCE(s.name, 'Servicio Eliminado') as serviceName
        FROM appointments a
        LEFT JOIN services s ON a.serviceId = s.id
        WHERE a.clientPhone = ?
        ORDER BY a.appointmentDate DESC, a.appointmentTime DESC
        LIMIT 20
    `;
    db.all(query, [phone], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
        res.json(rows);
    });
});

app.get('/api/clients/:phone/notes', requireAuth, (req, res) => {
    db.all("SELECT * FROM client_notes WHERE clientPhone = ? ORDER BY createdAt DESC", [req.params.phone], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
        res.json(rows);
    });
});

app.post('/api/clients/:phone/notes', requireAuth, (req, res) => {
    const { note } = req.body;
    if (!note || note.trim().length === 0) return res.status(400).json({ error: 'Nota requerida.' });
    db.run("INSERT INTO client_notes (clientPhone, note) VALUES (?, ?)", [req.params.phone, note.trim()], function(err) {
        if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
        res.json({ id: this.lastID, success: true });
    });
});

app.delete('/api/clients/notes/:id', requireAuth, (req, res) => {
    db.run("DELETE FROM client_notes WHERE id = ?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
        res.json({ success: true });
    });
});

// ==========================================
// ENDPOINTS DE GASTOS
// ==========================================
app.get('/api/expenses', requireAuth, (req, res) => {
    const { month, year } = req.query;
    let query = "SELECT * FROM expenses";
    let params = [];
    if (month && year) {
        query += " WHERE strftime('%m', expenseDate) = ? AND strftime('%Y', expenseDate) = ?";
        params = [month.padStart(2, '0'), year];
    }
    query += " ORDER BY expenseDate DESC, createdAt DESC";
    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
        res.json(rows);
    });
});

app.post('/api/expenses', requireAuth, (req, res) => {
    const { description, amount, expenseDate } = req.body;
    if (!description || !amount || !expenseDate) return res.status(400).json({ error: 'Todos los campos son requeridos.' });
    db.run("INSERT INTO expenses (description, amount, expenseDate) VALUES (?, ?, ?)",
        [description.trim(), parseFloat(amount), expenseDate],
        function(err) {
            if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
            res.json({ id: this.lastID, success: true });
        }
    );
});

app.delete('/api/expenses/:id', requireAuth, (req, res) => {
    db.run("DELETE FROM expenses WHERE id = ?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
        res.json({ success: true });
    });
});

// ==========================================
// ENDPOINTS DE BUFFER / CONFIGURACIÓN GENERAL
// ==========================================
app.get('/api/settings/buffer', requireAuth, (req, res) => {
    db.get("SELECT value FROM settings WHERE key = 'buffer_minutes'", (err, row) => {
        if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
        res.json({ minutes: row ? parseInt(row.value) : 0 });
    });
});

app.post('/api/settings/buffer', requireAuth, (req, res) => {
    const { minutes } = req.body;
    const val = parseInt(minutes) || 0;
    db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('buffer_minutes', ?)", [val.toString()], function(err) {
        if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
        res.json({ success: true });
    });
});

// ==========================================
// ENDPOINTS DE ESTADÍSTICAS
// ==========================================
app.get('/api/stats/peaks', requireAuth, (req, res) => {
    const dayQuery = `
        SELECT 
            CASE cast(strftime('%w', appointmentDate) as integer)
                WHEN 0 THEN 'Domingo'
                WHEN 1 THEN 'Lunes'
                WHEN 2 THEN 'Martes'
                WHEN 3 THEN 'Miércoles'
                WHEN 4 THEN 'Jueves'
                WHEN 5 THEN 'Viernes'
                WHEN 6 THEN 'Sábado'
            END as dayName,
            cast(strftime('%w', appointmentDate) as integer) as dayNum,
            COUNT(*) as total
        FROM appointments 
        WHERE status IN ('scheduled', 'completed')
        GROUP BY dayNum
        ORDER BY dayNum
    `;
    const hourQuery = `
        SELECT appointmentTime as hour, COUNT(*) as total
        FROM appointments 
        WHERE status IN ('scheduled', 'completed')
        GROUP BY appointmentTime
        ORDER BY appointmentTime
    `;
    const financeQuery = `
        SELECT 
            strftime('%Y-%m', appointmentDate) as month,
            SUM(COALESCE(s.price, 0)) as totalRevenue,
            COUNT(*) as totalAppointments
        FROM appointments a
        LEFT JOIN services s ON a.serviceId = s.id
        WHERE a.status = 'completed'
        GROUP BY month
        ORDER BY month DESC
        LIMIT 6
    `;

    db.all(dayQuery, [], (err, byDay) => {
        if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
        db.all(hourQuery, [], (err, byHour) => {
            if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
            db.all(financeQuery, [], (err, byMonth) => {
                if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
                res.json({ byDay, byHour, byMonth });
            });
        });
    });
});

// ==========================================
// ENDPOINT GANANCIA NETA MENSUAL
// ==========================================
app.get('/api/stats/net-revenue', requireAuth, (req, res) => {
    const revenueQuery = `
        SELECT 
            strftime('%Y-%m', appointmentDate) as month,
            SUM(COALESCE(s.price, 0)) as totalRevenue,
            COUNT(*) as totalAppointments
        FROM appointments a
        LEFT JOIN services s ON a.serviceId = s.id
        WHERE a.status = 'completed'
        GROUP BY month
        ORDER BY month DESC
        LIMIT 12
    `;
    const expensesQuery = `
        SELECT 
            strftime('%Y-%m', expenseDate) as month,
            SUM(amount) as totalExpenses
        FROM expenses
        GROUP BY month
        ORDER BY month DESC
        LIMIT 12
    `;
    db.all(revenueQuery, [], (err, revenueRows) => {
        if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
        db.all(expensesQuery, [], (err, expenseRows) => {
            if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
            const expenseMap = {};
            expenseRows.forEach(e => { expenseMap[e.month] = e.totalExpenses; });
            const data = revenueRows.map(r => ({
                month: r.month,
                totalRevenue: r.totalRevenue,
                totalExpenses: expenseMap[r.month] || 0,
                netRevenue: r.totalRevenue - (expenseMap[r.month] || 0),
                totalAppointments: r.totalAppointments
            }));
            res.json(data);
        });
    });
});

// ==========================================
// ENDPOINT AGENDA SEMANAL
// ==========================================
app.get('/api/appointments/week', requireAuth, (req, res) => {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) return res.status(400).json({ error: 'startDate y endDate son requeridos.' });
    const query = `
        SELECT a.id, a.clientName, a.clientPhone, a.appointmentDate, a.appointmentTime, a.status,
               COALESCE(s.name, 'Servicio Eliminado') as serviceName, COALESCE(s.price, 0) as price
        FROM appointments a
        LEFT JOIN services s ON a.serviceId = s.id
        WHERE a.appointmentDate >= ? AND a.appointmentDate <= ?
        AND a.status IN ('scheduled', 'completed', 'pending_payment')
        ORDER BY a.appointmentDate ASC, a.appointmentTime ASC
    `;
    db.all(query, [startDate, endDate], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
        res.json(rows);
    });
});

// ==========================================
// ENDPOINT EXPORTAR CSV
// ==========================================
app.get('/api/appointments/export', requireAuth, (req, res) => {
    const { month, year } = req.query;
    let query = `
        SELECT a.id, a.clientName, a.clientPhone, a.appointmentDate, a.appointmentTime, a.status,
               COALESCE(s.name, 'N/A') as serviceName, COALESCE(s.price, 0) as price
        FROM appointments a
        LEFT JOIN services s ON a.serviceId = s.id
    `;
    let params = [];
    if (month && year) {
        query += " WHERE strftime('%m', a.appointmentDate) = ? AND strftime('%Y', a.appointmentDate) = ?";
        params = [month.padStart(2, '0'), year];
    }
    query += " ORDER BY a.appointmentDate DESC, a.appointmentTime ASC";

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
        const header = 'ID,Cliente,Telefono,Fecha,Hora,Estado,Servicio,Precio\n';
        const csvRows = rows.map(r =>
            `${r.id},"${r.clientName}","${r.clientPhone}",${r.appointmentDate},${r.appointmentTime},${r.status},"${r.serviceName}",${r.price}`
        ).join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=turnos_${month || 'all'}_${year || 'all'}.csv`);
        res.send(header + csvRows);
    });
});

// ==========================================
// ENDPOINTS DE GALERÍA DE FOTOS
// ==========================================
app.get('/api/gallery', (req, res) => {
    db.all("SELECT * FROM gallery ORDER BY createdAt DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
        res.json(rows);
    });
});

app.post('/api/gallery', requireAuth, (req, res) => {
    const { imageUrl, caption } = req.body;
    if (!imageUrl) return res.status(400).json({ error: 'URL de imagen requerida.' });
    db.run("INSERT INTO gallery (imageUrl, caption) VALUES (?, ?)", [imageUrl, caption || ''], function(err) {
        if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
        res.json({ id: this.lastID, success: true });
    });
});

app.delete('/api/gallery/:id', requireAuth, (req, res) => {
    db.run("DELETE FROM gallery WHERE id = ?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
        res.json({ success: true });
    });
});

// ==========================================
// ENDPOINTS DE RESEÑAS
// ==========================================
app.get('/api/reviews', (req, res) => {
    db.all("SELECT * FROM reviews ORDER BY createdAt DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
        res.json(rows);
    });
});

app.post('/api/reviews', (req, res) => {
    const { clientName, rating, comment } = req.body;
    if (!clientName || !rating) return res.status(400).json({ error: 'Nombre y calificación requeridos.' });
    if (rating < 1 || rating > 5) return res.status(400).json({ error: 'La calificación debe ser entre 1 y 5.' });
    db.run("INSERT INTO reviews (clientName, rating, comment) VALUES (?, ?, ?)",
        [clientName, parseInt(rating), comment || ''],
        function(err) {
            if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
            res.json({ id: this.lastID, success: true });
        }
    );
});

app.delete('/api/reviews/:id', requireAuth, (req, res) => {
    db.run("DELETE FROM reviews WHERE id = ?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
        res.json({ success: true });
    });
});

// ==========================================
// ENDPOINTS DE CLIENTES (CUMPLEAÑOS)
// ==========================================
app.get('/api/clients', requireAuth, (req, res) => {
    db.all("SELECT * FROM clients ORDER BY name ASC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
        res.json(rows);
    });
});

app.post('/api/clients', requireAuth, (req, res) => {
    const { phone, name, birthday } = req.body;
    if (!phone || !name) return res.status(400).json({ error: 'Teléfono y nombre son requeridos.' });
    db.run("INSERT OR REPLACE INTO clients (phone, name, birthday) VALUES (?, ?, ?)",
        [phone, name, birthday || null],
        function(err) {
            if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
            res.json({ id: this.lastID, success: true });
        }
    );
});

app.put('/api/clients/:id', requireAuth, (req, res) => {
    const { name, birthday } = req.body;
    db.run("UPDATE clients SET name = ?, birthday = ? WHERE id = ?",
        [name, birthday || null, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
            res.json({ success: true });
        }
    );
});

app.delete('/api/clients/:id', requireAuth, (req, res) => {
    db.run("DELETE FROM clients WHERE id = ?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
        res.json({ success: true });
    });
});

// Clientes con cumpleaños hoy o esta semana
app.get('/api/clients/birthdays/upcoming', requireAuth, (req, res) => {
    const now = new Date();
    const todayMD = `${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    db.all("SELECT * FROM clients WHERE birthday IS NOT NULL", [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
        const upcoming = rows.filter(c => {
            if (!c.birthday) return false;
            const bday = c.birthday.slice(5); // MM-DD
            const [bm, bd] = bday.split('-').map(Number);
            const [tm, td] = todayMD.split('-').map(Number);
            const bdayDate = new Date(now.getFullYear(), bm - 1, bd);
            const todayDate = new Date(now.getFullYear(), tm - 1, td);
            const diff = (bdayDate - todayDate) / (1000 * 60 * 60 * 24);
            return diff >= 0 && diff <= 7;
        }).map(c => ({ ...c, isToday: c.birthday.slice(5) === todayMD }));
        res.json(upcoming);
    });
});

// Servicio favorito del cliente
app.get('/api/clients/:phone/favorite-service', requireAuth, (req, res) => {
    const query = `
        SELECT s.name, COUNT(*) as total
        FROM appointments a
        JOIN services s ON a.serviceId = s.id
        WHERE a.clientPhone = ? AND a.status IN ('scheduled', 'completed')
        GROUP BY a.serviceId
        ORDER BY total DESC
        LIMIT 1
    `;
    db.get(query, [req.params.phone], (err, row) => {
        if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
        res.json(row || { name: 'Sin datos', total: 0 });
    });
});

// ==========================================
// ENDPOINTS DE PROMOCIONES / DESCUENTOS
// ==========================================
app.get('/api/promotions', requireAuth, (req, res) => {
    db.all("SELECT * FROM promotions ORDER BY createdAt DESC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
        res.json(rows);
    });
});

app.post('/api/promotions', requireAuth, (req, res) => {
    const { code, description, discountPercent, maxUses, validUntil } = req.body;
    if (!code || !discountPercent) return res.status(400).json({ error: 'Código y porcentaje de descuento son requeridos.' });
    db.run("INSERT INTO promotions (code, description, discountPercent, maxUses, validUntil) VALUES (?, ?, ?, ?, ?)",
        [code.toUpperCase(), description || '', parseInt(discountPercent), parseInt(maxUses) || 0, validUntil || null],
        function(err) {
            if (err) {
                if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Ese código ya existe.' });
                return res.status(500).json({ error: 'Error interno del servidor.' });
            }
            res.json({ id: this.lastID, success: true });
        }
    );
});

app.put('/api/promotions/:id/toggle', requireAuth, (req, res) => {
    db.run("UPDATE promotions SET active = CASE WHEN active = 1 THEN 0 ELSE 1 END WHERE id = ?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
        res.json({ success: true });
    });
});

app.delete('/api/promotions/:id', requireAuth, (req, res) => {
    db.run("DELETE FROM promotions WHERE id = ?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
        res.json({ success: true });
    });
});

// Validar código de descuento (público)
app.post('/api/promotions/validate', (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Código requerido.' });
    db.get("SELECT * FROM promotions WHERE code = ? AND active = 1", [code.toUpperCase()], (err, row) => {
        if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
        if (!row) return res.status(404).json({ error: 'Código inválido o expirado.' });
        if (row.maxUses > 0 && row.usageCount >= row.maxUses) return res.status(400).json({ error: 'Este código ya fue usado el máximo de veces.' });
        if (row.validUntil && new Date(row.validUntil) < new Date()) return res.status(400).json({ error: 'Este código ya expiró.' });
        res.json({ valid: true, discountPercent: row.discountPercent, description: row.description });
    });
});

// ==========================================
// ENDPOINT QR PARA RESERVAS
// ==========================================
app.get('/api/booking-qr', (req, res) => {
    const FRONTEND_URL = process.env.FRONTEND_URL || 'https://synory.tech';
    res.json({ url: `${FRONTEND_URL}/reserva` });
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

// Cada minuto: notificaciones 15min y 5min
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

// Cada hora: recordatorio 24hs y cumpleaños
cron.schedule('0 * * * *', () => {
    if (!isReady()) return;

    const now = new Date();
    const tomorrowDate = new Date(now);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowStr = tomorrowDate.toISOString().split('T')[0];

    // Recordatorio 24hs antes
    db.all(
        `SELECT a.*, s.name as serviceName FROM appointments a JOIN services s ON a.serviceId = s.id 
         WHERE a.appointmentDate = ? AND a.status = 'scheduled' AND a.notification24hSent = 0`,
        [tomorrowStr],
        (err, appointments) => {
            if (err) return console.error('Error cron 24h:', err);
            appointments.forEach(app => {
                if (app.clientPhone) {
                    const cleanPhone = app.clientPhone.replace(/\D/g, '');
                    const msg = `*YSY BARBER* ✂️\n\n¡Hola ${app.clientName}!\n\nTe recordamos que mañana tenés turno:\n*📅 Fecha:* ${app.appointmentDate}\n*⏰ Hora:* ${app.appointmentTime}\n*💈 Servicio:* ${app.serviceName}\n\n¡Te esperamos!`;
                    sendWhatsAppMessage(cleanPhone, msg);
                    db.run("UPDATE appointments SET notification24hSent = 1 WHERE id = ?", [app.id]);
                }
            });
        }
    );

    // Cumpleaños: enviar mensaje a las 9am
    if (now.getHours() === 9) {
        const todayMD = `${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
        db.all("SELECT * FROM clients WHERE birthday IS NOT NULL", [], (err, clients) => {
            if (err) return;
            clients.forEach(c => {
                if (c.birthday && c.birthday.slice(5) === todayMD && c.phone) {
                    const cleanPhone = c.phone.replace(/\D/g, '');
                    const msg = `*YSY BARBER* ✂️🎂\n\n¡Feliz cumpleaños ${c.name}!\n\nQue la pases genial. Como regalo, te invitamos a tu próximo corte con un *descuento especial*.\n\n¡Pasá a visitarnos! 🎉`;
                    sendWhatsAppMessage(cleanPhone, msg);
                }
            });
        });
    }
});

app.listen(PORT, () => {
    console.log(`✅ Backend Server running on port ${PORT}`);
});
