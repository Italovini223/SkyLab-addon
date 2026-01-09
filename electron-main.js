
/**
 * main.js - SkyLink OCC Integrated Operations with SQLite Persistence
 */

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { SimConnect, SimConnectPeriod, SimConnectDataType } = require('node-simconnect');
const sqlite3 = require('sqlite3').verbose();

let mainWindow;
let simConnect = null;
let lastOnGround = true;
let db;

// Inicialização do Banco de Dados SQLite
function initDatabase() {
    const dbPath = path.join(app.getPath('userData'), 'skylink_va.sqlite');
    db = new sqlite3.Database(dbPath, (err) => {
        if (err) console.error('Database Error:', err.message);
        else console.log('SkyLink OCC: Database linked at', dbPath);
    });

    db.serialize(() => {
        // Tabela de Rotas Sugeridas (Cache para busca rápida)
        db.run(`CREATE TABLE IF NOT EXISTS suggested_routes (
            id TEXT PRIMARY KEY,
            origin TEXT,
            destination TEXT,
            distance INTEGER,
            airline_type TEXT
        )`);

        // Tabela de Frota para persistência de localização
        db.run(`CREATE TABLE IF NOT EXISTS fleet_status (
            aircraft_id TEXT PRIMARY KEY,
            location TEXT,
            total_hours REAL,
            last_update INTEGER
        )`);
    });
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1440,
        height: 900,
        backgroundColor: '#020617',
        webPreferences: {
            preload: path.join(__dirname, 'electron-preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.loadFile('index.html');

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });
}

async function setupSimConnect() {
    try {
        simConnect = new SimConnect();
        
        simConnect.on('connected', () => {
            console.log('SkyLink OCC: Link established');
            if (mainWindow) {
                mainWindow.webContents.send('flight-event', 'info', { message: 'MSFS Conectado com Sucesso!' });
            }
            
            simConnect.subscribeToDataDefinition([
                ['PLANE ALTITUDE', 'Feet', SimConnectDataType.FLOAT64],
                ['GROUND VELOCITY', 'Knots', SimConnectDataType.FLOAT64],
                ['VERTICAL SPEED', 'Feet per minute', SimConnectDataType.FLOAT64],
                ['FUEL TOTAL QUANTITY WEIGHT', 'Pounds', SimConnectDataType.FLOAT64],
                ['PLANE LATITUDE', 'Degrees', SimConnectDataType.FLOAT64],
                ['PLANE LONGITUDE', 'Degrees', SimConnectDataType.FLOAT64],
                ['SIM ON GROUND', 'Bool', SimConnectDataType.INT32],
                ['ENG COMBUSTION:1', 'Bool', SimConnectDataType.INT32],
                ['BRAKE PARKING INDICATOR', 'Bool', SimConnectDataType.INT32],
                ['GEAR HANDLE POSITION', 'Bool', SimConnectDataType.INT32]
            ], SimConnectPeriod.SECOND);
        });

        simConnect.on('data', (data) => {
            const onGround = !!data['SIM ON GROUND'];
            if (lastOnGround && !onGround) {
                mainWindow.webContents.send('flight-event', 'info', { message: 'Decolagem Detectada! Boa Viagem.' });
            }
            if (!lastOnGround && onGround) {
                mainWindow.webContents.send('flight-event', 'success', { message: 'Toque na pista detectado! Bem-vindo.' });
            }
            lastOnGround = onGround;

            const payload = {
                altitude: Math.round(data['PLANE ALTITUDE']),
                groundSpeed: Math.round(data['GROUND VELOCITY']),
                verticalSpeed: Math.round(data['VERTICAL SPEED']),
                totalFuel: data['FUEL TOTAL QUANTITY WEIGHT'],
                latitude: data['PLANE LATITUDE'],
                longitude: data['PLANE LONGITUDE'],
                onGround: onGround,
                enginesRunning: !!data['ENG COMBUSTION:1'],
                parkingBrake: !!data['BRAKE PARKING INDICATOR'],
                gearDown: !!data['GEAR HANDLE POSITION'],
                connected: true
            };
            mainWindow.webContents.send('sim-data', payload);
        });

        simConnect.on('disconnected', () => {
            mainWindow.webContents.send('flight-event', 'error', { message: 'SimConnect Desconectado.' });
        });

        simConnect.connect({ appName: 'SkyLink OCC v4' });
    } catch (e) {
        console.error('SimConnect Failure:', e.message);
    }
}

app.whenReady().then(() => {
    initDatabase();
    createWindow();
    setupSimConnect();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
