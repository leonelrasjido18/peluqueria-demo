const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dotenv = require('dotenv');
const cron = require('node-cron');
const bcrypt = require('bcrypt');
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');

// Servicios locales
const { sendWhatsAppMessage, isReady, startWhatsApp, getQrData } = require('./whatsappService');

dotenv.config();

// Configuración de MercadoPago
const MP_TOKEN = process.env.MP_ACCESS_TOKEN || 'APP_USR-8700938384214532-111516-ac7d7eb0b1532f6f57c63ec3b9cf7199-2101733221';
const mpClient = new MercadoPagoConfig({ accessToken: MP_TOKEN });

const app = express();
app.use(cors());
app.use(express.json());

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

        // Asegurar que el usuario maestro "Juampi" existe siempre y con la contraseña y teléfono correctos
        (async () => {
            const hashedPassword = await bcrypt.hash('123456', 10);
            db.get("SELECT id FROM users WHERE role = 'master'", (err, row) => {
                if (!row) {
                    const stmt = db.prepare("INSERT INTO users (name, phone, password, role) VALUES (?, ?, ?, 'master')");
                    stmt.run('Juampi', '+549111234567', hashedPassword);
                    stmt.finalize();
                    console.log('✅ Usuario maestro guardado por primera vez.');
                } else {
                    // Forzar actualización de credenciales para no fallar el login (Por si cambiamos números durante el desarrollo) 
                    // Esto va a cambiarle el nro telefónico y reparar la base de datos rota antigua
                    db.run("UPDATE users SET phone = ?, password = ? WHERE id = ?", ['+549111234567', hashedPassword, row.id]);
                }
            });
        })();
    });
}

// ==========================================
// ENDPOINTS DE AUTENTICACIÓN
// ==========================================
app.post('/api/auth/login', (req, res) => {
    const { phone, password } = req.body;

    // Normalizar: Agregar el '+' obligatoriamente si el usuario escribió 549111234567 sin él.
    let searchPhone = phone.trim();
    if (!searchPhone.startsWith('+')) searchPhone = '+' + searchPhone;

    db.get('SELECT * FROM users WHERE phone = ?', [searchPhone], async (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!user) return res.status(401).json({ error: 'Número de WhatsApp incorrecto.' });

        // Si la base de datos es súper vieja y tiene la clave sin encriptar (por seguridad backwards)
        if (user.password === password) {
            return res.json({ id: user.id, name: user.name, role: user.role });
        }

        // Si está encriptada correctamente
        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ error: 'Contraseña incorrecta.' });

        res.json({ id: user.id, name: user.name, role: user.role });
    });
});

// ==========================================
// ENDPOINTS DE SERVICIOS
// ==========================================
app.get('/api/services', (req, res) => {
    db.all("SELECT * FROM services", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/services', (req, res) => {
    const { name, duration, price } = req.body;
    db.run("INSERT INTO services (name, duration, price) VALUES (?, ?, ?)", [name, duration, price], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, name, duration, price });
    });
});

app.put('/api/services/:id', (req, res) => {
    const { name, duration, price } = req.body;
    db.run("UPDATE services SET name = ?, duration = ?, price = ? WHERE id = ?", [name, duration, price, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.delete('/api/services/:id', (req, res) => {
    // Note: We might have appointments tied to this service. We can soft-delete or just handle the error, but for MVP let's allow hard delete assuming caution.
    // Better yet, just delete it.
    db.run("DELETE FROM services WHERE id = ?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ==========================================
// ENDPOINTS DE HORARIOS
// ==========================================
app.get('/api/schedules', (req, res) => {
    db.all("SELECT * FROM schedules ORDER BY time ASC", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/schedules', (req, res) => {
    const { time } = req.body;
    db.run("INSERT OR IGNORE INTO schedules (time) VALUES (?)", [time], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, time });
    });
});

app.delete('/api/schedules/:id', (req, res) => {
    db.run("DELETE FROM schedules WHERE id = ?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ==========================================
// ENDPOINTS DE TURNOS Y PAGOS 
// ==========================================
app.post('/api/appointments', (req, res) => {
    const { clientName, clientPhone, serviceId, appointmentDate, appointmentTime } = req.body;

    db.get("SELECT * FROM services WHERE id = ?", [serviceId], (err, serviceRow) => {
        if (err || !serviceRow) return res.status(400).json({ error: 'Servicio no encontrado' });

        const precioSena = serviceRow.price * 0.25;
        const sql = `INSERT INTO appointments (clientName, clientPhone, serviceId, appointmentDate, appointmentTime, status) 
                     VALUES (?, ?, ?, ?, ?, 'pending_payment')`;

        db.run(sql, [clientName, clientPhone, serviceId, appointmentDate, appointmentTime], async function (err) {
            if (err) return res.status(400).json({ error: err.message });

            const newAppointmentId = this.lastID;
            const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
            const WEBHOOK_URL = process.env.WEBHOOK_URL ? `${process.env.WEBHOOK_URL}/api/webhooks/mercadopago` : undefined;

            try {
                const preference = new Preference(mpClient);
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
                console.error("Error MercadoPago API:", error);
                res.status(500).json({ error: 'Error al generar link de Mercado Pago' });
            }
        });
    });
});

app.get('/api/appointments', (req, res) => {
    const query = `
        SELECT a.id, a.clientName, a.clientPhone, a.appointmentDate, a.appointmentTime, a.status, s.name as serviceName, s.price 
        FROM appointments a
        JOIN services s ON a.serviceId = s.id
        WHERE a.status != 'pending_payment'
        ORDER BY a.appointmentDate DESC, a.appointmentTime DESC
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.put('/api/appointments/:id/status', (req, res) => {
    const { status } = req.body;
    db.run("UPDATE appointments SET status = ? WHERE id = ?", [status, req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// ==========================================
// ENDPOINT WEBHOOK MERCADO PAGO
// ==========================================
app.post('/api/webhooks/mercadopago', async (req, res) => {
    res.status(200).send("OK");

    const paymentInfo = req.query;
    if (paymentInfo.type === 'payment' && paymentInfo['data.id']) {
        try {
            const payment = new Payment(mpClient);
            const data = await payment.get({ id: paymentInfo['data.id'] });

            if (data.status === 'approved') {
                const appointmentId = data.external_reference;

                db.run("UPDATE appointments SET status = 'scheduled' WHERE id = ?", [appointmentId], function (err) {
                    if (!err && this.changes > 0) {
                        db.get("SELECT a.*, s.name as serviceName FROM appointments a JOIN services s ON a.serviceId = s.id WHERE a.id = ?", [appointmentId], (err, row) => {
                            if (row && isReady()) {
                                const cleanPhone = row.clientPhone.replace(/\D/g, '');
                                const msgCliente = `*ROYAL CUTS* ✂️\n¡Hola ${row.clientName}!\n\nTu seña fue recibida y tu turno fue *CONFIRMADO*.\n*Fecha:* ${row.appointmentDate}\n*Hora:* ${row.appointmentTime}\n*Servicio:* ${row.serviceName}\n\n¡Te esperamos!`;
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
            console.error("Error validando webhook de MercadoPago:", error);
        }
    }
});

// ==========================================
// ENDPOINTS DE WHATSAPP (FRONTEND PANEL)
// ==========================================
app.get('/api/whatsapp/status', (req, res) => {
    res.json({ ready: isReady(), qrUrl: getQrData() });
});

app.post('/api/whatsapp/start', (req, res) => {
    startWhatsApp(true); // Forzar reinicio
    res.json({ success: true, message: "Intentando conectar o generar QR" });
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
                const msg = `*ROYAL CUTS* ✂️\n\n¡${app.clientName}, tu turno de ${app.serviceName} empieza en *15 minutos*! Te esperamos.`;
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
