// server.js

// 1. Importar librerías necesarias
const express = require('express');
const mysql = require('mysql2/promise'); // Usar la versión promise
const bcrypt = require('bcrypt');
const cors = require('cors');
const path = require('path'); // Necesario para manejar rutas de archivos
const fs = require('fs'); // Necesario para crear carpetas si no existen
const multer = require('multer'); // *** NUEVO: Para manejar subida de archivos ***

// 2. Inicializar la aplicación Express
const app = express();
const port = 3000; // Puerto donde correrá el servidor

// 3. Middleware
app.use(cors()); // Habilitar CORS para permitir peticiones desde el frontend
app.use(express.json()); // Para parsear cuerpos de petición JSON
app.use(express.urlencoded({ extended: true })); // Para parsear cuerpos de petición URL-encoded

// *** NUEVO: Servir archivos estáticos desde la carpeta 'uploads' ***
// Esto permite que el navegador acceda a las imágenes subidas usando una URL como http://localhost:3000/uploads/avatars/nombre_archivo.jpg
const uploadsDir = path.join(__dirname, 'uploads'); // Directorio base para subidas
if (!fs.existsSync(uploadsDir)){ // Crear carpeta 'uploads' si no existe
    fs.mkdirSync(uploadsDir);
}
app.use('/uploads', express.static(uploadsDir));
console.log(`Sirviendo archivos estáticos desde: ${uploadsDir}`);
// --- Fin Servir archivos estáticos ---

// 4. Configuración de la Conexión a la Base de Datos
const dbPool = mysql.createPool({
    connectionLimit: 10, // Número máximo de conexiones en el pool
    host: 'localhost', // Host de la base de datos
    user: 'root', // Usuario de la base de datos
    password: 'root', // Contraseña de la base de datos
    database: 'servicio_automotriz', // Nombre de la base de datos
    waitForConnections: true, // Esperar si no hay conexiones disponibles
    queueLimit: 0, // Sin límite en la cola de espera
    dateStrings: true // Importante para devolver fechas como strings
});

// 5. Probar la Conexión a la Base de Datos al iniciar
async function testDbConnection() {
    let connection;
    try {
        connection = await dbPool.getConnection();
        console.log('¡Conexión exitosa a la base de datos!');
    } catch (error) {
        console.error('Error al conectar con la base de datos:', error);
        process.exit(1); // Terminar la aplicación si no se puede conectar
    } finally {
        if (connection) connection.release(); // Siempre liberar la conexión
    }
}
testDbConnection();

// --- Configuración de Hashing ---
const saltRounds = 10;

// *** NUEVO: Configuración de Multer para subida de avatares ***
const avatarUploadsDir = path.join(uploadsDir, 'avatars'); // Carpeta específica para avatares
if (!fs.existsSync(avatarUploadsDir)){ // Crear carpeta 'avatars' si no existe
    fs.mkdirSync(avatarUploadsDir);
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, avatarUploadsDir); // Define la carpeta de destino
    },
    filename: function (req, file, cb) {
        // Genera un nombre de archivo único: userId-timestamp.extension
        const userId = req.params.id || 'unknown'; // Obtiene el ID del usuario de la ruta
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const extension = path.extname(file.originalname); // Obtiene la extensión original
        cb(null, `user-${userId}-${uniqueSuffix}${extension}`);
    }
});

// Filtro para aceptar solo imágenes
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true); // Aceptar archivo
    } else {
        cb(new Error('Tipo de archivo no permitido. Solo se aceptan imágenes.'), false); // Rechazar archivo
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 2 * 1024 * 1024 // Límite de 2MB (ajusta según necesidad)
    }
});
// --- Fin Configuración Multer ---


// 6. Definir Rutas de la API

// Ruta de prueba para la raíz
app.get('/', (req, res) => {
    res.send('¡Bienvenido al Backend del Servicio Automotriz!');
});

// --- Rutas API para CITAS ---
// (Las rutas de citas existentes van aquí... sin cambios)
// POST /api/citas - GUARDAR una NUEVA CITA
app.post('/api/citas', async (req, res) => {
    console.log('Datos recibidos para nueva cita:', req.body);
    const {
        nombres_cliente, apellidos_cliente, email_cliente, telefono_cliente,
        vehiculo_registrado_id, is_new_vehicle, marca_vehiculo, modelo_vehiculo,
        ano_vehiculo, placa_vehiculo, kilometraje, servicio_id,
        detalle_sintomas, fecha_cita, hora_cita,
        userId // ID del usuario que crea la cita
    } = req.body;

    // Validación de campos obligatorios
    if (!userId) return res.status(400).json({ success: false, message: 'Falta información del usuario creador.' });
    if (!nombres_cliente || !apellidos_cliente || !telefono_cliente || !fecha_cita || !hora_cita) return res.status(400).json({ success: false, message: 'Faltan campos obligatorios del cliente o de la cita.' });
    if (is_new_vehicle === '1' && (!marca_vehiculo || !modelo_vehiculo || !ano_vehiculo || !placa_vehiculo)) return res.status(400).json({ success: false, message: 'Faltan campos obligatorios para registrar el nuevo vehículo.' });
    if (is_new_vehicle !== '1' && !vehiculo_registrado_id) return res.status(400).json({ success: false, message: 'Debe seleccionar un vehículo existente o añadir uno nuevo.' });
    if (!servicio_id || (isNaN(parseInt(servicio_id)) && servicio_id !== 'otros')) return res.status(400).json({ success: false, message: 'Debe seleccionar un servicio válido.' });

    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.beginTransaction();

        let clienteId;
        let vehiculoId;

        // Manejar Cliente (buscar o crear)
        const [clientesExistentes] = await connection.query( 'SELECT id_cliente FROM Clientes WHERE telefono = ?', [telefono_cliente] );
        if (clientesExistentes.length > 0) { clienteId = clientesExistentes[0].id_cliente; }
        else { const [clienteResult] = await connection.query( 'INSERT INTO Clientes (nombres, apellidos, email, telefono) VALUES (?, ?, ?, ?)', [nombres_cliente, apellidos_cliente, email_cliente || null, telefono_cliente] ); clienteId = clienteResult.insertId; }

        // Manejar Vehículo (usar existente o crear)
         if (is_new_vehicle === '1') {
             const [placaExistente] = await connection.query('SELECT id_vehiculo FROM Vehiculos WHERE placa = ?', [placa_vehiculo.toUpperCase()]);
             if(placaExistente.length > 0) { await connection.rollback(); return res.status(409).json({ success: false, message: 'Error: La placa del vehículo ya está registrada.' }); }
             const [vehiculoResult] = await connection.query( 'INSERT INTO Vehiculos (id_cliente, marca, modelo, ano, placa) VALUES (?, ?, ?, ?, ?)', [clienteId, marca_vehiculo, modelo_vehiculo, ano_vehiculo, placa_vehiculo.toUpperCase()] );
             vehiculoId = vehiculoResult.insertId;
         } else {
             vehiculoId = vehiculo_registrado_id;
             const [vehiculoValido] = await connection.query( 'SELECT id_vehiculo FROM Vehiculos WHERE id_vehiculo = ? AND id_cliente = ?', [vehiculoId, clienteId] );
             if (vehiculoValido.length === 0) { await connection.rollback(); return res.status(400).json({ success: false, message: 'Error: El vehículo seleccionado no pertenece al cliente indicado.' }); }
         }

        // Insertar la Cita
        let servicioParaGuardar = null;
        if (servicio_id && servicio_id !== 'otros' && !isNaN(parseInt(servicio_id))) { servicioParaGuardar = `Servicio ID: ${servicio_id}`; }
        else if (servicio_id === 'otros') { servicioParaGuardar = "Otros servicios / Diagnóstico"; }
        const estadoInicial = 'Pendiente';
        const sqlInsertCita = `INSERT INTO Citas (id_cliente, id_vehiculo, fecha_cita, hora_cita, kilometraje, servicio_principal, motivo_detalle, estado, creado_por_id, fecha_creacion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`;
        const insertParams = [ clienteId, vehiculoId, fecha_cita, hora_cita, kilometraje || null, servicioParaGuardar, detalle_sintomas || null, estadoInicial, userId ];
        const [citaResult] = await connection.query(sqlInsertCita, insertParams);
        const citaId = citaResult.insertId;
        console.log(`Cita insertada con ID: ${citaId}, estado: ${estadoInicial}, creada por User ID: ${userId}`);

        await connection.commit();
        return res.status(201).json({
            success: true,
            message: 'Cita registrada exitosamente.', // Mensaje limpio
            citaId: citaId
        });

    } catch (error) {
        console.error('Error durante la transacción de base de datos (/api/citas):', error);
        if (connection) await connection.rollback();
        // Manejo de errores duplicados mejorado
        if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
            let campoDuplicado = 'desconocido';
            const match = error.message.match(/for key '(.+?)'/);
            if (match && match[1]) {
                const keyName = match[1];
                // Ajusta estos nombres según los nombres EXACTOS de tus índices UNIQUE
                if (keyName.toLowerCase().includes('placa')) campoDuplicado = 'Placa del Vehículo';
                else if (keyName.toLowerCase().includes('email')) campoDuplicado = 'Email del Cliente';
                else if (keyName.toLowerCase().includes('telefono')) campoDuplicado = 'Teléfono del Cliente';
                else campoDuplicado = keyName;
            }
            return res.status(409).json({ success: false, message: `Error: El valor para '${campoDuplicado}' ya existe.` });
        } else if (error.code === 'ER_NO_REFERENCED_ROW_2') {
             return res.status(400).json({ success: false, message: 'Error: El cliente o el vehículo seleccionado no es válido o no existe.' });
        } else {
             return res.status(500).json({ success: false, message: 'Error interno al registrar la cita.' });
        }
    } finally {
        if (connection) { connection.release(); }
    }
});

// GET /api/citas - OBTENER lista de CITAS
app.get('/api/citas', async (req, res) => {
    const { fecha_inicio, fecha_fin } = req.query;
    console.log("Petición recibida para GET /api/citas con filtros:", req.query);
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
        if (fecha_inicio && /^\d{4}-\d{2}-\d{2}$/.test(fecha_inicio)) { conditions.push('c.fecha_cita >= ?'); queryParams.push(fecha_inicio); }
        if (fecha_fin && /^\d{4}-\d{2}-\d{2}$/.test(fecha_fin)) { conditions.push('c.fecha_cita <= ?'); queryParams.push(fecha_fin); }
        if (conditions.length > 0) { sqlQuery += ' WHERE ' + conditions.join(' AND '); }
        sqlQuery += ' ORDER BY c.fecha_cita DESC, c.hora_cita DESC';
        const [citas] = await connection.query(sqlQuery, queryParams);
        return res.status(200).json({ success: true, citas: citas });
    } catch (error) { console.error('Error al obtener la lista de citas:', error); return res.status(500).json({ success: false, message: 'Error al obtener la lista de citas.' }); }
    finally { if (connection) { connection.release(); } }
});

// GET /api/citas/:id - OBTENER una CITA específica por ID
app.get('/api/citas/:id', async (req, res) => {
    const citaId = req.params.id;
    if (isNaN(parseInt(citaId))) { return res.status(400).json({ success: false, message: 'ID de cita inválido.' }); }
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

// PUT /api/citas/:id - ACTUALIZAR una CITA existente
app.put('/api/citas/:id', async (req, res) => {
    const citaId = req.params.id;
    const { fecha_cita, hora_cita, kilometraje, servicio_id, detalle_sintomas, userId } = req.body;
    if (isNaN(parseInt(citaId))) { return res.status(400).json({ success: false, message: 'ID de cita inválido.' }); }
    if (!userId) { return res.status(400).json({ success: false, message: 'Falta información del usuario modificador.' }); }
    if (!fecha_cita || !hora_cita) { return res.status(400).json({ success: false, message: 'La fecha y la hora de la cita son obligatorias.' }); }
    if (!servicio_id || (isNaN(parseInt(servicio_id)) && servicio_id !== 'otros')) { return res.status(400).json({ success: false, message: 'Debe seleccionar un servicio válido.' }); }

    let connection;
    try {
        connection = await dbPool.getConnection();
        let servicioParaGuardar = null;
        if (servicio_id && servicio_id !== 'otros' && !isNaN(parseInt(servicio_id))) { servicioParaGuardar = `Servicio ID: ${servicio_id}`; }
        else if (servicio_id === 'otros') { servicioParaGuardar = "Otros servicios / Diagnóstico"; }
        const sqlQuery = `UPDATE Citas SET fecha_cita = ?, hora_cita = ?, kilometraje = ?, servicio_principal = ?, motivo_detalle = ?, modificado_por_id = ?, fecha_modificacion = NOW() WHERE id_cita = ?`;
        const queryParams = [ fecha_cita, hora_cita, kilometraje || null, servicioParaGuardar, detalle_sintomas || null, userId, citaId ];
        const [result] = await connection.query(sqlQuery, queryParams);
        if (result.affectedRows > 0) { return res.status(200).json({ success: true, message: 'Cita actualizada exitosamente.' }); }
        else if (result.changedRows > 0) { return res.status(200).json({ success: true, message: 'No se realizaron cambios (datos iguales).' }); } // Opcional: manejar caso sin cambios
        else { return res.status(404).json({ success: false, message: 'Cita no encontrada.' }); }
    } catch (error) { console.error(`Error al actualizar cita ID: ${citaId}:`, error); return res.status(500).json({ success: false, message: 'Error interno al actualizar la cita.' }); }
    finally { if (connection) { connection.release(); } }
});

// PATCH /api/citas/:id/cancelar - CANCELAR una cita
app.patch('/api/citas/:id/cancelar', async (req, res) => {
    const citaId = req.params.id;
    const userId = req.body.userId || null;
    if (isNaN(parseInt(citaId))) { return res.status(400).json({ success: false, message: 'ID de cita inválido.' }); }
    let connection;
    try {
        connection = await dbPool.getConnection();
        const [result] = await connection.query( "UPDATE Citas SET estado = 'Cancelada', modificado_por_id = ?, fecha_modificacion = NOW() WHERE id_cita = ?", [userId, citaId] );
        if (result.affectedRows > 0) { return res.status(200).json({ success: true, message: 'Cita cancelada exitosamente.' }); }
        else { return res.status(404).json({ success: false, message: 'Cita no encontrada.' }); }
    } catch (error) { console.error(`Error al cancelar cita ID: ${citaId}:`, error); return res.status(500).json({ success: false, message: 'Error interno al cancelar la cita.' }); }
    finally { if (connection) { connection.release(); } }
});

// PATCH /api/citas/:id/completar - COMPLETAR una cita
app.patch('/api/citas/:id/completar', async (req, res) => {
    const citaId = req.params.id;
    const userId = req.body.userId || null;
    if (isNaN(parseInt(citaId))) { return res.status(400).json({ success: false, message: 'ID de cita inválido.' }); }
    let connection;
    try {
        connection = await dbPool.getConnection();
        const [result] = await connection.query( "UPDATE Citas SET estado = 'Completada', modificado_por_id = ?, fecha_modificacion = NOW() WHERE id_cita = ?", [userId, citaId] );
        if (result.affectedRows > 0) { return res.status(200).json({ success: true, message: 'Cita marcada como completada.' }); }
        else { return res.status(404).json({ success: false, message: 'Cita no encontrada.' }); }
    } catch (error) { console.error(`Error al completar cita ID: ${citaId}:`, error); return res.status(500).json({ success: false, message: 'Error interno al completar la cita.' }); }
    finally { if (connection) { connection.release(); } }
});

// --- Rutas API para USUARIOS ---

// POST /api/login - Iniciar sesión
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) { return res.status(400).json({ success: false, message: 'Usuario y contraseña son requeridos.' }); }
    let connection;
    try {
        connection = await dbPool.getConnection();
        // *** Incluir avatar_url en la consulta de login ***
        const [rows] = await connection.query( 'SELECT id_usuario, username, password_hash, nombre_completo, rol, avatar_url FROM Usuarios WHERE username = ?', [username] );
        if (rows.length === 0) { return res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos.' }); }
        const user = rows[0];
        const isPasswordMatch = await bcrypt.compare(password, user.password_hash);
        if (isPasswordMatch) {
            // *** Devolver avatar_url en la respuesta ***
             return res.status(200).json({
                success: true,
                message: 'Inicio de sesión exitoso.',
                user: {
                    id: user.id_usuario,
                    username: user.username,
                    nombre: user.nombre_completo,
                    rol: user.rol,
                    avatarUrl: user.avatar_url // Añadido
                 }
            });
        } else {
            return res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos.' });
        }
    } catch (error) { console.error('Error durante el proceso de login:', error); return res.status(500).json({ success: false, message: 'Error interno del servidor durante el inicio de sesión.' }); }
    finally { if (connection) { connection.release(); } }
});

// POST /api/register - Registrar un nuevo usuario
app.post('/api/register', async (req, res) => {
    const { username, password, nombre_completo } = req.body;
    if (!username || !password) { return res.status(400).json({ success: false, message: 'Nombre de usuario y contraseña son requeridos.' }); }
    if (password.length < 6) { return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 6 caracteres.' }); }
    if (!nombre_completo) { return res.status(400).json({ success: false, message: 'El nombre completo es requerido.' }); }

    let connection;
    try {
        connection = await dbPool.getConnection();
        // Verificar nombre completo duplicado
        const [existingName] = await connection.query( 'SELECT id_usuario FROM Usuarios WHERE nombre_completo = ?', [nombre_completo] );
        if (existingName.length > 0) { return res.status(409).json({ success: false, message: 'Error: Ya existe un usuario registrado con ese nombre completo.' }); }

        const hashedPassword = await bcrypt.hash(password, saltRounds);
        const rolPorDefecto = 'Usuario';
        const [result] = await connection.query( 'INSERT INTO Usuarios (username, password_hash, nombre_completo, rol) VALUES (?, ?, ?, ?)', [username, hashedPassword, nombre_completo, rolPorDefecto] );
        return res.status(201).json({ success: true, message: 'Usuario registrado exitosamente.' });
    } catch (error) {
        console.error('Error durante el proceso de registro:', error);
        // Manejo de error duplicado mejorado
        if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
            let campoDuplicado = 'desconocido';
            const match = error.message.match(/for key '(.+?)'/);
             if (match && match[1]) {
                const keyName = match[1];
                // Ajusta estos nombres según los nombres EXACTOS de tus índices UNIQUE
                if (keyName.toLowerCase().includes('username') || keyName.toLowerCase().includes('usuarios.username')) {
                    campoDuplicado = 'Nombre de Usuario';
                     return res.status(409).json({ success: false, message: `Error: El ${campoDuplicado} ya está en uso.` });
                } else { campoDuplicado = keyName; }
            }
            return res.status(409).json({ success: false, message: `Error: Conflicto de datos duplicados para '${campoDuplicado}'.` });
        }
        return res.status(500).json({ success: false, message: 'Error interno del servidor durante el registro.' });
    } finally {
        if (connection) { connection.release(); }
    }
});

// *** NUEVA RUTA: POST /api/users/:id/avatar - Subir/Actualizar avatar ***
app.post('/api/users/:id/avatar', upload.single('avatar'), async (req, res) => {
    const userId = req.params.id;
    console.log(`Petición POST /api/users/${userId}/avatar recibida.`);

    // Verifica si se subió un archivo
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No se subió ningún archivo de imagen.' });
    }

    // Verifica si el ID de usuario es válido
    if (isNaN(parseInt(userId))) {
        // Si el ID no es válido, borra el archivo subido para no dejar basura
        fs.unlink(req.file.path, (err) => {
            if (err) console.error("Error borrando archivo subido por ID inválido:", err);
        });
        return res.status(400).json({ success: false, message: 'ID de usuario inválido.' });
    }

    // Construye la URL pública del avatar
    // Asegúrate de que las barras inclinadas sean correctas para URL (siempre /)
    const avatarPath = path.join('uploads', 'avatars', req.file.filename).replace(/\\/g, '/'); // Normaliza a /
    const avatarUrl = `${req.protocol}://${req.get('host')}/${avatarPath}`; // URL completa
    console.log(`Archivo subido: ${req.file.path}, URL pública generada: ${avatarUrl}`);


    let connection;
    try {
        connection = await dbPool.getConnection();

        // Actualiza la URL del avatar en la base de datos
        const [result] = await connection.query(
            'UPDATE Usuarios SET avatar_url = ? WHERE id_usuario = ?',
            [avatarUrl, userId]
        );

        if (result.affectedRows > 0) {
            console.log(`Avatar actualizado para usuario ID: ${userId}`);
            return res.status(200).json({
                success: true,
                message: 'Foto de perfil actualizada exitosamente.',
                avatarUrl: avatarUrl // Devuelve la URL completa
            });
        } else {
            // Si el usuario no existe, borra el archivo subido
            fs.unlink(req.file.path, (err) => {
                if (err) console.error("Error borrando archivo subido por usuario no encontrado:", err);
            });
            console.log(`Usuario ID: ${userId} no encontrado para actualizar avatar.`);
            return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
        }
    } catch (error) {
        console.error(`Error al actualizar avatar para usuario ID: ${userId}:`, error);
        // Borra el archivo subido si hay un error de base de datos
        fs.unlink(req.file.path, (err) => {
            if (err) console.error("Error borrando archivo subido por error de DB:", err);
        });
        return res.status(500).json({ success: false, message: 'Error interno al actualizar la foto de perfil.' });
    } finally {
        if (connection) { connection.release(); }
    }
});
// --- Fin Nueva Ruta Avatar ---


// --- Rutas API para SERVICIOS ---
// (Las rutas de servicios existentes van aquí... sin cambios)
// GET /api/servicios - Obtener lista de servicios
app.get('/api/servicios', async (req, res) => {
    const soloActivos = req.query.activos === 'true';
    console.log(`Petición recibida para GET /api/servicios (Solo Activos: ${soloActivos})`);
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

// POST /api/servicios - Crear un nuevo servicio
app.post('/api/servicios', async (req, res) => {
    const { nombre_servicio } = req.body;
    console.log(`Petición POST /api/servicios recibida para crear: ${nombre_servicio}`);
    if (!nombre_servicio || nombre_servicio.trim() === '') { return res.status(400).json({ success: false, message: 'El nombre del servicio es requerido.' }); }
    let connection;
    try {
        connection = await dbPool.getConnection();
        const [existe] = await connection.query('SELECT id_servicio FROM Servicios WHERE LOWER(nombre_servicio) = LOWER(?)', [nombre_servicio.trim()]);
        if (existe.length > 0) { return res.status(409).json({ success: false, message: 'Error: Ya existe un servicio con ese nombre.' }); }
        const [result] = await connection.query( 'INSERT INTO Servicios (nombre_servicio, activo) VALUES (?, TRUE)', [nombre_servicio.trim()] );
        const nuevoId = result.insertId;
        return res.status(201).json({ success: true, message: 'Servicio añadido exitosamente.', id_servicio: nuevoId });
    } catch (error) {
        console.error('Error al añadir servicio:', error);
         if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) { return res.status(409).json({ success: false, message: 'Error: Ya existe un servicio con ese nombre.' }); }
        return res.status(500).json({ success: false, message: 'Error interno al añadir el servicio.' });
    } finally {
        if (connection) connection.release();
    }
});

// PUT /api/servicios/:id - Actualizar nombre de un servicio
app.put('/api/servicios/:id', async (req, res) => {
    const servicioId = req.params.id;
    const { nombre_servicio } = req.body;
    console.log(`Petición PUT /api/servicios/${servicioId} recibida para actualizar nombre a: ${nombre_servicio}`);
    if (isNaN(parseInt(servicioId))) { return res.status(400).json({ success: false, message: 'ID de servicio inválido.' }); }
    if (!nombre_servicio || nombre_servicio.trim() === '') { return res.status(400).json({ success: false, message: 'El nuevo nombre del servicio es requerido.' }); }

    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.beginTransaction();
        const [existe] = await connection.query( 'SELECT id_servicio FROM Servicios WHERE LOWER(nombre_servicio) = LOWER(?) AND id_servicio != ?', [nombre_servicio.trim(), servicioId] );
        if (existe.length > 0) { await connection.rollback(); return res.status(409).json({ success: false, message: 'Error: Ya existe otro servicio con ese nombre.' }); }
        const [result] = await connection.query( 'UPDATE Servicios SET nombre_servicio = ? WHERE id_servicio = ?', [nombre_servicio.trim(), servicioId] );
        await connection.commit();
        if (result.affectedRows > 0) { return res.status(200).json({ success: true, message: 'Servicio actualizado exitosamente.' }); }
        else { return res.status(404).json({ success: false, message: 'Servicio no encontrado.' }); }
    } catch (error) {
        console.error(`Error al actualizar servicio ID: ${servicioId}:`, error);
        if (connection) await connection.rollback();
         if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) { return res.status(409).json({ success: false, message: 'Error: Ya existe otro servicio con ese nombre.' }); }
        return res.status(500).json({ success: false, message: 'Error interno al actualizar el servicio.' });
    } finally {
        if (connection) connection.release();
    }
});

// PATCH /api/servicios/:id/toggle - Cambiar estado activo/inactivo
app.patch('/api/servicios/:id/toggle', async (req, res) => {
    const servicioId = req.params.id;
    console.log(`Petición PATCH /api/servicios/${servicioId}/toggle recibida`);
    if (isNaN(parseInt(servicioId))) { return res.status(400).json({ success: false, message: 'ID de servicio inválido.' }); }

    let connection;
    try {
        connection = await dbPool.getConnection();
        const [result] = await connection.query( 'UPDATE Servicios SET activo = NOT activo WHERE id_servicio = ?', [servicioId] );
        if (result.affectedRows > 0) {
             const [newState] = await connection.query('SELECT activo FROM Servicios WHERE id_servicio = ?', [servicioId]);
             const nuevoEstado = Boolean(newState[0]?.activo);
            console.log(`Estado del servicio ID: ${servicioId} cambiado a ${nuevoEstado ? 'Activo' : 'Inactivo'}.`);
            return res.status(200).json({ success: true, message: `Estado del servicio cambiado a ${nuevoEstado ? 'Activo' : 'Inactivo'}.`, nuevoEstado: nuevoEstado });
        } else {
            console.log(`Toggle fallido: Servicio ID: ${servicioId} no encontrado.`);
            return res.status(404).json({ success: false, message: 'Servicio no encontrado.' });
        }
    } catch (error) { console.error(`Error al cambiar estado del servicio ID: ${servicioId}:`, error); return res.status(500).json({ success: false, message: 'Error interno al cambiar estado del servicio.' }); }
    finally { if (connection) connection.release(); }
});

// DELETE /api/servicios/:id - Eliminar un servicio
app.delete('/api/servicios/:id', async (req, res) => {
    const servicioId = req.params.id;
    console.log(`Petición DELETE /api/servicios/${servicioId} recibida`);
    if (isNaN(parseInt(servicioId))) { return res.status(400).json({ success: false, message: 'ID de servicio inválido.' }); }

    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.beginTransaction();
        // Verificar si el servicio está siendo usado en alguna CITA
        const [citasAsociadas] = await connection.query( 'SELECT COUNT(*) as count FROM Citas WHERE servicio_principal = ? OR servicio_principal = ?', [`Servicio ID: ${servicioId}`, servicioId] );
        if (citasAsociadas[0].count > 0) { await connection.rollback(); return res.status(409).json({ success: false, message: 'Error: No se puede eliminar el servicio porque está asociado a una o más citas.' }); }
        // Eliminar el servicio
        const [result] = await connection.query('DELETE FROM Servicios WHERE id_servicio = ?', [servicioId]);
        await connection.commit();
        if (result.affectedRows > 0) { return res.status(200).json({ success: true, message: 'Servicio eliminado exitosamente.' }); }
        else { return res.status(404).json({ success: false, message: 'Servicio no encontrado.' }); }
    } catch (error) {
        console.error(`Error al eliminar servicio ID: ${servicioId}:`, error);
        if (connection) await connection.rollback();
         if (error.code === 'ER_ROW_IS_REFERENCED_2') { return res.status(409).json({ success: false, message: 'Error: No se puede eliminar el servicio porque está referenciado en otras tablas.' }); }
        return res.status(500).json({ success: false, message: 'Error interno al eliminar el servicio.' });
    } finally {
        if (connection) connection.release();
    }
});


// --- Rutas API para VEHÍCULOS ---
// (Las rutas de vehículos existentes van aquí... sin cambios)
// GET /api/vehiculos/cliente - Obtener vehículos por teléfono de cliente
app.get('/api/vehiculos/cliente', async (req, res) => {
    const telefonoCliente = req.query.telefono;
    if (!telefonoCliente) { return res.status(400).json({ success: false, message: 'Número de teléfono es requerido.' }); }
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

// GET /api/clientes/buscar - Buscar cliente por teléfono
app.get('/api/clientes/buscar', async (req, res) => {
    const telefono = req.query.telefono;
    console.log(`Buscando cliente por teléfono: ${telefono}`);
    if (!telefono || !/^[0-9]{7,15}$/.test(telefono)) { return res.status(400).json({ success: false, message: 'Número de teléfono inválido.' }); }
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


// GET /api/vehiculos - Obtener lista de vehículos
app.get('/api/vehiculos', async (req, res) => {
    const placaQuery = req.query.placa;
    console.log(`Petición GET /api/vehiculos recibida. Buscando placa: ${placaQuery || 'Todos'}`);
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

// POST /api/vehiculos - Añadir un nuevo vehículo
app.post('/api/vehiculos', async (req, res) => {
    console.log('Datos recibidos para nuevo vehículo:', req.body);
    const { placa_vehiculo, marca_vehiculo, modelo_vehiculo, ano_vehiculo, id_cliente } = req.body;
    if (!placa_vehiculo || !marca_vehiculo || !modelo_vehiculo || !ano_vehiculo || !id_cliente) { return res.status(400).json({ success: false, message: 'Faltan campos obligatorios para el vehículo o el ID del cliente.' }); }
    if (isNaN(parseInt(id_cliente))) { return res.status(400).json({ success: false, message: 'El ID del cliente proporcionado no es válido.' }); }

    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.beginTransaction();
        const [clienteExiste] = await connection.query('SELECT id_cliente FROM Clientes WHERE id_cliente = ?', [id_cliente]);
        if (clienteExiste.length === 0) { await connection.rollback(); return res.status(404).json({ success: false, message: 'Error: El cliente especificado no existe.' }); }
        const [placaExistente] = await connection.query('SELECT id_vehiculo FROM Vehiculos WHERE placa = ?', [placa_vehiculo.toUpperCase()]);
        if (placaExistente.length > 0) { await connection.rollback(); return res.status(409).json({ success: false, message: 'Error: La placa del vehículo ya está registrada.' }); }
        const sqlInsert = `INSERT INTO Vehiculos (id_cliente, marca, modelo, ano, placa) VALUES (?, ?, ?, ?, ?)`;
        const insertParams = [ id_cliente, marca_vehiculo, modelo_vehiculo, ano_vehiculo, placa_vehiculo.toUpperCase() ];
        const [result] = await connection.query(sqlInsert, insertParams);
        const nuevoVehiculoId = result.insertId;
        await connection.commit();
        return res.status(201).json({ success: true, message: 'Vehículo añadido exitosamente.', vehiculoId: nuevoVehiculoId });
    } catch (error) {
        console.error('Error al añadir vehículo:', error);
        if (connection) await connection.rollback();
        // Manejo de error duplicado mejorado
        if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
            let campoDuplicado = 'desconocido';
            const match = error.message.match(/for key '(.+?)'/);
            if (match && match[1]) { const keyName = match[1]; if (keyName.toLowerCase().includes('placa')) campoDuplicado = 'Placa'; else campoDuplicado = keyName; }
            return res.status(409).json({ success: false, message: `Error: El valor para '${campoDuplicado}' ya existe.` });
        }
        return res.status(500).json({ success: false, message: 'Error interno al añadir el vehículo.' });
    } finally {
        if (connection) connection.release();
    }
});

// PUT /api/vehiculos/:id - Actualizar un vehículo existente
app.put('/api/vehiculos/:id', async (req, res) => {
    const vehiculoId = req.params.id;
    console.log(`Petición PUT recibida para actualizar vehículo ID: ${vehiculoId}`);
    const { placa_vehiculo, marca_vehiculo, modelo_vehiculo, ano_vehiculo } = req.body;
    if (isNaN(parseInt(vehiculoId))) { return res.status(400).json({ success: false, message: 'ID de vehículo inválido.' }); }
    if (!placa_vehiculo || !marca_vehiculo || !modelo_vehiculo || !ano_vehiculo) { return res.status(400).json({ success: false, message: 'Todos los campos del vehículo son requeridos para actualizar.' }); }

    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.beginTransaction();
        const [placaExistente] = await connection.query( 'SELECT id_vehiculo FROM Vehiculos WHERE placa = ? AND id_vehiculo != ?', [placa_vehiculo.toUpperCase(), vehiculoId] );
        if (placaExistente.length > 0) { await connection.rollback(); return res.status(409).json({ success: false, message: 'Error: La nueva placa ya está registrada en otro vehículo.' }); }
        const sqlUpdate = `UPDATE Vehiculos SET placa = ?, marca = ?, modelo = ?, ano = ? WHERE id_vehiculo = ?`;
        const updateParams = [ placa_vehiculo.toUpperCase(), marca_vehiculo, modelo_vehiculo, ano_vehiculo, vehiculoId ];
        const [result] = await connection.query(sqlUpdate, updateParams);
        await connection.commit();
        if (result.affectedRows > 0) { return res.status(200).json({ success: true, message: 'Vehículo actualizado exitosamente.' }); }
        else if (result.changedRows > 0) { return res.status(200).json({ success: true, message: 'No se realizaron cambios (datos iguales).' }); }
        else { return res.status(404).json({ success: false, message: 'Vehículo no encontrado.' }); }
    } catch (error) {
        console.error(`Error al actualizar vehículo ID: ${vehiculoId}:`, error);
        if (connection) await connection.rollback();
         if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
             let campoDuplicado = 'desconocido';
             const match = error.message.match(/for key '(.+?)'/);
             if (match && match[1]) { const keyName = match[1]; if (keyName.toLowerCase().includes('placa')) campoDuplicado = 'Placa'; else campoDuplicado = keyName; }
             return res.status(409).json({ success: false, message: `Error: El valor para '${campoDuplicado}' ya existe.` });
        }
        return res.status(500).json({ success: false, message: 'Error interno al actualizar el vehículo.' });
    } finally {
        if (connection) connection.release();
    }
});

// DELETE /api/vehiculos/:id - Eliminar un vehículo
app.delete('/api/vehiculos/:id', async (req, res) => {
    const vehiculoId = req.params.id;
    console.log(`Petición DELETE recibida para vehículo ID: ${vehiculoId}`);
    if (isNaN(parseInt(vehiculoId))) { return res.status(400).json({ success: false, message: 'ID de vehículo inválido.' }); }

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
         if (error.code === 'ER_ROW_IS_REFERENCED_2') { return res.status(409).json({ success: false, message: 'Error: No se puede eliminar el vehículo porque está referenciado en otras tablas.' }); }
        return res.status(500).json({ success: false, message: 'Error interno al eliminar el vehículo.' });
    } finally {
        if (connection) connection.release();
    }
});

// --- Rutas API para CONTADORES del Dashboard ---
// (Las rutas de contadores existentes van aquí... sin cambios)
// GET /api/vehiculos/count - Contar total de vehículos
app.get('/api/vehiculos/count', async (req, res) => {
    console.log("Petición GET /api/vehiculos/count recibida.");
    let connection;
    try {
        connection = await dbPool.getConnection();
        const [rows] = await connection.query('SELECT COUNT(*) as total FROM Vehiculos');
        console.log(`Total vehículos contados: ${rows[0].total}`);
        res.json({ success: true, total: rows[0].total });
    } catch (error) {
        console.error('Error al contar vehículos:', error);
        res.status(500).json({ success: false, message: 'Error interno al contar vehículos.' });
    } finally {
        if (connection) connection.release();
    }
});

// GET /api/clientes/count - Contar total de clientes
app.get('/api/clientes/count', async (req, res) => {
    console.log("Petición GET /api/clientes/count recibida.");
    let connection;
    try {
        connection = await dbPool.getConnection();
        const [rows] = await connection.query('SELECT COUNT(*) as total FROM Clientes');
        console.log(`Total clientes contados: ${rows[0].total}`);
        res.json({ success: true, total: rows[0].total });
    } catch (error) {
        console.error('Error al contar clientes:', error);
        res.status(500).json({ success: false, message: 'Error interno al contar clientes.' });
    } finally {
        if (connection) connection.release();
    }
});


// 7. Iniciar el Servidor
app.listen(port, () => {
    console.log(`Servidor backend escuchando en http://localhost:${port}`);
});

// 8. Manejar cierre ordenado (Ctrl+C)
process.on('SIGINT', async () => {
    console.log('Cerrando servidor...');
    try {
        await dbPool.end();
        console.log('Pool de conexiones de la base de datos cerrado.');
    } catch(err) {
        console.error('Error al cerrar el pool de conexiones:', err);
    }
    process.exit(0);
});