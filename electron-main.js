
/**
 * main.js - SkyLink OCC Integrated Operations with Event Triggers
 */

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { SimConnect, SimConnectPeriod, SimConnectDataType } = require('node-simconnect');

let mainWindow;
let simConnect = null;
let lastOnGround = true;

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

// Background Function for SimBrief integration logic
async function connectSimBrief(username) {
    console.log(`SkyLink OCC: Synchronizing SimBrief account for user ${username}`);
    // SimBrief API endpoint: https://www.simbrief.com/api/xml.fetcher.php?username=${username}&json=1
    // Logic here would handle background caching or token management if necessary.
    return true;
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
                ['TOTAL FUEL QUANTITY', 'Pounds', SimConnectDataType.FLOAT64],
                ['SIM ON GROUND', 'Bool', SimConnectDataType.INT32],
                ['ENG COMBUSTION:1', 'Bool', SimConnectDataType.INT32],
                ['BRAKE PARKING INDICATOR', 'Bool', SimConnectDataType.INT32],
                ['GEAR HANDLE POSITION', 'Bool', SimConnectDataType.INT32],
                ['PLANE LATITUDE', 'Degrees', SimConnectDataType.FLOAT64],
                ['PLANE LONGITUDE', 'Degrees', SimConnectDataType.FLOAT64]
            ], SimConnectPeriod.VISUAL_FRAME);
        });

        simConnect.on('data', (data) => {
            const onGround = !!data['SIM ON GROUND'];
            
            // Detect Takeoff
            if (lastOnGround && !onGround) {
                mainWindow.webContents.send('flight-event', 'info', { message: 'Decolagem Detectada! Boa Viagem.' });
            }
            // Detect Landing
            if (!lastOnGround && onGround) {
                mainWindow.webContents.send('flight-event', 'success', { message: 'Toque na pista detectado! Bem-vindo.' });
            }
            
            lastOnGround = onGround;

            const payload = {
                altitude: Math.round(data['PLANE ALTITUDE']),
                groundSpeed: Math.round(data['GROUND VELOCITY']),
                verticalSpeed: Math.round(data['VERTICAL SPEED']),
                totalFuel: data['TOTAL FUEL QUANTITY'],
                onGround: onGround,
                enginesRunning: !!data['ENG COMBUSTION:1'],
                parkingBrake: !!data['BRAKE PARKING INDICATOR'],
                gearDown: !!data['GEAR HANDLE POSITION'],
                latitude: data['PLANE LATITUDE'],
                longitude: data['PLANE LONGITUDE'],
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

ipcMain.on('connect-simbrief', (event, username) => {
    connectSimBrief(username);
});

app.whenReady().then(() => {
    createWindow();
    setupSimConnect();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
