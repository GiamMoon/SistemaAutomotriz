require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { body, validationResult, param, query } = require('express-validator');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const app = express();
const port = process.env.PORT || 3000;

app.use(
    helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" },
        contentSecurityPolicy: {
            directives: {
                ...helmet.contentSecurityPolicy.getDefaultDirectives(),
                "default-src": ["'self'"],
                "script-src": ["'self'", "https://cdn.tailwindcss.com", "'unsafe-inline'"],
                "style-src": ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com", "'unsafe-inline'"],
                "font-src": ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
                "img-src": ["'self'", `http://localhost:${port}`, "https://*.onrender.com", "https://placehold.co", "data:", `https://${process.env.RENDER_EXTERNAL_HOSTNAME}`],
                "connect-src": ["'self'", "https://*.onrender.com", `http://localhost:${port}`, `https://${process.env.RENDER_EXTERNAL_HOSTNAME}`],
            },
        },
    })
);

const allowedOrigins = [
    `http://localhost:${port}`,
    'http://127.0.0.1:5500',
    `https://${process.env.RENDER_EXTERNAL_HOSTNAME}`
];
if (process.env.RENDER_EXTERNAL_URL) {
    allowedOrigins.push(process.env.RENDER_EXTERNAL_URL);
}

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || origin === "null" || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.error(`Error de CORS: Origen no permitido: ${origin}`);
            callback(new Error('Origen no permitido por CORS'));
        }
    },
    credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));
console.log(`Sirviendo archivos de 'uploads' desde: ${uploadsDir}`);
console.warn("ADVERTENCIA: Los archivos en 'uploads' son efímeros en el plan gratuito de Render.");

const frontendDir = path.join(__dirname, '..');
console.log(`Directorio raíz del proyecto (HTML, css, js): ${frontendDir}`);
app.use('/css', express.static(path.join(frontendDir, 'css')));
console.log(`Sirviendo CSS desde: ${path.join(frontendDir, 'css')}`);
app.use('/js', express.static(path.join(frontendDir, 'js')));
console.log(`Sirviendo JS (frontend) desde: ${path.join(frontendDir, 'js')}`);
app.use(express.static(frontendDir));
console.log(`Sirviendo archivos estáticos generales (HTMLs) desde: ${frontendDir}`);

const dbPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined
});

async function testDbConnection() {
    let client;
    try {
        client = await dbPool.connect();
        await client.query('SELECT NOW()');
        console.log('¡Conexión exitosa a la base de datos PostgreSQL!');
    } catch (error) {
        console.error('Error CRÍTICO al conectar con la base de datos PostgreSQL:', error.message);
        if (error.code) console.error(`Código de error PostgreSQL: ${error.code}`);
        if (process.env.NODE_ENV !== 'production') {
             console.error('VERIFICA TUS CREDENCIALES DE BD EN LAS VARIABLES DE ENTORNO (Render o .env local)');
        }
        process.exit(1);
    } finally {
        if (client) client.release();
    }
}
testDbConnection();

const saltRounds = 10;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error("ERROR CRÍTICO: Falta JWT_SECRET en las variables de entorno. La autenticación fallará.");
}

const avatarUploadsDir = path.join(uploadsDir, 'avatars');
if (!fs.existsSync(avatarUploadsDir)) { fs.mkdirSync(avatarUploadsDir, {recursive: true }); }
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

function authenticateToken(req, res, next) {
    const token = req.cookies.accessToken;
    if (!token) {
        return res.status(401).json({ success: false, message: 'Acceso denegado. No autenticado.' });
    }
    if (!JWT_SECRET) {
        console.error("Error de autenticación: JWT_SECRET no está configurado en el servidor.");
        return res.status(500).json({ success: false, message: 'Error de configuración del servidor.' });
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

app.get('/', (req, res) => {
    res.sendFile(path.join(frontendDir, 'login.html'));
});

app.post('/api/login', [
    body('username').trim().notEmpty().withMessage('Usuario es requerido.').isLength({ min: 3, max: 50 }).escape(),
    body('password').notEmpty().withMessage('Contraseña es requerida.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ success: false, errors: errors.array() }); }
    const { username, password } = req.body;
    try {
        const result = await dbPool.query(
            'SELECT id_usuario, username, password_hash, nombre_completo, rol, avatar_url FROM Usuarios WHERE username = $1',
            [username]
        );
        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos.' });
        }
        const user = result.rows[0];
        const isPasswordMatch = await bcrypt.compare(password, user.password_hash);
        if (isPasswordMatch) {
            if (!JWT_SECRET) {
                console.error("Intento de login fallido: JWT_SECRET no configurado.");
                return res.status(500).json({ success: false, message: 'Error de configuración del servidor al iniciar sesión.' });
            }
            const userPayload = { id: user.id_usuario, username: user.username, rol: user.rol };
            const accessToken = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '1h' });
            res.cookie('accessToken', accessToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 60 * 60 * 1000
            });
            return res.status(200).json({
                success: true,
                message: 'Inicio de sesión exitoso.',
                user: { id: user.id_usuario, username: user.username, nombre: user.nombre_completo, rol: user.rol, avatarUrl: user.avatar_url }
            });
        } else {
            return res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos.' });
        }
    } catch (error) {
        console.error('Error durante el proceso de login:', error);
        return res.status(500).json({ success: false, message: 'Error interno del servidor durante el inicio de sesión.' });
    }
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('accessToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
    });
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
    const client = await dbPool.connect();
    try {
        await client.query('BEGIN');
        const existingNameResult = await client.query('SELECT id_usuario FROM Usuarios WHERE nombre_completo = $1', [nombre_completo]);
        if (existingNameResult.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ success: false, message: 'Error: Ya existe un usuario registrado con ese nombre completo.' });
        }
        const existingUsernameResult = await client.query('SELECT id_usuario FROM Usuarios WHERE username = $1', [username]);
        if (existingUsernameResult.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ success: false, message: 'Error: El nombre de usuario ya está en uso.' });
        }
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const rolPorDefecto = 'Usuario';
        await client.query(
            'INSERT INTO Usuarios (username, password_hash, nombre_completo, rol) VALUES ($1, $2, $3, $4)',
            [username, hashedPassword, nombre_completo, rolPorDefecto]
        );
        await client.query('COMMIT');
        return res.status(201).json({ success: true, message: 'Usuario registrado exitosamente.' });
    } catch (error) {
        if(client) await client.query('ROLLBACK');
        console.error('Error durante el proceso de registro:', error);
        if (error.code === '23505') {
            return res.status(409).json({ success: false, message: `Error: Conflicto de datos duplicados.` });
        }
        return res.status(500).json({ success: false, message: 'Error interno del servidor durante el registro.' });
    } finally {
        if(client) client.release();
    }
});

app.post('/api/users/:id/avatar', authenticateToken, [
    param('id').isInt({ gt: 0 }).withMessage('ID de usuario inválido.')
], upload.single('avatar'), handleMulterError, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        if (req.file && req.file.path) { fs.unlink(req.file.path, (err) => { if (err) console.error("Error borrando archivo subido por ID de usuario inválido:", err); }); }
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    const userIdFromParams = parseInt(req.params.id, 10);
    const authenticatedUserId = req.user.id;
    const authenticatedUserRol = req.user.rol;
    if (authenticatedUserId !== userIdFromParams && authenticatedUserRol !== 'Administrador') {
        if (req.file && req.file.path) { fs.unlink(req.file.path, (err) => { if (err) console.error("Error borrando archivo subido por falta de autorización:", err); }); }
        return res.status(403).json({ success: false, message: 'Acceso denegado. No tienes permiso para realizar esta acción.' });
    }
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No se subió ningún archivo de imagen o el tipo no es permitido.' });
    }
    const avatarRelativePath = path.join('uploads', 'avatars', req.file.filename).replace(/\\/g, '/');
    const avatarUrl = `${process.env.RENDER_EXTERNAL_URL || `${req.protocol}://${req.get('host')}`}/${avatarRelativePath}`;
    try {
        const result = await dbPool.query(
            'UPDATE Usuarios SET avatar_url = $1 WHERE id_usuario = $2',
            [avatarUrl, userIdFromParams]
        );
        if (result.rowCount > 0) {
            return res.status(200).json({ success: true, message: 'Foto de perfil actualizada exitosamente.', avatarUrl: avatarUrl });
        } else {
            fs.unlink(req.file.path, (err) => { if (err) console.error("Error borrando archivo subido para usuario no encontrado:", err); });
            return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
        }
    } catch (error) {
        console.error(`Error al actualizar avatar para usuario ID: ${userIdFromParams}:`, error);
        fs.unlink(req.file.path, (err) => { if (err) console.error("Error borrando archivo subido debido a error de BD:", err); });
        return res.status(500).json({ success: false, message: 'Error interno al actualizar la foto de perfil.' });
    }
});

app.post('/api/citas', authenticateToken, [
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
    if (is_new_vehicle === '1' && (!marca_vehiculo || !modelo_vehiculo || !ano_vehiculo || !placa_vehiculo)) {
        return res.status(400).json({ success: false, message: 'Faltan campos obligatorios para registrar el nuevo vehículo.' });
    }
    if (is_new_vehicle !== '1' && !vehiculo_registrado_id) {
        return res.status(400).json({ success: false, message: 'Debe seleccionar un vehículo existente o añadir uno nuevo.' });
    }
    const client = await dbPool.connect();
    try {
        await client.query('BEGIN');
        let clienteId;
        const clientesExistentesResult = await client.query( 'SELECT id_cliente FROM Clientes WHERE telefono = $1', [telefono_cliente] );
        if (clientesExistentesResult.rows.length > 0) {
            clienteId = clientesExistentesResult.rows[0].id_cliente;
        } else {
            const clienteResult = await client.query(
                'INSERT INTO Clientes (nombres, apellidos, email, telefono) VALUES ($1, $2, $3, $4) RETURNING id_cliente',
                [nombres_cliente, apellidos_cliente, email_cliente || null, telefono_cliente]
            );
            clienteId = clienteResult.rows[0].id_cliente;
        }
        let vehiculoId;
        if (is_new_vehicle === '1') {
            const placaExistenteResult = await client.query('SELECT id_vehiculo FROM Vehiculos WHERE placa = $1', [placa_vehiculo]);
            if(placaExistenteResult.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(409).json({ success: false, message: 'Error: La placa del vehículo ya está registrada.' });
            }
            const vehiculoResult = await client.query(
                'INSERT INTO Vehiculos (id_cliente, marca, modelo, ano, placa) VALUES ($1, $2, $3, $4, $5) RETURNING id_vehiculo',
                [clienteId, marca_vehiculo, modelo_vehiculo, ano_vehiculo, placa_vehiculo]
            );
            vehiculoId = vehiculoResult.rows[0].id_vehiculo;
        } else {
            vehiculoId = vehiculo_registrado_id;
            const vehiculoValidoResult = await client.query(
                'SELECT id_vehiculo FROM Vehiculos WHERE id_vehiculo = $1 AND id_cliente = $2',
                [vehiculoId, clienteId]
            );
            if (vehiculoValidoResult.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ success: false, message: 'Error: El vehículo seleccionado no pertenece al cliente indicado.' });
            }
        }
        let servicioParaGuardar = null;
        if (servicio_id && servicio_id !== 'otros' && !isNaN(parseInt(servicio_id))) {
            servicioParaGuardar = `Servicio ID: ${parseInt(servicio_id)}`;
        } else if (servicio_id === 'otros') {
            servicioParaGuardar = "Otros servicios / Diagnóstico";
        } else {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, message: 'Debe seleccionar un servicio válido.' });
        }
        const estadoInicial = 'Pendiente';
        const sqlInsertCita = `
            INSERT INTO Citas (id_cliente, id_vehiculo, fecha_cita, hora_cita, kilometraje, servicio_principal, motivo_detalle, estado, creado_por_id, fecha_creacion)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()) RETURNING id_cita
        `;
        const insertParams = [ clienteId, vehiculoId, fecha_cita, hora_cita, kilometraje || null, servicioParaGuardar, detalle_sintomas || null, estadoInicial, authenticatedUserId ];
        const citaResult = await client.query(sqlInsertCita, insertParams);
        const citaId = citaResult.rows[0].id_cita;
        await client.query('COMMIT');
        return res.status(201).json({ success: true, message: 'Cita registrada exitosamente.', citaId: citaId });
    } catch (error) {
        if (client) await client.query('ROLLBACK');
        console.error('Error durante la transacción de base de datos (/api/citas):', error);
        if (error.code === '23505') {
            return res.status(409).json({ success: false, message: `Error: El valor para un campo único ya existe.` });
        } else if (error.code === '23503') {
            return res.status(400).json({ success: false, message: 'Error: El cliente o el vehículo seleccionado no es válido o no existe.' });
        } else {
            return res.status(500).json({ success: false, message: 'Error interno al registrar la cita.' });
        }
    } finally {
        if (client) client.release();
    }
});

app.get('/api/citas', authenticateToken, [
    query('fecha_inicio').optional().isISO8601().toDate().withMessage('Fecha de inicio inválida.'),
    query('fecha_fin').optional().isISO8601().toDate().withMessage('Fecha de fin inválida.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ success: false, errors: errors.array() }); }
    const { fecha_inicio, fecha_fin } = req.query;
    try {
        let sqlQuery = `
            SELECT c.*, cl.nombres AS nombre_cliente, cl.apellidos AS apellido_cliente, cl.telefono AS telefono_cliente, cl.email AS email_cliente,
                   v.marca AS marca_vehiculo, v.modelo AS modelo_vehiculo, v.ano AS ano_vehiculo, v.placa AS placa_vehiculo,
                   uc.username AS creado_por_username, um.username AS modificado_por_username
            FROM Citas c JOIN Clientes cl ON c.id_cliente = cl.id_cliente JOIN Vehiculos v ON c.id_vehiculo = v.id_vehiculo
            LEFT JOIN Usuarios uc ON c.creado_por_id = uc.id_usuario LEFT JOIN Usuarios um ON c.modificado_por_id = um.id_usuario
        `;
        const queryParams = [];
        let conditions = [];
        let paramIndex = 1;
        if (fecha_inicio) {
            conditions.push(`c.fecha_cita >= $${paramIndex++}`);
            queryParams.push(fecha_inicio);
        }
        if (fecha_fin) {
            conditions.push(`c.fecha_cita <= $${paramIndex++}`);
            queryParams.push(fecha_fin);
        }
        if (conditions.length > 0) {
            sqlQuery += ' WHERE ' + conditions.join(' AND ');
        }
        sqlQuery += ' ORDER BY c.fecha_cita DESC, c.hora_cita DESC';
        const result = await dbPool.query(sqlQuery, queryParams);
        return res.status(200).json({ success: true, citas: result.rows });
    } catch (error) {
        console.error('Error al obtener la lista de citas:', error);
        return res.status(500).json({ success: false, message: 'Error al obtener la lista de citas.' });
    }
});

app.get('/api/citas/:id', authenticateToken, [
    param('id').isInt({ gt: 0 }).withMessage('ID de cita inválido.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ success: false, errors: errors.array() }); }
    const citaId = req.params.id;
    try {
        const sqlQuery = `
            SELECT c.*, cl.nombres AS nombre_cliente, cl.apellidos AS apellido_cliente, cl.telefono AS telefono_cliente, cl.email AS email_cliente,
                   v.marca AS marca_vehiculo, v.modelo AS modelo_vehiculo, v.ano AS ano_vehiculo, v.placa AS placa_vehiculo,
                   uc.username AS creado_por_username, um.username AS modificado_por_username
            FROM Citas c JOIN Clientes cl ON c.id_cliente = cl.id_cliente JOIN Vehiculos v ON c.id_vehiculo = v.id_vehiculo
            LEFT JOIN Usuarios uc ON c.creado_por_id = uc.id_usuario LEFT JOIN Usuarios um ON c.modificado_por_id = um.id_usuario
            WHERE c.id_cita = $1`;
        const result = await dbPool.query(sqlQuery, [citaId]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Cita no encontrada.' });
        }
        return res.status(200).json({ success: true, cita: result.rows[0] });
    } catch (error) {
        console.error(`Error al obtener cita ID: ${citaId}:`, error);
        return res.status(500).json({ success: false, message: 'Error al obtener los detalles de la cita.' });
    }
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
    let servicioParaGuardar = null;
    if (servicio_id && servicio_id !== 'otros' && !isNaN(parseInt(servicio_id))) {
        servicioParaGuardar = `Servicio ID: ${parseInt(servicio_id)}`;
    } else if (servicio_id === 'otros') {
        servicioParaGuardar = "Otros servicios / Diagnóstico";
    } else {
        return res.status(400).json({ success: false, message: 'Debe seleccionar un servicio válido.' });
    }
    try {
        const sqlQuery = `
            UPDATE Citas SET fecha_cita = $1, hora_cita = $2, kilometraje = $3, servicio_principal = $4, motivo_detalle = $5, modificado_por_id = $6, fecha_modificacion = NOW()
            WHERE id_cita = $7
        `;
        const queryParams = [ fecha_cita, hora_cita, kilometraje || null, servicioParaGuardar, detalle_sintomas || null, authenticatedUserId, citaId ];
        const result = await dbPool.query(sqlQuery, queryParams);
        if (result.rowCount > 0) {
            return res.status(200).json({ success: true, message: 'Cita actualizada exitosamente.' });
        } else {
            return res.status(404).json({ success: false, message: 'Cita no encontrada o sin cambios.' });
        }
    } catch (error) {
        console.error(`Error al actualizar cita ID: ${citaId}:`, error);
        return res.status(500).json({ success: false, message: 'Error interno al actualizar la cita.' });
    }
});

app.patch('/api/citas/:id/cancelar', authenticateToken, [
    param('id').isInt({ gt: 0 }).withMessage('ID de cita inválido.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ success: false, errors: errors.array() }); }
    const authenticatedUserId = req.user.id;
    const citaId = req.params.id;
    try {
        const result = await dbPool.query(
            "UPDATE Citas SET estado = 'Cancelada', modificado_por_id = $1, fecha_modificacion = NOW() WHERE id_cita = $2",
            [authenticatedUserId, citaId]
        );
        if (result.rowCount > 0) {
            return res.status(200).json({ success: true, message: 'Cita cancelada exitosamente.' });
        } else {
            return res.status(404).json({ success: false, message: 'Cita no encontrada.' });
        }
    } catch (error) {
        console.error(`Error al cancelar cita ID: ${citaId}:`, error);
        return res.status(500).json({ success: false, message: 'Error interno al cancelar la cita.' });
    }
});

app.patch('/api/citas/:id/completar', authenticateToken, [
    param('id').isInt({ gt: 0 }).withMessage('ID de cita inválido.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ success: false, errors: errors.array() }); }
    const authenticatedUserId = req.user.id;
    const citaId = req.params.id;
    try {
        const result = await dbPool.query(
            "UPDATE Citas SET estado = 'Completada', modificado_por_id = $1, fecha_modificacion = NOW() WHERE id_cita = $2",
            [authenticatedUserId, citaId]
        );
        if (result.rowCount > 0) {
            return res.status(200).json({ success: true, message: 'Cita marcada como completada.' });
        } else {
            return res.status(404).json({ success: false, message: 'Cita no encontrada.' });
        }
    } catch (error) {
        console.error(`Error al completar cita ID: ${citaId}:`, error);
        return res.status(500).json({ success: false, message: 'Error interno al completar la cita.' });
    }
});

app.get('/api/servicios', authenticateToken, adminOnly, [ query('activos').optional().isBoolean() ], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ success: false, errors: errors.array() }); }
    const soloActivos = req.query.activos === 'true';
    try {
        let sqlQuery = "SELECT id_servicio, nombre_servicio, activo FROM Servicios";
        if (soloActivos) { sqlQuery += " WHERE activo = TRUE"; }
        sqlQuery += " ORDER BY nombre_servicio";
        const result = await dbPool.query(sqlQuery);
        const serviciosConBooleano = result.rows.map(s => ({ ...s, activo: Boolean(s.activo) }));
        return res.status(200).json({ success: true, servicios: serviciosConBooleano });
    } catch (error) {
        console.error('Error al obtener servicios:', error);
        return res.status(500).json({ success: false, message: 'Error al obtener la lista de servicios.' });
    }
});

app.post('/api/servicios', authenticateToken, adminOnly, [ body('nombre_servicio').trim().notEmpty().withMessage('El nombre del servicio es requerido.').isLength({max: 100}).escape() ], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ success: false, errors: errors.array() }); }
    const { nombre_servicio } = req.body;
    const client = await dbPool.connect();
    try {
        await client.query('BEGIN');
        const existeResult = await client.query('SELECT id_servicio FROM Servicios WHERE LOWER(nombre_servicio) = LOWER($1)', [nombre_servicio]);
        if (existeResult.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ success: false, message: 'Error: Ya existe un servicio con ese nombre.' });
        }
        const result = await client.query(
            'INSERT INTO Servicios (nombre_servicio, activo) VALUES ($1, TRUE) RETURNING id_servicio',
            [nombre_servicio]
        );
        await client.query('COMMIT');
        return res.status(201).json({ success: true, message: 'Servicio añadido exitosamente.', id_servicio: result.rows[0].id_servicio });
    } catch (error) {
        if(client) await client.query('ROLLBACK');
        console.error('Error al añadir servicio:', error);
        if (error.code === '23505') {
            return res.status(409).json({ success: false, message: 'Error: Ya existe un servicio con ese nombre (constraint unique).' });
        }
        return res.status(500).json({ success: false, message: 'Error interno al añadir el servicio.' });
    } finally {
        if(client) client.release();
    }
});

app.put('/api/servicios/:id', authenticateToken, adminOnly, [ param('id').isInt({ gt: 0 }), body('nombre_servicio').trim().notEmpty().isLength({max: 100}).escape() ], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ success: false, errors: errors.array() }); }
    const servicioId = req.params.id;
    const { nombre_servicio } = req.body;
    const client = await dbPool.connect();
    try {
        await client.query('BEGIN');
        const existeResult = await client.query(
            'SELECT id_servicio FROM Servicios WHERE LOWER(nombre_servicio) = LOWER($1) AND id_servicio != $2',
            [nombre_servicio, servicioId]
        );
        if (existeResult.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ success: false, message: 'Error: Ya existe otro servicio con ese nombre.' });
        }
        const result = await client.query(
            'UPDATE Servicios SET nombre_servicio = $1 WHERE id_servicio = $2',
            [nombre_servicio, servicioId]
        );
        await client.query('COMMIT');
        if (result.rowCount > 0) {
            return res.status(200).json({ success: true, message: 'Servicio actualizado exitosamente.' });
        } else {
            return res.status(404).json({ success: false, message: 'Servicio no encontrado.' });
        }
    } catch (error) {
        if(client) await client.query('ROLLBACK');
        console.error(`Error al actualizar servicio ID: ${servicioId}:`, error);
        if (error.code === '23505') {
             return res.status(409).json({ success: false, message: 'Error: Ya existe otro servicio con ese nombre (constraint unique).' });
        }
        return res.status(500).json({ success: false, message: 'Error interno al actualizar el servicio.' });
    } finally {
        if(client) client.release();
    }
});

app.patch('/api/servicios/:id/toggle', authenticateToken, adminOnly, [ param('id').isInt({ gt: 0 }) ], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ success: false, errors: errors.array() }); }
    const servicioId = req.params.id;
    try {
        const currentServiceResult = await dbPool.query('SELECT activo FROM Servicios WHERE id_servicio = $1', [servicioId]);
        if (currentServiceResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Servicio no encontrado.' });
        }
        const nuevoEstadoLogico = !Boolean(currentServiceResult.rows[0].activo);
        const result = await dbPool.query(
            'UPDATE Servicios SET activo = $1 WHERE id_servicio = $2',
            [nuevoEstadoLogico, servicioId]
        );
        if (result.rowCount > 0) {
            return res.status(200).json({ success: true, message: `Estado del servicio cambiado a ${nuevoEstadoLogico ? 'Activo' : 'Inactivo'}.`, nuevoEstado: nuevoEstadoLogico });
        } else {
            return res.status(404).json({ success: false, message: 'Servicio no encontrado (o sin cambios).' });
        }
    } catch (error) {
        console.error(`Error al cambiar estado del servicio ID: ${servicioId}:`, error);
        return res.status(500).json({ success: false, message: 'Error interno al cambiar estado del servicio.' });
    }
});

app.delete('/api/servicios/:id', authenticateToken, adminOnly, [ param('id').isInt({ gt: 0 }) ], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ success: false, errors: errors.array() }); }
    const servicioId = req.params.id;
    const client = await dbPool.connect();
    try {
        await client.query('BEGIN');
        const servicioIdStringFormat1 = `Servicio ID: ${servicioId}`;
        const servicioIdStringFormat2 = servicioId.toString();
        const citasAsociadasResult = await client.query(
            'SELECT COUNT(*) as count FROM Citas WHERE servicio_principal = $1 OR servicio_principal = $2',
            [servicioIdStringFormat1, servicioIdStringFormat2]
        );
        if (citasAsociadasResult.rows[0].count > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ success: false, message: 'Error: No se puede eliminar el servicio porque está asociado a una o más citas.' });
        }
        const result = await client.query('DELETE FROM Servicios WHERE id_servicio = $1', [servicioId]);
        await client.query('COMMIT');
        if (result.rowCount > 0) {
            return res.status(200).json({ success: true, message: 'Servicio eliminado exitosamente.' });
        } else {
            return res.status(404).json({ success: false, message: 'Servicio no encontrado.' });
        }
    } catch (error) {
        if(client) await client.query('ROLLBACK');
        console.error(`Error al eliminar servicio ID: ${servicioId}:`, error);
        if (error.code === '23503') {
            return res.status(409).json({ success: false, message: 'Error: No se puede eliminar el servicio porque está referenciado en otras tablas.'});
        }
        return res.status(500).json({ success: false, message: 'Error interno al eliminar el servicio.' });
    } finally {
        if(client) client.release();
    }
});

app.get('/api/vehiculos/cliente', authenticateToken, [ query('telefono').trim().notEmpty().isMobilePhone('any', { strictMode: false }) ], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ success: false, errors: errors.array() }); }
    const telefonoCliente = req.query.telefono;
    try {
        const clientesResult = await dbPool.query( 'SELECT id_cliente, nombres, apellidos FROM Clientes WHERE telefono = $1', [telefonoCliente] );
        if (clientesResult.rows.length === 0) {
            return res.status(200).json({ success: true, vehicles: [], cliente: null });
        }
        const cliente = clientesResult.rows[0];
        const vehiculosResult = await dbPool.query( 'SELECT id_vehiculo, marca, modelo, placa, ano FROM Vehiculos WHERE id_cliente = $1 ORDER BY marca, modelo', [cliente.id_cliente] );
        return res.status(200).json({
            success: true,
            vehicles: vehiculosResult.rows,
            cliente: {id_cliente: cliente.id_cliente, nombre_cliente: cliente.nombres, apellido_cliente: cliente.apellidos}
        });
    } catch (error) {
        console.error('Error al obtener vehículos por teléfono:', error);
        return res.status(500).json({ success: false, message: 'Error al obtener los vehículos del cliente.' });
    }
});

app.get('/api/clientes/buscar', authenticateToken, [ query('telefono').trim().notEmpty().isMobilePhone('any', { strictMode: false }) ], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ success: false, errors: errors.array() }); }
    const telefono = req.query.telefono;
    try {
        const clientesResult = await dbPool.query( 'SELECT id_cliente, nombres, apellidos FROM Clientes WHERE telefono = $1', [telefono] );
        if (clientesResult.rows.length > 0) {
            const clienteData = { id_cliente: clientesResult.rows[0].id_cliente, nombre_cliente: clientesResult.rows[0].nombres, apellido_cliente: clientesResult.rows[0].apellidos };
            return res.status(200).json({ success: true, cliente: clienteData });
        } else {
            return res.status(404).json({ success: false, message: 'Cliente no encontrado con ese teléfono.' });
        }
    } catch (error) {
        console.error("Error buscando cliente por teléfono:", error);
        return res.status(500).json({ success: false, message: 'Error interno al buscar cliente.' });
    }
});

app.get('/api/vehiculos', authenticateToken, adminOnly, [ query('placa').optional().trim().toUpperCase().escape() ], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ success: false, errors: errors.array() }); }
    const placaQuery = req.query.placa;
    try {
        let sqlQuery = `
            SELECT v.id_vehiculo, v.placa AS placa_vehiculo, v.marca AS marca_vehiculo, v.modelo AS modelo_vehiculo, v.ano AS ano_vehiculo,
                   v.id_cliente, cl.nombres AS nombre_cliente, cl.apellidos AS apellido_cliente
            FROM Vehiculos v
            JOIN Clientes cl ON v.id_cliente = cl.id_cliente `;
        const queryParams = [];
        if (placaQuery) {
            sqlQuery += ' WHERE v.placa LIKE $1';
            queryParams.push(`${placaQuery}%`);
        }
        sqlQuery += ' ORDER BY cl.apellidos, cl.nombres, v.marca, v.modelo';
        const vehiculosResult = await dbPool.query(sqlQuery, queryParams);
        return res.status(200).json({ success: true, vehiculos: vehiculosResult.rows });
    } catch (error) {
        console.error('Error al obtener la lista de vehículos:', error);
        return res.status(500).json({ success: false, message: 'Error al obtener la lista de vehículos.' });
    }
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
    const client = await dbPool.connect();
    try {
        await client.query('BEGIN');
        const clienteExisteResult = await client.query('SELECT id_cliente FROM Clientes WHERE id_cliente = $1', [id_cliente]);
        if (clienteExisteResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, message: 'Error: El cliente especificado no existe.' });
        }
        const placaExistenteResult = await client.query('SELECT id_vehiculo FROM Vehiculos WHERE placa = $1', [placa_vehiculo]);
        if (placaExistenteResult.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ success: false, message: 'Error: La placa del vehículo ya está registrada.' });
        }
        const sqlInsert = `INSERT INTO Vehiculos (id_cliente, marca, modelo, ano, placa) VALUES ($1, $2, $3, $4, $5) RETURNING id_vehiculo`;
        const insertParams = [ id_cliente, marca_vehiculo, modelo_vehiculo, ano_vehiculo, placa_vehiculo ];
        const result = await client.query(sqlInsert, insertParams);
        await client.query('COMMIT');
        return res.status(201).json({ success: true, message: 'Vehículo añadido exitosamente.', vehiculoId: result.rows[0].id_vehiculo });
    } catch (error) {
        if(client) await client.query('ROLLBACK');
        console.error('Error al añadir vehículo:', error);
        if (error.code === '23505') {
            return res.status(409).json({ success: false, message: `Error: La placa del vehículo ya existe.` });
        }
        return res.status(500).json({ success: false, message: 'Error interno al añadir el vehículo.' });
    } finally {
        if(client) client.release();
    }
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
    const client = await dbPool.connect();
    try {
        await client.query('BEGIN');
        const placaExistenteResult = await client.query(
            'SELECT id_vehiculo FROM Vehiculos WHERE placa = $1 AND id_vehiculo != $2',
            [placa_vehiculo, vehiculoId]
        );
        if (placaExistenteResult.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ success: false, message: 'Error: La nueva placa ya está registrada en otro vehículo.' });
        }
        const sqlUpdate = `UPDATE Vehiculos SET placa = $1, marca = $2, modelo = $3, ano = $4 WHERE id_vehiculo = $5`;
        const updateParams = [ placa_vehiculo, marca_vehiculo, modelo_vehiculo, ano_vehiculo, vehiculoId ];
        const result = await client.query(sqlUpdate, updateParams);
        await client.query('COMMIT');
        if (result.rowCount > 0) {
            return res.status(200).json({ success: true, message: 'Vehículo actualizado exitosamente.' });
        } else {
            return res.status(404).json({ success: false, message: 'Vehículo no encontrado o sin cambios.' });
        }
    } catch (error) {
        if(client) await client.query('ROLLBACK');
        console.error(`Error al actualizar vehículo ID: ${vehiculoId}:`, error);
        if (error.code === '23505') {
            return res.status(409).json({ success: false, message: `Error: La placa del vehículo ya existe.` });
        }
        return res.status(500).json({ success: false, message: 'Error interno al actualizar el vehículo.' });
    } finally {
        if(client) client.release();
    }
});

app.delete('/api/vehiculos/:id', authenticateToken, adminOnly, [
    param('id').isInt({ gt: 0 }).withMessage('ID de vehículo inválido.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ success: false, errors: errors.array() }); }
    const vehiculoId = req.params.id;
    const client = await dbPool.connect();
    try {
        await client.query('BEGIN');
        const citasAsociadasResult = await client.query( 'SELECT COUNT(*) as count FROM Citas WHERE id_vehiculo = $1', [vehiculoId] );
        if (citasAsociadasResult.rows[0].count > 0) {
            await client.query('ROLLBACK');
            return res.status(409).json({ success: false, message: 'Error: No se puede eliminar el vehículo porque tiene citas asociadas.' });
        }
        const result = await client.query('DELETE FROM Vehiculos WHERE id_vehiculo = $1', [vehiculoId]);
        await client.query('COMMIT');
        if (result.rowCount > 0) {
            return res.status(200).json({ success: true, message: 'Vehículo eliminado exitosamente.' });
        } else {
            return res.status(404).json({ success: false, message: 'Vehículo no encontrado.' });
        }
    } catch (error) {
        if(client) await client.query('ROLLBACK');
        console.error(`Error al eliminar vehículo ID: ${vehiculoId}:`, error);
        if (error.code === '23503') {
            return res.status(409).json({ success: false, message: 'Error: No se puede eliminar el vehículo porque está referenciado en otras tablas.'});
        }
        return res.status(500).json({ success: false, message: 'Error interno al eliminar el vehículo.' });
    } finally {
        if(client) client.release();
    }
});

app.get('/api/vehiculos/count', authenticateToken, adminOnly, async (req, res) => {
    try {
        const result = await dbPool.query('SELECT COUNT(*) as total FROM Vehiculos');
        res.json({ success: true, total: parseInt(result.rows[0].total) });
    } catch (error) {
        console.error('Error al contar vehículos:', error);
        res.status(500).json({ success: false, message: 'Error interno al contar vehículos.' });
    }
});

app.get('/api/clientes/count', authenticateToken, adminOnly, async (req, res) => {
    try {
        const result = await dbPool.query('SELECT COUNT(*) as total FROM Clientes');
        res.json({ success: true, total: parseInt(result.rows[0].total) });
    } catch (error) {
        console.error('Error al contar clientes:', error);
        res.status(500).json({ success: false, message: 'Error interno al contar clientes.' });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Servidor backend escuchando en el puerto ${port}`);
    const host = process.env.RENDER_EXTERNAL_URL || `http://localhost:${port}`;
    console.log(`Frontend debería ser accesible en ${host}/login.html`);
});

async function gracefulShutdown() {
    console.log('Cerrando servidor elegantemente...');
    try {
        await dbPool.end();
        console.log('Pool de conexiones de la base de datos PostgreSQL cerrado.');
        process.exit(0);
    } catch (err) {
        console.error('Error al cerrar el pool de conexiones de PostgreSQL:', err);
        process.exit(1);
    }
}
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
