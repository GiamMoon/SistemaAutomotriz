// Importar dotenv y cargar variables de entorno desde .env
require('dotenv').config();

const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
const cors = require('cors');
const path = require('path');
const fs = require('fs'); // Necesario para leer el archivo CA
const multer = require('multer');
const { body, validationResult, param, query } = require('express-validator');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const app = express();
const port = process.env.PORT || 3000;

// Middlewares de Seguridad y Utilidades
app.use(
    helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" },
        contentSecurityPolicy: {
            directives: {
                ...helmet.contentSecurityPolicy.getDefaultDirectives(),
                "default-src": ["'self'"],
                "script-src": ["'self'", "https://cdn.tailwindcss.com"],
                "style-src": ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com", "'unsafe-inline'"],
                "font-src": ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
                "img-src": ["'self'", `http://localhost:${port}`, "https://*.onrender.com", "https://placehold.co", "data:"], // Ajustar para tu dominio de Render
                "connect-src": ["'self'", "https://*.onrender.com", "http://localhost:3000", "http://127.0.0.1:5500"], // Ajustar para tu dominio de Render
            },
        },
    })
);

const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:5500',
    // Añade aquí la URL de tu servicio Render una vez que la tengas
    // Ejemplo: 'https://tu-app-automotriz.onrender.com'
];
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin) || (process.env.RENDER_EXTERNAL_URL && origin === process.env.RENDER_EXTERNAL_URL)) {
            callback(null, true);
        } else {
            console.warn(`Origen CORS no permitido: ${origin}`);
            callback(new Error('Origen no permitido por CORS'));
        }
    },
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// --- Servir archivos estáticos ---
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) { fs.mkdirSync(uploadsDir); }
app.use('/uploads', express.static(uploadsDir));
console.log(`Sirviendo archivos de uploads desde: ${uploadsDir}`);

const frontendDir = path.join(__dirname, '..');
console.log(`Intentando servir archivos frontend desde: ${frontendDir}`);
app.use('/css', express.static(path.join(frontendDir, 'css')));
app.use('/js', express.static(path.join(frontendDir, 'js')));
app.use(express.static(frontendDir));

// --- Pool de Base de Datos ---
let sslConfig = {
    rejectUnauthorized: true // Es bueno mantener esto para seguridad
};

const caPathFromEnv = process.env.DB_SSL_CA_PATH;
if (caPathFromEnv) {
    const absoluteCaPath = path.isAbsolute(caPathFromEnv) ? caPathFromEnv : path.join(__dirname, caPathFromEnv);
    if (fs.existsSync(absoluteCaPath)) {
        sslConfig.ca = fs.readFileSync(absoluteCaPath);
        console.log(`Usando certificado CA desde: ${absoluteCaPath}`);
    } else {
        console.warn(`ADVERTENCIA: Certificado CA especificado en DB_SSL_CA_PATH (${absoluteCaPath}) no encontrado. La conexión SSL podría fallar.`);
    }
} else {
    console.warn(`ADVERTENCIA: DB_SSL_CA_PATH no está definido en .env. Para Aiven, esto es usualmente necesario.`);
}

const dbPool = mysql.createPool({
    connectionLimit: 10,
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: process.env.DB_PORT, // Asegúrate de tener DB_PORT en tu .env si Aiven usa uno no estándar
    waitForConnections: true,
    queueLimit: 0,
    dateStrings: true,
    ssl: sslConfig
});

async function testDbConnection() {
    let connection;
    try {
        connection = await dbPool.getConnection();
        console.log('¡Conexión exitosa a la base de datos de Aiven!');
    } catch (error) {
        console.error('Error al conectar con la base de datos de Aiven:', error);
        if (error.code === 'ER_ACCESS_DENIED_ERROR') {
             console.error('VERIFICA LAS CREDENCIALES DE AIVEN EN TU ARCHIVO .env');
        }
        if (error.message.includes('SSL') || error.message.includes('certificate') || error.code === 'HANDSHAKE_SSL_ERROR') {
            console.error('El error parece estar relacionado con la configuración SSL. Verifica el archivo CA (DB_SSL_CA_PATH en .env) y la configuración.');
        }
        // No salir del proceso en producción automáticamente, mejor loguear y manejar.
        // process.exit(1);
    } finally {
        if (connection) connection.release();
    }
}
testDbConnection(); // Probar conexión al iniciar

const saltRounds = 10;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error("ERROR CRÍTICO: Falta JWT_SECRET en las variables de entorno.");
    // process.exit(1); // Considera si quieres que la app falle al iniciar sin JWT_SECRET
}

// --- Configuración de Multer ---
const avatarUploadsDir = path.join(uploadsDir, 'avatars');
if (!fs.existsSync(avatarUploadsDir)) { fs.mkdirSync(avatarUploadsDir); }
const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, avatarUploadsDir); },
    filename: function (req, file, cb) {
        const userIdForFile = req.user ? req.user.id : (req.params.id || 'unknown');
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname);
        cb(null, `user-${userIdForFile}-${uniqueSuffix}${extension}`);
    }
});
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) { cb(null, true); }
    else { cb(new Error('Tipo de archivo no permitido. Solo se aceptan imágenes.'), false); }
};
const upload = multer({ storage: storage, fileFilter: fileFilter, limits: { fileSize: 2 * 1024 * 1024 } });
function handleMulterError(err, req, res, next) {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') { return res.status(400).json({ success: false, message: 'El archivo es demasiado grande. Máximo 2MB.' }); }
        return res.status(400).json({ success: false, message: `Error de Multer: ${err.message}` });
    } else if (err) { return res.status(400).json({ success: false, message: err.message }); }
    next();
}

// --- Middleware de Autenticación JWT ---
function authenticateToken(req, res, next) {
    const token = req.cookies.accessToken;
    if (!token) {
        return res.status(401).json({ success: false, message: 'Acceso denegado. No autenticado.' });
    }
    jwt.verify(token, JWT_SECRET, (err, userPayload) => {
        if (err) {
            res.clearCookie('accessToken');
            return res.status(403).json({ success: false, message: 'Acceso denegado. Token inválido o expirado.' });
        }
        req.user = userPayload;
        next();
    });
}

// --- Middleware de Autorización Basada en Roles ---
function authorizeRoles(allowedRoles) {
    return (req, res, next) => {
        if (!req.user || !req.user.rol) {
            return res.status(403).json({ success: false, message: 'Acceso denegado. Rol no especificado.' });
        }
        const hasRole = allowedRoles.includes(req.user.rol);
        if (!hasRole) {
            return res.status(403).json({ success: false, message: 'Acceso denegado. No tienes los permisos necesarios.' });
        }
        next();
    };
}
const adminOnly = authorizeRoles(['Administrador']);

// --- Ruta Raíz ---
app.get('/', (req, res) => {
    res.redirect('/login.html');
});

// --- RUTAS API ---
// (Aquí van todas tus rutas API como las tenías, con authenticateToken y authorizeRoles aplicados)

// --- RUTAS DE AUTENTICACIÓN Y USUARIOS ---
app.post('/api/login', [
    body('username').trim().notEmpty().withMessage('Usuario es requerido.').isLength({ min: 3, max: 50 }).escape(),
    body('password').notEmpty().withMessage('Contraseña es requerida.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ success: false, errors: errors.array() }); }
    const { username, password } = req.body;
    let connection;
    try {
        connection = await dbPool.getConnection();
        const [rows] = await connection.query('SELECT id_usuario, username, password_hash, nombre_completo, rol, avatar_url FROM Usuarios WHERE username = ?', [username]);
        if (rows.length === 0) { return res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos.' }); }
        const user = rows[0];
        const isPasswordMatch = await bcrypt.compare(password, user.password_hash);
        if (isPasswordMatch) {
            const userPayload = { id: user.id_usuario, username: user.username, rol: user.rol };
            const accessToken = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '1h' });
            res.cookie('accessToken', accessToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 60 * 60 * 1000 });
            return res.status(200).json({ success: true, message: 'Inicio de sesión exitoso.', user: { id: user.id_usuario, username: user.username, nombre: user.nombre_completo, rol: user.rol, avatarUrl: user.avatar_url }});
        } else { return res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos.' }); }
    } catch (error) { console.error('Error durante el proceso de login:', error); return res.status(500).json({ success: false, message: 'Error interno del servidor durante el inicio de sesión.' }); }
    finally { if (connection) { connection.release(); } }
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('accessToken');
    res.status(200).json({ success: true, message: 'Sesión cerrada exitosamente.' });
});

app.post('/api/register', [
    body('username').trim().notEmpty().withMessage('Nombre de usuario es requerido.').isAlphanumeric().withMessage('Username solo puede contener letras y números.').isLength({ min: 3, max: 50 }).escape(),
    body('password').notEmpty().withMessage('Contraseña es requerida.').isLength({ min: 6 }).withMessage('La contraseña debe tener al menos 6 caracteres.'),
    body('nombre_completo').trim().notEmpty().withMessage('Nombre completo es requerido.').isLength({ max: 100 }).escape()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ success: false, errors: errors.array() }); }
    const { username, password, nombre_completo } = req.body;
    let connection;
    try {
        connection = await dbPool.getConnection();
        const [existingName] = await connection.query('SELECT id_usuario FROM Usuarios WHERE nombre_completo = ?', [nombre_completo]);
        if (existingName.length > 0) { return res.status(409).json({ success: false, message: 'Error: Ya existe un usuario registrado con ese nombre completo.' }); }
        const [existingUsername] = await connection.query('SELECT id_usuario FROM Usuarios WHERE username = ?', [username]);
        if (existingUsername.length > 0) { return res.status(409).json({ success: false, message: 'Error: El nombre de usuario ya está en uso.' }); }
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const rolPorDefecto = 'Usuario';
        await connection.query('INSERT INTO Usuarios (username, password_hash, nombre_completo, rol) VALUES (?, ?, ?, ?)', [username, hashedPassword, nombre_completo, rolPorDefecto]);
        return res.status(201).json({ success: true, message: 'Usuario registrado exitosamente.' });
    } catch (error) {
        console.error('Error durante el proceso de registro:', error);
        if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) { return res.status(409).json({ success: false, message: `Error: Conflicto de datos duplicados.` }); }
        return res.status(500).json({ success: false, message: 'Error interno del servidor durante el registro.' });
    } finally { if (connection) { connection.release(); } }
});

app.post('/api/users/:id/avatar', [
    authenticateToken,
    param('id').isInt({ gt: 0 }).withMessage('ID de usuario inválido.')
], upload.single('avatar'), handleMulterError, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        if (req.file && req.file.path) { fs.unlink(req.file.path, (err) => { if (err) console.error("Error borrando archivo subido por ID inválido (validation):", err); }); }
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    const userIdFromParams = parseInt(req.params.id, 10);
    const authenticatedUserId = req.user.id;
    const authenticatedUserRol = req.user.rol;
    if (authenticatedUserId !== userIdFromParams && authenticatedUserRol !== 'Administrador') {
         if (req.file && req.file.path) { fs.unlink(req.file.path, (err) => { if (err) console.error("Error borrando archivo subido por falta de autorización:", err); }); }
         return res.status(403).json({ success: false, message: 'Acceso denegado. No tienes permiso para realizar esta acción.' });
    }
    if (!req.file) { return res.status(400).json({ success: false, message: 'No se subió ningún archivo de imagen.' }); }
    const avatarRelativePath = path.join('uploads', 'avatars', req.file.filename).replace(/\\/g, '/');
    const avatarUrl = `${req.protocol}://${req.get('host')}/${avatarRelativePath}`;
    let connection;
    try {
        connection = await dbPool.getConnection();
        const [result] = await connection.query('UPDATE Usuarios SET avatar_url = ? WHERE id_usuario = ?', [avatarUrl, userIdFromParams]);
        if (result.affectedRows > 0) {
            return res.status(200).json({ success: true, message: 'Foto de perfil actualizada exitosamente.', avatarUrl: avatarUrl });
        } else {
            fs.unlink(req.file.path, (err) => { if (err) console.error("Error borrando archivo subido por usuario no encontrado:", err); });
            return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
        }
    } catch (error) {
        console.error(`Error al actualizar avatar para usuario ID: ${userIdFromParams}:`, error);
        fs.unlink(req.file.path, (err) => { if (err) console.error("Error borrando archivo subido por error de DB:", err); });
        return res.status(500).json({ success: false, message: 'Error interno al actualizar la foto de perfil.' });
    } finally { if (connection) { connection.release(); } }
});

// --- RUTAS DE CITAS ---
app.post('/api/citas', [
    authenticateToken,
    body('nombres_cliente').trim().notEmpty().withMessage('Nombres del cliente son requeridos.').isLength({ max: 100 }).escape(),
    body('apellidos_cliente').trim().notEmpty().withMessage('Apellidos del cliente son requeridos.').isLength({ max: 100 }).escape(),
    body('email_cliente').optional({ checkFalsy: true }).isEmail().withMessage('Email inválido.').normalizeEmail().isLength({ max: 100 }),
    body('telefono_cliente').trim().notEmpty().withMessage('Teléfono es requerido.').isMobilePhone('any', { strictMode: false }).withMessage('Número de teléfono inválido.').isLength({ min: 7, max: 15 }),
    body('vehiculo_registrado_id').optional({ checkFalsy: true }).isInt({ gt: 0 }).withMessage('ID de vehículo registrado inválido.'),
    body('is_new_vehicle').isIn(['0', '1']).withMessage('Valor para is_new_vehicle inválido.'),
    body('marca_vehiculo').optional({ checkFalsy: true }).trim().isLength({ min: 1, max: 50 }).escape(),
    body('modelo_vehiculo').optional({ checkFalsy: true }).trim().isLength({ min: 1, max: 50 }).escape(),
    body('ano_vehiculo').optional({ checkFalsy: true }).isInt({ min: 1900, max: new Date().getFullYear() + 1 }).withMessage('Año de vehículo inválido.'),
    body('placa_vehiculo').optional({ checkFalsy: true }).trim().isLength({ min: 3, max: 10 }).toUpperCase().escape(),
    body('kilometraje').optional({ checkFalsy: true }).isInt({ min: 0 }).withMessage('Kilometraje inválido.'),
    body('servicio_id').notEmpty().withMessage('Servicio es requerido.').trim().escape(),
    body('detalle_sintomas').optional({ checkFalsy: true }).trim().isLength({ max: 1000 }).escape(),
    body('fecha_cita').isISO8601().withMessage('Fecha de cita inválida. Debe ser YYYY-MM-DD.'),
    body('hora_cita').matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage('Hora de cita inválida (HH:MM).')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ success: false, errors: errors.array() }); }
    const authenticatedUserId = req.user.id;
    const {
        nombres_cliente, apellidos_cliente, email_cliente, telefono_cliente,
        vehiculo_registrado_id, is_new_vehicle, marca_vehiculo, modelo_vehiculo,
        ano_vehiculo, placa_vehiculo, kilometraje, servicio_id,
        detalle_sintomas, fecha_cita, hora_cita
    } = req.body;
    if (is_new_vehicle === '1' && (!marca_vehiculo || !modelo_vehiculo || !ano_vehiculo || !placa_vehiculo)) return res.status(400).json({ success: false, message: 'Faltan campos obligatorios para registrar el nuevo vehículo.' });
    if (is_new_vehicle !== '1' && !vehiculo_registrado_id) return res.status(400).json({ success: false, message: 'Debe seleccionar un vehículo existente o añadir uno nuevo.' });
    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.beginTransaction();
        let clienteId;
        const [clientesExistentes] = await connection.query( 'SELECT id_cliente FROM Clientes WHERE telefono = ?', [telefono_cliente] );
        if (clientesExistentes.length > 0) { clienteId = clientesExistentes[0].id_cliente; }
        else { const [clienteResult] = await connection.query( 'INSERT INTO Clientes (nombres, apellidos, email, telefono) VALUES (?, ?, ?, ?)', [nombres_cliente, apellidos_cliente, email_cliente || null, telefono_cliente] ); clienteId = clienteResult.insertId; }
        let vehiculoId;
         if (is_new_vehicle === '1') {
             const [placaExistente] = await connection.query('SELECT id_vehiculo FROM Vehiculos WHERE placa = ?', [placa_vehiculo]);
             if(placaExistente.length > 0) { await connection.rollback(); return res.status(409).json({ success: false, message: 'Error: La placa del vehículo ya está registrada.' }); }
             const [vehiculoResult] = await connection.query( 'INSERT INTO Vehiculos (id_cliente, marca, modelo, ano, placa) VALUES (?, ?, ?, ?, ?)', [clienteId, marca_vehiculo, modelo_vehiculo, ano_vehiculo, placa_vehiculo] );
             vehiculoId = vehiculoResult.insertId;
         } else {
             vehiculoId = vehiculo_registrado_id;
             const [vehiculoValido] = await connection.query( 'SELECT id_vehiculo FROM Vehiculos WHERE id_vehiculo = ? AND id_cliente = ?', [vehiculoId, clienteId] );
             if (vehiculoValido.length === 0) { await connection.rollback(); return res.status(400).json({ success: false, message: 'Error: El vehículo seleccionado no pertenece al cliente indicado.' }); }
         }
        let servicioParaGuardar = null;
        if (servicio_id && servicio_id !== 'otros' && !isNaN(parseInt(servicio_id))) { servicioParaGuardar = `Servicio ID: ${parseInt(servicio_id)}`; }
        else if (servicio_id === 'otros') { servicioParaGuardar = "Otros servicios / Diagnóstico"; }
        else { await connection.rollback(); return res.status(400).json({ success: false, message: 'Debe seleccionar un servicio válido.' }); }
        const estadoInicial = 'Pendiente';
        const sqlInsertCita = `INSERT INTO Citas (id_cliente, id_vehiculo, fecha_cita, hora_cita, kilometraje, servicio_principal, motivo_detalle, estado, creado_por_id, fecha_creacion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`;
        const insertParams = [ clienteId, vehiculoId, fecha_cita, hora_cita, kilometraje || null, servicioParaGuardar, detalle_sintomas || null, estadoInicial, authenticatedUserId ];
        const [citaResult] = await connection.query(sqlInsertCita, insertParams);
        const citaId = citaResult.insertId;
        await connection.commit();
        return res.status(201).json({ success: true, message: 'Cita registrada exitosamente.', citaId: citaId });
    } catch (error) {
        console.error('Error durante la transacción de base de datos (/api/citas):', error);
        if (connection) await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) { return res.status(409).json({ success: false, message: `Error: El valor para un campo único ya existe.` }); }
        else if (error.code === 'ER_NO_REFERENCED_ROW_2') { return res.status(400).json({ success: false, message: 'Error: El cliente o el vehículo seleccionado no es válido o no existe.' }); }
        else { return res.status(500).json({ success: false, message: 'Error interno al registrar la cita.' }); }
    } finally { if (connection) { connection.release(); } }
});

app.get('/api/citas', authenticateToken, [
    query('fecha_inicio').optional().isISO8601().toDate().withMessage('Fecha de inicio inválida.'),
    query('fecha_fin').optional().isISO8601().toDate().withMessage('Fecha de fin inválida.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ success: false, errors: errors.array() }); }
    const { fecha_inicio, fecha_fin } = req.query;
    let connection;
    try {
        connection = await dbPool.getConnection();
        let sqlQuery = `
            SELECT c.*, cl.nombres AS nombre_cliente, cl.apellidos AS apellido_cliente, cl.telefono AS telefono_cliente, cl.email AS email_cliente,
                   v.marca AS marca_vehiculo, v.modelo AS modelo_vehiculo, v.ano AS ano_vehiculo, v.placa AS placa_vehiculo,
                   uc.username AS creado_por_username, um.username AS modificado_por_username
            FROM Citas c JOIN Clientes cl ON c.id_cliente = cl.id_cliente JOIN Vehiculos v ON c.id_vehiculo = v.id_vehiculo
            LEFT JOIN Usuarios uc ON c.creado_por_id = uc.id_usuario LEFT JOIN Usuarios um ON c.modificado_por_id = um.id_usuario
        `;
        const queryParams = []; let conditions = [];
        if (fecha_inicio) { conditions.push('c.fecha_cita >= ?'); queryParams.push(fecha_inicio); }
        if (fecha_fin) { conditions.push('c.fecha_cita <= ?'); queryParams.push(fecha_fin); }
        if (conditions.length > 0) { sqlQuery += ' WHERE ' + conditions.join(' AND '); }
        sqlQuery += ' ORDER BY c.fecha_cita DESC, c.hora_cita DESC';
        const [citas] = await connection.query(sqlQuery, queryParams);
        return res.status(200).json({ success: true, citas: citas });
    } catch (error) { console.error('Error al obtener la lista de citas:', error); return res.status(500).json({ success: false, message: 'Error al obtener la lista de citas.' }); }
    finally { if (connection) { connection.release(); } }
});

app.get('/api/citas/:id', authenticateToken, [
    param('id').isInt({ gt: 0 }).withMessage('ID de cita inválido.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ success: false, errors: errors.array() }); }
    const citaId = req.params.id;
    let connection;
    try {
        connection = await dbPool.getConnection();
        const sqlQuery = `
            SELECT c.*, cl.nombres AS nombre_cliente, cl.apellidos AS apellido_cliente, cl.telefono AS telefono_cliente, cl.email AS email_cliente,
                   v.marca AS marca_vehiculo, v.modelo AS modelo_vehiculo, v.ano AS ano_vehiculo, v.placa AS placa_vehiculo,
                   uc.username AS creado_por_username, um.username AS modificado_por_username
            FROM Citas c JOIN Clientes cl ON c.id_cliente = cl.id_cliente JOIN Vehiculos v ON c.id_vehiculo = v.id_vehiculo
            LEFT JOIN Usuarios uc ON c.creado_por_id = uc.id_usuario LEFT JOIN Usuarios um ON c.modificado_por_id = um.id_usuario
            WHERE c.id_cita = ?`;
        const [citas] = await connection.query(sqlQuery, [citaId]);
        if (citas.length === 0) { return res.status(404).json({ success: false, message: 'Cita no encontrada.' }); }
        return res.status(200).json({ success: true, cita: citas[0] });
    } catch (error) { console.error(`Error fetching appointment ID: ${citaId}:`, error); return res.status(500).json({ success: false, message: 'Error al obtener los detalles de la cita.' }); }
    finally { if (connection) { connection.release(); } }
});

app.put('/api/citas/:id', authenticateToken, [
    param('id').isInt({ gt: 0 }).withMessage('ID de cita inválido.'),
    body('fecha_cita').isISO8601().withMessage('Fecha de cita inválida. Debe ser YYYY-MM-DD.'),
    body('hora_cita').matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage('Hora de cita inválida (HH:MM).'),
    body('kilometraje').optional({ checkFalsy: true }).isInt({ min: 0 }).withMessage('Kilometraje inválido.'),
    body('servicio_id').notEmpty().withMessage('Servicio es requerido.').trim().escape(),
    body('detalle_sintomas').optional({ checkFalsy: true }).trim().isLength({ max: 1000 }).escape(),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ success: false, errors: errors.array() }); }
    const authenticatedUserId = req.user.id;
    const citaId = req.params.id;
    const { fecha_cita, hora_cita, kilometraje, servicio_id, detalle_sintomas } = req.body;
    let connection;
    try {
        connection = await dbPool.getConnection();
        let servicioParaGuardar = null;
        if (servicio_id && servicio_id !== 'otros' && !isNaN(parseInt(servicio_id))) { servicioParaGuardar = `Servicio ID: ${parseInt(servicio_id)}`; }
        else if (servicio_id === 'otros') { servicioParaGuardar = "Otros servicios / Diagnóstico"; }
        else { return res.status(400).json({ success: false, message: 'Debe seleccionar un servicio válido.' });}
        const sqlQuery = `UPDATE Citas SET fecha_cita = ?, hora_cita = ?, kilometraje = ?, servicio_principal = ?, motivo_detalle = ?, modificado_por_id = ?, fecha_modificacion = NOW() WHERE id_cita = ?`;
        const queryParams = [ fecha_cita, hora_cita, kilometraje || null, servicioParaGuardar, detalle_sintomas || null, authenticatedUserId, citaId ];
        const [result] = await connection.query(sqlQuery, queryParams);
        if (result.affectedRows > 0 || result.changedRows > 0) { return res.status(200).json({ success: true, message: 'Cita actualizada exitosamente.' }); }
        else { return res.status(404).json({ success: false, message: 'Cita no encontrada o sin cambios.' }); }
    } catch (error) { console.error(`Error al actualizar cita ID: ${citaId}:`, error); return res.status(500).json({ success: false, message: 'Error interno al actualizar la cita.' }); }
    finally { if (connection) { connection.release(); } }
});

app.patch('/api/citas/:id/cancelar', authenticateToken, [
    param('id').isInt({ gt: 0 }).withMessage('ID de cita inválido.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ success: false, errors: errors.array() }); }
    const authenticatedUserId = req.user.id;
    const citaId = req.params.id;
    let connection;
    try {
        connection = await dbPool.getConnection();
        const [result] = await connection.query( "UPDATE Citas SET estado = 'Cancelada', modificado_por_id = ?, fecha_modificacion = NOW() WHERE id_cita = ?", [authenticatedUserId, citaId] );
        if (result.affectedRows > 0) { return res.status(200).json({ success: true, message: 'Cita cancelada exitosamente.' }); }
        else { return res.status(404).json({ success: false, message: 'Cita no encontrada.' }); }
    } catch (error) { console.error(`Error al cancelar cita ID: ${citaId}:`, error); return res.status(500).json({ success: false, message: 'Error interno al cancelar la cita.' }); }
    finally { if (connection) { connection.release(); } }
});

app.patch('/api/citas/:id/completar', authenticateToken, [
    param('id').isInt({ gt: 0 }).withMessage('ID de cita inválido.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ success: false, errors: errors.array() }); }
    const authenticatedUserId = req.user.id;
    const citaId = req.params.id;
    let connection;
    try {
        connection = await dbPool.getConnection();
        const [result] = await connection.query( "UPDATE Citas SET estado = 'Completada', modificado_por_id = ?, fecha_modificacion = NOW() WHERE id_cita = ?", [authenticatedUserId, citaId] );
        if (result.affectedRows > 0) { return res.status(200).json({ success: true, message: 'Cita marcada como completada.' }); }
        else { return res.status(404).json({ success: false, message: 'Cita no encontrada.' }); }
    } catch (error) { console.error(`Error al completar cita ID: ${citaId}:`, error); return res.status(500).json({ success: false, message: 'Error interno al completar la cita.' }); }
    finally { if (connection) { connection.release(); } }
});

// --- RUTAS DE SERVICIOS ---
app.get('/api/servicios', authenticateToken, adminOnly, [ query('activos').optional().isBoolean() ], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ success: false, errors: errors.array() }); }
    const soloActivos = req.query.activos === 'true';
    let connection;
    try {
        connection = await dbPool.getConnection();
        let sqlQuery = "SELECT id_servicio, nombre_servicio, activo FROM Servicios";
        if (soloActivos) { sqlQuery += " WHERE activo = TRUE"; }
        sqlQuery += " ORDER BY nombre_servicio";
        const [servicios] = await connection.query(sqlQuery);
        const serviciosConBooleano = servicios.map(s => ({ ...s, activo: Boolean(s.activo) }));
        return res.status(200).json({ success: true, servicios: serviciosConBooleano });
    } catch (error) { console.error('Error al obtener servicios:', error); return res.status(500).json({ success: false, message: 'Error al obtener la lista de servicios.' }); }
    finally { if (connection) { connection.release(); } }
});

app.post('/api/servicios', authenticateToken, adminOnly, [ body('nombre_servicio').trim().notEmpty().withMessage('El nombre del servicio es requerido.').isLength({max: 100}).escape() ], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ success: false, errors: errors.array() }); }
    const { nombre_servicio } = req.body;
    let connection;
    try {
        connection = await dbPool.getConnection();
        const [existe] = await connection.query('SELECT id_servicio FROM Servicios WHERE LOWER(nombre_servicio) = LOWER(?)', [nombre_servicio]);
        if (existe.length > 0) { return res.status(409).json({ success: false, message: 'Error: Ya existe un servicio con ese nombre.' }); }
        const [result] = await connection.query( 'INSERT INTO Servicios (nombre_servicio, activo) VALUES (?, TRUE)', [nombre_servicio] );
        return res.status(201).json({ success: true, message: 'Servicio añadido exitosamente.', id_servicio: result.insertId });
    } catch (error) {
        console.error('Error al añadir servicio:', error);
        if (error.code === 'ER_DUP_ENTRY') { return res.status(409).json({ success: false, message: 'Error: Ya existe un servicio con ese nombre (constraint unique).' }); }
        return res.status(500).json({ success: false, message: 'Error interno al añadir el servicio.' });
    } finally { if (connection) connection.release(); }
});

app.put('/api/servicios/:id', authenticateToken, adminOnly, [ param('id').isInt({ gt: 0 }), body('nombre_servicio').trim().notEmpty().isLength({max: 100}).escape() ], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ success: false, errors: errors.array() }); }
    const servicioId = req.params.id;
    const { nombre_servicio } = req.body;
    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.beginTransaction();
        const [existe] = await connection.query( 'SELECT id_servicio FROM Servicios WHERE LOWER(nombre_servicio) = LOWER(?) AND id_servicio != ?', [nombre_servicio, servicioId] );
        if (existe.length > 0) { await connection.rollback(); return res.status(409).json({ success: false, message: 'Error: Ya existe otro servicio con ese nombre.' }); }
        const [result] = await connection.query( 'UPDATE Servicios SET nombre_servicio = ? WHERE id_servicio = ?', [nombre_servicio, servicioId] );
        await connection.commit();
        if (result.affectedRows > 0) { return res.status(200).json({ success: true, message: 'Servicio actualizado exitosamente.' }); }
        else { return res.status(404).json({ success: false, message: 'Servicio no encontrado.' }); }
    } catch (error) {
        console.error(`Error al actualizar servicio ID: ${servicioId}:`, error);
        if (connection) await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') { return res.status(409).json({ success: false, message: 'Error: Ya existe otro servicio con ese nombre (constraint unique).' }); }
        return res.status(500).json({ success: false, message: 'Error interno al actualizar el servicio.' });
    } finally { if (connection) connection.release(); }
});

app.patch('/api/servicios/:id/toggle', authenticateToken, adminOnly, [ param('id').isInt({ gt: 0 }) ], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ success: false, errors: errors.array() }); }
    const servicioId = req.params.id;
    let connection;
    try {
        connection = await dbPool.getConnection();
        const [currentService] = await connection.query('SELECT activo FROM Servicios WHERE id_servicio = ?', [servicioId]);
        if (currentService.length === 0) { return res.status(404).json({ success: false, message: 'Servicio no encontrado.' }); }
        const nuevoEstadoLogico = !Boolean(currentService[0].activo);
        const [result] = await connection.query( 'UPDATE Servicios SET activo = ? WHERE id_servicio = ?', [nuevoEstadoLogico, servicioId] );
        if (result.affectedRows > 0) { return res.status(200).json({ success: true, message: `Estado del servicio cambiado a ${nuevoEstadoLogico ? 'Activo' : 'Inactivo'}.`, nuevoEstado: nuevoEstadoLogico }); }
        else { return res.status(404).json({ success: false, message: 'Servicio no encontrado (o sin cambios).' }); }
    } catch (error) { console.error(`Error al cambiar estado del servicio ID: ${servicioId}:`, error); return res.status(500).json({ success: false, message: 'Error interno al cambiar estado del servicio.' }); }
    finally { if (connection) connection.release(); }
});

app.delete('/api/servicios/:id', authenticateToken, adminOnly, [ param('id').isInt({ gt: 0 }) ], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ success: false, errors: errors.array() }); }
    const servicioId = req.params.id;
    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.beginTransaction();
        const servicioIdString = `Servicio ID: ${servicioId}`;
        const [citasAsociadas] = await connection.query( 'SELECT COUNT(*) as count FROM Citas WHERE servicio_principal = ? OR servicio_principal = ?', [servicioIdString, servicioId.toString()] );
        if (citasAsociadas[0].count > 0) { await connection.rollback(); return res.status(409).json({ success: false, message: 'Error: No se puede eliminar el servicio porque está asociado a una o más citas.' }); }
        const [result] = await connection.query('DELETE FROM Servicios WHERE id_servicio = ?', [servicioId]);
        await connection.commit();
        if (result.affectedRows > 0) { return res.status(200).json({ success: true, message: 'Servicio eliminado exitosamente.' }); }
        else { return res.status(404).json({ success: false, message: 'Servicio no encontrado.' }); }
    } catch (error) {
        console.error(`Error al eliminar servicio ID: ${servicioId}:`, error);
        if (connection) await connection.rollback();
        if (error.code === 'ER_ROW_IS_REFERENCED_2') { return res.status(409).json({ success: false, message: 'Error: No se puede eliminar el servicio porque está referenciado en otras tablas (constraint).'}); }
        return res.status(500).json({ success: false, message: 'Error interno al eliminar el servicio.' });
    } finally { if (connection) connection.release(); }
});

// --- RUTAS DE VEHÍCULOS Y CLIENTES ---
app.get('/api/vehiculos/cliente', authenticateToken, [ query('telefono').trim().notEmpty().isMobilePhone('any') ], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ success: false, errors: errors.array() }); }
    const telefonoCliente = req.query.telefono;
    let connection;
    try {
        connection = await dbPool.getConnection();
        const [clientes] = await connection.query( 'SELECT id_cliente, nombres, apellidos FROM Clientes WHERE telefono = ?', [telefonoCliente] );
        if (clientes.length === 0) { return res.status(200).json({ success: true, vehicles: [], cliente: null }); }
        const cliente = clientes[0];
        const [vehiculos] = await connection.query( 'SELECT id_vehiculo, marca, modelo, placa, ano FROM Vehiculos WHERE id_cliente = ? ORDER BY marca, modelo', [cliente.id_cliente] );
        return res.status(200).json({ success: true, vehicles: vehiculos, cliente: {id_cliente: cliente.id_cliente, nombre_cliente: cliente.nombres, apellido_cliente: cliente.apellidos} });
    } catch (error) { console.error('Error al obtener vehículos por teléfono:', error); return res.status(500).json({ success: false, message: 'Error al obtener los vehículos del cliente.' }); }
    finally { if (connection) { connection.release(); } }
});

app.get('/api/clientes/buscar', authenticateToken, [ query('telefono').trim().notEmpty().isMobilePhone('any') ], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ success: false, errors: errors.array() }); }
    const telefono = req.query.telefono;
    let connection;
    try {
        connection = await dbPool.getConnection();
        const [clientes] = await connection.query( 'SELECT id_cliente, nombres, apellidos FROM Clientes WHERE telefono = ?', [telefono] );
        if (clientes.length > 0) {
            const clienteData = { id_cliente: clientes[0].id_cliente, nombre_cliente: clientes[0].nombres, apellido_cliente: clientes[0].apellidos };
            return res.status(200).json({ success: true, cliente: clienteData });
        } else {
            return res.status(404).json({ success: false, message: 'Cliente no encontrado con ese teléfono.' });
        }
    } catch (error) { console.error("Error buscando cliente por teléfono:", error); return res.status(500).json({ success: false, message: 'Error interno al buscar cliente.' }); }
    finally { if (connection) connection.release(); }
});

app.get('/api/vehiculos', authenticateToken, adminOnly, [ query('placa').optional().trim().toUpperCase().escape() ], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ success: false, errors: errors.array() }); }
    const placaQuery = req.query.placa;
    let connection;
    try {
        connection = await dbPool.getConnection();
        let sqlQuery = `
            SELECT v.id_vehiculo, v.placa AS placa_vehiculo, v.marca AS marca_vehiculo, v.modelo AS modelo_vehiculo, v.ano AS ano_vehiculo,
                   v.id_cliente, cl.nombres AS nombre_cliente, cl.apellidos AS apellido_cliente
            FROM Vehiculos v JOIN Clientes cl ON v.id_cliente = cl.id_cliente `;
        const queryParams = [];
        if (placaQuery) { sqlQuery += ' WHERE v.placa LIKE ?'; queryParams.push(`${placaQuery}%`); }
        sqlQuery += ' ORDER BY cl.apellidos, cl.nombres, v.marca, v.modelo';
        const [vehiculos] = await connection.query(sqlQuery, queryParams);
        return res.status(200).json({ success: true, vehiculos: vehiculos });
    } catch (error) { console.error('Error al obtener la lista de vehículos:', error); return res.status(500).json({ success: false, message: 'Error al obtener la lista de vehículos.' }); }
    finally { if (connection) { connection.release(); } }
});

app.post('/api/vehiculos', authenticateToken, adminOnly, [
    body('placa_vehiculo').trim().notEmpty().withMessage('Placa es requerida.').isLength({min:3, max:10}).toUpperCase().escape(),
    body('marca_vehiculo').trim().notEmpty().withMessage('Marca es requerida.').isLength({max:50}).escape(),
    body('modelo_vehiculo').trim().notEmpty().withMessage('Modelo es requerido.').isLength({max:50}).escape(),
    body('ano_vehiculo').isInt({min: 1900, max: new Date().getFullYear() + 1}).withMessage('Año inválido.'),
    body('id_cliente').isInt({ gt: 0 }).withMessage('ID de cliente inválido.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ success: false, errors: errors.array() }); }
    const { placa_vehiculo, marca_vehiculo, modelo_vehiculo, ano_vehiculo, id_cliente } = req.body;
    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.beginTransaction();
        const [clienteExiste] = await connection.query('SELECT id_cliente FROM Clientes WHERE id_cliente = ?', [id_cliente]);
        if (clienteExiste.length === 0) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Error: El cliente especificado no existe.' }); }
        const [placaExistente] = await connection.query('SELECT id_vehiculo FROM Vehiculos WHERE placa = ?', [placa_vehiculo]);
        if (placaExistente.length > 0) { await connection.rollback(); return res.status(409).json({ success: false, message: 'Error: La placa del vehículo ya está registrada.' }); }
        const sqlInsert = `INSERT INTO Vehiculos (id_cliente, marca, modelo, ano, placa) VALUES (?, ?, ?, ?, ?)`;
        const insertParams = [ id_cliente, marca_vehiculo, modelo_vehiculo, ano_vehiculo, placa_vehiculo ];
        const [result] = await connection.query(sqlInsert, insertParams);
        await connection.commit();
        return res.status(201).json({ success: true, message: 'Vehículo añadido exitosamente.', vehiculoId: result.insertId });
    } catch (error) {
        console.error('Error al añadir vehículo:', error);
        if (connection) await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') { return res.status(409).json({ success: false, message: `Error: La placa del vehículo ya existe.` }); }
        return res.status(500).json({ success: false, message: 'Error interno al añadir el vehículo.' });
    } finally { if (connection) connection.release(); }
});

app.put('/api/vehiculos/:id', authenticateToken, adminOnly, [
    param('id').isInt({ gt: 0 }).withMessage('ID de vehículo inválido.'),
    body('placa_vehiculo').trim().notEmpty().withMessage('Placa es requerida.').isLength({min:3, max:10}).toUpperCase().escape(),
    body('marca_vehiculo').trim().notEmpty().withMessage('Marca es requerida.').isLength({max:50}).escape(),
    body('modelo_vehiculo').trim().notEmpty().withMessage('Modelo es requerido.').isLength({max:50}).escape(),
    body('ano_vehiculo').isInt({min: 1900, max: new Date().getFullYear() + 1}).withMessage('Año inválido.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ success: false, errors: errors.array() }); }
    const vehiculoId = req.params.id;
    const { placa_vehiculo, marca_vehiculo, modelo_vehiculo, ano_vehiculo } = req.body;
    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.beginTransaction();
        const [placaExistente] = await connection.query( 'SELECT id_vehiculo FROM Vehiculos WHERE placa = ? AND id_vehiculo != ?', [placa_vehiculo, vehiculoId] );
        if (placaExistente.length > 0) { await connection.rollback(); return res.status(409).json({ success: false, message: 'Error: La nueva placa ya está registrada en otro vehículo.' }); }
        const sqlUpdate = `UPDATE Vehiculos SET placa = ?, marca = ?, modelo = ?, ano = ? WHERE id_vehiculo = ?`;
        const updateParams = [ placa_vehiculo, marca_vehiculo, modelo_vehiculo, ano_vehiculo, vehiculoId ];
        const [result] = await connection.query(sqlUpdate, updateParams);
        await connection.commit();
        if (result.affectedRows > 0 || result.changedRows > 0) { return res.status(200).json({ success: true, message: 'Vehículo actualizado exitosamente.' }); }
        else { return res.status(404).json({ success: false, message: 'Vehículo no encontrado o sin cambios.' }); }
    } catch (error) {
        console.error(`Error al actualizar vehículo ID: ${vehiculoId}:`, error);
        if (connection) await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') { return res.status(409).json({ success: false, message: `Error: La placa del vehículo ya existe.` }); }
        return res.status(500).json({ success: false, message: 'Error interno al actualizar el vehículo.' });
    } finally { if (connection) connection.release(); }
});

app.delete('/api/vehiculos/:id', authenticateToken, adminOnly, [
    param('id').isInt({ gt: 0 }).withMessage('ID de vehículo inválido.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ success: false, errors: errors.array() }); }
    const vehiculoId = req.params.id;
    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.beginTransaction();
        const [citasAsociadas] = await connection.query( 'SELECT COUNT(*) as count FROM Citas WHERE id_vehiculo = ?', [vehiculoId] );
        if (citasAsociadas[0].count > 0) { await connection.rollback(); return res.status(409).json({ success: false, message: 'Error: No se puede eliminar el vehículo porque tiene citas asociadas.' }); }
        const [result] = await connection.query('DELETE FROM Vehiculos WHERE id_vehiculo = ?', [vehiculoId]);
        await connection.commit();
        if (result.affectedRows > 0) { return res.status(200).json({ success: true, message: 'Vehículo eliminado exitosamente.' }); }
        else { return res.status(404).json({ success: false, message: 'Vehículo no encontrado.' }); }
    } catch (error) {
        console.error(`Error al eliminar vehículo ID: ${vehiculoId}:`, error);
        if (connection) await connection.rollback();
        if (error.code === 'ER_ROW_IS_REFERENCED_2') { return res.status(409).json({ success: false, message: 'Error: No se puede eliminar el vehículo porque está referenciado en otras tablas (constraint).'}); }
        return res.status(500).json({ success: false, message: 'Error interno al eliminar el vehículo.' });
    } finally { if (connection) connection.release(); }
});

// --- RUTAS DE CONTEO (Dashboard) ---
app.get('/api/vehiculos/count', authenticateToken, adminOnly, async (req, res) => {
    let connection;
    try {
        connection = await dbPool.getConnection();
        const [rows] = await connection.query('SELECT COUNT(*) as total FROM Vehiculos');
        res.json({ success: true, total: rows[0].total });
    } catch (error) {
        console.error('Error al contar vehículos:', error);
        res.status(500).json({ success: false, message: 'Error interno al contar vehículos.' });
    } finally {
        if (connection) connection.release();
    }
});

app.get('/api/clientes/count', authenticateToken, adminOnly, async (req, res) => {
    let connection;
    try {
        connection = await dbPool.getConnection();
        const [rows] = await connection.query('SELECT COUNT(*) as total FROM Clientes');
        res.json({ success: true, total: rows[0].total });
    } catch (error) {
        console.error('Error al contar clientes:', error);
        res.status(500).json({ success: false, message: 'Error interno al contar clientes.' });
    } finally {
        if (connection) connection.release();
    }
});

// --- FIN DE RUTAS API ---

// --- INICIO DEL SERVIDOR ---
app.listen(port, () => {
    console.log(`Servidor backend escuchando en el puerto ${port}`);
    if (process.env.NODE_ENV !== 'production') {
         console.log(`Accede a tu aplicación frontend en http://localhost:${port}/login.html`);
    }
});

// Manejo de cierre del servidor
process.on('SIGINT', async () => {
    console.log('Cerrando servidor...');
    try {
        await dbPool.end();
        console.log('Pool de conexiones de la base de datos cerrado.');
    } catch (err) {
        console.error('Error al cerrar el pool de conexiones:', err);
    }
    process.exit(0);
});
