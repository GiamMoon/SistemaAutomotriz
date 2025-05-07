// --- IMPORTACIONES DE MÓDULOS ---
require('dotenv').config(); // Carga variables de entorno desde .env para desarrollo local
const express = require('express');
const { Pool } = require('pg'); // <--- CAMBIO: PostgreSQL driver
const bcrypt = require('bcrypt');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { body, validationResult, param, query } = require('express-validator');
const helmet = require('helmet');

// --- INICIALIZACIÓN DE EXPRESS ---
const app = express();
const port = process.env.PORT || 3000;

// --- MIDDLEWARE DE SEGURIDAD (HELMET) ---
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
                "img-src": ["'self'", `http://localhost:${port}`, "https://*.onrender.com", "https://placehold.co", "data:"],
                "connect-src": ["'self'", "https://*.onrender.com", `http://localhost:${port}`],
            },
        },
    })
);

// --- MIDDLEWARE DE CORS ---
const allowedOrigins = [
    `http://localhost:${port}`,
    'http://127.0.0.1:5500',
    // AÑADE AQUÍ LA URL DE TU APP EN RENDER CUANDO LA TENGAS
];
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Origen no permitido por CORS'));
        }
    },
    credentials: true
}));

// --- MIDDLEWARE PARA PARSEAR PETICIONES ---
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- CONFIGURACIÓN PARA SERVIR ARCHIVOS ESTÁTICOS ---
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));
console.log(`Sirviendo archivos de 'uploads' desde: ${uploadsDir}`);
console.warn("ADVERTENCIA: Los archivos en 'uploads' son efímeros en el plan gratuito de Render.");

const frontendRootDir = path.join(__dirname, '..');
console.log(`Directorio raíz del proyecto (HTML, css, js): ${frontendRootDir}`);
app.use('/css', express.static(path.join(frontendRootDir, 'css')));
console.log(`Sirviendo CSS desde: ${path.join(frontendRootDir, 'css')}`);
app.use('/js', express.static(path.join(frontendRootDir, 'js')));
console.log(`Sirviendo JS (frontend) desde: ${path.join(frontendRootDir, 'js')}`);
app.use(express.static(frontendRootDir));
console.log(`Sirviendo archivos estáticos generales (HTMLs) desde: ${frontendRootDir}`);

// --- POOL DE CONEXIÓN A LA BASE DE DATOS POSTGRESQL ---
// Render usualmente provee DATABASE_URL. Si no, usa las variables individuales.
const dbPool = new Pool({
    connectionString: process.env.DATABASE_URL, // Preferido para Render
    // Fallback si DATABASE_URL no está disponible:
    // host: process.env.DB_HOST,
    // user: process.env.DB_USER,
    // password: process.env.DB_PASSWORD,
    // database: process.env.DB_DATABASE,
    // port: process.env.DB_PG_PORT || 5432, // Puerto PostgreSQL
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined // Necesario para Render si usa DATABASE_URL con SSL
});

async function testDbConnection() {
    let client;
    try {
        client = await dbPool.connect(); // Obtiene un cliente del pool
        await client.query('SELECT NOW()'); // Prueba una consulta simple
        console.log('¡Conexión exitosa a la base de datos PostgreSQL!');
    } catch (error) {
        console.error('Error CRÍTICO al conectar con la base de datos PostgreSQL:', error.message);
        if (error.code) {
            console.error(`Código de error PostgreSQL: ${error.code}`);
        }
        if (process.env.NODE_ENV !== 'production') {
             console.error('VERIFICA TUS CREDENCIALES DE BD EN LAS VARIABLES DE ENTORNO (Render o .env local)');
        }
        process.exit(1);
    } finally {
        if (client) client.release(); // Libera el cliente de vuelta al pool
    }
}
testDbConnection();

const saltRounds = 10;

// --- CONFIGURACIÓN DE MULTER ---
const avatarUploadsDir = path.join(uploadsDir, 'avatars');
if (!fs.existsSync(avatarUploadsDir)) {
    fs.mkdirSync(avatarUploadsDir, { recursive: true });
}
const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, avatarUploadsDir); },
    filename: function (req, file, cb) {
        const userId = req.params.id || req.user?.id || 'unknown-user';
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname);
        cb(null, `user-${userId}-${uniqueSuffix}${extension}`);
    }
});
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Tipo de archivo no permitido. Solo se aceptan imágenes.'), false);
    }
};
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 2 * 1024 * 1024 }
});

function handleMulterError(err, req, res, next) {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ success: false, message: 'El archivo es demasiado grande. Máximo 2MB.' });
        }
        return res.status(400).json({ success: false, message: `Error de Multer: ${err.message}` });
    } else if (err) {
        return res.status(400).json({ success: false, message: err.message });
    }
    next();
}

// --- RUTA RAÍZ ---
app.get('/', (req, res) => {
    res.sendFile(path.join(frontendRootDir, 'login.html'));
});

// --- RUTAS API (Adaptadas para PostgreSQL) ---

// --- RUTAS DE CITAS ---
app.post('/api/citas', [
    // Validaciones (sin cambios)
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
    body('hora_cita').matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage('Hora de cita inválida (HH:MM).'),
    body('userId').isInt({ gt: 0 }).withMessage('ID de usuario creador inválido.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    const {
        nombres_cliente, apellidos_cliente, email_cliente, telefono_cliente,
        vehiculo_registrado_id, is_new_vehicle, marca_vehiculo, modelo_vehiculo,
        ano_vehiculo, placa_vehiculo, kilometraje, servicio_id,
        detalle_sintomas, fecha_cita, hora_cita,
        userId
    } = req.body;

    if (is_new_vehicle === '1' && (!marca_vehiculo || !modelo_vehiculo || !ano_vehiculo || !placa_vehiculo)) {
        return res.status(400).json({ success: false, message: 'Faltan campos obligatorios para registrar el nuevo vehículo.' });
    }
    if (is_new_vehicle !== '1' && !vehiculo_registrado_id) {
        return res.status(400).json({ success: false, message: 'Debe seleccionar un vehículo existente o añadir uno nuevo.' });
    }

    const client = await dbPool.connect(); // Obtener un cliente para la transacción
    try {
        await client.query('BEGIN'); // Iniciar transacción

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
        // En PostgreSQL, NOW() es la función correcta para la fecha y hora actual.
        // Las columnas de fecha y hora se manejan bien con los tipos de datos de pg.
        const sqlInsertCita = `
            INSERT INTO Citas (id_cliente, id_vehiculo, fecha_cita, hora_cita, kilometraje, servicio_principal, motivo_detalle, estado, creado_por_id, fecha_creacion)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW()) RETURNING id_cita
        `;
        const insertParams = [ clienteId, vehiculoId, fecha_cita, hora_cita, kilometraje || null, servicioParaGuardar, detalle_sintomas || null, estadoInicial, userId ];
        const citaResult = await client.query(sqlInsertCita, insertParams);
        const citaId = citaResult.rows[0].id_cita;

        await client.query('COMMIT'); // Confirmar transacción
        return res.status(201).json({ success: true, message: 'Cita registrada exitosamente.', citaId: citaId });

    } catch (error) {
        await client.query('ROLLBACK'); // Revertir en caso de error
        console.error('Error durante la transacción de base de datos (/api/citas):', error);
        // Códigos de error de PostgreSQL: '23505' para unique_violation, '23503' para foreign_key_violation
        if (error.code === '23505') { // unique_violation
            return res.status(409).json({ success: false, message: `Error: El valor para un campo único ya existe.` });
        } else if (error.code === '23503') { // foreign_key_violation
            return res.status(400).json({ success: false, message: 'Error: El cliente o el vehículo seleccionado no es válido o no existe.' });
        } else {
            return res.status(500).json({ success: false, message: 'Error interno al registrar la cita.' });
        }
    } finally {
        client.release(); // Siempre liberar el cliente
    }
});

app.get('/api/citas', [
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

app.get('/api/citas/:id', [
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

app.put('/api/citas/:id', [
    // Validaciones sin cambios
    param('id').isInt({ gt: 0 }).withMessage('ID de cita inválido.'),
    body('fecha_cita').isISO8601().withMessage('Fecha de cita inválida. Debe ser YYYY-MM-DD.'),
    body('hora_cita').matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage('Hora de cita inválida (HH:MM).'),
    body('kilometraje').optional({ checkFalsy: true }).isInt({ min: 0 }).withMessage('Kilometraje inválido.'),
    body('servicio_id').notEmpty().withMessage('Servicio es requerido.').trim().escape(),
    body('detalle_sintomas').optional({ checkFalsy: true }).trim().isLength({ max: 1000 }).escape(),
    body('userId').isInt({ gt: 0 }).withMessage('ID de usuario modificador inválido.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ success: false, errors: errors.array() }); }

    const citaId = req.params.id;
    const { fecha_cita, hora_cita, kilometraje, servicio_id, detalle_sintomas, userId } = req.body;
    let servicioParaGuardar = null;
    if (servicio_id && servicio_id !== 'otros' && !isNaN(parseInt(servicio_id))) {
        servicioParaGuardar = `Servicio ID: ${parseInt(servicio_id)}`;
    } else if (servicio_id === 'otros') {
        servicioParaGuardar = "Otros servicios / Diagnóstico";
    } else {
        return res.status(400).json({ success: false, message: 'Debe seleccionar un servicio válido.' });
    }

    try {
        // fecha_modificacion = NOW() en PostgreSQL
        const sqlQuery = `
            UPDATE Citas SET fecha_cita = $1, hora_cita = $2, kilometraje = $3, servicio_principal = $4, motivo_detalle = $5, modificado_por_id = $6, fecha_modificacion = NOW()
            WHERE id_cita = $7
        `;
        const queryParams = [ fecha_cita, hora_cita, kilometraje || null, servicioParaGuardar, detalle_sintomas || null, userId, citaId ];
        const result = await dbPool.query(sqlQuery, queryParams);

        if (result.rowCount > 0) { // rowCount es el equivalente a affectedRows/changedRows
            return res.status(200).json({ success: true, message: 'Cita actualizada exitosamente.' });
        } else {
            return res.status(404).json({ success: false, message: 'Cita no encontrada o sin cambios.' });
        }
    } catch (error) {
        console.error(`Error al actualizar cita ID: ${citaId}:`, error);
        return res.status(500).json({ success: false, message: 'Error interno al actualizar la cita.' });
    }
});

app.patch('/api/citas/:id/cancelar', [
    param('id').isInt({ gt: 0 }).withMessage('ID de cita inválido.'),
    body('userId').optional({ checkFalsy: true }).isInt({ gt: 0 }).withMessage('ID de usuario inválido.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ success: false, errors: errors.array() }); }
    const citaId = req.params.id;
    const userId = req.body.userId || null;
    try {
        const result = await dbPool.query(
            "UPDATE Citas SET estado = 'Cancelada', modificado_por_id = $1, fecha_modificacion = NOW() WHERE id_cita = $2",
            [userId, citaId]
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

app.patch('/api/citas/:id/completar', [
    param('id').isInt({ gt: 0 }).withMessage('ID de cita inválido.'),
    body('userId').optional({ checkFalsy: true }).isInt({ gt: 0 }).withMessage('ID de usuario inválido.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ success: false, errors: errors.array() }); }
    const citaId = req.params.id;
    const userId = req.body.userId || null;
    try {
        const result = await dbPool.query(
            "UPDATE Citas SET estado = 'Completada', modificado_por_id = $1, fecha_modificacion = NOW() WHERE id_cita = $2",
            [userId, citaId]
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


// --- RUTAS DE AUTENTICACIÓN Y USUARIOS ---
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
        await client.query('ROLLBACK');
        console.error('Error durante el proceso de registro:', error);
        if (error.code === '23505') { // unique_violation en PostgreSQL
            return res.status(409).json({ success: false, message: `Error: Conflicto de datos duplicados.` });
        }
        return res.status(500).json({ success: false, message: 'Error interno del servidor durante el registro.' });
    } finally {
        client.release();
    }
});

app.post('/api/users/:id/avatar', [
    param('id').isInt({ gt: 0 }).withMessage('ID de usuario inválido.')
], upload.single('avatar'), handleMulterError, async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        if (req.file && req.file.path) { fs.unlink(req.file.path, (err) => { if (err) console.error("Error borrando archivo subido por ID de usuario inválido:", err); }); }
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    const userId = req.params.id;
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No se subió ningún archivo de imagen o el tipo no es permitido.' });
    }
    const avatarRelativePath = path.join('uploads', 'avatars', req.file.filename).replace(/\\/g, '/');
    const avatarUrl = `${req.protocol}://${req.get('host')}/${avatarRelativePath}`;
    try {
        const result = await dbPool.query(
            'UPDATE Usuarios SET avatar_url = $1 WHERE id_usuario = $2',
            [avatarUrl, userId]
        );
        if (result.rowCount > 0) {
            return res.status(200).json({ success: true, message: 'Foto de perfil actualizada exitosamente.', avatarUrl: avatarUrl });
        } else {
            fs.unlink(req.file.path, (err) => { if (err) console.error("Error borrando archivo subido para usuario no encontrado:", err); });
            return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
        }
    } catch (error) {
        console.error(`Error al actualizar avatar para usuario ID: ${userId}:`, error);
        fs.unlink(req.file.path, (err) => { if (err) console.error("Error borrando archivo subido debido a error de BD:", err); });
        return res.status(500).json({ success: false, message: 'Error interno al actualizar la foto de perfil.' });
    }
});

// --- RUTAS DE SERVICIOS ---
app.get('/api/servicios', [
    query('activos').optional().isBoolean().withMessage('El filtro "activos" debe ser booleano (true/false).')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ success: false, errors: errors.array() }); }
    const soloActivos = req.query.activos === 'true';
    try {
        let sqlQuery = "SELECT id_servicio, nombre_servicio, activo FROM Servicios";
        if (soloActivos) {
            sqlQuery += " WHERE activo = TRUE";
        }
        sqlQuery += " ORDER BY nombre_servicio";
        const result = await dbPool.query(sqlQuery);
        // 'activo' en PostgreSQL es booleano, así que la conversión explícita podría no ser necesaria
        // pero es bueno asegurarse de que el JSON refleje un booleano.
        const serviciosConBooleano = result.rows.map(s => ({ ...s, activo: Boolean(s.activo) }));
        return res.status(200).json({ success: true, servicios: serviciosConBooleano });
    } catch (error) {
        console.error('Error al obtener servicios:', error);
        return res.status(500).json({ success: false, message: 'Error al obtener la lista de servicios.' });
    }
});

app.post('/api/servicios', [
    body('nombre_servicio').trim().notEmpty().withMessage('El nombre del servicio es requerido.').isLength({max: 100}).escape()
], async (req, res) => {
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
        await client.query('ROLLBACK');
        console.error('Error al añadir servicio:', error);
        if (error.code === '23505') { // unique_violation
            return res.status(409).json({ success: false, message: 'Error: Ya existe un servicio con ese nombre (constraint unique).' });
        }
        return res.status(500).json({ success: false, message: 'Error interno al añadir el servicio.' });
    } finally {
        client.release();
    }
});

app.put('/api/servicios/:id', [
    param('id').isInt({ gt: 0 }).withMessage('ID de servicio inválido.'),
    body('nombre_servicio').trim().notEmpty().withMessage('El nuevo nombre del servicio es requerido.').isLength({max: 100}).escape()
], async (req, res) => {
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
        await client.query('ROLLBACK');
        console.error(`Error al actualizar servicio ID: ${servicioId}:`, error);
        if (error.code === '23505') { // unique_violation
             return res.status(409).json({ success: false, message: 'Error: Ya existe otro servicio con ese nombre (constraint unique).' });
        }
        return res.status(500).json({ success: false, message: 'Error interno al actualizar el servicio.' });
    } finally {
        client.release();
    }
});

app.patch('/api/servicios/:id/toggle', [
    param('id').isInt({ gt: 0 }).withMessage('ID de servicio inválido.')
], async (req, res) => {
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

app.delete('/api/servicios/:id', [
    param('id').isInt({ gt: 0 }).withMessage('ID de servicio inválido.')
], async (req, res) => {
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
        await client.query('ROLLBACK');
        console.error(`Error al eliminar servicio ID: ${servicioId}:`, error);
        if (error.code === '23503') { // foreign_key_violation
            return res.status(409).json({ success: false, message: 'Error: No se puede eliminar el servicio porque está referenciado en otras tablas.'});
        }
        return res.status(500).json({ success: false, message: 'Error interno al eliminar el servicio.' });
    } finally {
        client.release();
    }
});

// --- RUTAS DE VEHÍCULOS Y CLIENTES ---
app.get('/api/vehiculos/cliente', [
    query('telefono').trim().notEmpty().withMessage('Número de teléfono es requerido.').isMobilePhone('any', { strictMode: false }).withMessage('Número de teléfono inválido.')
], async (req, res) => {
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

app.get('/api/clientes/buscar', [
    query('telefono').trim().notEmpty().withMessage('Número de teléfono es requerido.').isMobilePhone('any', { strictMode: false }).withMessage('Número de teléfono inválido.')
], async (req, res) => {
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

app.get('/api/vehiculos', [
    query('placa').optional().trim().toUpperCase().escape()
], async (req, res) => {
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
            sqlQuery += ' WHERE v.placa LIKE $1'; // Usar $1 para el primer parámetro
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

app.post('/api/vehiculos', [
    // Validaciones sin cambios
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
        await client.query('ROLLBACK');
        console.error('Error al añadir vehículo:', error);
        if (error.code === '23505') { // unique_violation
            return res.status(409).json({ success: false, message: `Error: La placa del vehículo ya existe.` });
        }
        return res.status(500).json({ success: false, message: 'Error interno al añadir el vehículo.' });
    } finally {
        client.release();
    }
});

app.put('/api/vehiculos/:id', [
    // Validaciones sin cambios
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
        await client.query('ROLLBACK');
        console.error(`Error al actualizar vehículo ID: ${vehiculoId}:`, error);
        if (error.code === '23505') { // unique_violation
            return res.status(409).json({ success: false, message: `Error: La placa del vehículo ya existe.` });
        }
        return res.status(500).json({ success: false, message: 'Error interno al actualizar el vehículo.' });
    } finally {
        client.release();
    }
});

app.delete('/api/vehiculos/:id', [
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
        await client.query('ROLLBACK');
        console.error(`Error al eliminar vehículo ID: ${vehiculoId}:`, error);
        if (error.code === '23503') { // foreign_key_violation
            return res.status(409).json({ success: false, message: 'Error: No se puede eliminar el vehículo porque está referenciado en otras tablas.'});
        }
        return res.status(500).json({ success: false, message: 'Error interno al eliminar el vehículo.' });
    } finally {
        client.release();
    }
});

// --- RUTAS DE CONTEO (Dashboard) ---
app.get('/api/vehiculos/count', async (req, res) => {
    try {
        const result = await dbPool.query('SELECT COUNT(*) as total FROM Vehiculos');
        res.json({ success: true, total: parseInt(result.rows[0].total) }); // COUNT devuelve un string, convertir a int
    } catch (error) {
        console.error('Error al contar vehículos:', error);
        res.status(500).json({ success: false, message: 'Error interno al contar vehículos.' });
    }
});

app.get('/api/clientes/count', async (req, res) => {
    try {
        const result = await dbPool.query('SELECT COUNT(*) as total FROM Clientes');
        res.json({ success: true, total: parseInt(result.rows[0].total) }); // COUNT devuelve un string, convertir a int
    } catch (error) {
        console.error('Error al contar clientes:', error);
        res.status(500).json({ success: false, message: 'Error interno al contar clientes.' });
    }
});

// --- INICIO DEL SERVIDOR ---
app.listen(port, '0.0.0.0', () => {
    console.log(`Servidor backend escuchando en el puerto ${port}`);
    console.log(`Frontend debería ser accesible en la raíz (ej. http://localhost:${port}/login.html)`);
});

// --- MANEJO ELEGANTE DEL CIERRE DEL SERVIDOR ---
async function gracefulShutdown() {
    console.log('Cerrando servidor elegantemente...');
    try {
        await dbPool.end(); // Cierra el pool de conexiones de PostgreSQL
        console.log('Pool de conexiones de la base de datos PostgreSQL cerrado.');
        process.exit(0);
    } catch (err) {
        console.error('Error al cerrar el pool de conexiones de PostgreSQL:', err);
        process.exit(1);
    }
}
process.on('SIGINT', gracefulShutdown); // Ctrl+C
process.on('SIGTERM', gracefulShutdown); // Señal de terminación (ej. de Render)

