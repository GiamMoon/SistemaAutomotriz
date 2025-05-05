// server.js

// 1. Importar librerías necesarias
const express = require('express');
const mysql = require('mysql2/promise'); // Usar la versión promise
const bcrypt = require('bcrypt');
const cors = require('cors');

// 2. Inicializar la aplicación Express
const app = express();
const port = 3000; // Puerto donde correrá el servidor

// 3. Middleware
app.use(cors()); // Habilitar CORS para permitir peticiones desde el frontend
app.use(express.json()); // Para parsear cuerpos de petición JSON
app.use(express.urlencoded({ extended: true })); // Para parsear cuerpos de petición URL-encoded

// 4. Configuración de la Conexión a la Base de Datos
const dbPool = mysql.createPool({
    connectionLimit: 10, // Número máximo de conexiones en el pool
    host: 'localhost', // Host de la base de datos
    user: 'root', // Usuario de la base de datos
    password: 'root', // Contraseña de la base de datos
    database: 'servicio_automotriz', // Nombre de la base de datos
    waitForConnections: true, // Esperar si no hay conexiones disponibles
    queueLimit: 0, // Sin límite en la cola de espera
    // Importante para devolver fechas como strings y no objetos Date
    dateStrings: true
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
const saltRounds = 10; // Factor de coste para bcrypt (más alto = más seguro pero más lento)

// 6. Definir Rutas de la API

// Ruta de prueba para la raíz
app.get('/', (req, res) => {
    res.send('¡Bienvenido al Backend del Servicio Automotriz!');
});

// --- Rutas API para CITAS ---

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
        return res.status(201).json({ success: true, message: 'Cita registrada exitosamente', citaId: citaId });

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
        else if (result.changedRows > 0) { return res.status(200).json({ success: true, message: 'No se realizaron cambios (datos iguales).' }); }
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
        const [rows] = await connection.query( 'SELECT id_usuario, username, password_hash, nombre_completo, rol FROM Usuarios WHERE username = ?', [username] );
        if (rows.length === 0) { return res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos.' }); }
        const user = rows[0];
        const isPasswordMatch = await bcrypt.compare(password, user.password_hash);
        if (isPasswordMatch) { return res.status(200).json({ success: true, message: 'Inicio de sesión exitoso.', user: { id: user.id_usuario, username: user.username, nombre: user.nombre_completo, rol: user.rol } }); }
        else { return res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos.' }); }
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
                // Asumiendo que el índice unique de username se llama 'username' o similar
                if (keyName.toLowerCase().includes('username') || keyName.toLowerCase().includes('usuarios.username')) { // Ser más flexible con el nombre del índice
                    campoDuplicado = 'Nombre de Usuario';
                     return res.status(409).json({ success: false, message: `Error: El ${campoDuplicado} ya está en uso.` });
                }
                 else { campoDuplicado = keyName; } // Usar nombre del índice si no es username
            }
            // Mensaje genérico si no se identifica el campo específico
            return res.status(409).json({ success: false, message: `Error: Conflicto de datos duplicados para '${campoDuplicado}'.` });
        }
        // Otros errores
        return res.status(500).json({ success: false, message: 'Error interno del servidor durante el registro.' });
    } finally {
        if (connection) { connection.release(); }
    }
});

// --- Rutas API para SERVICIOS ---

// GET /api/servicios - Obtener lista de servicios activos
app.get('/api/servicios', async (req, res) => {
    console.log("Petición recibida para GET /api/servicios");
    let connection;
    try {
        connection = await dbPool.getConnection();
        const [servicios] = await connection.query( "SELECT id_servicio, nombre_servicio FROM Servicios WHERE activo = TRUE ORDER BY nombre_servicio" );
        return res.status(200).json({ success: true, servicios: servicios });
    } catch (error) {
        console.error('Error al obtener servicios:', error);
        return res.status(500).json({ success: false, message: 'Error al obtener la lista de servicios.' });
    } finally {
        if (connection) { connection.release(); }
    }
});

// --- Rutas API para VEHÍCULOS ---

// GET /api/vehiculos/cliente - Obtener vehículos por teléfono de cliente (para formulario de citas)
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
    } catch (error) {
        console.error('Error al obtener vehículos por teléfono:', error);
        return res.status(500).json({ success: false, message: 'Error al obtener los vehículos del cliente.' });
    } finally {
        if (connection) { connection.release(); }
    }
});

// GET /api/clientes/buscar - Buscar cliente por teléfono (para modal de vehículos)
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
    } catch (error) {
        console.error("Error buscando cliente por teléfono:", error);
        return res.status(500).json({ success: false, message: 'Error interno al buscar cliente.' });
    } finally {
        if (connection) connection.release();
    }
});


// GET /api/vehiculos - Obtener lista de vehículos (con filtro opcional por placa)
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

// POST /api/vehiculos - Añadir un nuevo vehículo asociado a un cliente existente
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
        if (placaExistente.length > 0) { await connection.rollback(); return res.status(409).json({ success: false, message: 'Error: La placa del vehículo ya está registrada.' }); } // Mensaje específico
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
            if (match && match[1]) {
                const keyName = match[1];
                if (keyName.toLowerCase().includes('placa')) campoDuplicado = 'Placa';
                else campoDuplicado = keyName;
            }
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
        // Manejo de error duplicado mejorado
         if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
             let campoDuplicado = 'desconocido';
             const match = error.message.match(/for key '(.+?)'/);
             if (match && match[1]) {
                 const keyName = match[1];
                 if (keyName.toLowerCase().includes('placa')) campoDuplicado = 'Placa';
                 else campoDuplicado = keyName;
             }
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
