const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dotenv = require('dotenv');
const cron = require('node-cron');
const { sendWhatsAppMessage, isReady } = require('./whatsappService');
const bcrypt = require('bcrypt'); // Añado bcrypt
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');

dotenv.config();

const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN || 'APP_USR-8700938384214532-111516-ac7d7eb0b1532f6f57c63ec3b9cf7199-2101733221' }); // Reemplazar con token de acceso correcto en el .env


const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

// Configuración de la Base de Datos con soporte para volumen persistente de Render
const dbPath = process.env.DB_PATH || path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');

        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                phone TEXT UNIQUE,
                password TEXT,
                role TEXT
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS services (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,
                duration INTEGER,
                price REAL
            )`);

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

            db.get("SELECT COUNT(*) AS count FROM services", (err, row) => {
                if (row.count === 0) {
                    const stmt = db.prepare("INSERT INTO services (name, duration, price) VALUES (?, ?, ?)");
                    stmt.run('Corte Clásico', 30, 8000);
                    stmt.run('Degradado (Fade)', 45, 10000);
                    stmt.run('Corte + Barba', 60, 15000);
                    stmt.run('Perfilado Rapido', 20, 5000);
                    stmt.finalize();
                }
            });

            db.get("SELECT COUNT(*) AS count FROM users", async (err, row) => {
                if (row.count === 0) {
                    const hashedPassword = await bcrypt.hash('123456', 10);
                    const stmt = db.prepare("INSERT INTO users (name, phone, password, role) VALUES (?, ?, ?, ?)");
                    stmt.run('Juampi', '+549111234567', hashedPassword, 'master');
                    stmt.finalize();
                }
            });
        });
    }
});

// LOGIN Endpoint 
app.post('/api/auth/login', (req, res) => {
    const { phone, password } = req.body;
    db.get('SELECT * FROM users WHERE phone = ?', [phone], async (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ error: 'Invalid credentials' });

        // En un app real usariamos JWT acá, pero simplificamos retornando datos
        res.json({ id: user.id, name: user.name, role: user.role });
    });
});

app.get('/api/services', (req, res) => {
    db.all("SELECT * FROM services", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/appointments', async (req, res) => {
    const { clientName, clientPhone, serviceId, appointmentDate, appointmentTime } = req.body;

    // Buscar servicio para obtener precio
    db.get("SELECT * FROM services WHERE id = ?", [serviceId], async (err, serviceRow) => {
        if (err || !serviceRow) return res.status(400).json({ error: 'Servicio no encontrado' });

        const precioSena = serviceRow.price * 0.25;

        const sql = `INSERT INTO appointments (clientName, clientPhone, serviceId, appointmentDate, appointmentTime, status) 
                     VALUES (?, ?, ?, ?, ?, 'pending_payment')`;

        db.run(sql, [clientName, clientPhone, serviceId, appointmentDate, appointmentTime], async function (err) {
            if (err) return res.status(400).json({ error: err.message });

            const newAppointmentId = this.lastID;

            try {
                const preference = new Preference(client);
                const result = await preference.create({
                    body: {
                        items: [
                            {
                                id: serviceId.toString(),
                                title: `Seña 25% - ${serviceRow.name}`,
                                unit_price: precioSena,
                                quantity: 1,
                            }
                        ],
                        back_urls: {
                            success: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/pago-exitoso`,
                            failure: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/pago-fallido`,
                            pending: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/pago-pendiente`
                        },
                        auto_return: "approved",
                        external_reference: newAppointmentId.toString(),
                        // Cuando publicamos en Vercel/Railway el backend, esa URL irá aquí en el .env:
                        notification_url: process.env.WEBHOOK_URL ? `${process.env.WEBHOOK_URL}/api/webhooks/mercadopago` : undefined
                    }
                });

                res.json({
                    id: newAppointmentId,
                    message: 'Turno creado, esperando pago de seña...',
                    init_point: result.init_point
                });
            } catch (error) {
                console.error(error);
                res.status(500).json({ error: 'Error al generar link de Mercado Pago' });
            }
        });
    });
});

app.post('/api/webhooks/mercadopago', async (req, res) => {
    res.status(200).send("OK");

    const paymentInfo = req.query;
    if (paymentInfo.type === 'payment' && paymentInfo['data.id']) {
        try {
            const paymentClient = new Payment(client);
            const data = await paymentClient.get({ id: paymentInfo['data.id'] });

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

app.get('/api/appointments', (req, res) => {
    const query = `
        SELECT a.id, a.clientName, a.clientPhone, a.appointmentDate, a.appointmentTime, a.status, s.name as serviceName, s.price 
        FROM appointments a
        JOIN services s ON a.serviceId = s.id
        ORDER BY a.appointmentDate DESC, a.appointmentTime DESC
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Modificación de estatus
app.put('/api/appointments/:id/status', (req, res) => {
    const { status } = req.body;
    db.run("UPDATE appointments SET status = ? WHERE id = ?", [status, req.params.id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

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
    console.log(`Backend Server running on port ${PORT}`);
});
