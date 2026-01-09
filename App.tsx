
import React, { useState, useEffect, useCallback, useRef, useMemo, createContext, useContext } from 'react';
import { 
  SimData, CompanyConfig, Aircraft, RosterFlight, Transaction, 
  PilotStats, LicenseCategory, Toast, ToastType 
} from './types';
import { 
  Layout, Plane, Activity, Settings, Wrench, AlertTriangle, 
  CheckCircle, Award, List, Building2, ChevronRight, 
  TrendingUp, TrendingDown, DollarSign, Calendar, Clock, Navigation,
  User, Coffee, ShieldCheck, History, BarChart3, X, Info, ShoppingCart,
  Gauge, Fuel, Compass, ClipboardCheck, Timer, HelpCircle
} from 'lucide-react';

// --- CONSTANTES DE NEGÓCIO ---
const TICKET_PRICE = 165;
const FUEL_PRICE_LB = 0.88;

const LICENSE_REQS: Record<LicenseCategory, { name: string, hours: number, price: number, color: string }> = {
  'Light': { name: 'PPA (Privado)', hours: 0, price: 0, color: 'text-emerald-500' },
  'Turboprop': { name: 'PCH (Comercial)', hours: 10, price: 50000, color: 'text-blue-500' },
  'SingleAisle': { name: 'JET (Single-Aisle)', hours: 50, price: 250000, color: 'text-indigo-500' },
  'Widebody': { name: 'ATP (Widebody)', hours: 150, price: 750000, color: 'text-purple-500' }
};

const QUESTION_BANK = [
  { q: "Qual o principal fator que gera sustentação em uma asa?", a: "Diferença de pressão entre o intradorso e extradorso", options: ["Diferença de pressão entre o intradorso e extradorso", "Apenas a força do motor", "O peso total da aeronave"] },
  { q: "O que é a Velocidade V1 na decolagem?", a: "Velocidade de decisão: parar ou continuar", options: ["Velocidade de rotação", "Velocidade de decisão: parar ou continuar", "Velocidade de recolhimento de flaps"] },
  { q: "No ILS, o que o 'Glideslope' fornece ao piloto?", a: "Perfil de descida vertical", options: ["Direção lateral da pista", "Perfil de descida vertical", "Informação de distância DME"] },
  { q: "O efeito solo (Ground Effect) ocorre em qual altura aproximada?", a: "Cerca de uma envergadura da aeronave", options: ["500 pés acima do solo", "Cerca de uma envergadura da aeronave", "Sempre abaixo de 100 pés fixos"] },
  { q: "Como o ar frio e denso afeta a performance da aeronave?", a: "Aumenta a performance de decolagem e subida", options: ["Aumenta a performance de decolagem e subida", "Diminui a sustentação", "Aumenta o consumo drasticamente"] },
  { q: "O que é o ajuste 'QNH' no altímetro?", a: "Ajuste para altitude em relação ao nível do mar", options: ["Ajuste padrão 1013.2 hPa", "Ajuste para altitude em relação ao nível do mar", "Temperatura externa da pista"] },
  { q: "Qual comando de voo controla o eixo de Arfagem (Pitch)?", a: "Profundor", options: ["Leme", "Aileron", "Profundor"] },
  { q: "O que significa a sigla IFR em aviação?", a: "Regras de Voo por Instrumentos", options: ["Informação de Frequência de Rádio", "Regras de Voo por Instrumentos", "Informação de Rota Fixa"] },
  { q: "Se a pressão atmosférica diminuir, a altitude densidade...", a: "Aumenta", options: ["Aumenta", "Diminui", "Não sofre alteração"] },
  { q: "Um estol (stall) é causado pelo quê?", a: "Excesso de ângulo de ataque", options: ["Falta de combustível", "Excesso de ângulo de ataque", "Alta velocidade excessiva"] }
];

// Estrutura de Rotas Reais Sugeridas
const REAL_WORLD_ROUTES: Record<string, string[]> = {
  "SBKP": ["SBRJ", "SBCF", "SBGL", "SBCG", "SBPA", "SBFL", "SBCT", "SBBR", "SBCY", "SBGO", "SBFZ", "SBRF"],
  "SBGR": ["SBSP", "SBRJ", "SBGL", "SBCF", "SBPA", "SBCT", "SBRF", "SBSV", "SBFZ", "SBBE", "SBBR", "SBCG"],
  "SBSP": ["SBGR", "SBRJ", "SBCF", "SBCG", "SBPA", "SBCT", "SBBR", "SBCY", "SBGO", "SBGL"],
  "SBRJ": ["SBSP", "SBGR", "SBKP", "SBCF", "SBBR", "SBCT"],
  "SBGL": ["SBGR", "SBKP", "SBCF", "SBRF", "SBSV", "SBPA", "SBCT"],
  "KATL": ["KJFK", "KLAX", "KORD", "KDFW", "KMIA", "KMCO", "KCLT", "KSFO", "KSEA"],
  "KLAX": ["KATL", "KORD", "KJFK", "KSFO", "KSEA", "KPHX", "KLAS", "KDEN"],
  "KJFK": ["KLAX", "KORD", "KATL", "KSFO", "KMIA", "KBOS", "KIAD"]
};

// Coordenadas dos Aeroportos para Cálculo de Progresso
const AIRPORT_COORDS: Record<string, {lat: number, lon: number}> = {
  "SBGR": { lat: -23.435, lon: -46.473 },
  "SBKP": { lat: -23.007, lon: -47.134 },
  "SBSP": { lat: -23.626, lon: -46.656 },
  "SBRJ": { lat: -22.910, lon: -43.163 },
  "SBGL": { lat: -22.810, lon: -43.250 },
  "SBCF": { lat: -19.624, lon: -43.971 },
  "SBPA": { lat: -29.994, lon: -51.171 },
  "SBCT": { lat: -25.531, lon: -49.175 },
  "SBBR": { lat: -15.869, lon: -47.917 },
  "SBCG": { lat: -20.469, lon: -54.670 },
  "KATL": { lat: 33.640, lon: -84.426 },
  "KJFK": { lat: 40.641, lon: -73.778 },
  "KLAX": { lat: 33.941, lon: -118.408 }
};

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 3440.065; // Milhas Náuticas
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const REAL_AIRLINES: any = {
  "Brasil": [
    { name: "Azul Linhas Aéreas", hub: "SBKP", logo: "https://upload.wikimedia.org/wikipedia/commons/e/ed/Azul_Linhas_A%C3%A9reas_Brasileiras_logo.png" },
    { name: "GOL Linhas Aéreas", hub: "SBGR", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/Gol_Linhas_Aereas_Logo.svg/1280px-Gol_Linhas_Aereas_Logo.svg.png" },
    { name: "LATAM Brasil", hub: "SBGR", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/LATAM_Logo.svg/2560px-LATAM_Logo.svg.png" }
  ],
  "USA": [
    { name: "Delta Air Lines", hub: "KATL", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d1/Delta_logo.svg/2560px-Delta_logo.svg.png" },
    { name: "American Airlines", hub: "KDFW", logo: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/American_Airlines_logo_2013.svg/2560px-American_Airlines_logo_2013.svg.png" }
  ]
};

const MARKET_CANDIDATES: Aircraft[] = [
  { id: 'm1', model: 'A320neo', icaoType: 'A20N', livery: 'Standard', registration: 'PR-XBI', location: 'SBGR', totalHours: 0, totalCycles: 0, condition: 100, type: 'owned', nextMaintenanceDue: 50, status: 'active', maxPax: 174, emptyWeight: 90000, category: 'SingleAisle' },
  { id: 'm2', model: '737-800', icaoType: 'B738', livery: 'Standard', registration: 'PR-GUM', location: 'SBGR', totalHours: 0, totalCycles: 0, condition: 100, type: 'owned', nextMaintenanceDue: 45, status: 'active', maxPax: 186, emptyWeight: 91000, category: 'SingleAisle' },
  { id: 'm3', model: 'C208 Grand Caravan', icaoType: 'C208', livery: 'Standard', registration: 'PS-CNT', location: 'SBKP', totalHours: 0, totalCycles: 0, condition: 100, type: 'owned', nextMaintenanceDue: 30, status: 'active', maxPax: 9, emptyWeight: 4500, category: 'Turboprop' },
  { id: 'm4', model: 'A350-900', icaoType: 'A359', livery: 'Standard', registration: 'PR-AOW', location: 'SBGR', totalHours: 0, totalCycles: 0, condition: 100, type: 'owned', nextMaintenanceDue: 100, status: 'active', maxPax: 334, emptyWeight: 250000, category: 'Widebody' },
];

const AIRPORTS_BY_REGION: Record<string, string[]> = {
  "Brasil": ["SBGR", "SBSP", "SBGL", "SBRJ", "SBKP", "SBCF", "SBPA", "SBCT", "SBRF", "SBSV", "SBFZ", "SBBE"],
  "USA": ["KATL", "KLAX", "KORD", "KDFW", "KJFK", "KSFO", "KSEA", "KMIA", "KEWR", "KCLT", "KPHX", "KMCO"]
};

// --- CONTEXTO DE ESTADO ---
interface AppContextType {
  company: CompanyConfig;
  pilotStats: PilotStats;
  fleet: Aircraft[];
  roster: RosterFlight[];
  transactions: Transaction[];
  simData: SimData;
  activeTab: string;
  pilotSubTab: string;
  toasts: Toast[];
  setActiveTab: (tab: string) => void;
  setPilotSubTab: (tab: string) => void;
  notify: (type: ToastType, message: string) => void;
  removeToast: (id: string) => void;
  recordTransaction: (description: string, amount: number, type: 'credit' | 'debit', category: Transaction['category']) => void;
  updateCompany: (config: Partial<CompanyConfig>) => void;
  updatePilotStats: (stats: Partial<PilotStats>) => void;
  addToFleet: (aircraft: Aircraft) => void;
  generateRoster: (legs: number) => void;
  finalizeFlight: (finalFuel: number) => void;
}

const AppContext = createContext<AppContextType | null>(null);

const useAppStore = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useAppStore deve ser usado dentro de AppProvider");
  return context;
};

// --- COMPONENTES DA UI ---

const NotificationComponent: React.FC = () => {
  const { toasts, removeToast } = useAppStore();
  return (
    <div className="fixed top-6 right-6 z-[9999] flex flex-col space-y-4 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`pointer-events-auto flex items-center space-x-4 p-4 rounded-2xl shadow-2xl glass-card animate-toast-in border-l-4 w-80 ${
          t.type === 'success' ? 'border-emerald-500' : 
          t.type === 'error' ? 'border-red-500' : 
          t.type === 'warning' ? 'border-yellow-500' : 'border-blue-500'
        }`}>
          <div className={`${
            t.type === 'success' ? 'text-emerald-500' : 
            t.type === 'error' ? 'text-red-500' : 
            t.type === 'warning' ? 'text-yellow-500' : 'border-blue-500'
          }`}>
            {t.type === 'success' && <CheckCircle size={20} />}
            {t.type === 'error' && <AlertTriangle size={20} />}
            {t.type === 'warning' && <AlertTriangle size={20} />}
            {t.type === 'info' && <Info size={20} />}
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold text-slate-200">{t.message}</p>
          </div>
          <button onClick={() => removeToast(t.id)} className="text-slate-500 hover:text-white transition-colors">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};

const SidebarComponent: React.FC = () => {
  const { activeTab, setActiveTab, pilotSubTab, setPilotSubTab, simData, company, notify } = useAppStore();
  
  const [dutyTime, setDutyTime] = useState("00:00:00");

  useEffect(() => {
    if (!company.dutyStartTime) return;
    const interval = setInterval(() => {
      const diff = Date.now() - company.dutyStartTime!;
      const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
      const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
      const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
      setDutyTime(`${h}:${m}:${s}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [company.dutyStartTime]);

  return (
    <aside className="w-64 glass border-r border-slate-800/50 flex flex-col p-6 space-y-6">
      <div className="flex items-center space-x-3 px-2 mb-4">
        <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-600/20">
          <Plane className="text-white" size={20} />
        </div>
        <h1 className="text-lg font-bold italic tracking-tighter">SkyLink<span className="text-blue-500">OCC</span></h1>
      </div>
      
      <nav className="flex-1 space-y-1 overflow-y-auto">
        <button onClick={() => setActiveTab('dashboard')} className={`flex items-center space-x-3 w-full p-3 rounded-xl transition-all ${activeTab === 'dashboard' ? 'bg-blue-600 shadow-lg shadow-blue-600/20' : 'hover:bg-slate-800/50'}`}>
          <Layout size={18}/><span>Dashboard</span>
        </button>
        
        <div className="py-2">
          <p className="text-[10px] text-slate-500 font-bold uppercase px-3 mb-2 tracking-widest opacity-50">Operacional</p>
          <button onClick={() => { setActiveTab('pilot_area'); setPilotSubTab('roster'); }} className={`flex items-center space-x-3 w-full p-3 rounded-xl mb-1 transition-all ${activeTab === 'pilot_area' && pilotSubTab === 'roster' ? 'bg-blue-600 shadow-lg shadow-blue-600/20' : 'hover:bg-slate-800/50'}`}>
            <Calendar size={18}/><span>Escala de Voos</span>
          </button>
          <button onClick={() => { setActiveTab('pilot_area'); setPilotSubTab('licenses'); }} className={`flex items-center space-x-3 w-full p-3 rounded-xl mb-1 transition-all ${activeTab === 'pilot_area' && pilotSubTab === 'licenses' ? 'bg-blue-600 shadow-lg shadow-blue-600/20' : 'hover:bg-slate-800/50'}`}>
            <ShieldCheck size={18}/><span>Licenças</span>
          </button>
          <button onClick={() => { setActiveTab('pilot_area'); setPilotSubTab('management'); }} className={`flex items-center space-x-3 w-full p-3 rounded-xl transition-all ${activeTab === 'pilot_area' && pilotSubTab === 'management' ? 'bg-blue-600 shadow-lg shadow-blue-600/20' : 'hover:bg-slate-800/50'}`}>
            <User size={18}/><span>Logbook Piloto</span>
          </button>
        </div>

        <div className="py-2">
          <p className="text-[10px] text-slate-500 font-bold uppercase px-3 mb-2 tracking-widest opacity-50">Corporativo</p>
          <button onClick={() => setActiveTab('accounting')} className={`flex items-center space-x-3 w-full p-3 rounded-xl mb-1 transition-all ${activeTab === 'accounting' ? 'bg-blue-600 shadow-lg shadow-blue-600/20' : 'hover:bg-slate-800/50'}`}>
            <DollarSign size={18}/><span>Financeiro</span>
          </button>
          <button onClick={() => setActiveTab('hangar')} className={`flex items-center space-x-3 w-full p-3 rounded-xl mb-1 transition-all ${activeTab === 'hangar' ? 'bg-blue-600 shadow-lg shadow-blue-600/20' : 'hover:bg-slate-800/50'}`}>
            <Wrench size={18}/><span>Frota</span>
          </button>
          <button onClick={() => setActiveTab('market')} className={`flex items-center space-x-3 w-full p-3 rounded-xl transition-all ${activeTab === 'market' ? 'bg-blue-600 shadow-lg shadow-blue-600/20' : 'hover:bg-slate-800/50'}`}>
            <ShoppingCart size={18}/><span>Mercado</span>
          </button>
        </div>
      </nav>

      {company.dutyStartTime && (
        <div className="p-4 bg-slate-900/50 rounded-2xl border border-slate-800/50 mt-auto">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-slate-500 font-bold uppercase">Jornada</span>
            <Coffee size={12} className="text-blue-500" />
          </div>
          <p className="text-lg font-mono font-bold text-blue-400">{dutyTime}</p>
        </div>
      )}

      <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/50">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">SimConnect</span>
          <div className={`w-2 h-2 rounded-full ${simData.connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
        </div>
        <button className="w-full py-2 bg-slate-800 rounded-xl text-[10px] font-bold hover:bg-slate-700 transition-colors uppercase">
          {simData.connected ? 'Conectado' : 'Reconectar'}
        </button>
      </div>
    </aside>
  );
};

const FlightCardComponent: React.FC<{ flight: RosterFlight, aircraft?: Aircraft }> = ({ flight, aircraft }) => {
  const { notify, company, setActiveTab } = useAppStore();
  
  return (
    <div className={`p-6 rounded-3xl border transition-all ${flight.status === 'current' ? 'border-blue-500/50 bg-blue-500/5 shadow-2xl shadow-blue-500/5 ring-1 ring-blue-500/20' : 'border-slate-800 opacity-60'}`}>
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-12">
          <div className="min-w-24">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Identificador</p>
            <p className="text-xl font-mono font-black text-blue-500">{flight.flightNumber}</p>
          </div>
          <div className="flex items-center space-x-8 px-10 border-l border-slate-800/50">
            <div className="text-center">
              <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Origem</p>
              <p className="text-2xl font-bold tracking-tighter">{flight.origin}</p>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-slate-600 font-bold italic mb-1">{flight.distance}NM</span>
              <Plane size={18} className="rotate-90 text-slate-700" />
            </div>
            <div className="text-center">
              <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Destino</p>
              <p className="text-2xl font-bold tracking-tighter">{flight.destination}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-8 text-[10px] uppercase font-bold text-slate-500 border-l border-slate-800/50 pl-10">
            <div><p className="mb-1 opacity-50">Pax</p><p className="text-white text-xs">{flight.pax}</p></div>
            <div><p className="mb-1 opacity-50">Cargo</p><p className="text-white text-xs">{flight.cargoWeight} LB</p></div>
            <div><p className="mb-1 opacity-50">Block Fuel</p><p className="text-emerald-500 text-xs">{flight.minFuel} LB</p></div>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {flight.status === 'current' ? (
            <>
              <button onClick={() => {
                notify('info', 'Abrindo SimBrief Dispatcher...');
                window.open(`https://www.simbrief.com/system/dispatch.php?orig=${flight.origin}&dest=${flight.destination}&type=${aircraft?.icaoType || 'A20N'}&callsign=${flight.flightNumber}&airline=${company.name.substring(0,3)}`, '_blank');
              }} className="bg-slate-900 border border-slate-800 px-5 py-3 rounded-2xl text-[10px] font-bold hover:bg-slate-800 transition-colors uppercase tracking-wider">SimBrief</button>
              <button onClick={()=>setActiveTab('flight-monitor')} className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-2xl text-[10px] font-bold uppercase transition-all shadow-xl shadow-blue-600/20 active:scale-95">Monitorar</button>
            </>
          ) : flight.status === 'completed' ? (
            <div className="text-emerald-500 bg-emerald-500/10 px-5 py-3 rounded-2xl border border-emerald-500/20 text-[10px] font-bold flex items-center space-x-2 tracking-widest uppercase">
              <CheckCircle size={14}/> <span>FINALIZADO</span>
            </div>
          ) : (
            <div className="text-slate-700 font-bold uppercase tracking-widest text-[10px] bg-slate-900/50 px-5 py-3 rounded-2xl border border-slate-800/50">Em Espera</div>
          )}
        </div>
      </div>
    </div>
  );
};

const OnboardingModal: React.FC = () => {
  const { updateCompany, recordTransaction, notify } = useAppStore();
  const [step, setStep] = useState(1);
  const [tempConfig, setTempConfig] = useState<Partial<CompanyConfig>>({ type: 'real', country: 'Brasil' });

  const finish = () => {
    const CHEAPEST_AIRCRAFT_PRICE = 1200000;
    const initialBalance = CHEAPEST_AIRCRAFT_PRICE + 300000;
    updateCompany({ ...tempConfig, setupComplete: true, balance: initialBalance, reputation: 5.0 }); 
    recordTransaction("Injeção Capital Inicial", initialBalance, 'credit', 'purchase');
    notify('success', "Bem-vindo ao comando.");
  };

  return (
    <div className="h-screen w-full flex items-center justify-center bg-slate-950 p-6">
      <div className="max-w-xl w-full glass p-10 rounded-3xl border-slate-800 border space-y-8 animate-in fade-in zoom-in duration-300">
         <div className="text-center">
           <div className="w-16 h-16 bg-blue-600 rounded-2xl mx-auto flex items-center justify-center text-white mb-6 shadow-xl shadow-blue-500/20">
             <Building2 size={32} />
           </div>
           <h1 className="text-3xl font-bold">Fundar Companhia</h1>
         </div>
         {step === 1 ? (
           <div className="space-y-4">
              <button onClick={() => { setTempConfig({ ...tempConfig, type: 'real' }); setStep(2); }} className="w-full p-6 bg-slate-900/50 border border-slate-800 rounded-2xl flex items-center justify-between hover:border-blue-500 transition-all group text-left">
                 <div><p className="font-bold text-lg">Modo Real</p><p className="text-sm text-slate-500">Operar como uma linha aérea real.</p></div>
                 <ChevronRight />
              </button>
              <button onClick={() => { setTempConfig({ ...tempConfig, type: 'virtual' }); setStep(2); }} className="w-full p-6 bg-slate-900/50 border border-slate-800 rounded-2xl flex items-center justify-between hover:border-blue-500 transition-all group text-left">
                 <div><p className="font-bold text-lg">Modo Virtual</p><p className="text-sm text-slate-500">Marca e hubs customizados.</p></div>
                 <ChevronRight />
              </button>
           </div>
         ) : (
           <div className="space-y-6">
             {tempConfig.type === 'real' ? (
               <div className="grid grid-cols-1 gap-2 overflow-y-auto max-h-60 pr-2">
                 {REAL_AIRLINES[tempConfig.country || 'Brasil'].map((air: any) => (
                   <button key={air.name} onClick={() => setTempConfig({ ...tempConfig, name: air.name, logo: air.logo, hub: air.hub })} className={`p-4 border rounded-xl flex items-center space-x-4 transition-all ${tempConfig.name === air.name ? 'border-blue-500 bg-blue-500/5' : 'border-slate-800'}`}>
                        <img src={air.logo} className="h-6 w-auto grayscale" alt="" />
                        <span className="font-bold">{air.name}</span>
                   </button>
                 ))}
               </div>
             ) : (
               <div className="space-y-4">
                 <input className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 outline-none" placeholder="Nome da Empresa" onChange={(e) => setTempConfig({ ...tempConfig, name: e.target.value })} />
                 <input className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 outline-none uppercase" placeholder="Hub Principal (Ex: SBGR)" onChange={(e) => setTempConfig({ ...tempConfig, hub: e.target.value })} />
               </div>
             )}
             <div className="flex space-x-4">
               <button onClick={() => setStep(1)} className="flex-1 py-4 bg-slate-900/50 rounded-xl font-bold">Voltar</button>
               <button onClick={finish} disabled={!tempConfig.name} className="flex-2 w-full py-4 bg-blue-600 rounded-xl font-bold disabled:opacity-30">Confirmar</button>
             </div>
           </div>
         )}
      </div>
    </div>
  );
};

// --- NOVA VIEW: MONITORAMENTO DE VOO ATIVO ---

const ActiveFlightMonitor: React.FC = () => {
  const { simData, roster, setActiveTab, fleet } = useAppStore();
  const currentFlight = useMemo(() => roster.find(f => f.status === 'current'), [roster]);
  const aircraft = fleet[0];

  const flightProgress = useMemo(() => {
    if (!currentFlight || simData.onGround) return 0;
    
    const origin = AIRPORT_COORDS[currentFlight.origin];
    if (!origin || simData.latitude === 0) return 45; // Fallback visual se coords não mapeadas

    const distFromOrigin = calculateDistance(origin.lat, origin.lon, simData.latitude, simData.longitude);
    const progress = (distFromOrigin / currentFlight.distance) * 100;
    
    return Math.min(Math.max(progress, 0), 100);
  }, [simData.latitude, simData.longitude, currentFlight]);

  return (
    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-blue-600 rounded-xl shadow-lg shadow-blue-600/20"><Activity size={20} className="text-white"/></div>
          <h3 className="text-2xl font-bold uppercase tracking-tighter italic">Monitoramento de Voo Ativo</h3>
        </div>
        <button 
          onClick={() => setActiveTab('pilot_area')} 
          className="flex items-center space-x-2 bg-slate-900 border border-slate-800 px-6 py-3 rounded-2xl text-[10px] font-bold uppercase hover:bg-slate-800 transition-all"
        >
          <Calendar size={14} /> <span>Voltar para Escala</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Altitude (FT)', value: simData.altitude.toLocaleString(), icon: Gauge },
          { label: 'Ground Speed (KTS)', value: simData.groundSpeed, icon: Navigation },
          { label: 'Vertical Speed (FPM)', value: simData.verticalSpeed, icon: Activity, color: simData.verticalSpeed >= 0 ? 'text-emerald-500' : 'text-red-500' },
          { label: 'Fuel Qty (LB)', value: Math.round(simData.totalFuel).toLocaleString(), icon: Fuel }
        ].map((stat, i) => (
          <div key={i} className="glass-card p-8 rounded-3xl border-slate-800/50">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-3">{stat.label}</p>
            <p className={`text-4xl font-mono font-bold tracking-tighter ${stat.color || 'text-white'}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="glass-card p-10 rounded-3xl border-blue-500/20 bg-blue-500/5 relative overflow-hidden">
        <div className="relative z-10 flex flex-col space-y-8">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-[10px] text-blue-500 font-bold uppercase mb-1">Identificador ATC</p>
              <h4 className="text-4xl font-mono font-black italic">{currentFlight?.flightNumber || '---'}</h4>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Aeronave</p>
              <p className="text-xl font-bold">{aircraft?.model} <span className="text-blue-500">[{aircraft?.registration}]</span></p>
            </div>
          </div>
          
          <div className="flex justify-between items-center px-12 py-10 bg-slate-900/40 rounded-3xl border border-white/5">
            <div className="text-center">
              <p className="text-[10px] text-slate-500 font-bold uppercase mb-2">Origem</p>
              <p className="text-6xl font-black tracking-tighter">{currentFlight?.origin}</p>
            </div>
            <div className="flex-1 px-16 relative">
              <div className="w-full h-1 bg-slate-800 relative">
                <div className="absolute top-0 left-0 h-full bg-blue-500 transition-all duration-1000 ease-linear" style={{ width: `${flightProgress}%` }}></div>
                <Plane size={24} className="text-blue-500 absolute top-1/2 -translate-y-1/2 rotate-90 transition-all duration-1000 ease-linear" style={{ left: `${flightProgress}%` }} />
              </div>
              <p className="mt-4 text-[10px] font-bold text-slate-600 uppercase italic text-center">Em Rota - Estimado FL340</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-slate-500 font-bold uppercase mb-2">Destino</p>
              <p className="text-6xl font-black tracking-tighter">{currentFlight?.destination}</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500">
              <span>Progresso de Voo</span>
              <span className="text-blue-400">{Math.round(flightProgress)}% Concluído</span>
            </div>
            <div className="w-full h-4 bg-slate-950 rounded-full border border-white/5 overflow-hidden">
              <div 
                className="h-full bg-blue-600 rounded-full shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all duration-1000 ease-linear" 
                style={{ width: `${flightProgress}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- VIEWS (MÓDULOS DA UI) ---

const DashboardView: React.FC = () => {
  const { pilotStats, fleet, transactions } = useAppStore();
  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'Total Horas', value: `${Math.floor(pilotStats.totalHours)}h`, icon: Clock, color: 'text-blue-500' },
            { label: 'Pernas Voadas', value: pilotStats.totalFlights, icon: Plane, color: 'text-emerald-500' },
            { label: 'Patente', value: pilotStats.rank, icon: Award, color: 'text-yellow-500' },
            { label: 'Aeronaves', value: fleet.length, icon: List, color: 'text-slate-500' }
          ].map((stat, i) => (
            <div key={i} className="glass-card p-6 rounded-3xl border-slate-800/50">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">{stat.label}</p>
                <stat.icon className={`${stat.color} opacity-60`} size={20} />
              </div>
              <p className="text-3xl font-mono font-bold tracking-tighter">{stat.value}</p>
            </div>
          ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 glass-card p-8 rounded-3xl border-slate-800/50 flex flex-col items-center justify-center text-center min-h-[300px]">
            <Building2 size={48} className="text-slate-700 mb-6" />
            <h3 className="text-xl font-bold uppercase italic tracking-tighter">SkyLink OCC Integrated</h3>
            <p className="text-slate-500 text-sm mt-3 max-w-sm">Bem-vindo ao centro de comando operacional. Use a escala para despachar novos voos.</p>
          </div>
          
          <div className="glass-card p-8 rounded-3xl border-slate-800/50">
            <h3 className="text-lg font-bold mb-6 flex items-center space-x-2 uppercase tracking-tighter"><TrendingUp size={18} className="text-emerald-500"/> <span>Ultimos Ganhos</span></h3>
            <div className="space-y-4">
                {transactions.slice(0, 5).map(t => (
                  <div key={t.id} className="flex justify-between items-center p-4 bg-slate-900/30 rounded-2xl border border-white/5">
                      <div>
                        <p className="text-xs font-bold text-slate-200 line-clamp-1">{t.description}</p>
                        <p className="text-[9px] text-slate-500 font-mono mt-1 uppercase">{new Date(t.timestamp).toLocaleDateString()}</p>
                      </div>
                      <p className={`font-mono text-xs font-bold ${t.type === 'credit' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {t.type === 'credit' ? '+' : '-'}${t.amount.toLocaleString()}
                      </p>
                  </div>
                ))}
            </div>
          </div>
      </div>
    </div>
  );
};

// --- COMPONENTE DE LICENÇAS E EXAME ---

const LicenseCheckride: React.FC<{ category: LicenseCategory, onComplete: (passed: boolean) => void }> = ({ category, onComplete }) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [finished, setFinished] = useState(false);

  // Seleciona 5 questões aleatórias
  const examQuestions = useMemo(() => {
    return [...QUESTION_BANK].sort(() => 0.5 - Math.random()).slice(0, 5);
  }, []);

  const handleAnswer = (opt: string) => {
    const isCorrect = opt === examQuestions[currentQuestion].a;
    setAnswers([...answers, isCorrect]);
    if (currentQuestion < 4) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      setFinished(true);
    }
  };

  if (finished) {
    const correctCount = answers.filter(a => a).length;
    const passed = correctCount >= 4;

    return (
      <div className="glass-card p-12 rounded-[40px] text-center max-w-2xl mx-auto space-y-8 animate-in zoom-in duration-300">
        <div className={`w-24 h-24 mx-auto rounded-full flex items-center justify-center ${passed ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500'}`}>
          {passed ? <CheckCircle size={48} /> : <AlertTriangle size={48} />}
        </div>
        <div>
          <h4 className="text-3xl font-black italic tracking-tighter uppercase">{passed ? 'Aprovado!' : 'Reprovado'}</h4>
          <p className="text-slate-500 mt-2 font-bold uppercase tracking-widest">Você acertou {correctCount} de 5 questões.</p>
        </div>
        <p className="text-sm text-slate-400">
          {passed 
            ? "Parabéns, Comandante! Sua nova habilitação técnica foi devidamente averbada em sua ficha funcional." 
            : "Infelizmente você não atingiu a pontuação mínima de 80%. O valor da inscrição não será reembolsado."}
        </p>
        <button 
          onClick={() => onComplete(passed)}
          className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest text-xs transition-all ${passed ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-800 hover:bg-slate-700'}`}
        >
          {passed ? 'Finalizar Checkride' : 'Voltar e Estudar'}
        </button>
      </div>
    );
  }

  return (
    <div className="glass-card p-12 rounded-[40px] max-w-2xl mx-auto space-y-10 animate-in slide-in-from-bottom-8">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-600/10 rounded-lg text-blue-500"><ClipboardCheck size={20}/></div>
          <h4 className="font-black italic text-lg uppercase tracking-tighter">Exame Técnico: {LICENSE_REQS[category].name}</h4>
        </div>
        <div className="flex items-center space-x-2 text-blue-400 font-mono text-sm font-bold">
          <Timer size={14}/> <span>Questão {currentQuestion + 1}/5</span>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-slate-900/50 p-6 rounded-2xl border border-white/5">
          <p className="text-lg font-bold text-slate-100">{examQuestions[currentQuestion].q}</p>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {examQuestions[currentQuestion].options.map((opt, i) => (
            <button 
              key={i} 
              onClick={() => handleAnswer(opt)}
              className="w-full text-left p-5 bg-slate-800/50 hover:bg-blue-600/10 border border-slate-700 hover:border-blue-500/50 rounded-2xl transition-all text-sm font-medium group flex justify-between items-center"
            >
              <span>{opt}</span>
              <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const PilotAreaView: React.FC = () => {
  const { pilotSubTab, roster, generateRoster, fleet, pilotStats, company, updateCompany, notify, recordTransaction, updatePilotStats } = useAppStore();
  const [sbUser, setSbUser] = useState(company.simBriefUsername || '');
  const [activeCheckride, setActiveCheckride] = useState<LicenseCategory | null>(null);
  
  const handleConnectSimBrief = () => {
    updateCompany({ simBriefUsername: sbUser });
    notify('success', 'Usuário SimBrief vinculado.');
  };

  const startCheckride = (cat: LicenseCategory) => {
    const req = LICENSE_REQS[cat];
    if (pilotStats.totalHours < req.hours) return notify('error', `Requisito: ${req.hours}h totais de voo.`);
    if (company.balance < req.price) return notify('error', "Saldo insuficiente para taxa de exame.");
    
    // Transação de Taxa de Exame
    recordTransaction(`Taxa Exame: ${req.name}`, req.price, 'debit', 'investment');
    setActiveCheckride(cat);
  };

  const handleExamComplete = (passed: boolean) => {
    if (passed && activeCheckride) {
      updatePilotStats({ licenses: [...pilotStats.licenses, activeCheckride] });
      notify('success', `Habilitação ${activeCheckride} emitida!`);
    }
    setActiveCheckride(null);
  };

  if (activeCheckride) {
    return <LicenseCheckride category={activeCheckride} onComplete={handleExamComplete} />;
  }

  if (pilotSubTab === 'roster') {
    return (
      <div className="space-y-6 animate-in slide-in-from-right-4">
        <section className="glass-card p-8 rounded-3xl border-slate-800/50">
           <div className="flex justify-between mb-10 items-center">
              <div className="flex items-center space-x-4">
                 <div className="p-3 bg-blue-600/10 rounded-2xl text-blue-500 shadow-inner"><Navigation size={24}/></div>
                 <h3 className="text-xl font-bold uppercase tracking-tighter italic">Despacho de Voos</h3>
              </div>
              <button onClick={() => generateRoster(1)} className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-xl text-xs font-bold uppercase transition-all shadow-lg shadow-blue-600/20 active:scale-95">Novo Plano</button>
           </div>
           <div className="space-y-4">
              {roster.length === 0 ? (
                <div className="py-24 text-center border-2 border-dashed border-slate-800 rounded-3xl opacity-30 italic uppercase tracking-widest text-xs">Sem voos planejados</div>
              ) : roster.map(f => <FlightCardComponent key={f.id} flight={f} aircraft={fleet[0]} />)}
           </div>
        </section>
      </div>
    );
  }

  if (pilotSubTab === 'licenses') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in slide-in-from-right-4">
        {(Object.keys(LICENSE_REQS) as LicenseCategory[]).map(cat => {
          const req = LICENSE_REQS[cat];
          const hasLicense = pilotStats.licenses.includes(cat);
          const canAfford = company.balance >= req.price;
          const hasHours = pilotStats.totalHours >= req.hours;

          return (
            <div key={cat} className={`glass-card p-8 rounded-[32px] border transition-all ${hasLicense ? 'border-emerald-500/30 bg-emerald-500/5 shadow-2xl shadow-emerald-500/5' : 'border-slate-800/50 shadow-xl'}`}>
               <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-8 shadow-xl ${hasLicense ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
                  <ShieldCheck size={28} />
               </div>
               <h4 className="text-xl font-black italic uppercase tracking-tighter leading-none mb-1">{req.name}</h4>
               <p className={`text-[10px] font-black uppercase tracking-widest mb-8 ${req.color}`}>Categoria: {cat}</p>

               <div className="space-y-4 mb-10">
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                    <span className="text-slate-500">Requisito Horas</span>
                    <span className={hasHours ? 'text-emerald-500' : 'text-red-400'}>{pilotStats.totalHours.toFixed(1)} / {req.hours}h</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                    <span className="text-slate-500">Custo Exame</span>
                    <span className={canAfford ? 'text-blue-400' : 'text-red-400'}>R$ {req.price.toLocaleString()}</span>
                  </div>
               </div>

               {hasLicense ? (
                 <div className="w-full py-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-500 text-[10px] font-black uppercase tracking-widest flex items-center justify-center space-x-2">
                    <CheckCircle size={14}/> <span>LICENCIADO</span>
                 </div>
               ) : (
                 <button 
                  onClick={() => startCheckride(cat)}
                  disabled={!hasHours || !canAfford}
                  className={`w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${(!hasHours || !canAfford) ? 'bg-slate-800 text-slate-600 opacity-50 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 active:scale-95'}`}
                 >
                   {!hasHours ? 'Horas Insuficientes' : !canAfford ? 'Saldo Insuficiente' : 'Iniciar Checkride'}
                 </button>
               )}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in slide-in-from-right-4">
       <div className="lg:col-span-1 space-y-6">
          <div className="glass-card p-10 rounded-3xl flex flex-col items-center text-center border-slate-800/50">
             <div className="w-28 h-28 bg-slate-900 rounded-full mb-8 flex items-center justify-center border-4 border-blue-600/30 relative">
                <User size={56} className="text-blue-500" />
                <div className="absolute -bottom-2 bg-blue-600 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-blue-400/20 shadow-lg">{pilotStats.rank}</div>
             </div>
             <h3 className="text-2xl font-bold uppercase italic tracking-tighter">Pilot Command</h3>
             <p className="text-blue-500 font-bold text-xs uppercase mt-3 tracking-widest">{Math.floor(pilotStats.totalHours)} Horas Totais</p>
          </div>

          <div className="glass-card p-8 rounded-3xl border-slate-800/50">
             <h4 className="text-lg font-bold flex items-center space-x-2 mb-6 uppercase tracking-tighter">
                <Settings size={18} className="text-blue-500"/>
                <span>Configurações Operacionais</span>
             </h4>
             <div className="space-y-4">
                <div>
                   <label className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2 block">SimBrief User</label>
                   <input type="text" value={sbUser} onChange={(e) => setSbUser(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-all text-sm font-mono" placeholder="Username..." />
                </div>
                <button onClick={handleConnectSimBrief} className="w-full py-4 bg-blue-600 hover:bg-blue-700 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all shadow-lg shadow-blue-600/20 active:scale-95">Sincronizar</button>
             </div>
          </div>
       </div>

       <div className="lg:col-span-2 glass-card p-8 rounded-3xl min-h-[400px] border-slate-800/50">
          <h4 className="text-xl font-bold flex items-center space-x-3 mb-10 uppercase tracking-tighter"><History size={22} className="text-blue-500" /> <span>Logbook de Operações</span></h4>
          <div className="flex flex-col items-center justify-center py-20 opacity-10">
             <List size={48} className="mb-4" />
             <p className="text-xs font-bold uppercase tracking-widest">Logs em tempo real via SimConnect</p>
          </div>
       </div>
    </div>
  );
};

// --- APP PROVIDER ---

const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [pilotSubTab, setPilotSubTab] = useState('roster');
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  const [company, setCompany] = useState<CompanyConfig>(() => {
    const saved = localStorage.getItem('skyLink_company_store');
    return saved ? JSON.parse(saved) : { setupComplete: false, balance: 150000, reputation: 5.0 };
  });

  const [pilotStats, setPilotStats] = useState<PilotStats>(() => {
    const saved = localStorage.getItem('skyLink_pilot_store');
    return saved ? JSON.parse(saved) : { totalHours: 0, totalFlights: 0, rank: 'Cadete', licenses: ['Light'], avgLandingRate: 0 };
  });

  const [fleet, setFleet] = useState<Aircraft[]>(() => {
    const saved = localStorage.getItem('skyLink_fleet_store');
    return saved ? JSON.parse(saved) : [];
  });

  const [roster, setRoster] = useState<RosterFlight[]>(() => {
    const saved = localStorage.getItem('skyLink_roster_store');
    return saved ? JSON.parse(saved) : [];
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('skyLink_tx_store');
    return saved ? JSON.parse(saved) : [];
  });

  const [simData, setSimData] = useState<SimData>({
    altitude: 0, groundSpeed: 0, totalFuel: 0, onGround: true,
    verticalSpeed: 0, enginesRunning: false, parkingBrake: true, gearDown: true,
    latitude: 0, longitude: 0, connected: false
  });

  const initialFuelRef = useRef<number>(0);
  const isFlyingRef = useRef<boolean>(false);

  useEffect(() => {
    localStorage.setItem('skyLink_company_store', JSON.stringify(company));
    localStorage.setItem('skyLink_pilot_store', JSON.stringify(pilotStats));
    localStorage.setItem('skyLink_fleet_store', JSON.stringify(fleet));
    localStorage.setItem('skyLink_roster_store', JSON.stringify(roster));
    localStorage.setItem('skyLink_tx_store', JSON.stringify(transactions));
  }, [company, pilotStats, fleet, roster, transactions]);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onSimData((data: SimData) => setSimData(data));
      window.electronAPI.onFlightEvent((type: ToastType, data: { message: string }) => notify(type, data.message));
    }
  }, []);

  const notify = useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [{ id, type, message }, ...prev]);
    setTimeout(() => removeToast(id), 5000);
  }, []);

  const removeToast = useCallback((id: string) => setToasts(prev => prev.filter(t => t.id !== id)), []);

  const recordTransaction = useCallback((description: string, amount: number, type: 'credit' | 'debit', category: Transaction['category']) => {
    const newTx: Transaction = { id: Math.random().toString(36).substr(2, 9), timestamp: Date.now(), description, amount, type, category };
    setTransactions(prev => [newTx, ...prev]);
    setCompany(prev => ({ ...prev, balance: type === 'credit' ? prev.balance + amount : prev.balance - amount }));
  }, []);

  const generateRoster = (legs: number) => {
    if (fleet.length === 0) return notify('warning', "Sem aeronaves disponíveis.");
    const aircraft = fleet[0]; 
    let origin = aircraft.location || company.hub;
    if (roster.length > 0) origin = roster[roster.length - 1].destination;

    const newFlights: RosterFlight[] = [];
    let movingLoc = origin;

    for (let i = 0; i < legs; i++) {
      let dest = "";
      const suggested = REAL_WORLD_ROUTES[movingLoc];
      if (suggested && suggested.length > 0) dest = suggested[Math.floor(Math.random() * suggested.length)];
      else {
        const regionAirports = AIRPORTS_BY_REGION[company.country || "Brasil"];
        dest = regionAirports[Math.floor(Math.random() * regionAirports.length)];
        while (dest === movingLoc) dest = regionAirports[Math.floor(Math.random() * regionAirports.length)];
      }
      
      newFlights.push({
        id: Math.random().toString(36).substr(2, 9),
        flightNumber: `${company.name.substring(0,2).toUpperCase()}${Math.floor(1000 + Math.random() * 8999)}`,
        origin: movingLoc, destination: dest, distance: 250, 
        departureTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: (roster.length === 0 && i === 0) ? 'current' : 'pending', 
        pax: 150, cargoWeight: 3000, minFuel: 10000, events: {}
      });
      movingLoc = dest;
    }
    setFleet(prev => prev.map(a => a.id === aircraft.id ? { ...a, location: movingLoc } : a));
    setRoster(prev => [...prev, ...newFlights]);
    notify('success', `Escala gerada partindo de ${origin}.`);
  };

  const finalizeFlight = useCallback((finalFuel: number) => {
    const currentLeg = roster.find(l => l.status === 'current');
    if (!currentLeg) return;
    const fuelUsed = Math.max(0, initialFuelRef.current - finalFuel);
    recordTransaction(`Voo ${currentLeg.flightNumber}: Receita`, currentLeg.pax * TICKET_PRICE, 'credit', 'flight_revenue');
    recordTransaction(`Combustível ${currentLeg.flightNumber}`, fuelUsed * FUEL_PRICE_LB, 'debit', 'fuel');
    updatePilotStats({ totalFlights: pilotStats.totalFlights + 1, totalHours: pilotStats.totalHours + 1.2 });
    setFleet(prev => prev.map(a => ({ ...a, location: currentLeg.destination })));
    const updatedRoster = roster.map(l => l.id === currentLeg.id ? { ...l, status: 'completed' as const } : l);
    const nextPending = updatedRoster.find(l => l.status === 'pending');
    if (nextPending) nextPending.status = 'current';
    setRoster(updatedRoster);
    notify('success', `Pouso em ${currentLeg.destination} concluído.`);
  }, [roster, pilotStats, recordTransaction, notify]);

  useEffect(() => {
    if (!simData.connected) return;
    if (!simData.onGround && !isFlyingRef.current) {
      isFlyingRef.current = true;
      initialFuelRef.current = simData.totalFuel;
    }
    if (simData.onGround && isFlyingRef.current) {
      isFlyingRef.current = false;
      finalizeFlight(simData.totalFuel);
    }
  }, [simData, finalizeFlight]);

  const updateCompany = (config: Partial<CompanyConfig>) => setCompany(prev => ({ ...prev, ...config }));
  const updatePilotStats = (stats: Partial<PilotStats>) => setPilotStats(prev => ({ ...prev, ...stats }));
  const addToFleet = (aircraft: Aircraft) => setFleet(prev => [...prev, aircraft]);

  const store = {
    company, pilotStats, fleet, roster, transactions, simData, activeTab, pilotSubTab, toasts,
    setActiveTab, setPilotSubTab, notify, removeToast, recordTransaction, 
    updateCompany, updatePilotStats, addToFleet, generateRoster, finalizeFlight
  };

  return <AppContext.Provider value={store}>{children}</AppContext.Provider>;
};

const MainLayout: React.FC = () => {
  const { company, activeTab, transactions, addToFleet, notify, fleet } = useAppStore();
  if (!company.setupComplete) return <OnboardingModal />;

  return (
    <div className="flex h-screen w-full bg-[#020617] text-slate-200 overflow-hidden">
      <NotificationComponent /><SidebarComponent />
      <main className="flex-1 overflow-y-auto p-8 relative scroll-smooth">
        <header className="flex justify-between items-center mb-10">
           <div className="flex items-center space-x-5">
             <div className="p-3 bg-blue-600 rounded-2xl"><Building2 size={24} /></div>
             <div><h2 className="text-2xl font-bold uppercase tracking-tight leading-none">{company.name}</h2><p className="text-slate-500 text-xs font-medium uppercase mt-1">Hub: <span className="text-blue-500">{company.hub}</span></p></div>
           </div>
           <div className="px-6 py-3 rounded-2xl glass-card border-emerald-500/20 border-l-4 text-right shadow-2xl">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Patrimônio</p>
              <p className="text-xl font-mono text-emerald-400 font-bold tracking-tighter">${company.balance.toLocaleString()}</p>
           </div>
        </header>

        {activeTab === 'dashboard' && <DashboardView />}
        {activeTab === 'flight-monitor' && <ActiveFlightMonitor />}
        {activeTab === 'pilot_area' && <PilotAreaView />}
        
        {activeTab === 'accounting' && (
          <div className="space-y-8 animate-in slide-in-from-right-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               {[
                  { label: 'Receita Operacional', value: transactions.filter(t=>t.type==='credit').reduce((a,b)=>a+b.amount,0), color: 'text-emerald-400' },
                  { label: 'Custos e Despesas', value: -transactions.filter(t=>t.type==='debit').reduce((a,b)=>a+b.amount,0), color: 'text-red-400' },
                  { label: 'Lucro Líquido', value: company.balance, color: 'text-blue-400' }
               ].map((box, i) => (
                  <div key={i} className="glass-card p-10 rounded-3xl border-l-4 border-white/5">
                     <p className="text-xs text-slate-500 font-bold uppercase mb-3 tracking-widest">{box.label}</p>
                     <p className={`text-4xl font-mono font-bold tracking-tighter ${box.color}`}>${box.value.toLocaleString()}</p>
                  </div>
               ))}
            </div>
            <section className="glass-card p-10 rounded-3xl border-slate-800/50">
               <h3 className="text-xl font-bold mb-10 uppercase tracking-tighter italic">DRE - Fluxo de Caixa</h3>
               <div className="divide-y divide-slate-800/50">
                  {transactions.map(t => (
                     <div key={t.id} className="flex justify-between items-center py-6">
                        <div><p className="font-bold text-sm uppercase">{t.description}</p><p className="text-[10px] text-slate-600 font-mono mt-1 uppercase">{new Date(t.timestamp).toLocaleString()}</p></div>
                        <p className={`font-mono font-bold text-xl ${t.type === 'credit' ? 'text-emerald-400' : 'text-red-400'}`}>
                           {t.type === 'credit' ? '+' : '-'}${t.amount.toLocaleString()}
                        </p>
                     </div>
                  ))}
               </div>
            </section>
          </div>
        )}

        {activeTab === 'market' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in zoom-in-95">
             {MARKET_CANDIDATES.map(p => {
                const price = p.category === 'Widebody' ? 320000000 : p.category === 'SingleAisle' ? 85000000 : 1200000;
                return (
                   <div key={p.id} className="glass-card p-8 rounded-3xl border-slate-800/50 flex flex-col group">
                      <div className="w-full h-44 bg-slate-900 rounded-2xl mb-8 flex items-center justify-center border border-white/5 relative">
                         <Plane size={56} className="text-slate-800 group-hover:text-blue-500/20 transition-colors" />
                      </div>
                      <h4 className="text-xl font-bold tracking-tight">{p.model}</h4>
                      <p className="text-3xl font-mono font-bold text-emerald-400 tracking-tighter my-6">${price.toLocaleString()}</p>
                      <button onClick={()=>{ 
                         if(company.balance < price) return notify('error', "Saldo insuficiente.");
                         addToFleet({...p, id: Math.random().toString(36).substr(2,9)});
                         notify('success', `${p.model} adquirido.`);
                      }} className="w-full py-4 bg-blue-600 rounded-2xl font-bold text-xs uppercase shadow-xl shadow-blue-600/20 active:scale-95">Adquirir</button>
                   </div>
                );
             })}
          </div>
        )}

        {activeTab === 'hangar' && (
           <div className="grid grid-cols-1 gap-6">
              {fleet.map(a => (
                 <div key={a.id} className="glass-card p-10 rounded-3xl border-slate-800/50 flex justify-between items-center border-l-8 border-l-blue-600 shadow-xl group">
                    <div className="flex items-center space-x-10">
                       <div className="p-5 bg-slate-950 rounded-2xl text-slate-600 group-hover:text-blue-500 transition-colors"><Plane size={36}/></div>
                       <div><h4 className="text-3xl font-bold tracking-tighter">{a.model}</h4><p className="text-sm text-slate-500 font-mono mt-2 uppercase tracking-widest">{a.registration}</p></div>
                    </div>
                    <div className="flex space-x-16 text-center">
                       <div><p className="text-[10px] text-slate-500 font-bold uppercase mb-2 tracking-widest">Localização</p><p className="font-bold tracking-tighter text-2xl uppercase">{a.location}</p></div>
                       <div><p className="text-[10px] text-slate-500 font-bold uppercase mb-2 tracking-widest">Condição</p><p className="font-bold tracking-tighter text-2xl text-emerald-500">{a.condition}%</p></div>
                    </div>
                 </div>
              ))}
           </div>
        )}
      </main>
    </div>
  );
};

const App: React.FC = () => <AppProvider><MainLayout /></AppProvider>;
export default App;
