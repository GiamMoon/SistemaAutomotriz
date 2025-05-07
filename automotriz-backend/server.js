// --- IMPORTACIONES DE MÓDULOS ---
require('dotenv').config(); // Carga variables de entorno desde .env para desarrollo local
const express = require('express');
const mysql = require('mysql2/promise'); // Usando la versión con promesas de mysql2
const bcrypt = require('bcrypt');
const cors = require('cors');
const path = require('path');
const fs = require('fs'); // File System, para crear directorios si no existen
const multer = require('multer'); // Para manejar la subida de archivos (avatares)
const { body, validationResult, param, query } = require('express-validator'); // Para validaciones de datos
const helmet = require('helmet'); // Ayuda a securizar Express estableciendo varias cabeceras HTTP

// --- INICIALIZACIÓN DE EXPRESS ---
const app = express();
const port = process.env.PORT || 3000; // Render asignará el puerto a través de process.env.PORT

// --- MIDDLEWARE DE SEGURIDAD (HELMET) ---
// Configuración de Helmet con políticas de seguridad.
// Es importante ajustar Content-Security-Policy (CSP) según tus necesidades específicas.
app.use(
    helmet({
        crossOriginResourcePolicy: { policy: "cross-origin" },
        contentSecurityPolicy: {
            directives: {
                ...helmet.contentSecurityPolicy.getDefaultDirectives(),
                "default-src": ["'self'"], // Por defecto, solo permite recursos del mismo origen
                // Asegúrate de que las URLs de CDN sean las que realmente usas.
                "script-src": [
                    "'self'",
                    "https://cdn.tailwindcss.com" // Si usas Tailwind CSS desde CDN
                    // Añade aquí otros orígenes de scripts si los necesitas (ej. CDNs de otras librerías JS)
                ],
                "style-src": [
                    "'self'",
                    "https://cdnjs.cloudflare.com", // Ejemplo: FontAwesome CDN
                    "https://fonts.googleapis.com", // Ejemplo: Google Fonts CDN
                    "'unsafe-inline'" // Permite estilos en línea (considera eliminarlos por seguridad si es posible)
                ],
                "font-src": [
                    "'self'",
                    "https://cdnjs.cloudflare.com", // Para fuentes de FontAwesome
                    "https://fonts.gstatic.com" // Para fuentes de Google Fonts
                ],
                // AJUSTAR PARA PRODUCCIÓN:
                // 'self' permitirá imágenes servidas desde tu propio dominio de Render.
                // Si usas un servicio externo para 'uploads' (como S3, Cloudinary), añade su URL aquí.
                "img-src": [
                    "'self'",
                    `http://localhost:${port}`, // Para desarrollo, si sirves uploads localmente
                    "https://*.onrender.com", // Permite imágenes desde cualquier subdominio de onrender.com (ajusta si es necesario)
                    "https://placehold.co", // Para placeholders
                    "data:" // Para imágenes en formato data URI
                ],
                // Si tu frontend hace llamadas API solo a tu backend en Render:
                "connect-src": ["'self'", "https://*.onrender.com", `http://localhost:${port}`],
            },
        },
    })
);

// --- MIDDLEWARE DE CORS ---
// Configuración de CORS. Ajusta 'origin' para producción.
// Si tu frontend y backend están en el mismo dominio de Render, podrías ser más restrictivo.
const allowedOrigins = [
    `http://localhost:${port}`, // Tu backend sirviendo el frontend localmente
    'http://127.0.0.1:5500', // Común para Live Server de VSCode
    // AÑADE AQUÍ LA URL DE TU APP EN RENDER CUANDO LA TENGAS, ej: 'https://tu-app.onrender.com'
];
app.use(cors({
    origin: function (origin, callback) {
        // Permite solicitudes sin 'origin' (como Postman o apps móviles) o si el origen está en la lista
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Origen no permitido por CORS'));
        }
    },
    credentials: true // Si usas cookies o cabeceras de autorización
}));


// --- MIDDLEWARE PARA PARSEAR PETICIONES ---
app.use(express.json()); // Parsea cuerpos de petición JSON
app.use(express.urlencoded({ extended: true })); // Parsea cuerpos de petición URL-encoded

// --- CONFIGURACIÓN PARA SERVIR ARCHIVOS ESTÁTICOS ---

// Directorio para 'uploads' (avatares, etc.) DENTRO de 'automotriz-backend'
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true }); // Crea el directorio si no existe
}
// Sirve archivos desde la carpeta 'uploads' bajo la ruta '/uploads'
// Ejemplo: http://localhost:3000/uploads/avatars/imagen.jpg
app.use('/uploads', express.static(uploadsDir));
console.log(`Sirviendo archivos de 'uploads' desde: ${uploadsDir}`);
console.warn("ADVERTENCIA: Los archivos en 'uploads' son efímeros en el plan gratuito de Render. Considera un servicio de almacenamiento externo para persistencia.");


// Directorio raíz del frontend (un nivel ARRIBA de __dirname, que es 'automotriz-backend')
// Esto es porque tus HTML, css/, js/ están fuera de 'automotriz-backend'
const frontendRootDir = path.join(__dirname, '..');
console.log(`Directorio raíz del proyecto (donde están HTML, css, js): ${frontendRootDir}`);

// Servir archivos CSS desde la carpeta 'css' en la raíz del proyecto
app.use('/css', express.static(path.join(frontendRootDir, 'css')));
console.log(`Sirviendo CSS desde: ${path.join(frontendRootDir, 'css')}`);

// Servir archivos JS del frontend desde la carpeta 'js' en la raíz del proyecto
app.use('/js', express.static(path.join(frontendRootDir, 'js')));
console.log(`Sirviendo JS (frontend) desde: ${path.join(frontendRootDir, 'js')}`);

// Servir archivos HTML (y otros estáticos como imágenes en la raíz) desde la raíz del proyecto
app.use(express.static(frontendRootDir));
console.log(`Sirviendo archivos estáticos generales (HTMLs) desde: ${frontendRootDir}`);


// --- POOL DE CONEXIÓN A LA BASE DE DATOS MYSQL ---
// Las credenciales se toman de variables de entorno (process.env)
const dbPool = mysql.createPool({
    connectionLimit: 10, // Límite de conexiones en el pool
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    port: process.env.DB_MYSQL_PORT || 3306, // Puerto de MySQL, Render podría usar uno diferente
    waitForConnections: true, // Esperar si todas las conexiones están en uso
    queueLimit: 0, // Sin límite en la cola de espera
    dateStrings: true, // Devuelve fechas como strings (YYYY-MM-DD HH:MM:SS) en lugar de objetos Date
    // Considera añadir configuraciones SSL si tu base de datos en Render lo requiere
    // ssl: {
    //   ca: process.env.DB_SSL_CA_CONTENT, // Contenido del certificado CA como variable de entorno
    //   rejectUnauthorized: true // O false si tienes problemas con certificados autofirmados (no recomendado para producción)
    // }
});

// Función para probar la conexión a la base de datos al iniciar
async function testDbConnection() {
    let connection;
    try {
        connection = await dbPool.getConnection();
        console.log('¡Conexión exitosa a la base de datos MySQL!');
    } catch (error) {
        console.error('Error CRÍTICO al conectar con la base de datos:', error.message);
        if (error.code) {
            console.error(`Código de error MySQL: ${error.code}`);
        }
        if (process.env.NODE_ENV !== 'production') { // Solo muestra esto en desarrollo
             console.error('VERIFICA TUS CREDENCIALES DE BD EN LAS VARIABLES DE ENTORNO (.env local o configuración de Render)');
        }
        // En un entorno de producción, podrías querer que la app no inicie o reintente.
        // Por ahora, salimos si no podemos conectar.
        process.exit(1);
    } finally {
        if (connection) connection.release(); // Libera la conexión de vuelta al pool
    }
}
testDbConnection(); // Llama a la función de prueba de conexión

const saltRounds = 10; // Para bcrypt

// --- CONFIGURACIÓN DE MULTER (SUBIDA DE ARCHIVOS) ---
const avatarUploadsDir = path.join(uploadsDir, 'avatars'); // Subcarpeta para avatares
if (!fs.existsSync(avatarUploadsDir)) {
    fs.mkdirSync(avatarUploadsDir, { recursive: true });
}
const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, avatarUploadsDir); },
    filename: function (req, file, cb) {
        const userId = req.params.id || req.user?.id || 'unknown-user'; // Intenta obtener el ID de usuario
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname);
        cb(null, `user-${userId}-${uniqueSuffix}${extension}`);
    }
});
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) { // Aceptar solo imágenes
        cb(null, true);
    } else {
        cb(new Error('Tipo de archivo no permitido. Solo se aceptan imágenes.'), false);
    }
};
const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 2 * 1024 * 1024 } // Límite de tamaño de archivo: 2MB
});

// Middleware para manejar errores específicos de Multer
function handleMulterError(err, req, res, next) {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ success: false, message: 'El archivo es demasiado grande. Máximo 2MB.' });
        }
        return res.status(400).json({ success: false, message: `Error de Multer: ${err.message}` });
    } else if (err) { // Otros errores (ej. del fileFilter)
        return res.status(400).json({ success: false, message: err.message });
    }
    next(); // Si no hay error de Multer, continuar
}

// --- RUTA RAÍZ ---
// Sirve login.html (asegúrate que login.html está en la raíz de tu proyecto)
app.get('/', (req, res) => {
    res.sendFile(path.join(frontendRootDir, 'login.html'));
});


// --- RUTAS API (Citas, Auth, Servicios, Vehículos, Clientes, etc.) ---
// =====================================================================

// --- RUTAS DE CITAS ---
app.post('/api/citas', [
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
        console.log("Errores de validación en POST /api/citas:", errors.array());
        return res.status(400).json({ success: false, errors: errors.array() });
    }
    const {
        nombres_cliente, apellidos_cliente, email_cliente, telefono_cliente,
        vehiculo_registrado_id, is_new_vehicle, marca_vehiculo, modelo_vehiculo,
        ano_vehiculo, placa_vehiculo, kilometraje, servicio_id,
        detalle_sintomas, fecha_cita, hora_cita,
        userId
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
        const insertParams = [ clienteId, vehiculoId, fecha_cita, hora_cita, kilometraje || null, servicioParaGuardar, detalle_sintomas || null, estadoInicial, userId ];
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

app.get('/api/citas', [
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

app.get('/api/citas/:id', [
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
    } catch (error) { console.error(`Error al obtener cita ID: ${citaId}:`, error); return res.status(500).json({ success: false, message: 'Error al obtener los detalles de la cita.' }); }
    finally { if (connection) { connection.release(); } }
});

app.put('/api/citas/:id', [
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
    let connection;
    try {
        connection = await dbPool.getConnection();
        let servicioParaGuardar = null;
        if (servicio_id && servicio_id !== 'otros' && !isNaN(parseInt(servicio_id))) { servicioParaGuardar = `Servicio ID: ${parseInt(servicio_id)}`; }
        else if (servicio_id === 'otros') { servicioParaGuardar = "Otros servicios / Diagnóstico"; }
        else { return res.status(400).json({ success: false, message: 'Debe seleccionar un servicio válido.' });}
        const sqlQuery = `UPDATE Citas SET fecha_cita = ?, hora_cita = ?, kilometraje = ?, servicio_principal = ?, motivo_detalle = ?, modificado_por_id = ?, fecha_modificacion = NOW() WHERE id_cita = ?`;
        const queryParams = [ fecha_cita, hora_cita, kilometraje || null, servicioParaGuardar, detalle_sintomas || null, userId, citaId ];
        const [result] = await connection.query(sqlQuery, queryParams);
        if (result.affectedRows > 0 || result.changedRows > 0) { return res.status(200).json({ success: true, message: 'Cita actualizada exitosamente.' }); }
        else { return res.status(404).json({ success: false, message: 'Cita no encontrada o sin cambios.' }); }
    } catch (error) { console.error(`Error al actualizar cita ID: ${citaId}:`, error); return res.status(500).json({ success: false, message: 'Error interno al actualizar la cita.' }); }
    finally { if (connection) { connection.release(); } }
});

app.patch('/api/citas/:id/cancelar', [
    param('id').isInt({ gt: 0 }).withMessage('ID de cita inválido.'),
    body('userId').optional({ checkFalsy: true }).isInt({ gt: 0 }).withMessage('ID de usuario inválido.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ success: false, errors: errors.array() }); }
    const citaId = req.params.id;
    const userId = req.body.userId || null; // Puede ser cancelada por el sistema o un usuario
    let connection;
    try {
        connection = await dbPool.getConnection();
        const [result] = await connection.query( "UPDATE Citas SET estado = 'Cancelada', modificado_por_id = ?, fecha_modificacion = NOW() WHERE id_cita = ?", [userId, citaId] );
        if (result.affectedRows > 0) { return res.status(200).json({ success: true, message: 'Cita cancelada exitosamente.' }); }
        else { return res.status(404).json({ success: false, message: 'Cita no encontrada.' }); }
    } catch (error) { console.error(`Error al cancelar cita ID: ${citaId}:`, error); return res.status(500).json({ success: false, message: 'Error interno al cancelar la cita.' }); }
    finally { if (connection) { connection.release(); } }
});

app.patch('/api/citas/:id/completar', [
    param('id').isInt({ gt: 0 }).withMessage('ID de cita inválido.'),
    body('userId').optional({ checkFalsy: true }).isInt({ gt: 0 }).withMessage('ID de usuario inválido.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ success: false, errors: errors.array() }); }
    const citaId = req.params.id;
    const userId = req.body.userId || null; // Puede ser completada por el sistema o un usuario
    let connection;
    try {
        connection = await dbPool.getConnection();
        const [result] = await connection.query( "UPDATE Citas SET estado = 'Completada', modificado_por_id = ?, fecha_modificacion = NOW() WHERE id_cita = ?", [userId, citaId] );
        if (result.affectedRows > 0) { return res.status(200).json({ success: true, message: 'Cita marcada como completada.' }); }
        else { return res.status(404).json({ success: false, message: 'Cita no encontrada.' }); }
    } catch (error) { console.error(`Error al completar cita ID: ${citaId}:`, error); return res.status(500).json({ success: false, message: 'Error interno al completar la cita.' }); }
    finally { if (connection) { connection.release(); } }
});

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
            return res.status(200).json({
                success: true,
                message: 'Inicio de sesión exitoso.',
                user: { id: user.id_usuario, username: user.username, nombre: user.nombre_completo, rol: user.rol, avatarUrl: user.avatar_url }
            });
        } else { return res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos.' }); }
    } catch (error) { console.error('Error durante el proceso de login:', error); return res.status(500).json({ success: false, message: 'Error interno del servidor durante el inicio de sesión.' }); }
    finally { if (connection) { connection.release(); } }
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
        const rolPorDefecto = 'Usuario'; // O el rol que desees por defecto
        const [result] = await connection.query('INSERT INTO Usuarios (username, password_hash, nombre_completo, rol) VALUES (?, ?, ?, ?)', [username, hashedPassword, nombre_completo, rolPorDefecto]);
        return res.status(201).json({ success: true, message: 'Usuario registrado exitosamente.' });
    } catch (error) {
        console.error('Error durante el proceso de registro:', error);
        if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) { return res.status(409).json({ success: false, message: `Error: Conflicto de datos duplicados.` }); }
        return res.status(500).json({ success: false, message: 'Error interno del servidor durante el registro.' });
    } finally { if (connection) { connection.release(); } }
});

app.post('/api/users/:id/avatar', [
    param('id').isInt({ gt: 0 }).withMessage('ID de usuario inválido.')
], upload.single('avatar'), handleMulterError, async (req, res) => {
    const errors = validationResult(req); // Validar el ID del parámetro
    if (!errors.isEmpty()) {
        // Si hay error de validación y se subió un archivo, borrarlo
        if (req.file && req.file.path) { fs.unlink(req.file.path, (err) => { if (err) console.error("Error borrando archivo subido por ID de usuario inválido:", err); }); }
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    const userId = req.params.id;
    if (!req.file) { // Multer no adjuntó un archivo (posiblemente por el fileFilter o ningún archivo enviado)
        return res.status(400).json({ success: false, message: 'No se subió ningún archivo de imagen o el tipo no es permitido.' });
    }

    // Construir la URL relativa y luego la completa para el avatar
    // La URL se construye relativa a la raíz del servidor, donde se sirven los 'uploads'
    const avatarRelativePath = path.join('uploads', 'avatars', req.file.filename).replace(/\\/g, '/'); // Normalizar a slashes
    // En producción, req.protocol y req.get('host') darán la URL de Render.
    const avatarUrl = `${req.protocol}://${req.get('host')}/${avatarRelativePath}`;
    let connection;
    try {
        connection = await dbPool.getConnection();
        const [result] = await connection.query('UPDATE Usuarios SET avatar_url = ? WHERE id_usuario = ?', [avatarUrl, userId]);
        if (result.affectedRows > 0) {
            return res.status(200).json({ success: true, message: 'Foto de perfil actualizada exitosamente.', avatarUrl: avatarUrl });
        } else {
            // Si el usuario no existe, el archivo subido no tiene sentido, así que se borra.
            fs.unlink(req.file.path, (err) => { if (err) console.error("Error borrando archivo subido para usuario no encontrado:", err); });
            return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
        }
    } catch (error) {
        console.error(`Error al actualizar avatar para usuario ID: ${userId}:`, error);
        // Si hay un error de BD, también borrar el archivo subido para no dejar basura.
        fs.unlink(req.file.path, (err) => { if (err) console.error("Error borrando archivo subido debido a error de BD:", err); });
        return res.status(500).json({ success: false, message: 'Error interno al actualizar la foto de perfil.' });
    } finally { if (connection) { connection.release(); } }
});


// --- RUTAS DE SERVICIOS ---
app.get('/api/servicios', [
    query('activos').optional().isBoolean().withMessage('El filtro "activos" debe ser booleano (true/false).')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ success: false, errors: errors.array() }); }

    const soloActivos = req.query.activos === 'true';
    let connection;
    try {
        connection = await dbPool.getConnection();
        let sqlQuery = "SELECT id_servicio, nombre_servicio, activo FROM Servicios";
        if (soloActivos) {
            sqlQuery += " WHERE activo = TRUE"; // O activo = 1, dependiendo de tu BD
        }
        sqlQuery += " ORDER BY nombre_servicio";
        const [servicios] = await connection.query(sqlQuery);
        // Asegurar que 'activo' sea un booleano en la respuesta JSON
        const serviciosConBooleano = servicios.map(s => ({ ...s, activo: Boolean(s.activo) }));
        return res.status(200).json({ success: true, servicios: serviciosConBooleano });
    } catch (error) {
        console.error('Error al obtener servicios:', error);
        return res.status(500).json({ success: false, message: 'Error al obtener la lista de servicios.' });
    } finally {
        if (connection) connection.release();
    }
});

app.post('/api/servicios', [
    body('nombre_servicio').trim().notEmpty().withMessage('El nombre del servicio es requerido.').isLength({max: 100}).escape()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ success: false, errors: errors.array() }); }

    const { nombre_servicio } = req.body;
    let connection;
    try {
        connection = await dbPool.getConnection();
        // Verificar si ya existe un servicio con el mismo nombre (insensible a mayúsculas/minúsculas)
        const [existe] = await connection.query('SELECT id_servicio FROM Servicios WHERE LOWER(nombre_servicio) = LOWER(?)', [nombre_servicio]);
        if (existe.length > 0) {
            return res.status(409).json({ success: false, message: 'Error: Ya existe un servicio con ese nombre.' });
        }
        // Por defecto, un nuevo servicio se crea como activo (TRUE o 1)
        const [result] = await connection.query( 'INSERT INTO Servicios (nombre_servicio, activo) VALUES (?, TRUE)', [nombre_servicio] );
        return res.status(201).json({ success: true, message: 'Servicio añadido exitosamente.', id_servicio: result.insertId });
    } catch (error) {
        console.error('Error al añadir servicio:', error);
        if (error.code === 'ER_DUP_ENTRY') { // Por si tienes una constraint unique que no sea case-insensitive
            return res.status(409).json({ success: false, message: 'Error: Ya existe un servicio con ese nombre (constraint unique).' });
        }
        return res.status(500).json({ success: false, message: 'Error interno al añadir el servicio.' });
    } finally {
        if (connection) connection.release();
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
    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.beginTransaction();
        // Verificar si el nuevo nombre ya existe en OTRO servicio
        const [existe] = await connection.query( 'SELECT id_servicio FROM Servicios WHERE LOWER(nombre_servicio) = LOWER(?) AND id_servicio != ?', [nombre_servicio, servicioId] );
        if (existe.length > 0) {
            await connection.rollback();
            return res.status(409).json({ success: false, message: 'Error: Ya existe otro servicio con ese nombre.' });
        }
        const [result] = await connection.query( 'UPDATE Servicios SET nombre_servicio = ? WHERE id_servicio = ?', [nombre_servicio, servicioId] );
        await connection.commit();
        if (result.affectedRows > 0) {
            return res.status(200).json({ success: true, message: 'Servicio actualizado exitosamente.' });
        } else {
            return res.status(404).json({ success: false, message: 'Servicio no encontrado.' });
        }
    } catch (error) {
        console.error(`Error al actualizar servicio ID: ${servicioId}:`, error);
        if (connection) await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') { // Por si tienes una constraint unique que no sea case-insensitive
             return res.status(409).json({ success: false, message: 'Error: Ya existe otro servicio con ese nombre (constraint unique).' });
        }
        return res.status(500).json({ success: false, message: 'Error interno al actualizar el servicio.' });
    } finally {
        if (connection) connection.release();
    }
});

app.patch('/api/servicios/:id/toggle', [
    param('id').isInt({ gt: 0 }).withMessage('ID de servicio inválido.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ success: false, errors: errors.array() }); }

    const servicioId = req.params.id;
    let connection;
    try {
        connection = await dbPool.getConnection();
        const [currentService] = await connection.query('SELECT activo FROM Servicios WHERE id_servicio = ?', [servicioId]);
        if (currentService.length === 0) {
            return res.status(404).json({ success: false, message: 'Servicio no encontrado.' });
        }
        const nuevoEstadoLogico = !Boolean(currentService[0].activo); // Invierte el estado actual
        // Guarda el nuevo estado (TRUE/FALSE o 1/0)
        const [result] = await connection.query( 'UPDATE Servicios SET activo = ? WHERE id_servicio = ?', [nuevoEstadoLogico, servicioId] );

        if (result.affectedRows > 0) {
            return res.status(200).json({ success: true, message: `Estado del servicio cambiado a ${nuevoEstadoLogico ? 'Activo' : 'Inactivo'}.`, nuevoEstado: nuevoEstadoLogico });
        } else {
            // Esto podría pasar si el estado ya era el que se intentó poner, o si el ID no existe (aunque ya se verificó)
            return res.status(404).json({ success: false, message: 'Servicio no encontrado o sin cambios necesarios.' });
        }
    } catch (error) {
        console.error(`Error al cambiar estado del servicio ID: ${servicioId}:`, error);
        return res.status(500).json({ success: false, message: 'Error interno al cambiar estado del servicio.' });
    } finally {
        if (connection) connection.release();
    }
});

app.delete('/api/servicios/:id', [
    param('id').isInt({ gt: 0 }).withMessage('ID de servicio inválido.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ success: false, errors: errors.array() }); }
    const servicioId = req.params.id;
    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.beginTransaction();
        // Verificar si el servicio está asociado a citas
        // Asumiendo que en Citas.servicio_principal guardas algo como "Servicio ID: X" o "Otros servicios / Diagnóstico"
        // Esta lógica de verificación podría necesitar ajustarse a cómo guardas exactamente la referencia al servicio en Citas.
        const servicioIdStringFormat1 = `Servicio ID: ${servicioId}`;
        const servicioIdStringFormat2 = servicioId.toString(); // Si a veces guardas solo el ID numérico como string

        const [citasAsociadas] = await connection.query(
            'SELECT COUNT(*) as count FROM Citas WHERE servicio_principal = ? OR servicio_principal = ?',
            [servicioIdStringFormat1, servicioIdStringFormat2]
        );

        if (citasAsociadas[0].count > 0) {
            await connection.rollback();
            return res.status(409).json({ success: false, message: 'Error: No se puede eliminar el servicio porque está asociado a una o más citas.' });
        }

        const [result] = await connection.query('DELETE FROM Servicios WHERE id_servicio = ?', [servicioId]);
        await connection.commit();
        if (result.affectedRows > 0) {
            return res.status(200).json({ success: true, message: 'Servicio eliminado exitosamente.' });
        } else {
            return res.status(404).json({ success: false, message: 'Servicio no encontrado.' });
        }
    } catch (error) {
        console.error(`Error al eliminar servicio ID: ${servicioId}:`, error);
        if (connection) await connection.rollback();
        // ER_ROW_IS_REFERENCED_2 es un error común de FK constraint
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(409).json({ success: false, message: 'Error: No se puede eliminar el servicio porque está referenciado en otras tablas (posiblemente citas u otra tabla con FK).'});
        }
        return res.status(500).json({ success: false, message: 'Error interno al eliminar el servicio.' });
    } finally {
        if (connection) connection.release();
    }
});


// --- RUTAS DE VEHÍCULOS Y CLIENTES ---
app.get('/api/vehiculos/cliente', [
    query('telefono').trim().notEmpty().withMessage('Número de teléfono es requerido.').isMobilePhone('any', { strictMode: false }).withMessage('Número de teléfono inválido.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ success: false, errors: errors.array() }); }
    const telefonoCliente = req.query.telefono;
    let connection;
    try {
        connection = await dbPool.getConnection();
        const [clientes] = await connection.query( 'SELECT id_cliente, nombres, apellidos FROM Clientes WHERE telefono = ?', [telefonoCliente] );
        if (clientes.length === 0) {
            // Si no se encuentra el cliente, devolver un array vacío de vehículos y cliente null.
            return res.status(200).json({ success: true, vehicles: [], cliente: null });
        }
        const cliente = clientes[0];
        const [vehiculos] = await connection.query( 'SELECT id_vehiculo, marca, modelo, placa, ano FROM Vehiculos WHERE id_cliente = ? ORDER BY marca, modelo', [cliente.id_cliente] );
        return res.status(200).json({
            success: true,
            vehicles: vehiculos,
            cliente: {id_cliente: cliente.id_cliente, nombre_cliente: cliente.nombres, apellido_cliente: cliente.apellidos}
        });
    } catch (error) {
        console.error('Error al obtener vehículos por teléfono:', error);
        return res.status(500).json({ success: false, message: 'Error al obtener los vehículos del cliente.' });
    } finally {
        if (connection) { connection.release(); }
    }
});

app.get('/api/clientes/buscar', [
    query('telefono').trim().notEmpty().withMessage('Número de teléfono es requerido.').isMobilePhone('any', { strictMode: false }).withMessage('Número de teléfono inválido.')
], async (req, res) => {
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
    } catch (error) {
        console.error("Error buscando cliente por teléfono:", error);
        return res.status(500).json({ success: false, message: 'Error interno al buscar cliente.' });
    } finally {
        if (connection) connection.release();
    }
});

app.get('/api/vehiculos', [
    query('placa').optional().trim().toUpperCase().escape() // Permite buscar por placa (opcional)
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ success: false, errors: errors.array() }); }

    const placaQuery = req.query.placa;
    let connection;
    try {
        connection = await dbPool.getConnection();
        let sqlQuery = `
            SELECT v.id_vehiculo, v.placa AS placa_vehiculo, v.marca AS marca_vehiculo, v.modelo AS modelo_vehiculo, v.ano AS ano_vehiculo,
                   v.id_cliente, cl.nombres AS nombre_cliente, cl.apellidos AS apellido_cliente
            FROM Vehiculos v
            JOIN Clientes cl ON v.id_cliente = cl.id_cliente `;

        const queryParams = [];
        if (placaQuery) {
            sqlQuery += ' WHERE v.placa LIKE ?';
            queryParams.push(`${placaQuery}%`); // Búsqueda que comience con la placa
        }
        sqlQuery += ' ORDER BY cl.apellidos, cl.nombres, v.marca, v.modelo';

        const [vehiculos] = await connection.query(sqlQuery, queryParams);
        return res.status(200).json({ success: true, vehiculos: vehiculos });
    } catch (error) {
        console.error('Error al obtener la lista de vehículos:', error);
        return res.status(500).json({ success: false, message: 'Error al obtener la lista de vehículos.' });
    } finally {
        if (connection) { connection.release(); }
    }
});

app.post('/api/vehiculos', [
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
        if (clienteExiste.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Error: El cliente especificado no existe.' });
        }

        const [placaExistente] = await connection.query('SELECT id_vehiculo FROM Vehiculos WHERE placa = ?', [placa_vehiculo]);
        if (placaExistente.length > 0) {
            await connection.rollback();
            return res.status(409).json({ success: false, message: 'Error: La placa del vehículo ya está registrada.' });
        }

        const sqlInsert = `INSERT INTO Vehiculos (id_cliente, marca, modelo, ano, placa) VALUES (?, ?, ?, ?, ?)`;
        const insertParams = [ id_cliente, marca_vehiculo, modelo_vehiculo, ano_vehiculo, placa_vehiculo ];
        const [result] = await connection.query(sqlInsert, insertParams);
        await connection.commit();
        return res.status(201).json({ success: true, message: 'Vehículo añadido exitosamente.', vehiculoId: result.insertId });
    } catch (error) {
        console.error('Error al añadir vehículo:', error);
        if (connection) await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') { // Por si la placa tiene constraint unique
            return res.status(409).json({ success: false, message: `Error: La placa del vehículo ya existe.` });
        }
        return res.status(500).json({ success: false, message: 'Error interno al añadir el vehículo.' });
    } finally {
        if (connection) connection.release();
    }
});

app.put('/api/vehiculos/:id', [
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

        // Verificar si la nueva placa ya existe en OTRO vehículo
        const [placaExistente] = await connection.query( 'SELECT id_vehiculo FROM Vehiculos WHERE placa = ? AND id_vehiculo != ?', [placa_vehiculo, vehiculoId] );
        if (placaExistente.length > 0) {
            await connection.rollback();
            return res.status(409).json({ success: false, message: 'Error: La nueva placa ya está registrada en otro vehículo.' });
        }

        const sqlUpdate = `UPDATE Vehiculos SET placa = ?, marca = ?, modelo = ?, ano = ? WHERE id_vehiculo = ?`;
        const updateParams = [ placa_vehiculo, marca_vehiculo, modelo_vehiculo, ano_vehiculo, vehiculoId ];
        const [result] = await connection.query(sqlUpdate, updateParams);
        await connection.commit();

        if (result.affectedRows > 0 || result.changedRows > 0) { // changedRows es útil si los datos son iguales
            return res.status(200).json({ success: true, message: 'Vehículo actualizado exitosamente.' });
        } else {
            return res.status(404).json({ success: false, message: 'Vehículo no encontrado o sin cambios necesarios.' });
        }
    } catch (error) {
        console.error(`Error al actualizar vehículo ID: ${vehiculoId}:`, error);
        if (connection) await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') { // Por si la placa tiene constraint unique
             return res.status(409).json({ success: false, message: `Error: La placa del vehículo ya existe.` });
        }
        return res.status(500).json({ success: false, message: 'Error interno al actualizar el vehículo.' });
    } finally {
        if (connection) connection.release();
    }
});

app.delete('/api/vehiculos/:id', [
    param('id').isInt({ gt: 0 }).withMessage('ID de vehículo inválido.')
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { return res.status(400).json({ success: false, errors: errors.array() }); }

    const vehiculoId = req.params.id;
    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.beginTransaction();

        // Verificar si el vehículo tiene citas asociadas
        const [citasAsociadas] = await connection.query( 'SELECT COUNT(*) as count FROM Citas WHERE id_vehiculo = ?', [vehiculoId] );
        if (citasAsociadas[0].count > 0) {
            await connection.rollback();
            return res.status(409).json({ success: false, message: 'Error: No se puede eliminar el vehículo porque tiene citas asociadas.' });
        }

        const [result] = await connection.query('DELETE FROM Vehiculos WHERE id_vehiculo = ?', [vehiculoId]);
        await connection.commit();

        if (result.affectedRows > 0) {
            return res.status(200).json({ success: true, message: 'Vehículo eliminado exitosamente.' });
        } else {
            return res.status(404).json({ success: false, message: 'Vehículo no encontrado.' });
        }
    } catch (error) {
        console.error(`Error al eliminar vehículo ID: ${vehiculoId}:`, error);
        if (connection) await connection.rollback();
        if (error.code === 'ER_ROW_IS_REFERENCED_2') { // Error de FK constraint
            return res.status(409).json({ success: false, message: 'Error: No se puede eliminar el vehículo porque está referenciado en otras tablas (posiblemente citas).'});
        }
        return res.status(500).json({ success: false, message: 'Error interno al eliminar el vehículo.' });
    } finally {
        if (connection) connection.release();
    }
});

// --- RUTAS DE CONTEO (Dashboard) ---
app.get('/api/vehiculos/count', async (req, res) => {
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

app.get('/api/clientes/count', async (req, res) => {
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


// --- INICIO DEL SERVIDOR ---
// Escucha en 0.0.0.0 para ser accesible en entornos de contenedores como Render
app.listen(port, '0.0.0.0', () => {
    console.log(`Servidor backend escuchando en el puerto ${port}`);
    // En desarrollo local, podrías acceder vía http://localhost:${port}
    // En Render, accederás a través de la URL que te proporcione Render.
    console.log(`Frontend debería ser accesible en la raíz (ej. http://localhost:${port}/login.html)`);
});

// --- MANEJO ELEGANTE DEL CIERRE DEL SERVIDOR ---
// Esto es útil para cerrar conexiones de base de datos, etc., antes de que el proceso termine.
process.on('SIGINT', async () => {
    console.log('Recibida señal SIGINT (Ctrl+C). Cerrando servidor...');
    try {
        await dbPool.end(); // Cierra todas las conexiones en el pool de MySQL
        console.log('Pool de conexiones de la base de datos cerrado exitosamente.');
    } catch (err) {
        console.error('Error al cerrar el pool de conexiones de la base de datos:', err);
    }
    process.exit(0); // Termina el proceso
});

process.on('SIGTERM', async () => {
    console.log('Recibida señal SIGTERM. Cerrando servidor...');
    try {
        await dbPool.end();
        console.log('Pool de conexiones de la base de datos cerrado exitosamente.');
    } catch (err) {
        console.error('Error al cerrar el pool de conexiones de la base de datos:', err);
    }
    process.exit(0);
});
