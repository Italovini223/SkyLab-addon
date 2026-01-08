
/**
 * preload.js - Ponte de Segurança (Context Bridge)
 * Expõe APIs seguras para o frontend React/HTML
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    // Escutando dados do simulador
    onSimData: (callback) => ipcRenderer.on('sim-data', (event, value) => callback(value)),
    
    // Escutando eventos de voo (Decolagem/Pouso)
    onFlightEvent: (callback) => ipcRenderer.on('flight-event', (event, type, data) => callback(type, data)),

    // Ações do frontend para o backend (Opcional)
    connectSim: () => ipcRenderer.send('connect-sim'),
    
    // SimBrief Integration
    connectSimBrief: (username) => ipcRenderer.send('connect-simbrief', username),
});
