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

// --- Ruta API para GUARDAR una NUEVA CITA (POST /api/citas) ---
// MODIFICADO: Añadir creado_por_id y estado Pendiente
app.post('/api/citas', async (req, res) => {
    console.log('Datos recibidos para nueva cita:', req.body);
    const {
        nombres_cliente, apellidos_cliente, email_cliente, telefono_cliente,
        vehiculo_registrado_id, is_new_vehicle, marca_vehiculo, modelo_vehiculo,
        ano_vehiculo, placa_vehiculo, kilometraje, servicio_id,
        detalle_sintomas, fecha_cita, hora_cita,
        userId // Recibir ID del usuario que crea la cita
    } = req.body;

    // --- Validación ---
    if (!userId) {
        return res.status(400).json({ success: false, message: 'Falta información del usuario creador.' });
    }
    if (!nombres_cliente || !apellidos_cliente || !telefono_cliente || !fecha_cita || !hora_cita) {
         return res.status(400).json({ success: false, message: 'Faltan campos obligatorios del cliente o de la cita.' });
    }
    if (is_new_vehicle === '1' && (!marca_vehiculo || !modelo_vehiculo || !ano_vehiculo || !placa_vehiculo)) {
        return res.status(400).json({ success: false, message: 'Faltan campos obligatorios para registrar el nuevo vehículo.' });
    }
    if (is_new_vehicle !== '1' && !vehiculo_registrado_id) {
         return res.status(400).json({ success: false, message: 'Debe seleccionar un vehículo existente o añadir uno nuevo.' });
     }
     if (!servicio_id || (isNaN(parseInt(servicio_id)) && servicio_id !== 'otros')) {
        return res.status(400).json({ success: false, message: 'Debe seleccionar un servicio válido.' });
     }

    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.beginTransaction();

        let clienteId;
        let vehiculoId;

        // --- Paso 1: Manejar Cliente ---
        const [clientesExistentes] = await connection.query( 'SELECT id_cliente FROM Clientes WHERE telefono = ?', [telefono_cliente] );
        if (clientesExistentes.length > 0) {
            clienteId = clientesExistentes[0].id_cliente;
            console.log(`Cliente existente encontrado con ID: ${clienteId}`);
        } else {
            console.log("Insertando nuevo cliente...");
            const [clienteResult] = await connection.query( 'INSERT INTO Clientes (nombres, apellidos, email, telefono) VALUES (?, ?, ?, ?)', [nombres_cliente, apellidos_cliente, email_cliente || null, telefono_cliente] );
            clienteId = clienteResult.insertId;
            console.log(`Nuevo cliente insertado con ID: ${clienteId}`);
        }

        // --- Paso 2: Manejar Vehículo ---
         if (is_new_vehicle === '1') {
             console.log("Insertando nuevo vehículo...");
             const [placaExistente] = await connection.query('SELECT id_vehiculo FROM Vehiculos WHERE placa = ?', [placa_vehiculo.toUpperCase()]); // Convertir a mayúsculas
             if(placaExistente.length > 0) { await connection.rollback(); return res.status(409).json({ success: false, message: 'Error: Ya existe un vehículo registrado con esa placa.' }); }
             const [vehiculoResult] = await connection.query( 'INSERT INTO Vehiculos (id_cliente, marca, modelo, ano, placa) VALUES (?, ?, ?, ?, ?)', [clienteId, marca_vehiculo, modelo_vehiculo, ano_vehiculo, placa_vehiculo.toUpperCase()] ); // Guardar en mayúsculas
             vehiculoId = vehiculoResult.insertId;
             console.log(`Nuevo vehículo insertado con ID: ${vehiculoId}`);
         } else {
             vehiculoId = vehiculo_registrado_id;
             console.log(`Usando vehículo existente con ID: ${vehiculoId}`);
             const [vehiculoValido] = await connection.query( 'SELECT id_vehiculo FROM Vehiculos WHERE id_vehiculo = ? AND id_cliente = ?', [vehiculoId, clienteId] );
             if (vehiculoValido.length === 0) { await connection.rollback(); return res.status(400).json({ success: false, message: 'Error: El vehículo seleccionado no pertenece al cliente indicado.' }); }
         }

        // --- Paso 3: Insertar la Cita ---
        let servicioParaGuardar = null;
        if (servicio_id && servicio_id !== 'otros' && !isNaN(parseInt(servicio_id))) { servicioParaGuardar = `Servicio ID: ${servicio_id}`; }
        else if (servicio_id === 'otros') { servicioParaGuardar = "Otros servicios / Diagnóstico"; }

        const estadoInicial = 'Pendiente'; // Estado inicial Pendiente

        const sqlInsertCita = `
            INSERT INTO Citas
                (id_cliente, id_vehiculo, fecha_cita, hora_cita, kilometraje,
                 servicio_principal, motivo_detalle, estado, creado_por_id, fecha_creacion)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `;
        const insertParams = [
            clienteId, vehiculoId, fecha_cita, hora_cita, kilometraje || null,
            servicioParaGuardar, detalle_sintomas || null, estadoInicial, userId
        ];

        const [citaResult] = await connection.query(sqlInsertCita, insertParams);
        const citaId = citaResult.insertId;
        console.log(`Cita insertada con ID: ${citaId}, estado: ${estadoInicial}, creada por User ID: ${userId}`);

        await connection.commit();
        console.log("Transacción completada exitosamente.");

        return res.status(201).json({ success: true, message: 'Cita registrada exitosamente (Pendiente).', citaId: citaId });

    } catch (error) {
        console.error('Error durante la transacción de base de datos (/api/citas):', error);
        if (connection) await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY') {
             if (error.message.includes('Vehiculos.placa')) { return res.status(409).json({ success: false, message: 'Error: Ya existe un vehículo registrado con esa placa.' }); }
             else if (error.message.includes('Clientes.email') && email_cliente) { return res.status(409).json({ success: false, message: 'Error: Ya existe un cliente registrado con ese email.' }); }
             else if (error.message.includes('Clientes.telefono')) { return res.status(409).json({ success: false, message: 'Error: Ya existe un cliente registrado con ese teléfono.' }); }
             else { return res.status(409).json({ success: false, message: 'Error: Conflicto de datos duplicados.' }); }
        } else if (error.code === 'ER_NO_REFERENCED_ROW_2') { return res.status(400).json({ success: false, message: 'Error: El cliente o el vehículo seleccionado no es válido o no existe.' }); }
        else { return res.status(500).json({ success: false, message: 'Error interno al registrar la cita.' }); }
    } finally {
        if (connection) { connection.release(); }
    }
});


// --- Ruta API para LOGIN de usuario (POST /api/login) ---
app.post('/api/login', async (req, res) => {
    console.log(`--- INTENTO DE LOGIN INICIO ---`);
    console.log('Intento de login recibido:', req.body);
    const { username, password } = req.body;

    if (!username || !password) {
        console.log("Error Login: Falta usuario o contraseña");
        return res.status(400).json({ success: false, message: 'Usuario y contraseña son requeridos.' });
    }

    let connection;
    try {
        console.log("Login: Obteniendo conexión a BD...");
        connection = await dbPool.getConnection();
        console.log("Login: Conexión a BD obtenida.");

        console.log(`Login: Consultando usuario: ${username}`);
        const [rows] = await connection.query(
            'SELECT id_usuario, username, password_hash, nombre_completo, rol FROM Usuarios WHERE username = ?',
            [username]
        );
        console.log(`Login: Consulta finalizada. ${rows.length} usuario(s) encontrado(s).`);

        if (rows.length === 0) {
            console.log(`Login fallido: Usuario no encontrado "${username}"`);
            return res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos.' });
        }

        const user = rows[0];
        console.log(`Login: Usuario encontrado. Comparando contraseña para ID: ${user.id_usuario}`);

        const isPasswordMatch = await bcrypt.compare(password, user.password_hash);
        console.log(`Login: Resultado comparación contraseña: ${isPasswordMatch}`);

        if (isPasswordMatch) {
            console.log(`Login exitoso para usuario: ${user.username}. Enviando respuesta OK.`);
            return res.status(200).json({
                success: true,
                message: 'Inicio de sesión exitoso.',
                user: {
                    id: user.id_usuario, // Devolver el ID del usuario
                    username: user.username,
                    nombre: user.nombre_completo,
                    rol: user.rol
                }
            });
        } else {
            console.log(`Login fallido: Contraseña incorrecta para usuario: ${user.username}.`);
            return res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos.' });
        }

    } catch (error) {
        console.error('Error durante el proceso de login:', error);
        return res.status(500).json({ success: false, message: 'Error interno del servidor durante el inicio de sesión.' });
    } finally {
        if (connection) {
            connection.release();
            console.log("Conexión a BD liberada para /api/login.");
        }
        console.log(`--- INTENTO DE LOGIN FIN ---`);
    }
});

// --- Ruta API para REGISTRO de usuario (POST /api/register) ---
// MODIFICADO: Mejor manejo de error para username duplicado en CATCH
app.post('/api/register', async (req, res) => {
    console.log('Intento de registro recibido:', req.body);
    const { username, password, nombre_completo } = req.body;

    // Validaciones básicas
    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Nombre de usuario y contraseña son requeridos.' });
    }
    if (password.length < 6) {
        return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 6 caracteres.' });
    }
    if (!nombre_completo) {
         return res.status(400).json({ success: false, message: 'El nombre completo es requerido.' });
     }

    let connection;
    try {
        connection = await dbPool.getConnection();
        console.log("Conexión a BD obtenida para registro.");

        // Verificar si ya existe un usuario con el mismo nombre_completo
        console.log(`Verificando si existe usuario con nombre: ${nombre_completo}`);
        const [existingName] = await connection.query(
            'SELECT id_usuario FROM Usuarios WHERE nombre_completo = ?',
            [nombre_completo]
        );

        if (existingName.length > 0) {
            console.log(`Registro fallido: Ya existe un usuario con el nombre "${nombre_completo}".`);
            return res.status(409).json({
                success: false,
                message: 'Error: Ya existe un usuario registrado con ese nombre completo.'
            });
        }

        // Hashear la contraseña
        console.log(`Hasheando contraseña para usuario: ${username}`);
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        console.log(`Contraseña hasheada exitosamente.`);

        // Insertar el nuevo usuario
        console.log("Insertando nuevo usuario...");
        const rolPorDefecto = 'Usuario';
        const [result] = await connection.query(
            'INSERT INTO Usuarios (username, password_hash, nombre_completo, rol) VALUES (?, ?, ?, ?)',
            [username, hashedPassword, nombre_completo, rolPorDefecto]
        );
        console.log(`Usuario registrado exitosamente con ID: ${result.insertId}`);

        return res.status(201).json({
            success: true,
            message: 'Usuario registrado exitosamente.'
        });

    } catch (error) {
        console.error('Error durante el proceso de registro:', error);

        // <<--- MANEJO DE ERROR MEJORADO --->>
        if (error.code === 'ER_DUP_ENTRY' || error.errno === 1062) {
            if (error.message.toLowerCase().includes('\'username\'') || error.message.toLowerCase().includes('usuarios.username')) {
                console.log(`Registro fallido: Username "${username}" ya existe.`);
                return res.status(409).json({
                    success: false,
                    message: 'Error: El nombre de usuario ya está en uso.' // Mensaje descriptivo
                });
            }
            else {
                 return res.status(409).json({
                    success: false,
                    message: 'Error: Conflicto de datos duplicados.' // Mensaje genérico para otros duplicados
                });
            }
        }

        // Otros errores
        return res.status(500).json({
            success: false,
            message: 'Error interno del servidor durante el registro.' // Mensaje genérico para otros errores
        });
    } finally {
        if (connection) {
            connection.release();
            console.log("Conexión a BD liberada para /api/register.");
        }
    }
});


// --- Ruta API para OBTENER vehículos por teléfono del cliente (GET /api/vehiculos/cliente) ---
// Usada principalmente por el formulario de citas para poblar el dropdown
app.get('/api/vehiculos/cliente', async (req, res) => {
    const telefonoCliente = req.query.telefono;
    console.log(`Petición para obtener vehículos por teléfono: ${telefonoCliente}`);

    if (!telefonoCliente) {
        return res.status(400).json({ success: false, message: 'Número de teléfono es requerido.' });
    }

    let connection;
    try {
        connection = await dbPool.getConnection();
        console.log("Conexión a BD obtenida para /api/vehiculos/cliente.");

        const [clientes] = await connection.query(
            'SELECT id_cliente FROM Clientes WHERE telefono = ?',
            [telefonoCliente]
        );

        if (clientes.length === 0) {
            console.log(`Cliente no encontrado para teléfono: ${telefonoCliente}`);
            return res.status(200).json({ success: true, vehicles: [] });
        }

        const clienteId = clientes[0].id_cliente;
        console.log(`Cliente encontrado ID: ${clienteId}. Obteniendo vehículos...`);

        const [vehiculos] = await connection.query(
            'SELECT id_vehiculo, marca, modelo, placa, ano FROM Vehiculos WHERE id_cliente = ? ORDER BY marca, modelo',
            [clienteId]
        );
        console.log(`Encontrados ${vehiculos.length} vehículos para cliente ID: ${clienteId}`);

        return res.status(200).json({ success: true, vehicles: vehiculos });

    } catch (error) {
        console.error('Error al obtener vehículos por teléfono:', error);
        return res.status(500).json({ success: false, message: 'Error al obtener los vehículos del cliente.' });
    } finally {
        if (connection) {
            connection.release();
            console.log("Conexión a BD liberada para /api/vehiculos/cliente.");
        }
    }
});

// --- Ruta API para OBTENER lista de CITAS (GET /api/citas) ---
// MODIFICADO: Añadir JOINs con Usuarios y seleccionar nuevos campos
app.get('/api/citas', async (req, res) => {
    const { fecha_inicio, fecha_fin } = req.query;
    console.log("Petición recibida para GET /api/citas con filtros:", req.query);

    let connection;
    try {
        connection = await dbPool.getConnection();
        console.log("Conexión a BD obtenida para GET /api/citas");

        let sqlQuery = `
            SELECT
                c.id_cita, c.fecha_cita, c.hora_cita, c.kilometraje,
                c.servicio_principal, c.motivo_detalle, c.estado,
                cl.id_cliente, cl.nombres AS nombre_cliente, cl.apellidos AS apellido_cliente,
                cl.telefono AS telefono_cliente, cl.email AS email_cliente,
                v.id_vehiculo, v.marca AS marca_vehiculo, v.modelo AS modelo_vehiculo,
                v.ano AS ano_vehiculo, v.placa AS placa_vehiculo,
                c.fecha_creacion, c.fecha_modificacion,
                uc.username AS creado_por_username,
                um.username AS modificado_por_username
            FROM Citas c
            JOIN Clientes cl ON c.id_cliente = cl.id_cliente
            JOIN Vehiculos v ON c.id_vehiculo = v.id_vehiculo
            LEFT JOIN Usuarios uc ON c.creado_por_id = uc.id_usuario
            LEFT JOIN Usuarios um ON c.modificado_por_id = um.id_usuario
        `;
        const queryParams = [];
        let conditions = [];

        if (fecha_inicio && /^\d{4}-\d{2}-\d{2}$/.test(fecha_inicio)) { conditions.push('c.fecha_cita >= ?'); queryParams.push(fecha_inicio); }
        if (fecha_fin && /^\d{4}-\d{2}-\d{2}$/.test(fecha_fin)) { conditions.push('c.fecha_cita <= ?'); queryParams.push(fecha_fin); }

        if (conditions.length > 0) { sqlQuery += ' WHERE ' + conditions.join(' AND '); }
        sqlQuery += ' ORDER BY c.fecha_cita DESC, c.hora_cita DESC';

        console.log("Ejecutando consulta:", sqlQuery, queryParams);
        const [citas] = await connection.query(sqlQuery, queryParams);
        console.log(`Encontradas ${citas.length} citas con los filtros aplicados.`);

        return res.status(200).json({ success: true, citas: citas });

    } catch (error) {
        console.error('Error al obtener la lista de citas:', error);
        return res.status(500).json({ success: false, message: 'Error al obtener la lista de citas.' });
    } finally {
        if (connection) { connection.release(); }
    }
});

// --- Ruta API para OBTENER una CITA específica por ID (GET /api/citas/:id) ---
// MODIFICADO: Añadir JOINs con Usuarios y seleccionar nuevos campos
app.get('/api/citas/:id', async (req, res) => {
    const citaId = req.params.id;
    console.log(`Request received for GET /api/citas/${citaId}`);

    if (isNaN(parseInt(citaId))) { return res.status(400).json({ success: false, message: 'ID de cita inválido.' }); }

    let connection;
    try {
        connection = await dbPool.getConnection();
        console.log(`DB connection obtained for GET /api/citas/${citaId}`);

        const sqlQuery = `
            SELECT
                c.id_cita, c.fecha_cita, c.hora_cita, c.kilometraje,
                c.servicio_principal, c.motivo_detalle, c.estado,
                c.id_cliente, cl.nombres AS nombre_cliente, cl.apellidos AS apellido_cliente,
                cl.telefono AS telefono_cliente, cl.email AS email_cliente,
                c.id_vehiculo, v.marca AS marca_vehiculo, v.modelo AS modelo_vehiculo,
                v.ano AS ano_vehiculo, v.placa AS placa_vehiculo,
                c.fecha_creacion, c.fecha_modificacion,
                uc.username AS creado_por_username,
                um.username AS modificado_por_username
            FROM Citas c
            JOIN Clientes cl ON c.id_cliente = cl.id_cliente
            JOIN Vehiculos v ON c.id_vehiculo = v.id_vehiculo
            LEFT JOIN Usuarios uc ON c.creado_por_id = uc.id_usuario
            LEFT JOIN Usuarios um ON c.modificado_por_id = um.id_usuario
            WHERE c.id_cita = ?
        `;

        console.log("Executing query:", sqlQuery, [citaId]);
        const [citas] = await connection.query(sqlQuery, [citaId]);

        if (citas.length === 0) {
            console.log(`Appointment ID: ${citaId} not found.`);
            return res.status(404).json({ success: false, message: 'Cita no encontrada.' });
        }

        console.log(`Appointment ID: ${citaId} found.`);
        return res.status(200).json({ success: true, cita: citas[0] });

    } catch (error) {
        console.error(`Error fetching appointment ID: ${citaId}:`, error);
        return res.status(500).json({ success: false, message: 'Error al obtener los detalles de la cita.' });
    } finally {
        if (connection) { connection.release(); }
    }
});


// --- Ruta API para ACTUALIZAR una CITA existente (PUT /api/citas/:id) ---
// MODIFICADO: Añadir modificado_por_id y fecha_modificacion
app.put('/api/citas/:id', async (req, res) => {
    const citaId = req.params.id;
    console.log(`Petición PUT recibida para actualizar cita ID: ${citaId}`);
    console.log('Datos recibidos para actualizar:', req.body);

    const {
        fecha_cita, hora_cita, kilometraje, servicio_id, detalle_sintomas,
        userId // Recibir ID del usuario que modifica
    } = req.body;

    // --- Validación ---
    if (isNaN(parseInt(citaId))) { return res.status(400).json({ success: false, message: 'ID de cita inválido.' }); }
    if (!userId) { return res.status(400).json({ success: false, message: 'Falta información del usuario modificador.' }); }
    if (!fecha_cita || !hora_cita) { return res.status(400).json({ success: false, message: 'La fecha y la hora de la cita son obligatorias.' }); }
    if (!servicio_id || (isNaN(parseInt(servicio_id)) && servicio_id !== 'otros')) { return res.status(400).json({ success: false, message: 'Debe seleccionar un servicio válido.' }); }

    let connection;
    try {
        connection = await dbPool.getConnection();
        console.log(`Conexión a BD obtenida para PUT /api/citas/${citaId}`);

        let servicioParaGuardar = null;
        if (servicio_id && servicio_id !== 'otros' && !isNaN(parseInt(servicio_id))) { servicioParaGuardar = `Servicio ID: ${servicio_id}`; }
        else if (servicio_id === 'otros') { servicioParaGuardar = "Otros servicios / Diagnóstico"; }

        const sqlQuery = `
            UPDATE Citas SET
                fecha_cita = ?,
                hora_cita = ?,
                kilometraje = ?,
                servicio_principal = ?,
                motivo_detalle = ?,
                modificado_por_id = ?,
                fecha_modificacion = NOW()
            WHERE id_cita = ?
        `;
        const queryParams = [
            fecha_cita, hora_cita, kilometraje || null,
            servicioParaGuardar, detalle_sintomas || null,
            userId,
            citaId
        ];

        console.log("Ejecutando consulta UPDATE:", sqlQuery, queryParams);
        const [result] = await connection.query(sqlQuery, queryParams);
        console.log("Resultado de la actualización:", result);

        if (result.affectedRows > 0) {
            console.log(`Cita ID: ${citaId} actualizada exitosamente por User ID: ${userId}.`);
            return res.status(200).json({ success: true, message: 'Cita actualizada exitosamente.' });
        } else if (result.changedRows > 0) {
             console.log(`Cita ID: ${citaId} encontrada pero no se realizaron cambios (datos iguales).`);
             return res.status(200).json({ success: true, message: 'No se realizaron cambios (datos iguales).' });
        }
        else {
            console.log(`Actualización fallida: Cita ID: ${citaId} no encontrada.`);
            return res.status(404).json({ success: false, message: 'Cita no encontrada.' });
        }

    } catch (error) {
        console.error(`Error al actualizar cita ID: ${citaId}:`, error);
        return res.status(500).json({ success: false, message: 'Error interno al actualizar la cita.' });
    } finally {
        if (connection) { connection.release(); }
    }
});


// --- Ruta API para CANCELAR una cita (PATCH /api/citas/:id/cancelar) ---
// MODIFICADO: Añadir modificado_por_id y fecha_modificacion
app.patch('/api/citas/:id/cancelar', async (req, res) => {
    const citaId = req.params.id;
    const userId = req.body.userId || null;
    console.log(`Petición recibida para cancelar cita ID: ${citaId} por User ID: ${userId || 'Sistema'}`);

    if (isNaN(parseInt(citaId))) { return res.status(400).json({ success: false, message: 'ID de cita inválido.' }); }

    let connection;
    try {
        connection = await dbPool.getConnection();
        console.log("Conexión a BD obtenida para PATCH /api/citas/:id/cancelar");

        const [result] = await connection.query(
            "UPDATE Citas SET estado = 'Cancelada', modificado_por_id = ?, fecha_modificacion = NOW() WHERE id_cita = ?",
            [userId, citaId]
        );
        console.log("Resultado de la actualización (cancelar):", result);

        if (result.affectedRows > 0) {
            console.log(`Cita ID: ${citaId} cancelada exitosamente.`);
            return res.status(200).json({ success: true, message: 'Cita cancelada exitosamente.' });
        } else {
            console.log(`Cancelación fallida: Cita ID: ${citaId} no encontrada.`);
            return res.status(404).json({ success: false, message: 'Cita no encontrada.' });
        }

    } catch (error) {
        console.error(`Error al cancelar cita ID: ${citaId}:`, error);
        return res.status(500).json({ success: false, message: 'Error interno al cancelar la cita.' });
    } finally {
        if (connection) { connection.release(); }
    }
});

// --- Ruta API para COMPLETAR una cita (PATCH /api/citas/:id/completar) ---
// MODIFICADO: Añadir modificado_por_id y fecha_modificacion
app.patch('/api/citas/:id/completar', async (req, res) => {
    const citaId = req.params.id;
    const userId = req.body.userId || null;
    console.log(`Petición recibida para completar cita ID: ${citaId} por User ID: ${userId || 'Sistema'}`);

    if (isNaN(parseInt(citaId))) { return res.status(400).json({ success: false, message: 'ID de cita inválido.' }); }

    let connection;
    try {
        connection = await dbPool.getConnection();
        console.log("Conexión a BD obtenida para PATCH /api/citas/:id/completar");

        const [result] = await connection.query(
            "UPDATE Citas SET estado = 'Completada', modificado_por_id = ?, fecha_modificacion = NOW() WHERE id_cita = ?",
            [userId, citaId]
        );
        console.log("Resultado de la actualización (completar):", result);

        if (result.affectedRows > 0) {
            console.log(`Cita ID: ${citaId} marcada como completada exitosamente.`);
            return res.status(200).json({ success: true, message: 'Cita marcada como completada.' });
        } else {
            console.log(`Completar fallido: Cita ID: ${citaId} no encontrada.`);
            return res.status(404).json({ success: false, message: 'Cita no encontrada.' });
        }

    } catch (error) {
        console.error(`Error al completar cita ID: ${citaId}:`, error);
        return res.status(500).json({ success: false, message: 'Error interno al completar la cita.' });
    } finally {
        if (connection) { connection.release(); }
    }
});


// --- Ruta API para OBTENER todos los servicios activos (GET /api/servicios) ---
app.get('/api/servicios', async (req, res) => {
    console.log("Petición recibida para GET /api/servicios");
    let connection;
    try {
        connection = await dbPool.getConnection();
        console.log("Conexión a BD obtenida para GET /api/servicios");

        const [servicios] = await connection.query(
            "SELECT id_servicio, nombre_servicio FROM Servicios WHERE activo = TRUE ORDER BY nombre_servicio"
        );
        console.log(`Encontrados ${servicios.length} servicios activos.`);

        return res.status(200).json({ success: true, servicios: servicios });

    } catch (error) {
        console.error('Error al obtener servicios:', error);
        return res.status(500).json({ success: false, message: 'Error al obtener la lista de servicios.' });
    } finally {
        if (connection) {
            connection.release();
            console.log("Conexión a BD liberada para GET /api/servicios.");
        }
    }
});


// --- Rutas API para VEHÍCULOS ---

// GET /api/vehiculos - Obtener lista de vehículos (con filtro opcional por placa)
app.get('/api/vehiculos', async (req, res) => {
    const placaQuery = req.query.placa;
    console.log(`Petición GET /api/vehiculos recibida. Buscando placa: ${placaQuery || 'Todos'}`);

    let connection;
    try {
        connection = await dbPool.getConnection();
        let sqlQuery = `
            SELECT
                v.id_vehiculo, v.placa AS placa_vehiculo, v.marca AS marca_vehiculo,
                v.modelo AS modelo_vehiculo, v.ano AS ano_vehiculo,
                v.id_cliente, cl.nombres AS nombre_cliente, cl.apellidos AS apellido_cliente
            FROM Vehiculos v
            JOIN Clientes cl ON v.id_cliente = cl.id_cliente
        `;
        const queryParams = [];

        if (placaQuery) {
            sqlQuery += ' WHERE v.placa LIKE ?';
            queryParams.push(`${placaQuery}%`);
        }

        sqlQuery += ' ORDER BY cl.apellidos, cl.nombres, v.marca, v.modelo';

        console.log("Ejecutando consulta:", sqlQuery, queryParams);
        const [vehiculos] = await connection.query(sqlQuery, queryParams);
        console.log(`Encontrados ${vehiculos.length} vehículos.`);

        return res.status(200).json({ success: true, vehiculos: vehiculos });

    } catch (error) {
        console.error('Error al obtener la lista de vehículos:', error);
        return res.status(500).json({ success: false, message: 'Error al obtener la lista de vehículos.' });
    } finally {
        if (connection) { connection.release(); }
    }
});

// POST /api/vehiculos - Añadir un nuevo vehículo asociado a un cliente existente
app.post('/api/vehiculos', async (req, res) => {
    console.log('Datos recibidos para nuevo vehículo:', req.body);
    const {
        placa_vehiculo, marca_vehiculo, modelo_vehiculo, ano_vehiculo,
        id_cliente
    } = req.body;

    // Validaciones
    if (!placa_vehiculo || !marca_vehiculo || !modelo_vehiculo || !ano_vehiculo || !id_cliente) {
        return res.status(400).json({ success: false, message: 'Faltan campos obligatorios para el vehículo o el ID del cliente.' });
    }
    if (isNaN(parseInt(id_cliente))) {
         return res.status(400).json({ success: false, message: 'El ID del cliente proporcionado no es válido.' });
    }

    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.beginTransaction();

        // 1. Verificar si el cliente existe
        const [clienteExiste] = await connection.query('SELECT id_cliente FROM Clientes WHERE id_cliente = ?', [id_cliente]);
        if (clienteExiste.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Error: El cliente especificado no existe.' });
        }

        // 2. Verificar si la placa ya existe
        const [placaExistente] = await connection.query('SELECT id_vehiculo FROM Vehiculos WHERE placa = ?', [placa_vehiculo.toUpperCase()]);
        if (placaExistente.length > 0) {
            await connection.rollback();
            return res.status(409).json({ success: false, message: 'Error: Ya existe un vehículo registrado con esa placa.' });
        }

        // 3. Insertar el vehículo
        const sqlInsert = `
            INSERT INTO Vehiculos (id_cliente, marca, modelo, ano, placa)
            VALUES (?, ?, ?, ?, ?)
        `;
        const insertParams = [
            id_cliente, marca_vehiculo, modelo_vehiculo, ano_vehiculo, placa_vehiculo.toUpperCase()
        ];
        const [result] = await connection.query(sqlInsert, insertParams);
        const nuevoVehiculoId = result.insertId;

        await connection.commit();
        console.log(`Nuevo vehículo insertado con ID: ${nuevoVehiculoId} para Cliente ID: ${id_cliente}`);
        return res.status(201).json({ success: true, message: 'Vehículo añadido exitosamente.', vehiculoId: nuevoVehiculoId });

    } catch (error) {
        console.error('Error al añadir vehículo:', error);
        if (connection) await connection.rollback();
        if (error.code === 'ER_DUP_ENTRY' && error.message.includes('placa')) {
             return res.status(409).json({ success: false, message: 'Error: Ya existe un vehículo registrado con esa placa.' });
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
    console.log('Datos recibidos para actualizar:', req.body);

    const { placa_vehiculo, marca_vehiculo, modelo_vehiculo, ano_vehiculo } = req.body;

    // Validaciones
    if (isNaN(parseInt(vehiculoId))) {
        return res.status(400).json({ success: false, message: 'ID de vehículo inválido.' });
    }
    if (!placa_vehiculo || !marca_vehiculo || !modelo_vehiculo || !ano_vehiculo) {
        return res.status(400).json({ success: false, message: 'Todos los campos del vehículo son requeridos para actualizar.' });
    }

    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.beginTransaction();

        // Verificar si la nueva placa (si cambió) ya existe en OTRO vehículo
        const [placaExistente] = await connection.query(
            'SELECT id_vehiculo FROM Vehiculos WHERE placa = ? AND id_vehiculo != ?',
            [placa_vehiculo.toUpperCase(), vehiculoId]
        );
        if (placaExistente.length > 0) {
            await connection.rollback();
            return res.status(409).json({ success: false, message: 'Error: La nueva placa ya está registrada en otro vehículo.' });
        }

        // Actualizar vehículo
        const sqlUpdate = `
            UPDATE Vehiculos SET
                placa = ?,
                marca = ?,
                modelo = ?,
                ano = ?
            WHERE id_vehiculo = ?
        `;
        const updateParams = [
            placa_vehiculo.toUpperCase(), marca_vehiculo, modelo_vehiculo, ano_vehiculo, vehiculoId
        ];
        const [result] = await connection.query(sqlUpdate, updateParams);

        await connection.commit();

        if (result.affectedRows > 0) {
            console.log(`Vehículo ID: ${vehiculoId} actualizado.`);
            return res.status(200).json({ success: true, message: 'Vehículo actualizado exitosamente.' });
        } else if (result.changedRows > 0) {
             console.log(`Vehículo ID: ${vehiculoId} encontrado pero no se realizaron cambios (datos iguales).`);
             return res.status(200).json({ success: true, message: 'No se realizaron cambios (datos iguales).' });
        }
        else {
            console.log(`Actualización fallida: Vehículo ID: ${vehiculoId} no encontrado.`);
            return res.status(404).json({ success: false, message: 'Vehículo no encontrado.' });
        }

    } catch (error) {
        console.error(`Error al actualizar vehículo ID: ${vehiculoId}:`, error);
        if (connection) await connection.rollback();
         if (error.code === 'ER_DUP_ENTRY' && error.message.includes('placa')) {
             return res.status(409).json({ success: false, message: 'Error: La nueva placa ya está registrada en otro vehículo.' });
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

    if (isNaN(parseInt(vehiculoId))) {
        return res.status(400).json({ success: false, message: 'ID de vehículo inválido.' });
    }

    let connection;
    try {
        connection = await dbPool.getConnection();
        await connection.beginTransaction();

        // Opcional: Verificar si el vehículo tiene citas asociadas antes de borrar
        const [citasAsociadas] = await connection.query(
            'SELECT COUNT(*) as count FROM Citas WHERE id_vehiculo = ?', [vehiculoId]
        );
        if (citasAsociadas[0].count > 0) {
            await connection.rollback();
            return res.status(409).json({ success: false, message: 'Error: No se puede eliminar el vehículo porque tiene citas asociadas.' });
        }

        // Eliminar vehículo
        const [result] = await connection.query('DELETE FROM Vehiculos WHERE id_vehiculo = ?', [vehiculoId]);

        await connection.commit();

        if (result.affectedRows > 0) {
            console.log(`Vehículo ID: ${vehiculoId} eliminado.`);
            return res.status(200).json({ success: true, message: 'Vehículo eliminado exitosamente.' });
        } else {
            console.log(`Eliminación fallida: Vehículo ID: ${vehiculoId} no encontrado.`);
            return res.status(404).json({ success: false, message: 'Vehículo no encontrado.' });
        }

    } catch (error) {
        console.error(`Error al eliminar vehículo ID: ${vehiculoId}:`, error);
        if (connection) await connection.rollback();
         if (error.code === 'ER_ROW_IS_REFERENCED_2') {
             return res.status(409).json({ success: false, message: 'Error: No se puede eliminar el vehículo porque está referenciado en otras tablas.' });
         }
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
