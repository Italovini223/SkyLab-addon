
/**
 * main.js - Processo Principal Electron Expandido (Tycoon + Validation)
 */

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { SimConnect, SimConnectPeriod, SimConnectDataType } = require('node-simconnect');

let mainWindow;
let simConnect = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1300,
        height: 900,
        backgroundColor: '#0f172a',
        webPreferences: {
            preload: path.join(__dirname, 'electron-preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.loadFile('index.html');
}

async function setupSimConnect() {
    try {
        simConnect = new SimConnect();
        
        simConnect.on('connected', () => {
            console.log('MSFS Conectado - Validação Estrita Ativada');
            
            simConnect.subscribeToDataDefinition([
                ['PLANE ALTITUDE', 'Feet', SimConnectDataType.FLOAT64],
                ['GROUND VELOCITY', 'Knots', SimConnectDataType.FLOAT64],
                ['VERTICAL SPEED', 'Feet per minute', SimConnectDataType.FLOAT64],
                ['TOTAL FUEL QUANTITY', 'Pounds', SimConnectDataType.FLOAT64],
                ['SIM ON GROUND', 'Bool', SimConnectDataType.INT32],
                ['ENG COMBUSTION:1', 'Bool', SimConnectDataType.INT32],
                ['BRAKE PARKING INDICATOR', 'Bool', SimConnectDataType.INT32],
                ['GEAR HANDLE POSITION', 'Bool', SimConnectDataType.INT32] // Added for landing phase tracking
            ], SimConnectPeriod.VISUAL_FRAME);
        });

        simConnect.on('data', (data) => {
            const payload = {
                altitude: data['PLANE ALTITUDE'],
                groundSpeed: data['GROUND VELOCITY'],
                verticalSpeed: data['VERTICAL SPEED'],
                totalFuel: data['TOTAL FUEL QUANTITY'],
                onGround: !!data['SIM ON GROUND'],
                enginesRunning: !!data['ENG COMBUSTION:1'],
                parkingBrake: !!data['BRAKE PARKING INDICATOR'],
                gearDown: !!data['GEAR HANDLE POSITION'],
                connected: true
            };

            mainWindow.webContents.send('sim-data', payload);
        });

        simConnect.connect({ appName: 'SkyLink Professional' });
    } catch (e) {
        console.error('SimConnect Error:', e);
    }
}

app.whenReady().then(() => {
    createWindow();
    setupSimConnect();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
