import { useState, useEffect, useRef, useCallback } from "react";

// ─── DATOS DE DEMO ──────────────────────────────────────────────────────────
const EVENTOS = [
  { id: 1, nombre: "Festival Primavera Sound BA", venue: "Hipódromo de Palermo", fecha: "15 Nov 2026", aforo: 25000, estado: "EN CURSO" },
  { id: 2, nombre: "Recital Estadio Monumental", venue: "Estadio Más Monumental", fecha: "14 Jun 2026", aforo: 82800, estado: "FINALIZADO" },
  { id: 3, nombre: "Copa Davis Argentina", venue: "Parque Roca", fecha: "22 Nov 2026", aforo: 12000, estado: "PRÓXIMO" },
];

// ─── LÓGICA DE GENERADORES ───────────────────────────────────────────────────
// Consumo diesel real por KVA al 75% de carga (litros/hora)
// Fórmula estándar: KVA × 0.75 × 0.28 L/kWh ≈ L/h
// Tanques estándar de alquiler en Argentina por potencia
const GENERADORES_RAW = [
  { id:"G1", grupo:"STAGE",         kva:1200, tanqueLitros:2000, combustible:78, temp:82, ubicacion:"Lateral escenario A" },
  { id:"G2", grupo:"STAGE",         kva:1200, tanqueLitros:2000, combustible:41, temp:88, ubicacion:"Lateral escenario B" },
  { id:"G3", grupo:"GASTRO CAMPO",  kva:300,  tanqueLitros:500,  combustible:65, temp:74, ubicacion:"Campo norte" },
  { id:"G4", grupo:"GASTRO CAMPO",  kva:300,  tanqueLitros:500,  combustible:58, temp:71, ubicacion:"Campo sur" },
  { id:"G5", grupo:"ACTIVACIONES",  kva:150,  tanqueLitros:250,  combustible:82, temp:68, ubicacion:"Sector este" },
  { id:"G6", grupo:"ACTIVACIONES",  kva:150,  tanqueLitros:250,  combustible:29, temp:91, ubicacion:"Sector oeste" },
  { id:"G7", grupo:"GASTRO SÍVORI", kva:250,  tanqueLitros:400,  combustible:71, temp:75, ubicacion:"Tribuna Sívori N" },
  { id:"G8", grupo:"GASTRO SÍVORI", kva:250,  tanqueLitros:400,  combustible:53, temp:79, ubicacion:"Tribuna Sívori S" },
];

function calcularGenerador(g) {
  // Consumo real: KVA × 0.8 (factor potencia) × 0.25 L/kWh al 75% carga
  const consumoLh = Math.round(g.kva * 0.8 * 0.25 * 0.75 * 10) / 10;
  const litrosRestantes = Math.round(g.tanqueLitros * (g.combustible / 100));
  const horasRestantes = litrosRestantes / consumoLh;
  const minutosRestantes = horasRestantes * 60;
  // Hora estimada de agotamiento desde las 13:40 (hora demo)
  const ahoraMinutos = 13 * 60 + 40;
  const apagadoMinutos = ahoraMinutos + minutosRestantes;
  const apagadoH = Math.floor(apagadoMinutos / 60) % 24;
  const apagadoM = Math.floor(apagadoMinutos % 60);
  const horaApagado = `${String(apagadoH).padStart(2,"0")}:${String(apagadoM).padStart(2,"0")}`;
  // Estado basado en horas restantes y momento del show (show a las 21hs, termina ~23:30)
  const showTermina = 23 * 60 + 30;
  const llegarAlFinal = apagadoMinutos >= showTermina;
  const estado = g.combustible <= 25 ? "critico"
    : g.combustible <= 50 ? "alerta"
    : "ok";
  return {
    ...g,
    consumoLh,
    litrosRestantes,
    horasRestantes: Math.round(horasRestantes * 10) / 10,
    minutosRestantes: Math.round(minutosRestantes),
    horaApagado,
    llegarAlFinal,
    estado,
  };
}

const GENERADORES = GENERADORES_RAW.map(calcularGenerador);

const VARIABLES = [
  { id: 1, cat: "Clima",    ico: "🌡️", nombre: "Temperatura",           valor: "28°C",    estado: "ok",    umbral: ">35°C = riesgo" },
  { id: 2, cat: "Clima",    ico: "💨", nombre: "Viento",                 valor: "18 km/h", estado: "ok",    umbral: ">50 km/h = riesgo" },
  { id: 3, cat: "Clima",    ico: "🌧️", nombre: "Prob. de lluvia",       valor: "15%",     estado: "ok",    umbral: ">60% = protocolo B" },
  { id: 4, cat: "Aforo",    ico: "👥", nombre: "Sector Norte",           valor: "72%",     estado: "ok",    umbral: "Alerta al alcanzar 100%" },
  { id: 5, cat: "Aforo",    ico: "👥", nombre: "Sector Sur",             valor: "96%",     estado: "alerta",umbral: "Alerta al alcanzar 100%" },
  { id: 6, cat: "Aforo",    ico: "⭐", nombre: "Sector VIP",             valor: "61%",     estado: "ok",    umbral: "Alerta al alcanzar 100%" },
  { id: 7, cat: "Seguridad",ico: "🚨", nombre: "Incidentes reportados",  valor: "2",       estado: "ok",    umbral: ">5 = revisión" },
  { id: 8, cat: "Seguridad",ico: "🏥", nombre: "Personal médico",        valor: "12/12",   estado: "ok",    umbral: "<8 = alerta" },
  { id: 9, cat: "Logística",ico: "🍺", nombre: "Stock bebidas",          valor: "65%",     estado: "ok",    umbral: "<20% = reposición" },
  { id:10, cat: "Accesos",  ico: "🚪", nombre: "Cola Puerta Principal",  valor: "~210 p",  estado: "ok",    umbral: ">800 = alternativa" },
  { id:11, cat: "Accesos",  ico: "🚪", nombre: "Cola Puerta Lateral",    valor: "~90 p",   estado: "ok",    umbral: ">500 = alerta" },
];

const DB_PUNTOS = [
  { id:"P1", nombre:"FOH — Campo frontal",      zona:"interior", limite:103, color:"#FF5A00" },
  { id:"P2", nombre:"Sívori — anillo bajo",     zona:"interior", limite:100, color:"#FF3C28" },
  { id:"P3", nombre:"San Martín — alto",        zona:"interior", limite:100, color:"#FF8C00" },
  { id:"P4", nombre:"Belgrano — lateral",       zona:"interior", limite:100, color:"#FFB347" },
  { id:"P5", nombre:"Perímetro norte",          zona:"exterior", limite:55,  color:"#DC143C" },
  { id:"P6", nombre:"Perímetro sur",            zona:"exterior", limite:55,  color:"#FF4500" },
];

const SCHEDULE_TASKS = [
  { label:"Estructura escenario", sub:"RigPro",        start:6,    end:12.67, color:"#FF5A00", status:"done" },
  { label:"Colgado PA principal", sub:"Sonido Pro SA ⚠",start:13,  end:16,   color:"#DC143C", status:"late", alert:true },
  { label:"Colgado iluminación",  sub:"LightArt",      start:12,   end:15,   color:"#FF8C00", status:"active" },
  { label:"Pantallas LED",        sub:"ScreenTech",     start:10,   end:14,   color:"#FF5A00", status:"done" },
  { label:"Sound check banda",    sub:"Dir. técnico",  start:16,   end:18,   color:"#B22222", status:"pending" },
  { label:"Catering staff",       sub:"GourmetBA",     start:13.5, end:17,   color:"#FF8C00", status:"active" },
  { label:"Seguridad privada",    sub:"SecureEvent",   start:17,   end:24,   color:"#8B0000", status:"pending" },
  { label:"Show principal",       sub:"Artista",       start:21,   end:23.5, color:"#FF3C28", status:"pending" },
];

const ALERTAS_LOG = [
  { tipo:"critico", msg:"Sonido Pro SA lleva 32 min de atraso — compromete sound check 16hs", hora:"13:32" },
  { tipo:"alerta",  msg:"Sector Sur al 96% — cámaras detectan acercamiento a capacidad máxima", hora:"13:28" },
  { tipo:"alerta",  msg:"ACTIVACIONES G6 — combustible al 29% · Temperatura 91°C — recargar AHORA", hora:"13:10" },
  { tipo:"ok",      msg:"Estructura escenario completada 20 min antes — liberada para colgado", hora:"12:40" },
  { tipo:"ok",      msg:"Acceso VIP normalizado — cola resuelta en 8 min", hora:"12:15" },
];

// ─── UTILIDADES ─────────────────────────────────────────────────────────────
function genDB(punto, t) {
  const base = punto.zona === "interior"
    ? (punto.id === "P1" ? 98 : punto.id === "P2" ? 94 : 90)
    : 52;
  return Math.min(Math.max(base + (Math.random()-0.5)*6 + Math.sin(t/8)*3 + (Math.random()>0.97?Math.random()*7:0), 40), 115);
}

function statusStyle(s) {
  if (s === "ok")     return { dot:"bg-emerald-500", text:"text-emerald-400", border:"border-emerald-500/20", bg:"bg-emerald-500/5",  label:"OK" };
  if (s === "alerta") return { dot:"bg-amber-400 animate-pulse", text:"text-amber-400", border:"border-amber-500/30", bg:"bg-amber-500/8", label:"ALERTA" };
  if (s === "critico")return { dot:"bg-red-500 animate-pulse", text:"text-red-400", border:"border-red-500/30", bg:"bg-red-500/8", label:"CRÍTICO" };
  return { dot:"bg-slate-500", text:"text-slate-400", border:"border-slate-700", bg:"bg-slate-800/30", label:"-" };
}

// ─── COMPONENTES BASE ────────────────────────────────────────────────────────
function Logo({ size = "md" }) {
  const s = size === "lg" ? "text-3xl" : size === "sm" ? "text-lg" : "text-xl";
  return (
    <span className={`font-black tracking-tighter ${s}`}>
      <span className="text-white">SHOW</span>
      <span style={{ color:"#FF5A00" }}>CTRL</span>
    </span>
  );
}

function Badge({ children, type = "default" }) {
  const colors = {
    default: "bg-slate-800 text-slate-300 border-slate-700",
    orange:  "text-orange-400 border-orange-500/40",
    red:     "text-red-400 border-red-500/40",
    green:   "text-emerald-400 border-emerald-500/40",
    amber:   "text-amber-400 border-amber-500/40",
  };
  return (
    <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${colors[type]}`}
      style={type==="orange" ? {background:"rgba(255,90,0,0.12)"} : type==="red" ? {background:"rgba(220,20,60,0.12)"} : {}}>
      {children}
    </span>
  );
}

function Card({ children, className = "", glow }) {
  return (
    <div className={`rounded-xl border border-white/5 bg-[#111] ${className}`}
      style={glow ? { boxShadow:`0 0 24px ${glow}22` } : {}}>
      {children}
    </div>
  );
}

function SectionHeader({ label, title, color = "#FF5A00" }) {
  return (
    <div className="mb-5">
      <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color }}>{label}</span>
      <h2 className="text-xl font-black text-white mt-0.5">{title}</h2>
    </div>
  );
}

// ─── MÓDULO: DASHBOARD ───────────────────────────────────────────────────────
function ModuleDashboard({ evento }) {
  const [vars, setVars] = useState(VARIABLES);
  const [editId, setEditId] = useState(null);
  const [editVal, setEditVal] = useState("");

  const alertas = vars.filter(v => v.estado !== "ok");
  const cats = [...new Set(vars.map(v => v.cat))];

  return (
    <div>
      <SectionHeader label="Monitor en tiempo real" title="Vista general del evento" />

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label:"Asistentes est.",  val: evento.aforo.toLocaleString("es-AR"), sub:"en venue" },
          { label:"Alertas activas",  val: alertas.length, sub:"requieren acción", accent:"#FF5A00" },
          { label:"Variables OK",     val: vars.filter(v=>v.estado==="ok").length, sub:`de ${vars.length} totales` },
          { label:"Próx. hito",       val: "Sound check", sub:"16:00 hs" },
        ].map((s,i) => (
          <Card key={i} className="p-4" glow={i===1&&alertas.length>0?"#FF5A00":null}>
            <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">{s.label}</p>
            <p className="text-2xl font-black" style={{ color: s.accent || "white" }}>{s.val}</p>
            <p className="text-[10px] text-white/30 mt-1">{s.sub}</p>
          </Card>
        ))}
      </div>

      {/* Alertas panel */}
      {alertas.length > 0 && (
        <Card className="mb-5 p-4 border-orange-500/20" glow="#FF5A00">
          <p className="text-[10px] font-bold text-orange-400 uppercase tracking-wider mb-3">
            ⚠ Variables que requieren atención
          </p>
          <div className="space-y-2">
            {alertas.map(a => {
              const st = statusStyle(a.estado);
              return (
                <div key={a.id} className={`flex items-center justify-between px-3 py-2 rounded-lg ${st.bg} border ${st.border}`}>
                  <span className="text-sm text-white/70">{a.ico} {a.nombre}</span>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-bold ${st.text}`}>{a.valor}</span>
                    <span className="text-[10px] text-white/30">{a.umbral}</span>
                    <Badge type="amber">{st.label}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Variables por categoría */}
      {cats.map(cat => (
        <div key={cat} className="mb-4">
          <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2 flex items-center gap-2">
            <span className="w-4 h-px bg-white/20" />
            {cat}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {vars.filter(v=>v.cat===cat).map(v => {
              const st = statusStyle(v.estado);
              return (
                <Card key={v.id} className={`flex items-center justify-between p-3 ${st.bg} border ${st.border}`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${st.dot}`} />
                    <div>
                      <p className="text-sm text-white/80">{v.ico} {v.nombre}</p>
                      <p className="text-[10px] text-white/30">{v.umbral}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {editId === v.id ? (
                      <div className="flex gap-1">
                        <input className="bg-black border border-white/10 rounded px-2 py-1 text-xs text-white w-20"
                          value={editVal} onChange={e => setEditVal(e.target.value)} autoFocus />
                        <button onClick={() => { setVars(prev => prev.map(x => x.id===v.id ? {...x, valor:editVal} : x)); setEditId(null); }}
                          className="text-xs bg-orange-500 px-2 py-1 rounded text-black font-bold">✓</button>
                        <button onClick={() => setEditId(null)} className="text-xs bg-white/10 px-2 py-1 rounded text-white/50">✕</button>
                      </div>
                    ) : (
                      <>
                        <span className={`text-sm font-bold ${st.text}`}>{v.valor}</span>
                        <button onClick={() => { setEditId(v.id); setEditVal(v.valor); }}
                          className="text-white/20 hover:text-white/50 text-xs">✏️</button>
                      </>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      {/* ── PANEL DE GENERADORES ────────────────────────────────────────────── */}
      <div className="mb-4">
        <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3 flex items-center gap-2">
          <span className="w-4 h-px bg-white/20" />
          Generadores eléctricos
          <span className="ml-auto text-[9px] normal-case font-normal text-white/20">8 unidades · Monitoreo en tiempo real</span>
        </p>

        {/* Alertas de generadores */}
        {GENERADORES.filter(g=>g.estado!=="ok").length > 0 && (
          <div className="mb-3 space-y-1.5">
            {GENERADORES.filter(g=>g.estado!=="ok").map(g => {
              const isCrit = g.estado==="critico";
              return (
                <div key={g.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-xs ${
                  isCrit ? "border-red-500/40 bg-red-500/8 text-red-400" : "border-amber-500/30 bg-amber-500/8 text-amber-400"
                }`}>
                  <span>{isCrit ? "🚨" : "⚠️"}</span>
                  <span className="font-bold">{g.grupo} {g.id}</span>
                  <span className="text-white/50">·</span>
                  <span>{g.kva} KVA · {g.ubicacion}</span>
                  <span className="ml-auto font-black">
                    {isCrit ? `CRÍTICO — ${g.combustible}% combustible` : `ALERTA — ${g.combustible}% combustible`}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Grid de generadores por grupo */}
        {["STAGE", "GASTRO CAMPO", "ACTIVACIONES", "GASTRO SÍVORI"].map(grupo => {
          const gens = GENERADORES.filter(g=>g.grupo===grupo);
          const kva = gens[0]?.kva;
          const grupoOk = gens.every(g=>g.estado==="ok");
          const grupoCrit = gens.some(g=>g.estado==="critico");
          const grupoAlerta = gens.some(g=>g.estado==="alerta");
          const grupoColor = grupoCrit ? "#DC143C" : grupoAlerta ? "#FF5A00" : "#4ade80";

          return (
            <div key={grupo} className="mb-4">
              {/* Grupo header */}
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full" style={{ background: grupoColor }} />
                <span className="text-xs font-black text-white/70">⚡ {grupo}</span>
                <span className="text-[10px] text-white/30">{kva} KVA</span>
                <span className="text-[10px] font-bold ml-auto" style={{ color: grupoColor }}>
                  {grupoCrit ? "CRÍTICO" : grupoAlerta ? "ALERTA" : "OK"}
                </span>
              </div>

              {/* Cards de cada generador del grupo */}
              <div className="grid grid-cols-2 gap-2">
                {gens.map(g => {
                  const st = statusStyle(g.estado);
                  const fuelColor = g.combustible <= 25 ? "#DC143C"
                    : g.combustible <= 50 ? "#FF5A00"
                    : g.combustible <= 70 ? "#facc15"
                    : "#4ade80";
                  const tempColor = g.temp >= 95 ? "#DC143C"
                    : g.temp >= 85 ? "#FF5A00"
                    : "#4ade80";

                  return (
                    <Card key={g.id} className={`p-4 border ${st.border} ${st.bg}`} glow={g.estado!=="ok"?grupoColor:null}>
                      {/* Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${st.dot}`} />
                          <span className="text-xs font-black text-white">{g.id}</span>
                          <span className="text-[10px] text-white/30">{g.kva} KVA</span>
                        </div>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${st.text} ${st.border}`}
                          style={{ background: st.bg }}>
                          {st.label}
                        </span>
                      </div>

                      {/* Combustible */}
                      <div className="mb-2">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] text-white/40">Combustible</span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-white/30">{g.litrosRestantes} L</span>
                            <span className="text-xs font-black" style={{ color: fuelColor }}>{g.combustible}%</span>
                          </div>
                        </div>
                        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{ width:`${g.combustible}%`, background: fuelColor }} />
                        </div>
                      </div>

                      {/* Temperatura */}
                      <div className="mb-3">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-[10px] text-white/40">Temperatura</span>
                          <span className="text-xs font-black" style={{ color: tempColor }}>{g.temp}°C</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <div className="h-full rounded-full transition-all"
                            style={{ width:`${Math.min((g.temp/110)*100,100)}%`, background: tempColor }} />
                        </div>
                      </div>

                      {/* ── PREDICCIÓN DE AUTONOMÍA ── */}
                      <div className="rounded-lg px-3 py-2 border mb-2"
                        style={{
                          background: g.llegarAlFinal ? "rgba(74,222,128,0.06)" : "rgba(220,20,60,0.08)",
                          borderColor: g.llegarAlFinal ? "rgba(74,222,128,0.2)" : "rgba(220,20,60,0.3)",
                        }}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-white/40">Autonomía estimada</span>
                          <span className="text-xs font-black"
                            style={{ color: g.llegarAlFinal ? "#4ade80" : "#DC143C" }}>
                            {g.horasRestantes >= 1
                              ? `${Math.floor(g.horasRestantes)}h ${Math.round((g.horasRestantes % 1) * 60)}min`
                              : `${g.minutosRestantes} min`}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-white/40">Se apaga aprox.</span>
                          <span className="text-xs font-black"
                            style={{ color: g.llegarAlFinal ? "#4ade80" : "#DC143C" }}>
                            {g.horaApagado} hs
                          </span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <span className="text-[9px]">{g.llegarAlFinal ? "✅" : "⛽"}</span>
                          <span className="text-[9px] font-bold"
                            style={{ color: g.llegarAlFinal ? "#4ade80" : "#DC143C" }}>
                            {g.llegarAlFinal
                              ? "Llega hasta el final del show"
                              : "NO llega al final — recargar antes de " + g.horaApagado}
                          </span>
                        </div>
                        <div className="mt-1 text-[9px] text-white/20">
                          Consumo: {g.consumoLh} L/h · Tanque: {g.tanqueLitros} L total
                        </div>
                      </div>

                      {/* Ubicación */}
                      <p className="text-[9px] text-white/20">📍 {g.ubicacion}</p>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── MÓDULO: AFORO / MAPA ────────────────────────────────────────────────────
function ModuleAforo() {
  const [hovered, setHovered] = useState(null);
  const sectors = [
    { id:"SV", nombre:"Sívori",     cap:26890, pct:82, col:"#FF5A00", path:"M 78 338 Q 250 448 422 338 L 390 292 Q 250 398 110 292 Z", tx:250, ty:390 },
    { id:"SM", nombre:"San Martín", cap:17755, pct:72, col:"#FF8C00", path:"M 110 208 Q 250 102 390 208 L 358 252 Q 250 152 142 252 Z", tx:250, ty:170 },
    { id:"CE", nombre:"Centenario", cap:0,     pct:0,  col:"#444",    path:"M 358 150 Q 472 250 358 350 L 320 318 Q 428 250 320 182 Z", tx:408, ty:255 },
    { id:"BL", nombre:"Belgrano",   cap:17000, pct:68, col:"#DC143C", path:"M 142 150 Q 28 250 142 350 L 180 318 Q 72 250 180 182 Z",  tx:90,  ty:255 },
    { id:"CA", nombre:"Campo",      cap:30000, pct:85, col:"#FF3C28", cx:230, cy:265, rx:112, ry:88, isEllipse:true, tx:200, ty:268 },
  ];

  return (
    <div>
      <SectionHeader label="Control de aforo" title="Mapa de calor — Estadio Monumental" />
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label:"Asistentes", val:"82.800" },
          { label:"Sector crítico", val:"Campo 85%", accent:"#FF5A00" },
          { label:"Centenario", val:"Escenario", sub:"0 espectadores" },
          { label:"Cap. efectiva", val:"~64.000 + campo" },
        ].map((s,i) => (
          <Card key={i} className="p-3">
            <p className="text-[10px] text-white/40 uppercase tracking-wider">{s.label}</p>
            <p className="text-lg font-black mt-1" style={{ color: s.accent||"white" }}>{s.val}</p>
            {s.sub && <p className="text-[10px] text-white/30">{s.sub}</p>}
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <Card className="p-4">
            <svg viewBox="0 0 500 500" width="100%" role="img" aria-label="Mapa de calor del Estadio Monumental">
              <ellipse cx="250" cy="250" rx="228" ry="218" fill="#0a0a0a" stroke="#222" strokeWidth="1"/>
              {sectors.map(s => (
                <g key={s.id}
                  onMouseEnter={() => setHovered(s)}
                  onMouseLeave={() => setHovered(null)}
                  style={{ cursor:"pointer" }}>
                  {s.isEllipse
                    ? <ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry}
                        fill={s.col} fillOpacity={s.pct===0?0.1:0.75}
                        stroke={s.col} strokeWidth="1.5" strokeOpacity="0.8"/>
                    : <path d={s.path} fill={s.col} fillOpacity={s.pct===0?0.1:0.75}
                        stroke={s.col} strokeWidth="1.2" strokeOpacity="0.8"/>}
                  {s.id==="CE" && (
                    <rect x="332" y="198" width="88" height="104" rx="4" fill="#1a1060" fillOpacity="0.9"/>
                  )}
                  <text x={s.tx} y={s.ty-8} textAnchor="middle" fontSize="11" fontWeight="600"
                    fill={s.pct===0?"#666":"#fff"} fillOpacity="0.9">
                    {s.nombre}
                  </text>
                  <text x={s.tx} y={s.ty+6} textAnchor="middle" fontSize="10"
                    fill={s.pct===0?"#444":s.col}>
                    {s.id==="CE" ? "ESCENARIO" : `${s.cap>0?s.cap.toLocaleString("es-AR"):0} · ${s.pct}%`}
                  </text>
                  {s.pct >= 85 && s.pct > 0 && (
                    <circle cx={s.tx+40} cy={s.ty-20} r="7" fill="#FF5A00" stroke="white" strokeWidth="1.5"/>
                  )}
                </g>
              ))}
              <text x="250" y="18"  textAnchor="middle" fontSize="9" fill="#444">N — San Martín</text>
              <text x="250" y="492" textAnchor="middle" fontSize="9" fill="#444">S — Sívori</text>
              <text x="488" y="255" textAnchor="middle" fontSize="8" fill="#444">E</text>
              <text x="12"  y="255" textAnchor="middle" fontSize="8" fill="#444">O</text>
            </svg>
            {hovered && (
              <div className="mt-2 px-4 py-2 rounded-lg border border-orange-500/30 text-sm"
                style={{ background:"rgba(255,90,0,0.08)" }}>
                <span className="font-bold text-orange-400">{hovered.nombre}</span>
                <span className="text-white/50 ml-3">
                  {hovered.pct===0 ? "Ocupado por escenario" : `${hovered.cap?.toLocaleString("es-AR")} personas · ${hovered.pct}% ocupación`}
                </span>
              </div>
            )}
          </Card>
        </div>
        <div className="space-y-3">
          <Card className="p-4">
            <p className="text-[10px] text-white/40 uppercase tracking-wider mb-3">Ocupación por sector</p>
            <div className="space-y-3">
              {sectors.filter(s=>s.pct>0).sort((a,b)=>b.pct-a.pct).map(s => (
                <div key={s.id}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-white/70">{s.nombre}</span>
                    <span className="font-bold" style={{ color:s.col }}>{s.pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5">
                    <div className="h-full rounded-full transition-all" style={{ width:`${s.pct}%`, background:s.col }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-4 border-orange-500/20" glow="#FF5A00">
            <p className="text-[10px] text-orange-400 font-bold uppercase tracking-wider mb-2">Predicción IA</p>
            <p className="text-xs text-white/60 leading-relaxed">
              Las cámaras detectan densidad alta en el Campo. El sector está próximo a completarse. Se recomienda activar el corredor de seguridad frontal.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── MÓDULO: SCHEDULE SEMANAL ────────────────────────────────────────────────
const DIAS_SEMANA = ["Lun 10", "Mar 11", "Mié 12", "Jue 13", "Vie 14", "Sáb 15", "Dom 16"];
const SEMANA_TASKS = [
  // label, proveedor, día(0-6), horaInicio, horaFin, color, status, tipo, confirmado
  { id:1,  label:"Montaje estructura escenario",  prov:"RigPro",          tel:"11-4521-8834", dia:0, hi:7,  hf:18, color:"#FF5A00", status:"done",    tipo:"montaje",   conf:"08:12" },
  { id:2,  label:"Instalación vallado perimetral",prov:"Barricade SA",    tel:"11-7743-5566", dia:0, hi:8,  hf:14, color:"#FF8C00", status:"done",    tipo:"montaje",   conf:"08:31" },
  { id:3,  label:"Montaje pantallas LED",         prov:"ScreenTech",      tel:"11-3321-0098", dia:1, hi:7,  hf:16, color:"#FF5A00", status:"done",    tipo:"montaje",   conf:"07:44" },
  { id:4,  label:"Instalación PA principal",      prov:"Sonido Pro SA",   tel:"11-6678-2210", dia:1, hi:10, hf:22, color:"#DC143C", status:"done",    tipo:"audio",     conf:"10:05" },
  { id:5,  label:"Colgado sistema iluminación",   prov:"LightArt",        tel:"11-5543-9921", dia:2, hi:7,  hf:17, color:"#FF8C00", status:"done",    tipo:"ilum",      conf:"07:50" },
  { id:6,  label:"Instalación generadores",       prov:"ElectroPower",    tel:"11-9012-3344", dia:2, hi:8,  hf:14, color:"#FF5A00", status:"done",    tipo:"electrica", conf:"08:22" },
  { id:7,  label:"Sound check técnico",           prov:"Dir. técnico",    tel:"11-1122-3344", dia:3, hi:10, hf:14, color:"#B22222", status:"done",    tipo:"ensayo",    conf:"10:01" },
  { id:8,  label:"Montaje catering y barras",     prov:"GourmetBA",       tel:"11-3398-5567", dia:3, hi:7,  hf:18, color:"#FF8C00", status:"done",    tipo:"logistica", conf:"07:38" },
  { id:9,  label:"Prueba de luces con artista",   prov:"LightArt",        tel:"11-5543-9921", dia:3, hi:15, hf:20, color:"#FF8C00", status:"done",    tipo:"ensayo",    conf:"15:10" },
  { id:10, label:"Prueba de sonido con artista",  prov:"Sonido Pro SA",   tel:"11-6678-2210", dia:3, hi:15, hf:20, color:"#DC143C", status:"done",    tipo:"ensayo",    conf:"15:03" },
  { id:11, label:"Acreditaciones y prensa",       prov:"Producción gral", tel:"11-9911-2233", dia:4, hi:9,  hf:14, color:"#FF5A00", status:"done",    tipo:"logistica", conf:"09:15" },
  { id:12, label:"Seguridad privada — ingreso",   prov:"SecureEvent",     tel:"11-9982-1234", dia:4, hi:14, hf:24, color:"#8B0000", status:"done",    tipo:"seguridad", conf:"14:02" },
  { id:13, label:"Atención médica — guardia",     prov:"MedEvent",        tel:"11-6612-3344", dia:4, hi:16, hf:24, color:"#DC143C", status:"done",    tipo:"seguridad", conf:"16:08" },
  { id:14, label:"SHOW PRINCIPAL",                prov:"Producción gral", tel:"",             dia:5, hi:21, hf:24, color:"#FF3C28", status:"done",    tipo:"show",      conf:"—" },
  { id:15, label:"Desmontaje PA y escenario",     prov:"RigPro + Sonido", tel:"11-4521-8834", dia:6, hi:6,  hf:18, color:"#FF5A00", status:"active",  tipo:"desmontaje",conf:null },
  { id:16, label:"Desmontaje iluminación",        prov:"LightArt",        tel:"11-5543-9921", dia:6, hi:6,  hf:16, color:"#FF8C00", status:"late",    tipo:"desmontaje",conf:null },
  { id:17, label:"Desmontaje catering",           prov:"GourmetBA",       tel:"11-3398-5567", dia:6, hi:7,  hf:14, color:"#FF8C00", status:"pending", tipo:"desmontaje",conf:null },
  { id:18, label:"Retiro vallado",                prov:"Barricade SA",    tel:"11-7743-5566", dia:6, hi:9,  hf:14, color:"#FF5A00", status:"pending", tipo:"desmontaje",conf:null },
];

const TIPO_COLORS = {
  montaje:"#FF5A00", audio:"#DC143C", ilum:"#FF8C00", electrica:"#FFB347",
  ensayo:"#B22222",  logistica:"#FF8C00", seguridad:"#8B0000", show:"#FF3C28", desmontaje:"#555"
};

function ModuleSchedule() {
  const [diaActivo, setDiaActivo] = useState(5); // sábado = día del show
  const [tareas, setTareas] = useState(SEMANA_TASKS);
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [modalProv, setModalProv] = useState(null);
  const HS=6, HE=24, TOTAL=HE-HS, NOW_DIA=5, NOW_H=0.5;

  const tareasDia = tareas.filter(t => t.dia === diaActivo && (filtroTipo==="todos" || t.tipo===filtroTipo));
  const alertasDia = tareas.filter(t => t.dia===diaActivo && (t.status==="late" || (t.status==="active" && !t.conf)));
  const confirmadosDia = tareas.filter(t => t.dia===diaActivo && t.conf && t.conf!=="—").length;
  const totalDia = tareas.filter(t => t.dia===diaActivo).length;

  function confirmarLlegada(id) {
    const hora = new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"});
    setTareas(prev => prev.map(t => t.id===id ? {...t, conf:hora, status:t.status==="pending"?"active":t.status} : t));
    setModalProv(null);
  }

  const statusInfo = {
    done:   { label:"✓ Completado",  cls:"text-emerald-400", bg:"bg-emerald-500/10 border-emerald-500/20" },
    active: { label:"● En curso",    cls:"text-orange-400",  bg:"bg-orange-500/10 border-orange-500/20" },
    late:   { label:"⚠ Atrasado",   cls:"text-red-400",     bg:"bg-red-500/10 border-red-500/30" },
    pending:{ label:"◌ Pendiente",   cls:"text-white/30",    bg:"bg-white/3 border-white/5" },
  };

  const tiposDia = [...new Set(tareas.filter(t=>t.dia===diaActivo).map(t=>t.tipo))];

  return (
    <div>
      <SectionHeader label="Coordinación de producción" title="Schedule semanal" />

      {/* Selector de día */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
        {DIAS_SEMANA.map((d,i) => {
          const tDia = tareas.filter(t=>t.dia===i);
          const hayAlerta = tDia.some(t=>t.status==="late");
          const esShow = i===5;
          return (
            <button key={i} onClick={()=>{ setDiaActivo(i); setFiltroTipo("todos"); }}
              className={`flex-shrink-0 px-4 py-2.5 rounded-xl text-xs font-bold border transition-all relative ${
                diaActivo===i
                  ? "text-white border-orange-500/50"
                  : "text-white/40 border-white/5 hover:border-white/10"
              }`}
              style={diaActivo===i ? { background:"rgba(255,90,0,0.15)" } : {}}>
              {hayAlerta && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
              <span className={esShow ? "text-orange-400" : ""}>{d}</span>
              {esShow && <span className="block text-[9px] text-orange-400/60 font-normal">SHOW</span>}
              {!esShow && <span className="block text-[9px] text-white/20 font-normal">{tDia.length} tareas</span>}
            </button>
          );
        })}
      </div>

      {/* Stats del día */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label:"Tareas del día",      val:totalDia,          col:"white" },
          { label:"Confirmaron llegada", val:`${confirmadosDia}/${totalDia}`, col:"#FF5A00" },
          { label:"Alertas activas",     val:alertasDia.length, col:alertasDia.length>0?"#DC143C":"#4ade80" },
          { label:"Completadas",         val:tareas.filter(t=>t.dia===diaActivo&&t.status==="done").length, col:"#4ade80" },
        ].map((s,i) => (
          <Card key={i} className="p-3">
            <p className="text-[10px] text-white/30 uppercase tracking-wider">{s.label}</p>
            <p className="text-2xl font-black mt-1" style={{ color:s.col }}>{s.val}</p>
          </Card>
        ))}
      </div>

      {/* Alertas del día */}
      {alertasDia.length > 0 && (
        <div className="space-y-2 mb-4">
          {alertasDia.map(a => (
            <div key={a.id} className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-red-500/30 bg-red-500/8">
              <span>⚠️</span>
              <p className="text-sm text-red-400 flex-1">
                <span className="font-bold">{a.prov}</span> — {a.label} {a.status==="late" ? "· sin confirmar llegada" : "· en curso sin confirmación"}
              </p>
              <button onClick={()=>setModalProv(a)}
                className="text-xs px-3 py-1.5 rounded-lg font-bold text-black flex-shrink-0"
                style={{ background:"#DC143C" }}>
                Contactar
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Filtro por tipo */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {["todos", ...tiposDia].map(t => (
          <button key={t} onClick={()=>setFiltroTipo(t)}
            className={`text-[10px] font-bold px-3 py-1 rounded-full border transition-all capitalize ${
              filtroTipo===t ? "text-white border-orange-500/50" : "text-white/30 border-white/5"
            }`}
            style={filtroTipo===t ? { background:"rgba(255,90,0,0.12)" } : {}}>
            {t}
          </button>
        ))}
      </div>

      {/* Gantt del día */}
      <Card className="p-4 mb-4">
        <div className="flex mb-2 ml-44">
          {[6,8,10,12,14,16,18,20,22,24].map(h => (
            <div key={h} className="flex-1 text-[9px] text-white/15 border-l border-white/5 pl-1">{h}h</div>
          ))}
        </div>
        <div className="space-y-1.5">
          {tareasDia.map(t => {
            const si = statusInfo[t.status];
            const barBg = t.status==="done" ? TIPO_COLORS[t.tipo]+"88"
                        : t.status==="late" ? "#DC143C99"
                        : t.status==="active" ? TIPO_COLORS[t.tipo]+"cc"
                        : TIPO_COLORS[t.tipo]+"33";
            return (
              <div key={t.id} className="flex items-center">
                <div className="w-44 flex-shrink-0 pr-3 cursor-pointer" onClick={()=>setModalProv(t)}>
                  <p className="text-xs text-white/70 truncate hover:text-white transition-colors">{t.label}</p>
                  <p className="text-[10px] truncate" style={{ color: TIPO_COLORS[t.tipo]+"99" }}>{t.prov}</p>
                </div>
                <div className="flex-1 h-9 relative rounded bg-white/3 overflow-hidden">
                  {diaActivo===NOW_DIA && (
                    <div className="absolute top-0 bottom-0 w-px bg-white/25 z-10"
                      style={{ left:`${((NOW_H-HS)/TOTAL*100).toFixed(1)}%` }} />
                  )}
                  <div className="absolute top-1 h-7 rounded flex items-center px-2 text-[9px] font-bold overflow-hidden gap-1"
                    style={{
                      left:`${((t.hi-HS)/TOTAL*100).toFixed(1)}%`,
                      width:`${((t.hf-t.hi)/TOTAL*100).toFixed(1)}%`,
                      background: barBg,
                      border: t.status==="late" ? "1px solid #DC143C" : "none",
                    }}>
                    {t.status==="done" ? "✓" : t.status==="late" ? "⚠" : ""} {t.hi}:00–{t.hf}:00
                    {t.conf && t.conf!=="—" && <span className="ml-auto text-[8px] opacity-70">✓{t.conf}</span>}
                  </div>
                </div>
                {/* Confirmación */}
                <div className="w-28 flex-shrink-0 pl-2 flex items-center justify-end gap-2">
                  {t.conf && t.conf!=="—" ? (
                    <span className="text-[10px] text-emerald-400 font-bold">✓ {t.conf}</span>
                  ) : t.status!=="pending" ? (
                    <button onClick={()=>setModalProv(t)}
                      className="text-[10px] px-2 py-1 rounded border border-orange-500/30 text-orange-400 hover:bg-orange-500/10 transition-all">
                      Confirmar
                    </button>
                  ) : (
                    <span className="text-[10px] text-white/15">Pendiente</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Lista de proveedores del día */}
      <div className="grid grid-cols-2 gap-2">
        {tareasDia.map(t => {
          const si = statusInfo[t.status];
          return (
            <Card key={t.id} className={`p-3 flex items-center gap-3 cursor-pointer hover:border-orange-500/20 transition-all ${si.bg}`}
              onClick={()=>setModalProv(t)}>
              <div className="w-2 h-8 rounded-full flex-shrink-0" style={{ background: TIPO_COLORS[t.tipo] }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{t.prov}</p>
                <p className="text-[10px] text-white/40 truncate">{t.hi}:00 — {t.hf}:00</p>
              </div>
              <div className="text-right">
                <p className={`text-[10px] font-bold ${si.cls}`}>{si.label}</p>
                {t.conf && t.conf!=="—" && <p className="text-[9px] text-white/20">llegó {t.conf}</p>}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Modal proveedor */}
      {modalProv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background:"rgba(0,0,0,0.85)" }}
          onClick={e=>{ if(e.target===e.currentTarget) setModalProv(null); }}>
          <div className="w-full max-w-sm rounded-2xl border border-orange-500/20 p-5"
            style={{ background:"#131313" }}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[10px] text-orange-400 uppercase tracking-wider mb-1">{modalProv.tipo}</p>
                <h3 className="text-base font-black text-white">{modalProv.label}</h3>
                <p className="text-xs text-white/40 mt-0.5">{modalProv.prov}</p>
              </div>
              <button onClick={()=>setModalProv(null)} className="text-white/20 hover:text-white/50 text-xl">✕</button>
            </div>

            <div className="space-y-2 mb-4">
              {[
                { label:"Horario asignado", val:`${modalProv.hi}:00 — ${modalProv.hf}:00` },
                { label:"Día",              val:DIAS_SEMANA[modalProv.dia] },
                { label:"Confirmó llegada", val: modalProv.conf && modalProv.conf!=="—" ? `✓ ${modalProv.conf}` : "Sin confirmar" },
                { label:"Teléfono",         val: modalProv.tel || "—" },
              ].map((r,i) => (
                <div key={i} className="flex justify-between py-1.5 border-b border-white/5">
                  <span className="text-xs text-white/30">{r.label}</span>
                  <span className="text-xs font-bold text-white">{r.val}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              {(!modalProv.conf || modalProv.conf==="—") && (
                <button onClick={()=>confirmarLlegada(modalProv.id)}
                  className="w-full py-3 rounded-xl font-bold text-sm text-black"
                  style={{ background:"linear-gradient(135deg,#FF5A00,#DC143C)" }}>
                  ✓ Registrar llegada ahora
                </button>
              )}
              {modalProv.tel && (
                <a href={`https://wa.me/54${modalProv.tel.replace(/\D/g,"")}`} target="_blank" rel="noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-bold text-sm border border-white/10 text-white/60 hover:border-green-500/40 hover:text-green-400 transition-all">
                  WhatsApp a {modalProv.prov}
                </a>
              )}
              <button onClick={()=>setModalProv(null)}
                className="w-full py-2 rounded-xl text-xs text-white/20 hover:text-white/40 transition-all">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MÓDULO: MONITOR dB ──────────────────────────────────────────────────────
function ModuleDB() {
  const [vals, setVals] = useState(() => DB_PUNTOS.map(p => ({ id:p.id, v:genDB(p,0), hist:[] })));
  const [running, setRunning] = useState(true);
  const tRef = useRef(0);

  useEffect(() => {
    if (!running) return;
    const interval = setInterval(() => {
      tRef.current++;
      setVals(prev => prev.map((v,i) => {
        const nv = genDB(DB_PUNTOS[i], tRef.current);
        return { ...v, v:nv, hist:[...v.hist.slice(-50), nv] };
      }));
    }, 700);
    return () => clearInterval(interval);
  }, [running]);

  return (
    <div>
      <SectionHeader label="Control acústico" title="Monitor dB en tiempo real" />
      <div className="flex items-center gap-3 mb-4">
        <button onClick={()=>setRunning(r=>!r)}
          className={`text-xs px-4 py-2 rounded-lg font-bold border transition-all ${running?"border-emerald-500/40 text-emerald-400 bg-emerald-500/10":"border-white/10 text-white/40"}`}>
          {running ? "● EN VIVO" : "⏸ PAUSADO"}
        </button>
        <span className="text-xs text-white/30">Actualización cada 700ms · OMS + Normativa CABA</span>
      </div>

      {/* Interior */}
      <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">Puntos interiores — límite OMS 103 dB(A) FOH / 100 dB(A) tribunas</p>
      <div className="grid grid-cols-4 gap-3 mb-4">
        {DB_PUNTOS.filter(p=>p.zona==="interior").map(p => {
          const v = vals.find(x=>x.id===p.id);
          const val = v?.v || 0;
          const isWarn = val >= p.limite;
          const isCrit = val >= 110;
          const col = isCrit?"#DC143C":isWarn?"#FF5A00":p.color;
          const pct = Math.min((val/110)*100, 100);
          return (
            <Card key={p.id} className={`p-4 ${isWarn?"border-orange-500/30":"border-white/5"}`} glow={isWarn?col:null}>
              <p className="text-[10px] text-white/40 mb-2 truncate">{p.nombre}</p>
              <div className="flex items-end gap-1 mb-2">
                <span className="text-3xl font-black" style={{ color:col }}>{val.toFixed(0)}</span>
                <span className="text-xs text-white/30 mb-1">dB(A)</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 mb-1">
                <div className="h-full rounded-full transition-all" style={{ width:`${pct}%`, background:col }} />
              </div>
              <div className="flex justify-between text-[9px]">
                <span className="text-white/20">límite {p.limite}dB</span>
                <span style={{ color:col }}>{isWarn ? `+${(val-p.limite).toFixed(1)}dB` : `✓ ${(p.limite-val).toFixed(1)}dB margen`}</span>
              </div>
              {/* Mini wave */}
              {v?.hist.length > 4 && (
                <svg width="100%" height="28" className="mt-2 opacity-60">
                  <polyline
                    points={v.hist.map((h,i)=>`${(i/(v.hist.length-1)*100)}%,${28-((h-40)/75)*28}`).join(" ")}
                    fill="none" stroke={col} strokeWidth="1.5"/>
                </svg>
              )}
            </Card>
          );
        })}
      </div>

      {/* Exterior */}
      <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">Puntos exteriores — límite normativa CABA 55 dB(A)</p>
      <div className="grid grid-cols-2 gap-3">
        {DB_PUNTOS.filter(p=>p.zona==="exterior").map(p => {
          const v = vals.find(x=>x.id===p.id);
          const val = v?.v || 0;
          const isWarn = val >= p.limite;
          const col = isWarn?"#DC143C":p.color;
          return (
            <Card key={p.id} className={`p-4 ${isWarn?"border-red-500/30":"border-white/5"}`} glow={isWarn?col:null}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-white/50">{p.nombre}</p>
                <Badge type={isWarn?"red":"green"}>{isWarn?"ALERTA":"OK"}</Badge>
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-4xl font-black" style={{ color:col }}>{val.toFixed(0)}</span>
                  <span className="text-xs text-white/30 ml-1">dB(A)</span>
                </div>
                <div className="flex-1">
                  <div className="h-2 rounded-full bg-white/5 mb-1">
                    <div className="h-full rounded-full" style={{ width:`${Math.min((val/65)*100,100)}%`, background:col }} />
                  </div>
                  <p className="text-[10px]" style={{ color:col }}>
                    {isWarn ? `⚠ +${(val-p.limite).toFixed(1)}dB SOBRE LÍMITE — riesgo de corte municipal`
                             : `✓ ${(p.limite-val).toFixed(1)}dB de margen antes del límite CABA`}
                  </p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ─── MÓDULO: ANÁLISIS DE PLANOS ──────────────────────────────────────────────
function ModulePlanos() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [aforo, setAforo] = useState("8000");
  const fileRef = useRef();

  async function analizar() {
    if (!aforo) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-6",
          max_tokens:1000,
          messages:[{
            role:"user",
            content:`Sos el motor de análisis normativo de SHOWCTRL. Analiza este venue para un evento de ${parseInt(aforo).toLocaleString("es-AR")} personas.

VENUE SIMULADO: Estadio cubierto de 4.200m² útiles. 
Accesos detectados:
- ACC-1 (ingreso principal): 2.40m de apertura
- ACC-2 (ingreso lateral): 1.80m de apertura  
- SE-1 (salida emergencia norte): 1.80m
- SE-2 (salida emergencia sur): 1.20m
- SERV-1 (servicio): 1.00m

Aforo declarado: ${parseInt(aforo).toLocaleString("es-AR")} personas.
Jurisdicción: CABA, Argentina.

Verificá contra IRAM 3625 y IRAM 3631. Generá el informe técnico con alertas priorizadas (🔴 CRÍTICO / 🟡 ATENCIÓN / 🔵 OBSERVACIÓN) y el aforo máximo recomendado. Sé directo y técnico. No uses asteriscos ni markdown, solo texto plano con los títulos en mayúscula.`
          }]
        })
      });
      const data = await res.json();
      setResult(data?.content?.[0]?.text || "Sin respuesta.");
    } catch(e) {
      setResult("Error de conexión. Revisá tu red.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <SectionHeader label="Módulo normativo" title="Análisis de planos e IRAM" />
      <div className="grid grid-cols-2 gap-4 mb-4">
        <Card className="p-5">
          <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Subir plano del venue</p>
          <div onClick={()=>fileRef.current.click()}
            className="border border-dashed border-white/10 hover:border-orange-500/40 rounded-xl p-8 text-center cursor-pointer transition-colors">
            <input ref={fileRef} type="file" accept=".pdf,.png,.jpg" className="hidden"
              onChange={e => setFile(e.target.files[0]?.name)} />
            <p className="text-3xl mb-2">📐</p>
            <p className="text-sm text-white/50">{file || "PDF nativo de AutoCAD o Revit"}</p>
            <p className="text-xs text-white/20 mt-1">Cotas en metros · Escala en cartucho inferior izquierdo</p>
          </div>
          {file && <p className="text-xs text-emerald-400 mt-2">✓ {file} cargado</p>}
          <div className="mt-4">
            <p className="text-xs text-white/40 mb-1">Aforo del evento</p>
            <input
              value={aforo}
              onChange={e => setAforo(e.target.value.replace(/\D/g,""))}
              placeholder="Ej: 8000"
              className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500/50 outline-none"
            />
          </div>
          <button onClick={analizar} disabled={loading}
            className="mt-4 w-full py-3 rounded-xl font-bold text-sm text-black transition-all disabled:opacity-50"
            style={{ background: loading ? "#666" : "linear-gradient(135deg,#FF5A00,#DC143C)" }}>
            {loading ? "⏳ Analizando con IA..." : "🔍 Analizar normativa IRAM"}
          </button>
        </Card>

        <Card className="p-5">
          <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Normativas integradas</p>
          {[
            { col:"#FF5A00", title:"IRAM 3625", desc:"Evacuación y salidas de emergencia. Ancho mínimo, cantidad y distancia máxima." },
            { col:"#DC143C", title:"IRAM 3631", desc:"Aforo y densidad de ocupación por tipo de uso: estadios, teatros, predios." },
            { col:"#FF8C00", title:"Cód. CABA",  desc:"Código de edificación para eventos en recintos cerrados de Buenos Aires." },
            { col:"#8B0000", title:"Ordenanzas", desc:"Regulaciones municipales del interior, actualizables sin tocar la plataforma." },
          ].map((n,i) => (
            <div key={i} className="flex gap-3 mb-3 last:mb-0">
              <div className="w-1 rounded-full flex-shrink-0" style={{ background:n.col }} />
              <div>
                <p className="text-xs font-bold" style={{ color:n.col }}>{n.title}</p>
                <p className="text-xs text-white/40 mt-0.5">{n.desc}</p>
              </div>
            </div>
          ))}
        </Card>
      </div>

      {loading && (
        <Card className="p-6">
          <div className="space-y-2">
            {[80,65,50,40].map((w,i) => (
              <div key={i} className="h-3 rounded bg-white/5 animate-pulse" style={{ width:`${w}%` }} />
            ))}
          </div>
        </Card>
      )}

      {result && (
        <Card className="p-5 border-orange-500/20" glow="#FF5A00">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/5">
            <span style={{ color:"#FF5A00" }}>🤖</span>
            <span className="text-xs text-white/40 uppercase tracking-wider">Informe generado por IA · Claude</span>
          </div>
          <pre className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap font-sans">{result}</pre>
        </Card>
      )}
    </div>
  );
}

// ─── MÓDULO: REPORTE POST-SHOW ───────────────────────────────────────────────
function ModuleReporte() {
  const incidentes = [
    { tipo:"critico", hora:"21:40", titulo:"Superpoblación — Sívori Alta y Media", desc:"Cámaras detectaron aforo completo en Sívori Alta. SHOWCTRL activó protocolo de desvío inmediatamente. Resuelto sin incidentes." },
    { tipo:"alerta",  hora:"21:35", titulo:"Densidad campo — zona frontal al escenario", desc:"Densidad de 4.2 personas/m² detectada. Barreras de contención activadas por seguridad." },
    { tipo:"alerta",  hora:"20:58", titulo:"Consumo eléctrico — pico en escenario", desc:"Pico de 118kW al encender LED y PA. Generadores de respaldo activados preventivamente 3 min antes." },
    { tipo:"ok",      hora:"22:11", titulo:"Asistencia médica — Sívori Baja", desc:"Persona detectada por cámara con postura de desmayo. Equipo médico llegó en 3 min. Alta in situ." },
    { tipo:"ok",      hora:"00:49", titulo:"Evacuación completada — 82.800 personas en 22 min", desc:"Mejora del 24% vs. referencia histórica (29 min). Protocolo anticipado de salida diferenciada por tribuna." },
  ];

  return (
    <div>
      <SectionHeader label="Resumen post-evento" title="Reporte — Recital Estadio Monumental" />

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label:"Asistentes",        val:"82.800", sub:"de 85.018 capacidad", col:"#FF5A00" },
          { label:"Alertas activadas", val:"3",      sub:"100% resueltas" },
          { label:"Evacuación",        val:"22 min", sub:"vs. 29 min histórico", col:"#FF8C00" },
          { label:"Incidentes médicos",val:"2",      sub:"ambos resueltos in situ" },
        ].map((s,i) => (
          <Card key={i} className="p-4">
            <p className="text-[10px] text-white/40 uppercase tracking-wider">{s.label}</p>
            <p className="text-2xl font-black mt-1" style={{ color:s.col||"white" }}>{s.val}</p>
            <p className="text-[10px] text-white/30 mt-1">{s.sub}</p>
          </Card>
        ))}
      </div>

      {/* Mapa de calor simplificado */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="col-span-2">
          <Card className="p-4">
            <p className="text-[10px] text-white/30 uppercase tracking-widest mb-3">Densidad de ocupación por sector</p>
            {[
              { nombre:"Sívori",     pct:99,  col:"#DC143C", cap:"26.890" },
              { nombre:"Centenario", pct:0,   col:"#333",    cap:"Escenario" },
              { nombre:"Campo",      pct:97,  col:"#FF5A00", cap:"30.000" },
              { nombre:"San Martín", pct:96,  col:"#FF8C00", cap:"17.755" },
              { nombre:"Belgrano",   pct:93,  col:"#FF8C00", cap:"17.000" },
            ].map((s,i) => (
              <div key={i} className="flex items-center gap-3 mb-3">
                <div className="w-24 text-xs text-white/60">{s.nombre}</div>
                <div className="flex-1 h-5 rounded bg-white/5 overflow-hidden relative">
                  <div className="h-full rounded transition-all" style={{ width:`${Math.min(s.pct,100)}%`, background:s.col }} />
                  {s.pct >= 98 && <div className="absolute inset-0 border border-orange-500 rounded animate-pulse opacity-60" />}
                </div>
                <div className="w-20 text-right">
                  <span className="text-xs font-bold" style={{ color:s.col }}>
                    {s.pct===0 ? "ESCENARIO" : `${s.pct}%`}
                  </span>
                </div>
                <div className="w-20 text-right text-xs text-white/30">{s.cap}</div>
              </div>
            ))}
          </Card>
        </div>
        <Card className="p-4">
          <p className="text-[10px] text-white/30 uppercase tracking-widest mb-3">Curva de evacuación</p>
          <svg viewBox="0 0 160 100" width="100%">
            <polyline points="0,0 20,22 50,52 80,78 110,92 130,98 160,100"
              fill="none" stroke="#FF5A00" strokeWidth="2" transform="scale(1,-1) translate(0,-100)"/>
            <text x="5" y="12" fontSize="8" fill="#555">100%</text>
            <text x="5" y="55" fontSize="8" fill="#555">50%</text>
            <text x="5" y="96" fontSize="8" fill="#555">0%</text>
            <text x="0" y="100" fontSize="7" fill="#333">00:29</text>
            <text x="120" y="100" fontSize="7" fill="#333">00:51</text>
          </svg>
          <p className="text-xs text-orange-400 font-bold text-center mt-2">22 min total</p>
        </Card>
      </div>

      {/* Incidentes */}
      <Card className="p-5">
        <p className="text-[10px] text-white/30 uppercase tracking-widest mb-4">Registro de incidentes</p>
        <div className="space-y-3">
          {incidentes.map((inc,i) => {
            const colors = {
              critico:{ bg:"border-red-500/30 bg-red-500/5", ico:"🚨", col:"text-red-400" },
              alerta: { bg:"border-orange-500/30 bg-orange-500/5", ico:"⚠️", col:"text-orange-400" },
              ok:     { bg:"border-emerald-500/20 bg-emerald-500/5", ico:"✅", col:"text-emerald-400" },
            }[inc.tipo];
            return (
              <div key={i} className={`flex gap-3 p-3 rounded-lg border ${colors.bg}`}>
                <span className="text-lg flex-shrink-0">{colors.ico}</span>
                <div className="flex-1">
                  <p className={`text-sm font-bold ${colors.col}`}>{inc.titulo}</p>
                  <p className="text-xs text-white/40 mt-0.5 leading-relaxed">{inc.desc}</p>
                </div>
                <span className="text-xs text-white/20 flex-shrink-0">{inc.hora}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="mt-4 flex items-center justify-between px-4 py-3 rounded-xl border border-orange-500/20"
        style={{ background:"rgba(255,90,0,0.05)" }}>
        <span className="text-xs text-white/40">Reporte listo para aseguradora y GCBA</span>
        <button className="text-xs font-bold px-4 py-2 rounded-lg text-black"
          style={{ background:"linear-gradient(135deg,#FF5A00,#DC143C)" }}>
          Descargar PDF ↗
        </button>
      </div>
    </div>
  );
}

// ─── MÓDULO: FOTOS ──────────────────────────────────────────────────────────

// ─── DATOS DEMO ───────────────────────────────────────────────────────────────
const CARPETAS_INIT = [
  {
    id: "C1",
    nombre: "Ingreso Centenario — Toma de posesión",
    tipo: "toma",
    sector: "Acceso Centenario",
    fecha: "Sáb 14 Jun · 07:12",
    autor: "Rodrigo M.",
    fotos: [
      { id:"F1", nombre:"centenario_01.jpg", tipo:"normal", hora:"07:12", nota:"Vista general puerta principal", thumb:"🚪" },
      { id:"F2", nombre:"centenario_02.jpg", tipo:"normal", hora:"07:13", nota:"Estado del piso — sin daños", thumb:"🏟️" },
      { id:"F3", nombre:"centenario_03.jpg", tipo:"normal", hora:"07:14", nota:"Paredes laterales OK", thumb:"🧱" },
    ],
    estado: "ok",
    cerrada: true,
  },
  {
    id: "C2",
    nombre: "Backstage Artista — Toma de posesión",
    tipo: "toma",
    sector: "Backstage",
    fecha: "Sáb 14 Jun · 07:45",
    autor: "Rodrigo M.",
    fotos: [
      { id:"F4", nombre:"backstage_01.jpg", tipo:"normal", hora:"07:45", nota:"Camarín principal", thumb:"🎤" },
      { id:"F5", nombre:"backstage_02.jpg", tipo:"normal", hora:"07:46", nota:"Baño — estado original", thumb:"🚿" },
    ],
    estado: "ok",
    cerrada: true,
  },
  {
    id: "C3",
    nombre: "Platea Norte — Incidente",
    tipo: "siniestro",
    sector: "Platea Norte",
    fecha: "Sáb 14 Jun · 14:33",
    autor: "Marcos T.",
    fotos: [
      { id:"F6", nombre:"siniestro_butaca_01.jpg", tipo:"siniestro", hora:"14:33", nota:"Butaca rota — fila 12, asiento 8", thumb:"💺" },
      { id:"F7", nombre:"siniestro_butaca_02.jpg", tipo:"siniestro", hora:"14:34", nota:"Vista detalle daño", thumb:"🔍" },
    ],
    estado: "siniestro",
    cerrada: false,
    notificado: true,
    notificadoHora: "14:33",
  },
];

const SECTORES = [
  "Acceso Centenario", "Acceso Sívori", "Acceso San Martín", "Acceso Belgrano",
  "Backstage", "Camarín artista", "Camarín banda", "Área de prensa",
  "Platea Norte", "Platea Sur", "Campo de juego", "Sector VIP",
  "Sala técnica PA", "Sala técnica iluminación", "Área catering",
  "Estacionamiento", "Depósito", "Sala de seguridad",
];

const TIPOS_CARPETA = [
  { id:"toma",      label:"Toma de posesión",  ico:"📥", color:"#4ade80", desc:"Documentar estado al ingresar al espacio" },
  { id:"entrega",   label:"Entrega de espacio", ico:"📤", color:"#60a5fa", desc:"Documentar estado al finalizar y entregar" },
  { id:"siniestro", label:"Siniestro / Daño",   ico:"⚠️", color:"#DC143C", desc:"Documentar rotura o incidente — notifica al productor" },
  { id:"montaje",   label:"Control de montaje",  ico:"🔧", color:"#FF8C00", desc:"Registro fotográfico del proceso de armado" },
];

// ─── UTILITIES ────────────────────────────────────────────────────────────────
function formatSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024*1024) return (bytes/1024).toFixed(0) + " KB";
  return (bytes/(1024*1024)).toFixed(1) + " MB";
}

function timeNow() {
  return new Date().toLocaleTimeString("es-AR", { hour:"2-digit", minute:"2-digit" });
}

function dateNow() {
  return new Date().toLocaleDateString("es-AR", { weekday:"short", day:"numeric", month:"short" }) + " · " + timeNow();
}

// ─── COMPONENTES BASE ─────────────────────────────────────────────────────────

// ─── NOTIFICACIÓN TOAST ───────────────────────────────────────────────────────
function Toast({ msg, onClose }) {
  return (
    <div className="fixed top-5 right-5 z-50 flex items-start gap-3 px-5 py-4 rounded-2xl border border-red-500/40 shadow-2xl animate-pulse"
      style={{ background:"#1a0505", maxWidth:380 }}>
      <span className="text-2xl flex-shrink-0">🚨</span>
      <div className="flex-1">
        <p className="text-sm font-black text-red-400 mb-1">ALERTA AL PRODUCTOR GENERAL</p>
        <p className="text-xs text-white/60 leading-relaxed">{msg}</p>
        <p className="text-[10px] text-white/30 mt-1">Notificación enviada · {timeNow()}</p>
      </div>
      <button onClick={onClose} className="text-white/20 hover:text-white/50 text-lg flex-shrink-0">✕</button>
    </div>
  );
}

// ─── MODAL: NUEVA CARPETA ─────────────────────────────────────────────────────
function ModalNuevaCarpeta({ onClose, onCreate }) {
  const [nombre, setNombre]   = useState("");
  const [sector, setSector]   = useState("");
  const [tipo, setTipo]       = useState("toma");
  const [autor, setAutor]     = useState("");
  const [custom, setCustom]   = useState(false);
  const tipoObj = TIPOS_CARPETA.find(t=>t.id===tipo);

  function handleCreate() {
    if (!nombre.trim() || !sector || !autor.trim()) return;
    onCreate({ nombre: nombre.trim(), sector, tipo, autor: autor.trim() });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ background:"rgba(0,0,0,0.88)" }}
      onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-2xl border border-white/8 p-6"
        style={{ background:"#131313" }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[10px] text-orange-400 uppercase tracking-wider mb-0.5">Nueva carpeta</p>
            <h3 className="text-base font-black text-white">Crear registro fotográfico</h3>
          </div>
          <button onClick={onClose} className="text-white/20 hover:text-white/50 text-xl">✕</button>
        </div>

        {/* Tipo */}
        <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Tipo de registro</p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {TIPOS_CARPETA.map(t => (
            <button key={t.id} onClick={()=>setTipo(t.id)}
              className={`p-3 rounded-xl border text-left transition-all ${tipo===t.id?"border-opacity-50":"border-white/5 hover:border-white/10"}`}
              style={tipo===t.id ? { borderColor:t.color+"80", background:t.color+"12" } : {}}>
              <p className="text-sm mb-0.5">{t.ico}</p>
              <p className="text-xs font-bold" style={{ color:tipo===t.id?t.color:"rgba(255,255,255,0.6)" }}>{t.label}</p>
              <p className="text-[9px] text-white/25 mt-0.5 leading-tight">{t.desc}</p>
            </button>
          ))}
        </div>

        {/* Sector */}
        <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Sector del venue</p>
        {!custom ? (
          <div className="flex gap-2 mb-1">
            <select value={sector} onChange={e=>setSector(e.target.value)}
              className="flex-1 bg-black border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-orange-500/50">
              <option value="">Seleccioná el sector...</option>
              {SECTORES.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={()=>setCustom(true)}
              className="text-xs px-3 py-2 border border-white/10 rounded-lg text-white/40 hover:text-white/60">
              + Otro
            </button>
          </div>
        ) : (
          <div className="flex gap-2 mb-1">
            <input value={sector} onChange={e=>setSector(e.target.value)}
              placeholder="Nombre del sector..."
              className="flex-1 bg-black border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-orange-500/50" />
            <button onClick={()=>{ setCustom(false); setSector(""); }}
              className="text-xs px-3 py-2 border border-white/10 rounded-lg text-white/40">↩</button>
          </div>
        )}

        {/* Nombre de la carpeta */}
        <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2 mt-4">Nombre de la carpeta</p>
        <input value={nombre} onChange={e=>setNombre(e.target.value)}
          placeholder={`Ej: ${tipoObj?.label} — ${sector||"Sector"}`}
          className="w-full bg-black border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-orange-500/50 mb-4" />

        {/* Autor */}
        <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Tu nombre</p>
        <input value={autor} onChange={e=>setAutor(e.target.value)}
          placeholder="Ej: Rodrigo M."
          className="w-full bg-black border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-orange-500/50 mb-5" />

        {tipo==="siniestro" && (
          <div className="mb-4 px-4 py-3 rounded-xl border border-red-500/30 text-xs text-red-300 leading-relaxed"
            style={{ background:"rgba(220,20,60,0.08)" }}>
            🚨 Las fotos cargadas en esta carpeta enviarán una <strong>notificación inmediata al productor general</strong> con el sector y la descripción del daño.
          </div>
        )}

        <button onClick={handleCreate}
          disabled={!nombre.trim()||!sector||!autor.trim()}
          className="w-full py-3 rounded-xl font-black text-sm text-black disabled:opacity-40 transition-all"
          style={{ background: tipo==="siniestro" ? "linear-gradient(135deg,#DC143C,#8B0000)" : "linear-gradient(135deg,#FF5A00,#DC143C)" }}>
          {tipo==="siniestro" ? "🚨 Crear carpeta de siniestro" : "📁 Crear carpeta"}
        </button>
      </div>
    </div>
  );
}

// ─── MODAL: CARPETA ABIERTA ───────────────────────────────────────────────────
function ModalCarpeta({ carpeta, onClose, onAddFoto, onCerrar }) {
  const [nota, setNota]       = useState("");
  const [preview, setPreview] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef();
  const tipoObj = TIPOS_CARPETA.find(t=>t.id===carpeta.tipo);

  function handleFile(file) {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = e => setPreview(e.target.result);
    reader.readAsDataURL(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) handleFile(file);
  }

  function handleSubir() {
    if (!fileName) return;
    const idx = carpeta.fotos.length + 1;
    const padded = String(idx).padStart(2,"0");
    const ext = fileName.split(".").pop();
    const autoName = `${carpeta.sector.toLowerCase().replace(/\s+/g,"_")}_${padded}.${ext}`;
    onAddFoto(carpeta.id, {
      id: "F" + Date.now(),
      nombre: autoName,
      tipo: carpeta.tipo === "siniestro" ? "siniestro" : "normal",
      hora: timeNow(),
      nota: nota.trim() || "Sin descripción",
      thumb: carpeta.tipo === "siniestro" ? "🚨" : "📷",
      preview,
    });
    setNota("");
    setPreview(null);
    setFileName(null);
  }

  const isSiniestro = carpeta.tipo === "siniestro";
  const accentColor = tipoObj?.color || "#FF5A00";

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ background:"rgba(0,0,0,0.90)" }}
      onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border overflow-hidden"
        style={{ background:"#131313", borderColor: accentColor+"40" }}>

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-white/5 flex-shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span>{tipoObj?.ico}</span>
              <Badge color={accentColor}>{tipoObj?.label}</Badge>
              {carpeta.cerrada && <Badge color="#60a5fa">CERRADA</Badge>}
              {carpeta.notificado && <Badge color="#DC143C">🚨 Productor notificado · {carpeta.notificadoHora}</Badge>}
            </div>
            <h3 className="text-base font-black text-white">{carpeta.nombre}</h3>
            <p className="text-xs text-white/30 mt-0.5">
              {carpeta.sector} · {carpeta.fecha} · por {carpeta.autor}
            </p>
          </div>
          <button onClick={onClose} className="text-white/20 hover:text-white/50 text-xl ml-4 flex-shrink-0">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Grid de fotos existentes */}
          {carpeta.fotos.length > 0 && (
            <div className="mb-5">
              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-3">
                {carpeta.fotos.length} foto{carpeta.fotos.length!==1?"s":""} en esta carpeta
              </p>
              <div className="grid grid-cols-3 gap-3">
                {carpeta.fotos.map(f => (
                  <div key={f.id} className={`rounded-xl border overflow-hidden ${f.tipo==="siniestro"?"border-red-500/30":"border-white/5"}`}>
                    {f.preview ? (
                      <img src={f.preview} alt={f.nombre}
                        className="w-full h-28 object-cover" />
                    ) : (
                      <div className="w-full h-28 flex items-center justify-center text-4xl"
                        style={{ background: f.tipo==="siniestro"?"rgba(220,20,60,0.08)":"#0d0d0d" }}>
                        {f.thumb}
                      </div>
                    )}
                    <div className="px-3 py-2" style={{ background:"#0d0d0d" }}>
                      <p className="text-[10px] font-mono text-white/50 truncate">{f.nombre}</p>
                      <p className="text-[10px] text-white/30 mt-0.5">{f.hora}</p>
                      {f.nota && <p className="text-[10px] text-white/60 mt-1 leading-tight">{f.nota}</p>}
                      {f.tipo==="siniestro" && (
                        <span className="inline-block mt-1 text-[9px] font-bold text-red-400 px-1.5 py-0.5 rounded border border-red-500/30"
                          style={{ background:"rgba(220,20,60,0.10)" }}>
                          🚨 SINIESTRO
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload zone */}
          {!carpeta.cerrada && (
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-widest mb-3">Agregar foto</p>

              {/* Drop zone */}
              <div
                onDragOver={e=>{ e.preventDefault(); setDragging(true); }}
                onDragLeave={()=>setDragging(false)}
                onDrop={handleDrop}
                onClick={()=>fileRef.current.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all mb-3 ${
                  dragging ? "border-orange-500/60" : "border-white/10 hover:border-white/20"
                }`}
                style={dragging ? { background:"rgba(255,90,0,0.05)" } : {}}>
                <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={e=>handleFile(e.target.files[0])} />

                {preview ? (
                  <div>
                    <img src={preview} alt="preview"
                      className="w-full max-h-48 object-contain rounded-lg mb-2" />
                    <p className="text-xs text-white/40">{fileName}</p>
                    <button onClick={e=>{ e.stopPropagation(); setPreview(null); setFileName(null); }}
                      className="text-[10px] text-white/20 hover:text-white/40 mt-1">
                      Cambiar foto
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="text-4xl mb-2">{isSiniestro?"📸":"📷"}</p>
                    <p className="text-sm text-white/50 font-bold">
                      {isSiniestro ? "Fotografiar el daño" : "Agregar foto"}
                    </p>
                    <p className="text-xs text-white/25 mt-1">
                      Tocá para abrir la cámara o seleccionar imagen
                    </p>
                  </div>
                )}
              </div>

              {/* Nota */}
              <textarea value={nota} onChange={e=>setNota(e.target.value)}
                placeholder={isSiniestro
                  ? "Describí el daño: qué se rompió, ubicación exacta, causa probable..."
                  : "Descripción de la foto (opcional)"}
                rows={2}
                className="w-full bg-black border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-orange-500/50 resize-none mb-3" />

              {isSiniestro && (
                <div className="mb-3 px-3 py-2 rounded-lg border border-red-500/20 text-xs text-red-300"
                  style={{ background:"rgba(220,20,60,0.06)" }}>
                  🚨 Al subir esta foto se enviará una <strong>notificación inmediata</strong> al productor general con el sector y la descripción del daño.
                </div>
              )}

              <button onClick={handleSubir} disabled={!preview}
                className="w-full py-3 rounded-xl font-black text-sm text-black disabled:opacity-40 transition-all"
                style={{ background: isSiniestro
                  ? "linear-gradient(135deg,#DC143C,#8B0000)"
                  : "linear-gradient(135deg,#FF5A00,#DC143C)" }}>
                {isSiniestro ? "🚨 Subir y notificar al productor" : "📤 Subir foto"}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {!carpeta.cerrada && (
          <div className="flex gap-3 px-5 py-3 border-t border-white/5 flex-shrink-0">
            <button onClick={()=>{ onCerrar(carpeta.id); onClose(); }}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold border border-white/10 text-white/40 hover:border-white/20 hover:text-white/60 transition-all">
              ✓ Cerrar carpeta
            </button>
            <button onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs text-white/20 hover:text-white/40 transition-all">
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── APP PRINCIPAL ────────────────────────────────────────────────────────────
function ModuleFotos() {
  const [carpetas, setCarpetas]     = useState(CARPETAS_INIT);
  const [modalNueva, setModalNueva] = useState(false);
  const [carpetaAbierta, setCarpetaAbierta] = useState(null);
  const [toast, setToast]           = useState(null);
  const [filtro, setFiltro]         = useState("todas");
  const [busqueda, setBusqueda]     = useState("");

  function handleCrear({ nombre, sector, tipo, autor }) {
    const nueva = {
      id: "C" + Date.now(),
      nombre, sector, tipo, autor,
      fecha: dateNow(),
      fotos: [],
      estado: tipo === "siniestro" ? "siniestro" : "ok",
      cerrada: false,
      notificado: false,
    };
    setCarpetas(prev => [nueva, ...prev]);
    setCarpetaAbierta(nueva);
  }

  function handleAddFoto(carpetaId, foto) {
    setCarpetas(prev => prev.map(c => {
      if (c.id !== carpetaId) return c;
      const fotos = [...c.fotos, foto];
      const updatedCarpeta = { ...c, fotos };
      // Si es siniestro, notificar
      if (c.tipo === "siniestro" && !c.notificado) {
        const hora = timeNow();
        setToast(`📍 ${c.sector} — "${foto.nota}"\n\nFoto cargada por ${c.autor} a las ${hora}. Carpeta: "${c.nombre}"`);
        return { ...updatedCarpeta, notificado:true, notificadoHora:hora, estado:"siniestro" };
      }
      // Notificar también si es siniestro ya notificado y se agrega otra foto
      if (c.tipo === "siniestro" && c.notificado) {
        setToast(`📍 ${c.sector} — Nueva foto agregada al siniestro por ${c.autor}. Total: ${fotos.length} foto${fotos.length!==1?"s":""}.`);
      }
      return updatedCarpeta;
    }));
    // Actualizar carpetaAbierta
    setCarpetaAbierta(prev => {
      if (!prev || prev.id !== carpetaId) return prev;
      const fotos = [...prev.fotos, foto];
      const updated = { ...prev, fotos };
      if (prev.tipo === "siniestro" && !prev.notificado) {
        return { ...updated, notificado:true, notificadoHora:timeNow() };
      }
      return updated;
    });
  }

  function handleCerrar(carpetaId) {
    setCarpetas(prev => prev.map(c => c.id===carpetaId ? {...c, cerrada:true} : c));
  }

  // Filtrado
  const carpetasFiltradas = carpetas.filter(c => {
    const matchFiltro = filtro==="todas" || c.tipo===filtro || (filtro==="siniestro"&&c.estado==="siniestro");
    const matchBusq = !busqueda || c.nombre.toLowerCase().includes(busqueda.toLowerCase()) || c.sector.toLowerCase().includes(busqueda.toLowerCase());
    return matchFiltro && matchBusq;
  });

  const totalFotos = carpetas.reduce((a,c)=>a+c.fotos.length,0);
  const totalSiniestros = carpetas.filter(c=>c.tipo==="siniestro").length;
  const totalCerradas = carpetas.filter(c=>c.cerrada).length;

  return (
    <div className="min-h-screen font-mono" style={{ background:"#0A0A0A", color:"white" }}>

      {/* Toast de notificación */}
      {toast && <Toast msg={toast} onClose={()=>setToast(null)} />}

      {/* Modal nueva carpeta */}
      {modalNueva && (
        <ModalNuevaCarpeta onClose={()=>setModalNueva(false)} onCreate={handleCrear} />
      )}

      {/* Modal carpeta abierta */}
      {carpetaAbierta && (
        <ModalCarpeta
          carpeta={carpetaAbierta}
          onClose={()=>setCarpetaAbierta(null)}
          onAddFoto={handleAddFoto}
          onCerrar={handleCerrar}
        />
      )}

      {/* Header */}
      <div className="border-b border-white/5 px-6 py-4 flex-shrink-0" style={{ background:"#0d0d0d" }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl font-black text-white">SHOW</span>
              <span className="text-xl font-black" style={{ color:"#FF5A00" }}>CTRL</span>
              <span className="text-white/20 mx-1">·</span>
              <span className="text-sm font-bold text-white/50">Registro fotográfico</span>
            </div>
            <p className="text-xs text-white/30">Estadio Más Monumental · Sáb 14 Jun 2026</p>
          </div>
          <button onClick={()=>setModalNueva(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm text-black"
            style={{ background:"linear-gradient(135deg,#FF5A00,#DC143C)" }}>
            <span>+</span> Nueva carpeta
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-5">

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-5">
          {[
            { label:"Carpetas totales",  val:carpetas.length,   col:"white",    sub:"en este evento" },
            { label:"Fotos subidas",     val:totalFotos,        col:"#FF8C00",  sub:"documentadas" },
            { label:"Siniestros",        val:totalSiniestros,   col:"#DC143C",  sub:totalSiniestros>0?"notificados al productor":"sin incidentes" },
            { label:"Carpetas cerradas", val:`${totalCerradas}/${carpetas.length}`, col:"#4ade80", sub:"espacios verificados" },
          ].map((s,i) => (
            <div key={i} className="rounded-xl border border-white/5 p-4" style={{ background:"#111" }}>
              <p className="text-[10px] text-white/30 uppercase tracking-wider">{s.label}</p>
              <p className="text-3xl font-black mt-1" style={{ color:s.col }}>{s.val}</p>
              <p className="text-[10px] text-white/20 mt-1">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Filtros + Búsqueda */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="flex gap-1.5 bg-white/3 rounded-xl p-1">
            {[
              { id:"todas",    label:"Todas" },
              { id:"toma",     label:"Toma" },
              { id:"entrega",  label:"Entrega" },
              { id:"siniestro",label:"Siniestros" },
              { id:"montaje",  label:"Montaje" },
            ].map(f => (
              <button key={f.id} onClick={()=>setFiltro(f.id)}
                className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-all ${
                  filtro===f.id ? "text-white" : "text-white/30 hover:text-white/50"
                }`}
                style={filtro===f.id ? {
                  background: f.id==="siniestro" ? "rgba(220,20,60,0.20)" : "rgba(255,90,0,0.15)",
                  border: `1px solid ${f.id==="siniestro" ? "rgba(220,20,60,0.40)" : "rgba(255,90,0,0.30)"}`,
                } : {}}>
                {f.id==="siniestro" && carpetas.filter(c=>c.tipo==="siniestro").length > 0 && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 mr-1 animate-pulse" />
                )}
                {f.label}
              </button>
            ))}
          </div>
          <input value={busqueda} onChange={e=>setBusqueda(e.target.value)}
            placeholder="Buscar carpeta o sector..."
            className="flex-1 bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-orange-500/40" />
        </div>

        {/* Grid de carpetas */}
        <div className="grid grid-cols-3 gap-4">
          {carpetasFiltradas.map(c => {
            const tipoObj = TIPOS_CARPETA.find(t=>t.id===c.tipo);
            const accentColor = tipoObj?.color || "#FF5A00";
            const isSin = c.tipo === "siniestro";

            return (
              <div key={c.id}
                className="rounded-xl border overflow-hidden cursor-pointer transition-all hover:scale-[1.01]"
                style={{
                  background:"#111",
                  borderColor: isSin ? "#DC143C44" : c.cerrada ? "#ffffff15" : accentColor+"33",
                  boxShadow: isSin ? "0 0 20px rgba(220,20,60,0.12)" : undefined,
                }}
                onClick={()=>setCarpetaAbierta(c)}>

                {/* Color top bar */}
                <div className="h-1" style={{ background: c.cerrada ? "#ffffff20" : accentColor }} />

                {/* Preview de fotos */}
                <div className="h-28 relative overflow-hidden"
                  style={{ background: isSin ? "rgba(220,20,60,0.06)" : "#0d0d0d" }}>
                  {c.fotos.length === 0 ? (
                    <div className="w-full h-full flex items-center justify-center text-3xl opacity-20">
                      {tipoObj?.ico}
                    </div>
                  ) : c.fotos.length === 1 ? (
                    c.fotos[0].preview
                      ? <img src={c.fotos[0].preview} alt="" className="w-full h-full object-cover opacity-70" />
                      : <div className="w-full h-full flex items-center justify-center text-4xl">{c.fotos[0].thumb}</div>
                  ) : (
                    <div className="grid grid-cols-3 h-full gap-px">
                      {c.fotos.slice(0,3).map((f,i) => (
                        <div key={f.id} className="relative overflow-hidden"
                          style={{ background:"#0a0a0a" }}>
                          {f.preview
                            ? <img src={f.preview} alt="" className="w-full h-full object-cover opacity-70" />
                            : <div className="w-full h-full flex items-center justify-center text-2xl">{f.thumb}</div>}
                          {i===2 && c.fotos.length > 3 && (
                            <div className="absolute inset-0 flex items-center justify-center text-white font-black text-sm"
                              style={{ background:"rgba(0,0,0,0.6)" }}>
                              +{c.fotos.length-3}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Badges overlay */}
                  <div className="absolute top-2 left-2 flex gap-1.5 flex-wrap">
                    {c.cerrada && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border border-blue-400/40 text-blue-300"
                        style={{ background:"rgba(96,165,250,0.15)" }}>✓ Cerrada</span>
                    )}
                    {c.notificado && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full border border-red-500/40 text-red-300 animate-pulse"
                        style={{ background:"rgba(220,20,60,0.15)" }}>🚨 Notificado</span>
                    )}
                  </div>
                </div>

                {/* Info */}
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-xs font-black text-white leading-tight flex-1">{c.nombre}</p>
                    <span className="text-sm flex-shrink-0">{tipoObj?.ico}</span>
                  </div>
                  <p className="text-[10px] text-white/40 mb-2">{c.sector}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[10px] text-white/25">
                      <span>📷 {c.fotos.length}</span>
                      <span>·</span>
                      <span>{c.autor}</span>
                    </div>
                    <span className="text-[10px] text-white/20">{c.fecha.split("·")[1]?.trim()}</span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Card Nueva carpeta */}
          <div onClick={()=>setModalNueva(true)}
            className="rounded-xl border border-dashed border-white/8 flex flex-col items-center justify-center cursor-pointer hover:border-orange-500/30 transition-all min-h-52 gap-3"
            style={{ background:"#0d0d0d" }}>
            <span className="text-3xl opacity-30">📁</span>
            <p className="text-xs text-white/20 font-bold">Nueva carpeta</p>
          </div>
        </div>

        {carpetasFiltradas.length === 0 && (
          <div className="text-center py-16">
            <p className="text-4xl mb-3 opacity-30">🔍</p>
            <p className="text-sm text-white/20">No hay carpetas que coincidan con la búsqueda</p>
          </div>
        )}
      </div>
    </div>
  );
}


// ─── MÓDULO: CLIMA ──────────────────────────────────────────────────────────

// ─── CONSTANTES Y UMBRALES ────────────────────────────────────────────────────
// Basados en normativa argentina y estándares internacionales de producción
const UMBRALES = {
  viento: {
    ok:      { max: 30,  label: "Sin riesgo",         color: "#4ade80" },
    atencion:{ max: 50,  label: "Monitorear",         color: "#facc15" },
    alerta:  { max: 70,  label: "Alerta estructural", color: "#fb923c" },
    critico: { max: 90,  label: "Suspensión posible", color: "#f87171" },
    suspend: { max: 999, label: "SUSPENDER",          color: "#DC143C" },
  },
  lluvia: {
    ok:      { max: 2,   label: "Sin riesgo",         color: "#4ade80" },
    atencion:{ max: 5,   label: "Llovizna leve",      color: "#facc15" },
    alerta:  { max: 15,  label: "Lluvia moderada",    color: "#fb923c" },
    critico: { max: 30,  label: "Lluvia intensa",     color: "#f87171" },
    suspend: { max: 999, label: "SUSPENDER",          color: "#DC143C" },
  },
  rayos: {
    ok:      { dist: 999, label: "Sin actividad",     color: "#4ade80" },
    atencion:{ dist: 40,  label: "Actividad lejana",  color: "#facc15" },
    alerta:  { dist: 20,  label: "Alerta eléctrica",  color: "#fb923c" },
    critico: { dist: 10,  label: "Peligro inminente", color: "#f87171" },
    suspend: { dist: 0,   label: "SUSPENDER",         color: "#DC143C" },
  },
};

const VENUES_COORD = {
  "Hipódromo de Palermo":    { lat: -34.5742, lon: -58.4199, nombre: "Buenos Aires" },
  "Estadio Más Monumental":  { lat: -34.5453, lon: -58.4504, nombre: "Núñez, CABA" },
  "Parque Roca":             { lat: -34.6945, lon: -58.4283, nombre: "Villa Lugano" },
};

// ─── UTILIDADES ───────────────────────────────────────────────────────────────
function windLevel(kmh) {
  if (kmh < 30) return "ok";
  if (kmh < 50) return "atencion";
  if (kmh < 70) return "alerta";
  if (kmh < 90) return "critico";
  return "suspend";
}
function rainLevel(mmh) {
  if (mmh < 2)  return "ok";
  if (mmh < 5)  return "atencion";
  if (mmh < 15) return "alerta";
  if (mmh < 30) return "critico";
  return "suspend";
}
function overallRisk(wind, rain) {
  const levels = ["ok","atencion","alerta","critico","suspend"];
  return levels[Math.max(levels.indexOf(windLevel(wind)), levels.indexOf(rainLevel(rain)))];
}
function riskColor(level) {
  const map = { ok:"#4ade80", atencion:"#facc15", alerta:"#fb923c", critico:"#f87171", suspend:"#DC143C" };
  return map[level] || "#888";
}
function riskLabel(level) {
  const map = { ok:"SIN RIESGO", atencion:"MONITOREAR", alerta:"ALERTA", critico:"RIESGO CRÍTICO", suspend:"SUSPENDER" };
  return map[level] || "—";
}
function wmoDesc(code) {
  if (code === 0)              return "☀️ Despejado";
  if (code <= 3)               return "🌤️ Parcialmente nublado";
  if (code <= 49)              return "🌫️ Niebla o neblina";
  if (code <= 59)              return "🌧️ Llovizna";
  if (code <= 69)              return "🌧️ Lluvia";
  if (code <= 79)              return "❄️ Nieve / granizo";
  if (code <= 82)              return "🌦️ Lluvia variable";
  if (code <= 86)              return "🌨️ Nevada";
  if (code <= 99)              return "⛈️ Tormenta eléctrica";
  return "🌡️ Condición especial";
}
function formatHora(iso) {
  return new Date(iso).toLocaleTimeString("es-AR", { hour:"2-digit", minute:"2-digit" });
}
function formatFecha(iso) {
  return new Date(iso).toLocaleDateString("es-AR", { weekday:"short", day:"numeric", month:"short" });
}

// ─── COMPONENTES BASE ─────────────────────────────────────────────────────────
function Card({ children, className="", glow }) {
  return (
    <div className={`rounded-xl border border-white/5 ${className}`}
      style={{ background:"#111", boxShadow: glow ? `0 0 28px ${glow}28` : undefined }}>
      {children}
    </div>
  );
}
function SectionHeader({ label, title, color="#FF5A00" }) {
  return (
    <div className="mb-5">
      <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color }}>{label}</span>
      <h2 className="text-xl font-black text-white mt-0.5">{title}</h2>
    </div>
  );
}
function RiskBadge({ level, size="sm" }) {
  const col = riskColor(level);
  const lbl = riskLabel(level);
  const pulse = level === "suspend" || level === "critico";
  return (
    <span className={`inline-flex items-center gap-1.5 font-black rounded-full border px-3 py-1 ${size==="lg"?"text-sm":"text-[10px]"}`}
      style={{ color:col, borderColor:col+"55", background:col+"15" }}>
      <span className={`w-1.5 h-1.5 rounded-full ${pulse?"animate-pulse":""}`} style={{ background:col }} />
      {lbl}
    </span>
  );
}

// ─── GAUGE CIRCULAR ───────────────────────────────────────────────────────────
function Gauge({ value, max, color, label, unit, subtext }) {
  const pct = Math.min(value / max, 1);
  const r = 44, sw = 8;
  const circ = Math.PI * r;
  const offset = circ * (1 - pct);
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 110 70" width="110" height="70">
        <path d={`M ${55-r} 65 A ${r} ${r} 0 0 1 ${55+r} 65`}
          fill="none" stroke="#1a1a1a" strokeWidth={sw} strokeLinecap="round"/>
        <path d={`M ${55-r} 65 A ${r} ${r} 0 0 1 ${55+r} 65`}
          fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition:"all 0.6s" }}/>
        <text x="55" y="55" textAnchor="middle" fontSize="18" fontWeight="800" fill={color}>{value}</text>
        <text x="55" y="66" textAnchor="middle" fontSize="8" fill="#555">{unit}</text>
      </svg>
      <p className="text-[10px] font-bold text-center" style={{ color }}>{label}</p>
      {subtext && <p className="text-[9px] text-white/30 text-center mt-0.5">{subtext}</p>}
    </div>
  );
}

// ─── MINI BARRA HORARIA ───────────────────────────────────────────────────────
function HourBar({ value, max, color, hora }) {
  const pct = Math.min((value/max)*100, 100);
  return (
    <div className="flex flex-col items-center gap-1 flex-1">
      <div className="w-full h-16 rounded bg-white/3 relative flex items-end overflow-hidden">
        <div className="w-full rounded transition-all duration-500" style={{ height:`${pct}%`, background:color+"99" }} />
        {pct > 75 && <div className="absolute inset-0 border border-red-500/30 rounded animate-pulse" />}
      </div>
      <span className="text-[8px] text-white/30">{hora}</span>
      <span className="text-[8px] font-bold" style={{ color }}>{value}</span>
    </div>
  );
}

// ─── MÓDULO PRINCIPAL ─────────────────────────────────────────────────────────
function ModuleClima({ venue, showHora }) {
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [current, setCurrent]       = useState(null);
  const [hourly, setHourly]         = useState([]);
  const [daily, setDaily]           = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [iaAnalysis, setIaAnalysis] = useState(null);
  const [iaLoading, setIaLoading]   = useState(false);
  const [tab, setTab]               = useState("ahora");
  const [suspDecision, setSuspDecision] = useState(null);
  const timerRef = useRef(null);

  const coords = VENUES_COORD[venue] || VENUES_COORD["Hipódromo de Palermo"];

  // ── FETCH CLIMA ──────────────────────────────────────────────────────────────
  const fetchWeather = useCallback(async () => {
    try {
      setError(null);

      // Intentar Open-Meteo primero
      let data = null;
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}`
          + `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,cloud_cover`
          + `&hourly=temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,cloud_cover`
          + `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max`
          + `&timezone=America%2FArgentina%2FBuenos_Aires&forecast_days=7&wind_speed_unit=kmh`;
        const res = await fetch(url);
        if (res.ok) data = await res.json();
      } catch(_) { data = null; }

      // Fallback: datos realistas de Buenos Aires si no hay red
      if (!data) {
        const now = new Date();
        const hrs = Array.from({length:24},(_,i)=>{
          const d = new Date(now); d.setHours(now.getHours()+i,0,0,0);
          const isNight = d.getHours() < 7 || d.getHours() > 20;
          const isEvening = d.getHours() >= 18 && d.getHours() <= 23;
          const w = 18 + Math.sin(i*0.4)*8 + Math.random()*6;
          const g = w + 8 + Math.random()*12;
          const p = isEvening ? Math.random()*3 : Math.random()*0.5;
          return {
            time: d.toISOString().slice(0,16),
            temp: isNight ? 18+Math.random()*3 : 24+Math.random()*5,
            precip: p, precipProb: isEvening ? 25+Math.random()*20 : 10+Math.random()*10,
            wmo: p > 1 ? 61 : p > 0.3 ? 51 : 2,
            viento: Math.round(w), rafagas: Math.round(g), nubes: 40+Math.random()*40,
          };
        });
        const days = Array.from({length:7},(_,i)=>{
          const d = new Date(now); d.setDate(d.getDate()+i);
          const wm = [22,19,25,28,21,18,24][i];
          const vMax = [25,32,28,22,45,68,30][i];
          const rMax = [vMax+8, vMax+10, vMax+7, vMax+9, vMax+15, vMax+18, vMax+8][i];
          const pr = [2, 8, 0, 0, 15, 22, 1][i];
          return {
            date: d.toISOString().slice(0,10),
            wmo: pr>15?95:pr>5?61:pr>0?51:i===4?80:2,
            tMax: wm, tMin: wm-6,
            precipSum: pr, precipProb: [15,55,5,5,70,85,10][i],
            vientoMax: vMax, rafagasMax: rMax,
          };
        });
        data = {
          _isFallback: true,
          current: {
            temperature_2m: 24, apparent_temperature: 26,
            relative_humidity_2m: 62, rain: 0, precipitation: 0,
            weather_code: 2, wind_speed_10m: 22, wind_gusts_10m: 34,
            wind_direction_10m: 180, cloud_cover: 45,
          },
          hourly: {
            time:                    hrs.map(h=>h.time),
            temperature_2m:          hrs.map(h=>Math.round(h.temp*10)/10),
            precipitation:           hrs.map(h=>Math.round(h.precip*10)/10),
            precipitation_probability: hrs.map(h=>Math.round(h.precipProb)),
            weather_code:            hrs.map(h=>h.wmo),
            wind_speed_10m:          hrs.map(h=>h.viento),
            wind_gusts_10m:          hrs.map(h=>h.rafagas),
            cloud_cover:             hrs.map(h=>Math.round(h.nubes)),
          },
          daily: {
            time:                         days.map(d=>d.date),
            weather_code:                 days.map(d=>d.wmo),
            temperature_2m_max:           days.map(d=>d.tMax),
            temperature_2m_min:           days.map(d=>d.tMin),
            precipitation_sum:            days.map(d=>d.precipSum),
            precipitation_probability_max:days.map(d=>d.precipProb),
            wind_speed_10m_max:           days.map(d=>d.vientoMax),
            wind_gusts_10m_max:           days.map(d=>d.rafagasMax),
          }
        };
      }

      // Current
      const c = data.current;
      setCurrent({
        temp:        c.temperature_2m,
        sensTermica: c.apparent_temperature,
        humedad:     c.relative_humidity_2m,
        lluvia:      c.rain ?? c.precipitation ?? 0,
        wmo:         c.weather_code,
        viento:      c.wind_speed_10m,
        rafagas:     c.wind_gusts_10m,
        dirViento:   c.wind_direction_10m,
        nubes:       c.cloud_cover,
        isFallback:  data._isFallback || false,
      });

      // Hourly — próximas 24hs
      const now = new Date();
      const hrs = data.hourly.time
        .map((t,i) => ({
          time:    t,
          temp:    data.hourly.temperature_2m[i],
          precip:  data.hourly.precipitation[i] ?? 0,
          precipProb: data.hourly.precipitation_probability[i] ?? 0,
          wmo:     data.hourly.weather_code[i],
          viento:  data.hourly.wind_speed_10m[i],
          rafagas: data.hourly.wind_gusts_10m[i],
          nubes:   data.hourly.cloud_cover[i],
        }))
        .filter(h => {
          const d = new Date(h.time);
          return d >= now && d <= new Date(now.getTime() + 24*3600*1000);
        })
        .slice(0, 24);
      setHourly(hrs);

      // Daily
      const days = data.daily.time.map((t,i) => ({
        date:       t,
        wmo:        data.daily.weather_code[i],
        tMax:       data.daily.temperature_2m_max[i],
        tMin:       data.daily.temperature_2m_min[i],
        precipSum:  data.daily.precipitation_sum[i] ?? 0,
        precipProb: data.daily.precipitation_probability_max[i] ?? 0,
        vientoMax:  data.daily.wind_speed_10m_max[i],
        rafagasMax: data.daily.wind_gusts_10m_max[i],
      }));
      setDaily(days);
      setLastUpdate(new Date());
      setLoading(false);
    } catch(e) {
      setError(e.message);
      setLoading(false);
    }
  }, [coords.lat, coords.lon]);

  // Fetch inicial + cada 15 min
  useEffect(() => {
    fetchWeather();
    timerRef.current = setInterval(fetchWeather, 15 * 60 * 1000);
    return () => clearInterval(timerRef.current);
  }, [fetchWeather]);

  // ── ANÁLISIS IA ──────────────────────────────────────────────────────────────
  async function pedirAnalisisIA() {
    if (!current || !daily.length) return;
    setIaLoading(true);
    setIaAnalysis(null);
    try {
      const showDay = daily[0];
      const horasShow = hourly.filter(h => {
        const hora = new Date(h.time).getHours();
        return hora >= 18 && hora <= 24;
      });

      const prompt = `Sos el sistema de decisión de SHOWCTRL, plataforma de gestión de riesgo para eventos masivos.

EVENTO: Festival en ${venue} — Show a las ${showHora}
UBICACIÓN: ${coords.nombre}, Argentina

DATOS METEOROLÓGICOS ACTUALES (en tiempo real):
- Temperatura: ${current.temp}°C (sensación térmica ${current.sensTermica}°C)
- Lluvia actual: ${current.lluvia} mm/h
- Viento: ${current.viento} km/h — Ráfagas: ${current.rafagas} km/h
- Dirección viento: ${current.dirViento}°
- Humedad: ${current.humedad}%
- Condición: ${wmoDesc(current.wmo)}
- Nubosidad: ${current.nubes}%

PRONÓSTICO HORARIO (18:00 a 24:00 del día del show):
${horasShow.length > 0 ? horasShow.map(h => `${formatHora(h.time)}: ${h.temp}°C, lluvia ${h.precip}mm, prob.lluvia ${h.precipProb}%, viento ${h.viento}km/h, ráfagas ${h.rafagas}km/h, ${wmoDesc(h.wmo)}`).join("\n") : "No hay datos horarios para el horario del show hoy."}

PRÓXIMOS 7 DÍAS:
${daily.map(d => `${formatFecha(d.date)}: T.Max ${d.tMax}°C / T.Min ${d.tMin}°C, lluvia ${d.precipSum}mm (prob ${d.precipProb}%), viento máx ${d.vientoMax}km/h, ráfagas máx ${d.rafagasMax}km/h, ${wmoDesc(d.wmo)}`).join("\n")}

UMBRALES CRÍTICOS PARA ESTE EVENTO:
- Viento > 70 km/h: riesgo estructural en estructuras de escenario y torres
- Ráfagas > 90 km/h: SUSPENSIÓN INMEDIATA (riesgo de colapso estructural)
- Lluvia > 15 mm/h: evaluar suspensión (riesgo eléctrico y de seguridad)
- Rayos a menos de 20 km: protocolo de evacuación
- Combinación lluvia + viento fuerte: riesgo multiplicado

Analizá la situación y respondé con estas secciones (SIN asteriscos, SIN markdown, solo texto plano y MAYÚSCULAS para los títulos):

EVALUACIÓN GENERAL
[2-3 oraciones sobre la situación meteorológica global]

RIESGO PARA EL SHOW DE HOY
[Análisis específico del horario del show, nivel de riesgo: BAJO / MODERADO / ALTO / CRÍTICO]

VENTANA CRÍTICA
[Indicá si hay alguna hora específica de mayor riesgo]

RECOMENDACIÓN OPERATIVA
[Una de estas tres: CONTINUAR CON MONITOREO / ACTIVAR PROTOCOLO DE CONTINGENCIA / RECOMENDAR SUSPENSIÓN]
[Justificación en 2-3 oraciones]

ACCIONES INMEDIATAS
[Lista de 3 a 5 acciones concretas que el productor debe tomar ahora mismo]

OUTLOOK 7 DÍAS
[Resumen del clima de la semana, útil para shows futuros]`;

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [{ role:"user", content: prompt }]
        })
      });
      const data = await res.json();
      const text = data?.content?.[0]?.text || "Sin análisis disponible.";
      setIaAnalysis(text);

      // Auto-detectar recomendación
      if (text.includes("RECOMENDAR SUSPENSIÓN")) setSuspDecision("suspend");
      else if (text.includes("ACTIVAR PROTOCOLO")) setSuspDecision("protocolo");
      else setSuspDecision("ok");

    } catch(e) {
      setIaAnalysis("Error al conectar con el motor de análisis. Revisá tu conexión.");
    } finally {
      setIaLoading(false);
    }
  }

  // ── LOADING / ERROR ───────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-10 h-10 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
      <p className="text-sm text-white/40">Obteniendo datos meteorológicos en tiempo real...</p>
      <p className="text-xs text-white/20">Open-Meteo · SMN Argentina · {coords.nombre}</p>
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <p className="text-4xl">⚠️</p>
      <p className="text-sm text-red-400 font-bold">Error al obtener datos meteorológicos</p>
      <p className="text-xs text-white/30">{error}</p>
      <button onClick={fetchWeather} className="mt-2 text-xs px-4 py-2 rounded-lg border border-orange-500/30 text-orange-400 hover:bg-orange-500/10">
        Reintentar
      </button>
    </div>
  );

  const riesgoActual = current ? overallRisk(current.rafagas, current.lluvia) : "ok";
  const windDir = current ? current.dirViento : 0;

  return (
    <div>
      <SectionHeader label="Sistema meteorológico crítico" title="Control climático en tiempo real" />

      {/* BANNER SUSPENSIÓN si corresponde */}
      {suspDecision === "suspend" && (
        <div className="mb-5 p-4 rounded-xl border-2 border-red-500 animate-pulse"
          style={{ background:"rgba(220,20,60,0.15)" }}>
          <div className="flex items-center gap-3">
            <span className="text-3xl">🚨</span>
            <div>
              <p className="text-red-400 font-black text-lg">RECOMENDACIÓN DE SUSPENSIÓN</p>
              <p className="text-red-300/70 text-sm">El análisis de IA indica condiciones de riesgo crítico. Revisá el informe completo abajo.</p>
            </div>
          </div>
        </div>
      )}
      {suspDecision === "protocolo" && (
        <div className="mb-5 p-4 rounded-xl border border-orange-500/60"
          style={{ background:"rgba(255,90,0,0.10)" }}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="text-orange-400 font-black">ACTIVAR PROTOCOLO DE CONTINGENCIA</p>
              <p className="text-orange-300/70 text-sm">Se detectaron condiciones que requieren medidas preventivas. Revisá el informe.</p>
            </div>
          </div>
        </div>
      )}

      {/* TABS */}
      <div className="flex gap-1.5 mb-5 bg-white/3 rounded-xl p-1">
        {[
          { id:"ahora",    label:"🌡️ Ahora" },
          { id:"horario",  label:"⏱ Próximas 24h" },
          { id:"semana",   label:"📅 7 días" },
          { id:"decision", label:"🤖 Análisis IA" },
        ].map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              tab===t.id ? "text-white" : "text-white/30 hover:text-white/50"
            }`}
            style={tab===t.id ? { background:"rgba(255,90,0,0.20)", border:"1px solid rgba(255,90,0,0.30)" } : {}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: AHORA ──────────────────────────────────────────────────────── */}
      {tab === "ahora" && current && (
        <>
          {/* Riesgo global */}
          <Card className="p-5 mb-4" glow={riesgoActual!=="ok"?riskColor(riesgoActual):null}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Riesgo global ahora</p>
                <RiskBadge level={riesgoActual} size="lg" />
              </div>
              <div className="text-right">
                <p className="text-3xl">{wmoDesc(current.wmo).split(" ")[0]}</p>
                <p className="text-xs text-white/40 mt-1">{wmoDesc(current.wmo).split(" ").slice(1).join(" ")}</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-white/30">
              <span>Última actualización: {lastUpdate?.toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"})}</span>
              <span className="text-[10px] text-white/20">
                {current?.isFallback
                  ? "⚠ Datos de referencia — conectar Open-Meteo en producción"
                  : `Open-Meteo · SMN Argentina · ${coords.nombre}`}
                {" "}· Actualización cada 15 min</span>
              <button onClick={fetchWeather} className="text-orange-400 hover:text-orange-300 font-bold">↻ Actualizar</button>
            </div>
          </Card>

          {/* Gauges principales */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            <Card className="p-4 flex flex-col items-center">
              <Gauge value={current.viento} max={120}
                color={riskColor(windLevel(current.viento))}
                label={UMBRALES.viento[windLevel(current.viento)].label}
                unit="km/h" subtext="Viento sostenido" />
            </Card>
            <Card className="p-4 flex flex-col items-center" glow={current.rafagas>70?riskColor(windLevel(current.rafagas)):null}>
              <Gauge value={current.rafagas} max={120}
                color={riskColor(windLevel(current.rafagas))}
                label={UMBRALES.viento[windLevel(current.rafagas)].label}
                unit="km/h" subtext="Ráfagas (crítico)" />
            </Card>
            <Card className="p-4 flex flex-col items-center">
              <Gauge value={current.lluvia} max={40}
                color={riskColor(rainLevel(current.lluvia))}
                label={UMBRALES.lluvia[rainLevel(current.lluvia)].label}
                unit="mm/h" subtext="Precipitación" />
            </Card>
            <Card className="p-4 flex flex-col items-center">
              <Gauge value={current.temp} max={45}
                color={current.temp > 35 ? "#f87171" : current.temp < 5 ? "#60a5fa" : "#4ade80"}
                label={`Sensación ${current.sensTermica}°C`}
                unit="°C" subtext="Temperatura" />
            </Card>
          </div>

          {/* Variables detalle */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { ico:"💧", label:"Humedad",      val:`${current.humedad}%`,     note:"" },
              { ico:"☁️", label:"Nubosidad",    val:`${current.nubes}%`,       note:"" },
              { ico:"🧭", label:"Dir. viento",  val:`${current.dirViento}°`,   note: current.dirViento>=315||current.dirViento<45?"Norte":current.dirViento<135?"Este":current.dirViento<225?"Sur":"Oeste" },
            ].map((v,i) => (
              <Card key={i} className="p-4 flex items-center gap-3">
                <span className="text-2xl">{v.ico}</span>
                <div>
                  <p className="text-[10px] text-white/30">{v.label}</p>
                  <p className="text-xl font-black text-white">{v.val}</p>
                  {v.note && <p className="text-[10px] text-white/40">{v.note}</p>}
                </div>
              </Card>
            ))}
          </div>

          {/* Umbrales de referencia */}
          <Card className="p-4">
            <p className="text-[10px] text-white/30 uppercase tracking-widest mb-3">Umbrales de decisión para escenarios al aire libre</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-bold text-white/50 mb-2">VIENTO (km/h)</p>
                {[
                  { range:"0–30",  label:"Sin riesgo",          col:"#4ade80" },
                  { range:"30–50", label:"Monitorear",          col:"#facc15" },
                  { range:"50–70", label:"Riesgo estructural",  col:"#fb923c" },
                  { range:"70–90", label:"Suspensión posible",  col:"#f87171" },
                  { range:">90",   label:"SUSPENDER",           col:"#DC143C" },
                ].map((u,i) => (
                  <div key={i} className="flex items-center gap-2 py-1 border-b border-white/3 last:border-0">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background:u.col }} />
                    <span className="text-xs font-mono text-white/40 w-16">{u.range}</span>
                    <span className="text-xs text-white/60">{u.label}</span>
                    {current.rafagas >= parseInt(u.range) && current.rafagas < (parseInt(u.range.replace(">",""))+30) && (
                      <span className="ml-auto text-[9px] font-bold" style={{ color:u.col }}>← AHORA</span>
                    )}
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs font-bold text-white/50 mb-2">LLUVIA (mm/h)</p>
                {[
                  { range:"0–2",   label:"Sin riesgo",          col:"#4ade80" },
                  { range:"2–5",   label:"Llovizna leve",       col:"#facc15" },
                  { range:"5–15",  label:"Lluvia moderada",     col:"#fb923c" },
                  { range:"15–30", label:"Evaluar suspensión",  col:"#f87171" },
                  { range:">30",   label:"SUSPENDER",           col:"#DC143C" },
                ].map((u,i) => (
                  <div key={i} className="flex items-center gap-2 py-1 border-b border-white/3 last:border-0">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background:u.col }} />
                    <span className="text-xs font-mono text-white/40 w-16">{u.range}</span>
                    <span className="text-xs text-white/60">{u.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </>
      )}

      {/* ── TAB: PRÓXIMAS 24H ───────────────────────────────────────────────── */}
      {tab === "horario" && (
        <>
          <Card className="p-4 mb-4">
            <p className="text-[10px] text-white/30 uppercase tracking-widest mb-4">Viento — ráfagas por hora (km/h)</p>
            <div className="flex gap-1 items-end h-20">
              {hourly.slice(0,12).map((h,i) => (
                <HourBar key={i}
                  value={Math.round(h.rafagas)}
                  max={120}
                  color={riskColor(windLevel(h.rafagas))}
                  hora={formatHora(h.time)} />
              ))}
            </div>
          </Card>
          <Card className="p-4 mb-4">
            <p className="text-[10px] text-white/30 uppercase tracking-widest mb-4">Precipitación por hora (mm)</p>
            <div className="flex gap-1 items-end h-20">
              {hourly.slice(0,12).map((h,i) => (
                <HourBar key={i}
                  value={parseFloat(h.precip.toFixed(1))}
                  max={30}
                  color={riskColor(rainLevel(h.precip))}
                  hora={formatHora(h.time)} />
              ))}
            </div>
          </Card>
          <div className="space-y-1.5">
            {hourly.slice(0,12).map((h,i) => {
              const risk = overallRisk(h.rafagas, h.precip);
              const col  = riskColor(risk);
              return (
                <Card key={i} className={`flex items-center gap-4 px-4 py-2.5 ${risk!=="ok"?"border-orange-500/20":""}`}
                  glow={risk==="critico"||risk==="suspend"?col:null}>
                  <span className="text-xs font-mono text-white/40 w-12">{formatHora(h.time)}</span>
                  <span className="text-sm w-6">{wmoDesc(h.wmo).split(" ")[0]}</span>
                  <span className="text-xs text-white/60 flex-1">{wmoDesc(h.wmo).split(" ").slice(1).join(" ")}</span>
                  <span className="text-xs text-white/40">{h.temp}°C</span>
                  <span className="text-xs" style={{ color: riskColor(windLevel(h.rafagas)) }}>💨 {Math.round(h.rafagas)} km/h</span>
                  <span className="text-xs" style={{ color: riskColor(rainLevel(h.precip)) }}>🌧️ {h.precip.toFixed(1)}mm</span>
                  <RiskBadge level={risk} />
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* ── TAB: 7 DÍAS ──────────────────────────────────────────────────────── */}
      {tab === "semana" && (
        <div className="space-y-2">
          {daily.map((d,i) => {
            const risk = overallRisk(d.rafagasMax, d.precipSum > 8 ? d.precipSum/8 : 0);
            const col  = riskColor(risk);
            const esHoy = i === 0;
            return (
              <Card key={i} className={`p-4 ${esHoy?"border-orange-500/30":""} ${risk==="suspend"||risk==="critico"?"border-red-500/30":""}`}
                glow={risk==="suspend"?col:esHoy?"#FF5A00":null}>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="w-20 flex-shrink-0">
                    <p className="text-xs font-bold text-white">{formatFecha(d.date)}</p>
                    {esHoy && <span className="text-[9px] text-orange-400 font-bold">HOY</span>}
                  </div>
                  <span className="text-2xl">{wmoDesc(d.wmo).split(" ")[0]}</span>
                  <div className="flex-1 text-xs text-white/50">
                    {wmoDesc(d.wmo).split(" ").slice(1).join(" ")}
                  </div>
                  <div className="flex gap-4 text-xs flex-wrap">
                    <span className="text-white">{d.tMax}° / <span className="text-white/40">{d.tMin}°</span></span>
                    <span style={{ color:riskColor(rainLevel(d.precipSum/8)) }}>
                      🌧️ {d.precipSum.toFixed(1)}mm ({d.precipProb}%)
                    </span>
                    <span style={{ color:riskColor(windLevel(d.rafagasMax)) }}>
                      💨 {Math.round(d.vientoMax)} km/h · ráf. {Math.round(d.rafagasMax)} km/h
                    </span>
                  </div>
                  <RiskBadge level={risk} />
                </div>
                {(risk === "critico" || risk === "suspend") && (
                  <p className="text-xs mt-2 px-2 py-1.5 rounded-lg border border-red-500/20"
                    style={{ background:"rgba(220,20,60,0.08)", color:"#f87171" }}>
                    ⚠ Este día presenta condiciones que pueden requerir suspensión o reprogramación.
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* ── TAB: ANÁLISIS IA ──────────────────────────────────────────────────── */}
      {tab === "decision" && (
        <div>
          <Card className="p-5 mb-4 border-orange-500/20">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <p className="text-xs font-bold text-orange-400 uppercase tracking-wider mb-1">Motor de decisión</p>
                <p className="text-white font-black text-base mb-1">Análisis de suspensión con IA</p>
                <p className="text-xs text-white/40 leading-relaxed">
                  Claude analiza los datos meteorológicos en tiempo real, los cruza con los umbrales de seguridad
                  para escenarios al aire libre y genera una recomendación operativa concreta para el productor.
                </p>
              </div>
              <div className="flex-shrink-0 text-right">
                {current && (
                  <div className="mb-3">
                    <RiskBadge level={riesgoActual} size="lg" />
                    <p className="text-[10px] text-white/30 mt-1">Condición actual</p>
                  </div>
                )}
              </div>
            </div>
            <button onClick={pedirAnalisisIA} disabled={iaLoading || !current}
              className="w-full mt-4 py-3.5 rounded-xl font-black text-sm text-black transition-all disabled:opacity-50"
              style={{ background: iaLoading ? "#444" : "linear-gradient(135deg,#FF5A00,#DC143C)" }}>
              {iaLoading ? "⏳ Analizando condiciones meteorológicas..." : "🧠 Generar análisis de suspensión"}
            </button>
          </Card>

          {iaLoading && (
            <Card className="p-6">
              <p className="text-xs text-white/30 mb-3">Procesando datos en tiempo real...</p>
              <div className="space-y-2">
                {[85,70,55,40,60].map((w,i)=>(
                  <div key={i} className="h-3 rounded animate-pulse" style={{ width:`${w}%`, background:"#222" }} />
                ))}
              </div>
            </Card>
          )}

          {iaAnalysis && (
            <Card className="p-5" glow={suspDecision==="suspend"?"#DC143C":suspDecision==="protocolo"?"#FF5A00":null}>
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <span style={{ color:"#FF5A00" }}>🤖</span>
                  <span className="text-xs text-white/40 uppercase tracking-wider">Análisis IA — Claude Sonnet</span>
                </div>
                {suspDecision && <RiskBadge level={suspDecision==="suspend"?"suspend":suspDecision==="protocolo"?"critico":"ok"} size="lg" />}
              </div>

              {/* Parsear y mostrar secciones */}
              {iaAnalysis.split("\n\n").map((bloque, i) => {
                const lines = bloque.split("\n");
                const titulo = lines[0];
                const contenido = lines.slice(1).join("\n").trim();
                const isTitulo = titulo === titulo.toUpperCase() && titulo.length > 3;
                const isSuspend = titulo.includes("RECOMENDAR SUSPENSIÓN") || titulo.includes("SUSPENSIÓN");
                const isProtocolo = titulo.includes("PROTOCOLO") || titulo.includes("CONTINGENCIA");
                return (
                  <div key={i} className="mb-4 last:mb-0">
                    {isTitulo ? (
                      <p className="text-[10px] font-black uppercase tracking-widest mb-1.5"
                        style={{ color: isSuspend?"#DC143C":isProtocolo?"#FF5A00":"#FF8C00" }}>
                        {titulo}
                      </p>
                    ) : null}
                    <p className="text-sm text-white/75 leading-relaxed whitespace-pre-wrap">
                      {isTitulo ? contenido : bloque}
                    </p>
                  </div>
                );
              })}

              <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between">
                <span className="text-[10px] text-white/20">
                  Basado en datos Open-Meteo · {lastUpdate?.toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"})}
                </span>
                <button onClick={pedirAnalisisIA}
                  className="text-xs px-3 py-1.5 rounded-lg border border-orange-500/30 text-orange-400 hover:bg-orange-500/10">
                  ↻ Re-analizar
                </button>
              </div>
            </Card>
          )}

          {!iaAnalysis && !iaLoading && (
            <Card className="p-10 text-center">
              <p className="text-4xl mb-3">🌩️</p>
              <p className="text-sm text-white/30">
                Presioná el botón para que Claude analice<br/>
                las condiciones actuales y genere una recomendación<br/>
                de suspensión o continuidad del show.
              </p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}


// ─── MÓDULO: EVACUACIÓN ─────────────────────────────────────────────────────

// ─── CONFIGURACIÓN DEL SIMULADOR ─────────────────────────────────────────────
const EVAC_VENUE = {
  nombre: "Estadio Más Monumental",
  capacidad: 85018,
  superficie: 42000,
};

// Sectores con sus datos y salidas asignadas
const EVAC_SECTORES = [
  {
    id: "SM", nombre: "San Martín", alias: "Norte",
    cap: 17755, x: 250, y: 55, w: 200, h: 55,
    color: "#FF5A00", salidas: ["S1","S2","S3"],
    tiempoBase: 18, flujoMax: 900,
  },
  {
    id: "SV", nombre: "Sívori", alias: "Sur",
    cap: 26890, x: 250, y: 390, w: 200, h: 55,
    color: "#DC143C", salidas: ["S7","S8","S9","S10"],
    tiempoBase: 22, flujoMax: 1200,
  },
  {
    id: "CE", nombre: "Centenario", alias: "Este",
    cap: 0, x: 440, y: 170, w: 55, h: 160,
    color: "#333", salidas: [],
    tiempoBase: 0, flujoMax: 0, esEscenario: true,
  },
  {
    id: "BL", nombre: "Belgrano", alias: "Oeste",
    cap: 17000, x: 5, y: 170, w: 55, h: 160,
    color: "#FF8C00", salidas: ["S4","S5","S6"],
    tiempoBase: 20, flujoMax: 850,
  },
  {
    id: "CA", nombre: "Campo", alias: "Campo",
    cap: 30000, x: 110, y: 155, w: 280, h: 190,
    color: "#FFB347", salidas: ["S2","S5","S8"],
    tiempoBase: 28, flujoMax: 1500, isPitch: true,
  },
];

// Salidas con posición, ancho y tipo
const SALIDAS = [
  { id:"S1",  nombre:"Salida Norte 1",   x: 180, y: 28,  tipo:"principal", ancho:3.6, dir:"N" },
  { id:"S2",  nombre:"Salida Norte 2",   x: 250, y: 28,  tipo:"principal", ancho:4.2, dir:"N" },
  { id:"S3",  nombre:"Salida Norte 3",   x: 320, y: 28,  tipo:"principal", ancho:3.6, dir:"N" },
  { id:"S4",  nombre:"Salida Oeste 1",   x: -12, y: 195, tipo:"principal", ancho:3.0, dir:"O" },
  { id:"S5",  nombre:"Salida Oeste 2",   x: -12, y: 245, tipo:"principal", ancho:3.0, dir:"O" },
  { id:"S6",  nombre:"Salida Oeste 3",   x: -12, y: 295, tipo:"principal", ancho:2.4, dir:"O" },
  { id:"S7",  nombre:"Salida Sur 1",     x: 180, y: 472, tipo:"principal", ancho:4.8, dir:"S" },
  { id:"S8",  nombre:"Salida Sur 2",     x: 250, y: 472, tipo:"principal", ancho:5.4, dir:"S" },
  { id:"S9",  nombre:"Salida Sur 3",     x: 320, y: 472, tipo:"principal", ancho:4.8, dir:"S" },
  { id:"S10", nombre:"Salida Sur 4",     x: 390, y: 472, tipo:"emergencia", ancho:2.4, dir:"S" },
];

// Escenarios de evacuación
const ESCENARIOS = [
  { id:"total",    label:"Evacuación total",      desc:"Todo el público sale simultáneamente", icon:"🚨" },
  { id:"norte",    label:"Emergencia Norte",       desc:"Solo San Martín evacua — Resto espera", icon:"⬆️" },
  { id:"sur",      label:"Emergencia Sur",         desc:"Solo Sívori evacua — Resto espera", icon:"⬇️" },
  { id:"campo",    label:"Emergencia Campo",       desc:"Campo prioritario — resto secundario", icon:"⚡" },
  { id:"s8bloq",   label:"Salida Sur 2 bloqueada", desc:"Simula bloqueo de la salida principal", icon:"🚫" },
];

// ─── MOTOR DE SIMULACIÓN ──────────────────────────────────────────────────────
function calcularEvacuacion(escenario, ocupacion, bloqueadas = []) {
  const resultados = [];
  let tiempoTotal = 0;
  let totalPersonas = 0;
  let cuellos = [];

  EVAC_SECTORES.forEach(sec => {
    if (sec.esEscenario) return;

    const personas = Math.round(sec.cap * (ocupacion / 100));
    if (personas === 0) return;

    // Salidas disponibles (no bloqueadas)
    const salidasDisp = sec.salidas.filter(s => !bloqueadas.includes(s));
    if (salidasDisp.length === 0) {
      resultados.push({ ...sec, personas, tiempo: 999, flujoTotal: 0, cuello: true, salidasDisp: [] });
      cuellos.push({ sector: sec.nombre, problema: "TODAS LAS SALIDAS BLOQUEADAS" });
      return;
    }

    // Calcular flujo total disponible (personas/min por ancho de salida)
    const FLUJO_POR_METRO = 82; // personas/min/metro de ancho (estándar IRAM)
    const flujoTotal = salidasDisp.reduce((acc, sid) => {
      const sal = SALIDAS.find(s => s.id === sid);
      return acc + (sal ? sal.ancho * FLUJO_POR_METRO : 0);
    }, 0);

    // Prioridad por escenario
    let factorPrioridad = 1.0;
    if (escenario === "norte" && sec.id !== "SM") factorPrioridad = 0.2;
    if (escenario === "sur"   && sec.id !== "SV") factorPrioridad = 0.2;
    if (escenario === "campo" && sec.id !== "CA") factorPrioridad = 0.4;
    if (escenario === "campo" && sec.id === "CA") factorPrioridad = 1.3;

    const flujoEfectivo = flujoTotal * factorPrioridad;
    const tiempoVaciado = personas / flujoEfectivo;
    const tiempoConDesplaz = tiempoVaciado + (sec.tiempoBase * 0.3);
    const tiempoFinal = Math.round(tiempoConDesplaz);

    // Detectar cuello de botella
    const isCuello = flujoEfectivo < sec.flujoMax * 0.5;
    if (isCuello) {
      cuellos.push({
        sector: sec.nombre,
        problema: `Flujo reducido: ${Math.round(flujoEfectivo)} pers/min de ${sec.flujoMax} posibles`,
      });
    }

    resultados.push({
      ...sec,
      personas,
      flujoTotal: Math.round(flujoEfectivo),
      tiempo: tiempoFinal,
      salidasDisp,
      cuello: isCuello,
    });

    totalPersonas += personas;
    tiempoTotal = Math.max(tiempoTotal, tiempoFinal);
  });

  return { resultados, tiempoTotal, totalPersonas, cuellos };
}

// ─── COMPONENTES ──────────────────────────────────────────────────────────────
function Badge({ children, color = "#FF5A00", bg }) {
  return (
    <span className="text-[10px] font-black px-2.5 py-1 rounded-full border"
      style={{ color, borderColor: color + "55", background: bg || color + "18" }}>
      {children}
    </span>
  );
}


// ─── PLANO SVG CON FLECHAS ────────────────────────────────────────────────────
function PlanoEvacuacion({ resultados, salidas, bloqueadas, escenario, animating }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!animating) return;
    const i = setInterval(() => setTick(t => t + 1), 400);
    return () => clearInterval(i);
  }, [animating]);

  function tiempoColor(t) {
    if (t <= 15) return "#4ade80";
    if (t <= 22) return "#facc15";
    if (t <= 30) return "#fb923c";
    return "#DC143C";
  }

  function arrowPath(sec, salida) {
    const sal = SALIDAS.find(s => s.id === salida);
    if (!sal) return null;
    const sx = sec.x + sec.w / 2;
    const sy = sec.y + sec.h / 2;
    const ex = sal.x + 8;
    const ey = sal.y + 8;
    const mx = (sx + ex) / 2;
    const my = (sy + ey) / 2;
    return `M ${sx} ${sy} Q ${mx} ${my} ${ex} ${ey}`;
  }

  const isBlocked = (sid) => bloqueadas.includes(sid);

  // Animación de flujo: offset pulsante
  const dashOffset = animating ? -(tick * 6) % 24 : 0;

  return (
    <svg viewBox="-30 0 560 510" width="100%" style={{ maxHeight: 420 }}
      role="img" aria-label="Plano de evacuación del Estadio Monumental">
      <defs>
        <marker id="arrowGreen" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#4ade80"/>
        </marker>
        <marker id="arrowAmber" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#facc15"/>
        </marker>
        <marker id="arrowOrange" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#fb923c"/>
        </marker>
        <marker id="arrowRed" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#DC143C"/>
        </marker>
        <filter id="glow-green"><feGaussianBlur stdDeviation="2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="glow-red"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>

      {/* Fondo del estadio */}
      <rect x="-30" y="0" width="560" height="510" fill="#0a0a0a" rx="8"/>

      {/* Césped */}
      <rect x="110" y="155" width="280" height="190" fill="#0d1f0d" rx="4"/>
      <rect x="110" y="155" width="280" height="190" fill="none" stroke="#1a3a1a" strokeWidth="1"/>
      <line x1="250" y1="155" x2="250" y2="345" stroke="#1a3a1a" strokeWidth="0.8"/>
      <circle cx="250" cy="250" r="30" fill="none" stroke="#1a3a1a" strokeWidth="0.8"/>

      {/* Escenario */}
      <rect x="390" y="185" width="55" height="130" fill="#1a1060" rx="4" opacity="0.9"/>
      <text x="417" y="248" textAnchor="middle" fontSize="8" fontWeight="700" fill="#8888cc">ESCENA</text>
      <text x="417" y="260" textAnchor="middle" fontSize="7" fill="#555">RIO</text>

      {/* Sectores */}
      {SECTORES.map(sec => {
        const res = resultados.find(r => r.id === sec.id);
        const col = res ? tiempoColor(res.tiempo) : (sec.esEscenario ? "#222" : sec.color);
        const isCuello = res?.cuello;

        return (
          <g key={sec.id}>
            <rect
              x={sec.x} y={sec.y} width={sec.w} height={sec.h}
              fill={sec.esEscenario ? "#111" : col + "22"}
              stroke={isCuello ? "#DC143C" : col}
              strokeWidth={isCuello ? 2 : 1}
              rx="4"
              opacity={sec.esEscenario ? 0.5 : 0.95}
              style={isCuello && animating ? { animation:`pulse 1s infinite` } : {}}
            />
            {isCuello && (
              <rect x={sec.x} y={sec.y} width={sec.w} height={sec.h}
                fill="none" stroke="#DC143C" strokeWidth="1.5"
                strokeDasharray="4,3" rx="4" opacity={0.5 + (tick%2)*0.3}/>
            )}
            <text x={sec.x + sec.w/2} y={sec.y + sec.h/2 - 6}
              textAnchor="middle" fontSize="10" fontWeight="700" fill={sec.esEscenario?"#444":col}>
              {sec.alias}
            </text>
            {res && (
              <text x={sec.x + sec.w/2} y={sec.y + sec.h/2 + 8}
                textAnchor="middle" fontSize="8" fill={col}>
                {res.tiempo === 999 ? "SIN SALIDA" : `${res.tiempo} min`}
              </text>
            )}
            {res && res.personas > 0 && (
              <text x={sec.x + sec.w/2} y={sec.y + sec.h/2 + 19}
                textAnchor="middle" fontSize="7" fill="#444">
                {res.personas.toLocaleString("es-AR")} pers.
              </text>
            )}
          </g>
        );
      })}

      {/* Flechas de flujo */}
      {resultados.map(res => {
        if (res.esEscenario || res.tiempo === 999) return null;
        const col = tiempoColor(res.tiempo);
        const markerMap = {
          "#4ade80": "url(#arrowGreen)",
          "#facc15": "url(#arrowAmber)",
          "#fb923c": "url(#arrowOrange)",
          "#DC143C": "url(#arrowRed)",
        };
        const marker = markerMap[col] || "url(#arrowOrange)";

        return res.salidasDisp.map(sid => {
          const path = arrowPath(res, sid);
          if (!path) return null;
          const isPriority = sid === res.salidasDisp[0];
          return (
            <path key={`${res.id}-${sid}`}
              d={path}
              fill="none"
              stroke={col}
              strokeWidth={isPriority ? 2.5 : 1.5}
              strokeOpacity={isPriority ? 0.9 : 0.5}
              strokeDasharray={animating ? "8,4" : "none"}
              strokeDashoffset={animating ? dashOffset : 0}
              markerEnd={isPriority ? marker : ""}
              filter={isPriority ? "url(#glow-green)" : ""}
            />
          );
        });
      })}

      {/* Salidas */}
      {SALIDAS.map(sal => {
        const blocked = isBlocked(sal.id);
        const isUsed = resultados.some(r => r.salidasDisp?.includes(sal.id));
        const col = blocked ? "#DC143C" : isUsed ? "#4ade80" : "#444";
        const size = sal.tipo === "principal" ? 10 : 8;

        return (
          <g key={sal.id}>
            <circle cx={sal.x + 8} cy={sal.y + 8} r={size}
              fill={blocked ? "#DC143C33" : isUsed ? "#4ade8022" : "#11111"}
              stroke={col} strokeWidth={blocked ? 2 : 1.5}
              filter={isUsed && !blocked ? "url(#glow-green)" : ""}/>
            {blocked ? (
              <>
                <line x1={sal.x+2} y1={sal.y+2} x2={sal.x+14} y2={sal.y+14} stroke="#DC143C" strokeWidth="2"/>
                <line x1={sal.x+14} y1={sal.y+2} x2={sal.x+2} y2={sal.y+14} stroke="#DC143C" strokeWidth="2"/>
              </>
            ) : (
              <text x={sal.x+8} y={sal.y+12} textAnchor="middle" fontSize="7" fontWeight="700" fill={col}>
                {isUsed ? "✓" : "○"}
              </text>
            )}
            <text x={sal.x+8} y={sal.y + (sal.dir==="N"?-4:sal.dir==="S"?28:22)}
              textAnchor="middle" fontSize="6.5" fill={col}>
              {sal.id}
            </text>
          </g>
        );
      })}

      {/* Leyenda */}
      {[
        { col:"#4ade80", label:"≤15 min" },
        { col:"#facc15", label:"15-22 min" },
        { col:"#fb923c", label:"22-30 min" },
        { col:"#DC143C", label:">30 min / riesgo" },
      ].map((l,i) => (
        <g key={i} transform={`translate(${-20 + i*118}, 490)`}>
          <circle cx="6" cy="6" r="5" fill={l.col+"33"} stroke={l.col} strokeWidth="1"/>
          <text x="14" y="10" fontSize="8" fill="#666">{l.label}</text>
        </g>
      ))}

      {/* Brújula */}
      <text x="500" y="25" textAnchor="middle" fontSize="9" fill="#333">N</text>
      <text x="500" y="500" textAnchor="middle" fontSize="9" fill="#333">S</text>
    </svg>
  );
}

// ─── APP PRINCIPAL ────────────────────────────────────────────────────────────
function ModuleEvacuacion() {
  const [escenario, setEscenario]   = useState("total");
  const [ocupacion, setOcupacion]   = useState(97);
  const [bloqueadas, setBloqueadas] = useState([]);
  const [resultado, setResultado]   = useState(null);
  const [animating, setAnimating]   = useState(false);
  const [simRunning, setSimRunning] = useState(false);
  const [progreso, setProgreso]     = useState(0);

  const simRef = useRef(null);

  function toggleBloqueo(sid) {
    setBloqueadas(prev => prev.includes(sid) ? prev.filter(s=>s!==sid) : [...prev, sid]);
    setResultado(null);
  }

  function ejecutarSimulacion() {
    setSimRunning(true);
    setProgreso(0);
    setAnimating(false);
    const steps = 30;
    let step = 0;
    simRef.current = setInterval(() => {
      step++;
      setProgreso(Math.round((step/steps)*100));
      if (step >= steps) {
        clearInterval(simRef.current);
        const res = calcularEvacuacion(escenario, ocupacion, bloqueadas);
        setResultado(res);
        setSimRunning(false);
        setAnimating(true);
      }
    }, 60);
  }

  useEffect(() => () => clearInterval(simRef.current), []);

  function tiempoColor(t) {
    if (t <= 15) return "#4ade80";
    if (t <= 22) return "#facc15";
    if (t <= 30) return "#fb923c";
    return "#DC143C";
  }
  function tiempoLabel(t) {
    if (t <= 15) return "ÓPTIMO";
    if (t <= 22) return "ACEPTABLE";
    if (t <= 30) return "LENTO";
    return "CRÍTICO";
  }

  const escObj = ESCENARIOS.find(e=>e.id===escenario);

  return (
    <div className="min-h-screen font-mono" style={{ background:"#0A0A0A", color:"white" }}>
      {/* Header */}
      <div className="border-b border-white/5 px-6 py-4" style={{ background:"#0d0d0d" }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl font-black text-white">SHOW</span>
              <span className="text-2xl font-black" style={{ color:"#FF5A00" }}>CTRL</span>
              <span className="text-white/20 mx-1">·</span>
              <span className="text-sm font-bold text-white/50">Simulador de Evacuación</span>
            </div>
            <p className="text-xs text-white/30">{EVAC_VENUE.nombre} · Cap. {EVAC_VENUE.capacidad.toLocaleString("es-AR")} espectadores</p>
          </div>
          <div className="flex items-center gap-3">
            {resultado && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border"
                style={{ borderColor: tiempoColor(resultado.tiempoTotal)+"55", background: tiempoColor(resultado.tiempoTotal)+"15" }}>
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: tiempoColor(resultado.tiempoTotal) }}/>
                <span className="text-xs font-black" style={{ color: tiempoColor(resultado.tiempoTotal) }}>
                  {tiempoLabel(resultado.tiempoTotal)} — {resultado.tiempoTotal} MIN
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-5">
        <div className="grid grid-cols-12 gap-4">

          {/* PANEL IZQUIERDO — Controles */}
          <div className="col-span-4 space-y-4">

            {/* Escenario */}
            <Card className="p-4">
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3">Tipo de evacuación</p>
              <div className="space-y-2">
                {ESCENARIOS.map(e => (
                  <button key={e.id} onClick={()=>{ setEscenario(e.id); setResultado(null); setAnimating(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all border ${
                      escenario===e.id ? "border-orange-500/40 text-white" : "border-white/5 text-white/40 hover:border-white/10"
                    }`}
                    style={escenario===e.id ? { background:"rgba(255,90,0,0.12)" } : {}}>
                    <span className="text-base">{e.icon}</span>
                    <div>
                      <p className="text-xs font-bold">{e.label}</p>
                      <p className="text-[10px] text-white/30">{e.desc}</p>
                    </div>
                    {escenario===e.id && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-500"/>}
                  </button>
                ))}
              </div>
            </Card>

            {/* Ocupación */}
            <Card className="p-4">
              <div className="flex justify-between items-center mb-3">
                <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Ocupación del venue</p>
                <span className="text-lg font-black" style={{ color:"#FF5A00" }}>{ocupacion}%</span>
              </div>
              <input type="range" min="20" max="100" value={ocupacion}
                onChange={e=>{ setOcupacion(Number(e.target.value)); setResultado(null); setAnimating(false); }}
                className="w-full accent-orange-500 mb-2"/>
              <div className="flex justify-between text-[9px] text-white/20">
                <span>20%</span>
                <span>{Math.round(EVAC_VENUE.capacidad * ocupacion / 100).toLocaleString("es-AR")} personas</span>
                <span>100%</span>
              </div>
            </Card>

            {/* Salidas bloqueables */}
            <Card className="p-4">
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-1">Simular bloqueos</p>
              <p className="text-[9px] text-white/20 mb-3">Activá para simular salidas inutilizables</p>
              <div className="grid grid-cols-2 gap-1.5">
                {SALIDAS.map(sal => {
                  const isBlocked = bloqueadas.includes(sal.id);
                  return (
                    <button key={sal.id} onClick={()=>toggleBloqueo(sal.id)}
                      className={`text-[10px] font-bold px-2 py-1.5 rounded-lg border transition-all text-left ${
                        isBlocked ? "border-red-500/50 text-red-400" : "border-white/5 text-white/30 hover:border-white/10"
                      }`}
                      style={isBlocked ? { background:"rgba(220,20,60,0.12)" } : {}}>
                      {isBlocked ? "🚫" : "🟢"} {sal.id}
                      <span className="block text-[8px] font-normal opacity-60">{sal.ancho}m</span>
                    </button>
                  );
                })}
              </div>
              {bloqueadas.length > 0 && (
                <button onClick={()=>{ setBloqueadas([]); setResultado(null); }}
                  className="mt-2 w-full text-[10px] text-white/30 hover:text-white/50 py-1">
                  Quitar todos los bloqueos
                </button>
              )}
            </Card>

            {/* Botón simular */}
            <button onClick={ejecutarSimulacion} disabled={simRunning}
              className="w-full py-4 rounded-xl font-black text-sm text-black transition-all disabled:opacity-60"
              style={{ background: simRunning ? "#333" : "linear-gradient(135deg,#FF5A00,#DC143C)" }}>
              {simRunning ? `Simulando... ${progreso}%` : resultado ? "↻ Re-simular" : "▶ Ejecutar simulación"}
            </button>

            {simRunning && (
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-100"
                  style={{ width:`${progreso}%`, background:"linear-gradient(90deg,#FF5A00,#DC143C)" }}/>
              </div>
            )}
          </div>

          {/* PANEL CENTRAL — Plano */}
          <div className="col-span-5">
            <Card className="p-4 h-full">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Plano de evacuación</p>
                <div className="flex items-center gap-3">
                  {animating && (
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"/>
                      <span className="text-[10px] text-orange-400 font-bold">SIMULANDO FLUJO</span>
                    </div>
                  )}
                  <p className="text-[9px] text-white/20">{escObj?.icon} {escObj?.label}</p>
                </div>
              </div>

              <PlanoEvacuacion
                resultados={resultado?.resultados || []}
                salidas={SALIDAS}
                bloqueadas={bloqueadas}
                escenario={escenario}
                animating={animating}
              />

              {!resultado && !simRunning && (
                <div className="text-center mt-3">
                  <p className="text-xs text-white/20">Configurá el escenario y presioná Ejecutar simulación</p>
                </div>
              )}
            </Card>
          </div>

          {/* PANEL DERECHO — Resultados */}
          <div className="col-span-3 space-y-3">

            {resultado ? (
              <>
                {/* Tiempo total */}
                <Card className="p-4 text-center" glow={tiempoColor(resultado.tiempoTotal)}>
                  <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Tiempo evacuación total</p>
                  <p className="text-5xl font-black mb-1" style={{ color: tiempoColor(resultado.tiempoTotal) }}>
                    {resultado.tiempoTotal}
                  </p>
                  <p className="text-sm text-white/50 mb-2">minutos</p>
                  <Badge color={tiempoColor(resultado.tiempoTotal)}>
                    {tiempoLabel(resultado.tiempoTotal)}
                  </Badge>
                  <p className="text-[10px] text-white/30 mt-2">
                    {resultado.totalPersonas.toLocaleString("es-AR")} personas evacuadas
                  </p>
                </Card>

                {/* Por sector */}
                <Card className="p-4">
                  <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-3">Por sector</p>
                  <div className="space-y-2.5">
                    {resultado.resultados.sort((a,b)=>b.tiempo-a.tiempo).map(r => (
                      <div key={r.id}>
                        <div className="flex justify-between items-center mb-1">
                          <div className="flex items-center gap-1.5">
                            {r.cuello && <span className="text-[9px]">⚠</span>}
                            <span className="text-xs text-white/70">{r.nombre}</span>
                          </div>
                          <span className="text-xs font-black" style={{ color: tiempoColor(r.tiempo) }}>
                            {r.tiempo === 999 ? "SIN SALIDA" : `${r.tiempo} min`}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width:`${Math.min((r.tiempo/40)*100,100)}%`, background: tiempoColor(r.tiempo) }}/>
                        </div>
                        <div className="flex justify-between text-[9px] text-white/20 mt-0.5">
                          <span>{r.personas?.toLocaleString("es-AR")} pers</span>
                          <span>{r.flujoTotal} pers/min</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Cuellos de botella */}
                {resultado.cuellos.length > 0 && (
                  <Card className="p-4 border-red-500/30" glow="#DC143C">
                    <p className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-2">
                      ⚠ Cuellos de botella
                    </p>
                    <div className="space-y-2">
                      {resultado.cuellos.map((c,i) => (
                        <div key={i} className="text-xs p-2 rounded-lg border border-red-500/20"
                          style={{ background:"rgba(220,20,60,0.08)" }}>
                          <p className="text-red-400 font-bold">{c.sector}</p>
                          <p className="text-white/40 text-[10px] mt-0.5">{c.problema}</p>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

                {/* Recomendaciones */}
                <Card className="p-4">
                  <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">Recomendaciones</p>
                  <div className="space-y-1.5">
                    {resultado.tiempoTotal > 25 && (
                      <p className="text-[10px] text-amber-400">⚠ Tiempo superior al estándar IRAM de 25 min. Revisar plan de salidas.</p>
                    )}
                    {resultado.cuellos.length > 0 && (
                      <p className="text-[10px] text-red-400">🚨 {resultado.cuellos.length} cuellos detectados. Redistribuir personal de guía.</p>
                    )}
                    {bloqueadas.length > 0 && (
                      <p className="text-[10px] text-orange-400">🚫 {bloqueadas.length} salida(s) bloqueada(s). Impacto crítico en flujo.</p>
                    )}
                    {resultado.tiempoTotal <= 20 && resultado.cuellos.length === 0 && (
                      <p className="text-[10px] text-emerald-400">✓ Plan de evacuación dentro de parámetros óptimos.</p>
                    )}
                    {resultado.resultados.some(r=>r.tiempo===999) && (
                      <p className="text-[10px] text-red-400">⛔ Sector sin salidas disponibles — intervención inmediata requerida.</p>
                    )}
                  </div>
                </Card>

                {/* Exportar */}
                <button className="w-full py-2.5 rounded-xl text-xs font-bold border border-orange-500/30 text-orange-400 hover:bg-orange-500/10 transition-all">
                  📄 Exportar informe IRAM
                </button>
              </>
            ) : (
              <Card className="p-6 text-center">
                <p className="text-4xl mb-3">🏟️</p>
                <p className="text-sm text-white/30 leading-relaxed">
                  Configurá el tipo de evacuación, la ocupación y los bloqueos.<br/><br/>
                  El simulador calcula tiempos por sector, detecta cuellos de botella y muestra el flujo animado en el plano.
                </p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


// ─── APP PRINCIPAL ────────────────────────────────────────────────────────────
const MODULOS = [
  { id:"dashboard",  label:"Dashboard",    ico:"📊", group:"operacion" },
  { id:"aforo",      label:"Aforo",        ico:"👥", group:"operacion" },
  { id:"schedule",   label:"Schedule",     ico:"📅", group:"operacion" },
  { id:"db",         label:"Monitor dB",   ico:"🔊", group:"operacion" },
  { id:"clima",      label:"Clima",        ico:"🌩️", group:"operacion" },
  { id:"evacuacion", label:"Evacuación",   ico:"🚨", group:"seguridad" },
  { id:"planos",     label:"Planos IRAM",  ico:"📐", group:"seguridad" },
  { id:"fotos",      label:"Registro fotog.", ico:"📸", group:"cierre"    },
  { id:"reporte",    label:"Post-show",    ico:"📋", group:"cierre"    },
];

export default function App() {
  const [modulo, setModulo]       = useState("dashboard");
  const [eventoId, setEventoId]   = useState(1);
  const [sideOpen, setSideOpen]   = useState(true);
  const evento = EVENTOS.find(e => e.id === eventoId);

  const estadoBadge = { "EN CURSO":"text-emerald-400 border-emerald-500/30", "FINALIZADO":"text-white/40 border-white/10", "PRÓXIMO":"text-orange-400 border-orange-500/30" };

  return (
    <div className="min-h-screen flex" style={{ background:"#0A0A0A", fontFamily:"system-ui,sans-serif" }}>

      {/* SIDEBAR */}
      <div className={`flex-shrink-0 border-r border-white/5 flex flex-col transition-all duration-300 ${sideOpen?"w-52":"w-16"}`}
        style={{ background:"#0d0d0d" }}>
        {/* Logo */}
        <div className="px-4 py-5 border-b border-white/5 flex items-center justify-between">
          {sideOpen && <Logo />}
          <button onClick={()=>setSideOpen(o=>!o)} className="text-white/20 hover:text-white/50 text-lg ml-auto">
            {sideOpen ? "◀" : "▶"}
          </button>
        </div>

        {/* Evento selector */}
        {sideOpen && (
          <div className="px-3 py-3 border-b border-white/5">
            <p className="text-[9px] text-white/20 uppercase tracking-wider mb-2">Evento activo</p>
            <select value={eventoId} onChange={e=>setEventoId(Number(e.target.value))}
              className="w-full bg-black border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white/70 outline-none">
              {EVENTOS.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
            <div className="mt-2 flex items-center gap-2">
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${estadoBadge[evento.estado]}`}>
                {evento.estado}
              </span>
              <span className="text-[9px] text-white/20">{evento.fecha}</span>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 py-2 px-2 overflow-y-auto">
          {sideOpen && <p className="text-[8px] text-white/15 uppercase tracking-widest px-2 pt-2 pb-1">Operación</p>}
          {MODULOS.filter(m=>m.group==="operacion").map(m => (
            <button key={m.id} onClick={()=>setModulo(m.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left mb-0.5 ${
                modulo===m.id ? "text-white font-bold" : "text-white/40 hover:text-white/70 hover:bg-white/3"
              }`}
              style={modulo===m.id ? { background:"rgba(255,90,0,0.12)", border:"1px solid rgba(255,90,0,0.2)" } : {}}>
              <span className="text-base flex-shrink-0">{m.ico}</span>
              {sideOpen && <span className="text-sm">{m.label}</span>}
              {sideOpen && modulo===m.id && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-500" />}
            </button>
          ))}
          {sideOpen && <p className="text-[8px] text-white/15 uppercase tracking-widest px-2 pt-3 pb-1">Seguridad</p>}
          {!sideOpen && <div className="my-1 border-t border-white/5" />}
          {MODULOS.filter(m=>m.group==="seguridad").map(m => (
            <button key={m.id} onClick={()=>setModulo(m.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left mb-0.5 ${
                modulo===m.id ? "text-white font-bold" : "text-white/40 hover:text-white/70 hover:bg-white/3"
              }`}
              style={modulo===m.id ? { background:"rgba(220,20,60,0.12)", border:"1px solid rgba(220,20,60,0.2)" } : {}}>
              <span className="text-base flex-shrink-0">{m.ico}</span>
              {sideOpen && <span className="text-sm">{m.label}</span>}
              {sideOpen && modulo===m.id && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-red-500" />}
            </button>
          ))}
          {sideOpen && <p className="text-[8px] text-white/15 uppercase tracking-widest px-2 pt-3 pb-1">Cierre</p>}
          {!sideOpen && <div className="my-1 border-t border-white/5" />}
          {MODULOS.filter(m=>m.group==="cierre").map(m => (
            <button key={m.id} onClick={()=>setModulo(m.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left mb-0.5 ${
                modulo===m.id ? "text-white font-bold" : "text-white/40 hover:text-white/70 hover:bg-white/3"
              }`}
              style={modulo===m.id ? { background:"rgba(255,90,0,0.12)", border:"1px solid rgba(255,90,0,0.2)" } : {}}>
              <span className="text-base flex-shrink-0">{m.ico}</span>
              {sideOpen && <span className="text-sm">{m.label}</span>}
              {sideOpen && modulo===m.id && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-500" />}
            </button>
          ))}
        </nav>

        {/* Bottom */}
        {sideOpen && (
          <div className="px-4 pb-4 pt-3 border-t border-white/5">
            <p className="text-[9px] text-white/20">SHOWCTRL Demo · v3.0</p>
            <p className="text-[9px] text-white/15 mt-0.5">showctrl.io</p>
          </div>
        )}
      </div>

      {/* MAIN */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <div className="border-b border-white/5 px-6 py-3 flex items-center justify-between flex-shrink-0"
          style={{ background:"#0d0d0d" }}>
          <div>
            <p className="font-bold text-white text-sm">{evento.nombre}</p>
            <p className="text-xs text-white/30">{evento.venue} · {evento.fecha} · {evento.aforo.toLocaleString("es-AR")} espectadores</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/30"
              style={{ background:"rgba(16,185,129,0.08)" }}>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-bold text-emerald-400">SISTEMA ACTIVO</span>
            </div>
            <span className="text-xs text-white/20">{new Date().toLocaleTimeString("es-AR",{hour:"2-digit",minute:"2-digit"})}</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {modulo === "dashboard"  && <ModuleDashboard evento={evento} />}
          {modulo === "aforo"      && <ModuleAforo />}
          {modulo === "schedule"   && <ModuleSchedule />}
          {modulo === "db"         && <ModuleDB />}
          {modulo === "clima"      && <ModuleClima venue={evento.venue} showHora="21:00" />}
          {modulo === "evacuacion" && <ModuleEvacuacion />}
          {modulo === "planos"     && <ModulePlanos />}
          {modulo === "fotos"      && <ModuleFotos />}
          {modulo === "reporte"    && <ModuleReporte />}
        </div>

        {/* Footer */}
        <div className="border-t border-white/5 px-6 py-2 flex items-center justify-between flex-shrink-0"
          style={{ background:"#0d0d0d" }}>
          <p className="text-[10px] text-white/15">SHOWCTRL · Plataforma completa · 9 módulos · Datos en tiempo real</p>
          <p className="text-[10px] text-white/15">Motor IA: Claude Sonnet 4.6 · Anthropic</p>
        </div>
      </div>
    </div>
  );
}
