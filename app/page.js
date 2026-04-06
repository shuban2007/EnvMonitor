'use client'
import { useEffect, useState } from 'react'
import mqtt from 'mqtt'

// SECURE: Fetching credentials from Environment Variables
const CLUSTER_URL = process.env.NEXT_PUBLIC_MQTT_URL
const MQTT_USER   = process.env.NEXT_PUBLIC_MQTT_USER
const MQTT_PASS   = process.env.NEXT_PUBLIC_MQTT_PASS
const TOPIC       = process.env.NEXT_PUBLIC_MQTT_TOPIC || 'env/data'

const MAX_HISTORY = 40

// --- All helper functions (getAQColor, getTempColor, etc.) remain the same ---
// ... (omitting them for brevity, no changes needed here) ...
function getAQColor(level) {
    if (level === 'Good')      return '#10b981';
    if (level === 'Moderate')  return '#f59e0b';
    if (level === 'Poor')      return '#f97316';
    return '#ef4444';
}
function getOutdoorAQIColor(aqi) {
    if (aqi <= 20) return '#10b981';
    if (aqi <= 40) return '#84cc16';
    if (aqi <= 60) return '#f59e0b';
    if (aqi <= 80) return '#f97316';
    return '#ef4444';
}
function getTempColor(t) {
    if (t < 20) return '#3b82f6';
    if (t < 28) return '#10b981';
    if (t < 35) return '#f59e0b';
    return '#ef4444';
}
function getHumColor(h) {
    if (h < 30) return '#f97316';
    if (h < 60) return '#10b981';
    if (h < 75) return '#f59e0b';
    return '#3b82f6';
}
function getWeatherDesc(code) {
    if (code === 0) return { text: 'Clear Sky', icon: '☀️' };
    if (code <= 3)  return { text: 'Cloudy', icon: '⛅' };
    if (code <= 48) return { text: 'Foggy', icon: '🌫️' };
    if (code <= 67) return { text: 'Rainy', icon: '🌧️' };
    if (code <= 77) return { text: 'Snowy', icon: '❄️' };
    if (code <= 99) return { text: 'Stormy', icon: '⛈️' };
    return { text: 'Unknown', icon: '🌡️' };
}
function getRecommendations(data) {
    if (!data) return [];
    const recs = [];
    const { temp, hum, aq_level } = data;
    if (temp > 35)       recs.push({ icon: '🌡', text: 'Dangerously hot. Stay hydrated, avoid direct sun.', color: '#ef4444' });
    else if (temp > 30)  recs.push({ icon: '☀️', text: 'Quite warm. Keep the space ventilated.', color: '#f97316' });
    else if (temp < 18)  recs.push({ icon: '❄️', text: 'Temperature is low. Consider warming the space.', color: '#3b82f6' });
    else                 recs.push({ icon: '✅', text: 'Temperature is comfortable and safe.', color: '#10b981' });
    if (hum > 75)        recs.push({ icon: '💧', text: 'High humidity. Risk of mould — improve ventilation.', color: '#3b82f6' });
    else if (hum < 30)   recs.push({ icon: '🏜️', text: 'Air is very dry. Consider a humidifier.', color: '#f97316' });
    else                 recs.push({ icon: '✅', text: 'Humidity is in a healthy range.', color: '#10b981' });
    if (aq_level === 'Hazard')        recs.push({ icon: '🚨', text: 'Hazardous air quality! Open windows or leave immediately.', color: '#ef4444' });
    else if (aq_level === 'Poor')     recs.push({ icon: '😷', text: 'Poor air quality. Ventilate the space now.', color: '#f97316' });
    else if (aq_level === 'Moderate') recs.push({ icon: '⚡', text: 'Moderate air quality. Keep monitoring.', color: '#f59e0b' });
    else                              recs.push({ icon: '✅', text: 'Air quality is good. Safe to breathe.', color: '#10b981' });
    return recs;
}

// --- All components (Sparkline, Gauge) remain the same ---
// ... (omitting them for brevity, no changes needed here) ...
function Sparkline({ history, field, color, label, unit }) {
    const vals   = history.map(d => d[field]).filter(v => v !== undefined && !isNaN(v));
    const latest = vals[vals.length - 1];
    const w = 400, h = 90, pad = 12;

    function smoothPath(pts) {
      if (pts.length < 2) return '';
      let d = `M ${pts[0].x} ${pts[0].y}`;
      for (let i = 1; i < pts.length; i++) {
        const prev = pts[i - 1], curr = pts[i];
        const cpx = (prev.x + curr.x) / 2;
        d += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`;
      }
      return d;
    }

    if (vals.length < 2) return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:'16px' }}>
          <span style={{ color:'#94a3b8', fontSize:'11px', letterSpacing:'2px', textTransform:'uppercase', fontWeight: 600 }}>{label}</span>
          <span style={{ color, fontSize:'28px', fontWeight:'700', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>--<span style={{fontSize:'14px', color:'#64748b', marginLeft:'2px'}}>{unit}</span></span>
        </div>
        <div style={{ flex: 1, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <span style={{ color:'#475569', fontSize:'12px', letterSpacing:'1px' }}>Collecting data...</span>
        </div>
      </div>
    );
    const min = Math.min(...vals), max = Math.max(...vals), range = max - min || 1;
    const pts = vals.map((v, i) => ({
      x: (i / (vals.length - 1)) * w,
      y: h - pad - ((v - min) / range) * (h - pad * 2),
    }));
    const line = smoothPath(pts);
    const area = line + ` L ${w} ${h} L 0 ${h} Z`;
    const gid  = `g-${field}`;
    const last = pts[pts.length - 1];
    return (
      <div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:'16px' }}>
          <span style={{ color:'#94a3b8', fontSize:'11px', letterSpacing:'2px', textTransform:'uppercase', fontWeight: 600 }}>{label}</span>
          <div style={{ display:'flex', alignItems:'baseline', gap:'4px' }}>
            <span style={{ color, fontSize:'28px', fontWeight:'700', lineHeight: 1, fontVariantNumeric: 'tabular-nums', transition: 'color 0.8s ease' }}>{latest}</span>
            <span style={{ color:'#94a3b8', fontSize:'14px', fontWeight:'500' }}>{unit}</span>
          </div>
        </div>
        <svg width="100%" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ height:`${h}px`, display:'block', overflow:'visible' }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={color} stopOpacity="0.3"/>
              <stop offset="100%" stopColor={color} stopOpacity="0.0"/>
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${gid})`} stroke="none" style={{ transition: 'fill 0.8s ease' }}/>
          <path d={line} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
            style={{ filter:`drop-shadow(0 4px 6px ${color}40)`, transition: 'stroke 0.8s ease, filter 0.8s ease' }}/>
          <circle cx={last.x} cy={last.y} r="5" fill="#fff" stroke={color} strokeWidth="2" style={{ filter:`drop-shadow(0 0 8px ${color})`, transition: 'stroke 0.8s ease, filter 0.8s ease' }}/>
        </svg>
      </div>
    );
}
function Gauge({ value, min, max, label, unit, color }) {
    const pct = Math.min(Math.max((value - min) / (max - min), 0), 1);
    const r = 54, cx = 72, cy = 72;
    const C = 2 * Math.PI * r;
    const sweep = 240;
    const arcLength = (sweep / 360) * C;
    const dash = pct * arcLength;
    return (
      <div style={{ textAlign:'center', flex:'1 1 120px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <svg width="144" height="120" viewBox="0 0 144 120" style={{ overflow:'visible' }}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="12" 
            strokeDasharray={`${arcLength} ${C}`} strokeLinecap="round" 
            style={{ transform: 'rotate(150deg)', transformOrigin: '72px 72px' }} 
          />
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="12" 
            strokeDasharray={`${dash} ${C}`} strokeLinecap="round" 
            style={{ 
              transform: 'rotate(150deg)', transformOrigin: '72px 72px', 
              transition: 'stroke-dasharray 1s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.8s ease',
              filter: `drop-shadow(0 0 10px ${color}80)`
            }} 
          />
          <line x1={cx} y1={cy} x2={cx + 40} y2={cy} stroke="#fff" strokeWidth="3" strokeLinecap="round" 
            style={{ 
              transform: `rotate(${-210 + (pct * sweep)}deg)`, transformOrigin: '72px 72px',
              transition: 'transform 1s cubic-bezier(0.4, 0, 0.2, 1)',
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' 
            }} 
          />
          <circle cx={cx} cy={cy} r="6" fill="#fff" style={{ filter:`drop-shadow(0 0 8px ${color})`, transition: 'filter 0.8s ease' }}/>
          <text x={cx} y={cy+24} textAnchor="middle" fill="#f8fafc" fontSize="22" fontWeight="700" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {value ?? '--'}
          </text>
          <text x={cx} y={cy+40} textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="500">{unit}</text>
        </svg>
        <p style={{ color:'#cbd5e1', fontSize:'11px', letterSpacing:'2px', textTransform:'uppercase', fontWeight: 600, marginTop:'8px' }}>{label}</p>
      </div>
    );
}


export default function Dashboard() {
  const [data,         setData]         = useState(null)
  const [history,      setHistory]      = useState([])
  const [status,       setStatus]       = useState('Connecting…')
  const [lastSeen,     setLastSeen]     = useState(null)
  const [localWeather, setLocalWeather] = useState(null)

  // Fetch Outdoor Data (no changes here)
  useEffect(() => {
    // ... same code as before ...
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(async (position) => {
            const { latitude: lat, longitude: lon } = position.coords;
            try {
                const geoRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
                const geoData = await geoRes.json();
                const city = geoData.city || geoData.locality || "Your Area";
                const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code`);
                const weatherData = await weatherRes.json();
                const aqiRes = await fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi`);
                const aqiData = await aqiRes.json();
                setLocalWeather({ city, temp: weatherData.current.temperature_2m, hum: weatherData.current.relative_humidity_2m, code: weatherData.current.weather_code, aqi: aqiData.current.european_aqi });
            } catch (error) { console.error("Error fetching local weather:", error); }
        }, (error) => console.log("Geolocation access denied or failed.", error));
    }
  }, []);

  // NEW: A separate useEffect to load data from localStorage ONCE on startup
  useEffect(() => {
    try {
      const savedCache = localStorage.getItem('envMonitorCache');
      if (savedCache) {
        const { data, history, lastSeen } = JSON.parse(savedCache);
        setData(data);
        setHistory(history);
        setLastSeen(lastSeen);
      }
    } catch (error) {
      console.error("Could not load data from localStorage", error);
    }
  }, []);

  // MQTT Connection
  useEffect(() => {
    if (!CLUSTER_URL || !MQTT_USER || !MQTT_PASS) {
      setStatus('Setup Required (.env missing)');
      return;
    }

    const client = mqtt.connect(CLUSTER_URL, { username: MQTT_USER, password: MQTT_PASS, reconnectPeriod: 3000 });
    client.on('connect',   () => { setStatus('Live'); client.subscribe(TOPIC); });
    client.on('offline',   () => setStatus('Offline'));
    client.on('reconnect', () => setStatus('Reconnecting…'));
    client.on('error',     (err)  => { setStatus('Error'); console.error('MQTT Error:', err); });
    client.on('message',   (_, msg) => {
      try {
        const p = JSON.parse(msg.toString());
        const newLastSeen = new Date().toLocaleTimeString();
        
        // Update state
        setData(p);
        setLastSeen(newLastSeen);
        
        // Update history state based on previous state
        const newHistory = [...history.slice(-(MAX_HISTORY - 1)), p];
        setHistory(newHistory);

        // NEW: Save the latest data, history, and timestamp to localStorage
        const cache = {
          data: p,
          history: newHistory,
          lastSeen: newLastSeen,
        };
        localStorage.setItem('envMonitorCache', JSON.stringify(cache));

      } catch (e) {
        console.error("Error parsing MQTT message:", e);
      }
    });

    return () => client.end();
  // IMPORTANT: Added `history` to dependency array to ensure the localStorage save uses the latest history.
  }, [history]); 

  const recs   = getRecommendations(data);
  const isLive = status === 'Live';

  // --- The entire return (...) part with JSX and <style> remains the same ---
  // ... (omitting it for brevity, no changes needed here) ...
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Syne:wght@700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #020617; min-height: 100vh; font-family: 'Inter', sans-serif; color: #f8fafc; }
        .bg { position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; background: #020617; }
        .orb { position: absolute; border-radius: 50%; filter: blur(120px); opacity: 0.15; mix-blend-mode: screen; }
        .o1 { width: 800px; height: 800px; background: #10b981; top: -300px; left: -200px; animation: float1 22s ease-in-out infinite alternate; }
        .o2 { width: 700px; height: 700px; background: #3b82f6; bottom: -200px; right: -200px; animation: float2 28s ease-in-out infinite alternate; }
        .o3 { width: 500px; height: 500px; background: #8b5cf6; top: 40%; left: 30%; animation: float3 20s ease-in-out infinite alternate; }
        .grid-bg { position: absolute; inset: 0; background-image: linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px); background-size: 60px 60px; mask-image: radial-gradient(circle at center, black 30%, transparent 80%); -webkit-mask-image: radial-gradient(circle at center, black 30%, transparent 80%); }
        @keyframes float1 { to { transform: translate(150px, 150px) scale(1.1); } }
        @keyframes float2 { to { transform: translate(-100px, -150px) scale(1.2); } }
        @keyframes float3 { to { transform: translate(-150px, 100px); } }
        .wrap { position: relative; z-index: 1; max-width: 960px; margin: 0 auto; padding: 40px 20px 80px; }
        .card { background: linear-gradient(145deg, rgba(30,41,59,0.4) 0%, rgba(15,23,42,0.4) 100%); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.3), inset 0 1px 0 0 rgba(255,255,255,0.05); border-radius: 24px; padding: 28px 32px; transition: all 0.4s ease; }
        .card:hover { border-color: rgba(255, 255, 255, 0.15); box-shadow: 0 12px 40px 0 rgba(0, 0, 0, 0.4), inset 0 1px 0 0 rgba(255,255,255,0.1); }
        .lbl { color: #f8fafc; font-size: 16px; font-weight: 600; letter-spacing: 0.5px; margin-bottom: 24px; display: flex; alignItems: center; gap: 8px; }
        .header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 32px; }
        .gauges { display: flex; justify-content: space-around; flex-wrap: wrap; gap: 24px; }
        .g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
        .mb { margin-bottom: 24px; }
        .fi { animation: fadeUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .fi:nth-child(2) { animation-delay: 0.1s; }
        .fi:nth-child(3) { animation-delay: 0.2s; }
        .fi:nth-child(4) { animation-delay: 0.3s; }
        .fi:nth-child(5) { animation-delay: 0.4s; }
        .fi:nth-child(6) { animation-delay: 0.5s; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        .out-metric { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
        .out-val { font-size: 24px; font-weight: 700; font-variant-numeric: tabular-nums; display: flex; align-items: baseline; gap: 4px; }
        .out-lbl { color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600; }
        @media(max-width: 640px) { .wrap { padding: 24px 16px 60px; } .card { padding: 20px; border-radius: 20px; } .header { flex-direction: column; align-items: flex-start; gap: 16px; } .g2 { grid-template-columns: 1fr; } .gauges { gap: 16px; } .out-grid { grid-template-columns: 1fr 1fr !important; gap: 20px; } }
      `}</style>
      <div className="bg"> <div className="orb o1"/><div className="orb o2"/><div className="orb o3"/> <div className="grid-bg"/> </div>
      <div className="wrap">
        <div className="header fi">
          <div> <h1 style={{ fontFamily:"'Syne', sans-serif", fontSize:'clamp(28px, 6vw, 42px)', fontWeight:'800', letterSpacing:'-1px', lineHeight: 1.1, background: 'linear-gradient(to right, #fff, #94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}> ENV<span style={{ color:'#10b981', WebkitTextFillColor: '#10b981' }}>.</span>MONITOR </h1> <p style={{ color:'#64748b', fontSize:'12px', letterSpacing:'4px', marginTop:'10px', textTransform: 'uppercase', fontWeight: 600 }}> Real-Time Sensor Dashboard </p> </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <div style={{ display:'inline-flex', alignItems:'center', gap:'8px', padding:'8px 16px', borderRadius:'999px', background: isLive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', border:`1px solid ${isLive ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`, fontSize:'12px', letterSpacing:'1px', fontWeight: 600, textTransform: 'uppercase', color: isLive ? '#10b981' : '#ef4444', backdropFilter: 'blur(10px)' }}> <span style={{ width:'8px', height:'8px', borderRadius:'50%', flexShrink:0, background: isLive ? '#10b981' : (status === 'Setup Required (.env missing)' ? '#f59e0b' : '#ef4444'), boxShadow: isLive ? '0 0 10px #10b981' : 'none' }}/> {status} </div>
            {lastSeen && <p style={{ color:'#475569', fontSize:'11px', marginTop:'8px', letterSpacing:'1px', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>Last updated: {lastSeen}</p>}
          </div>
        </div>
        {localWeather && ( <div className="card mb fi" style={{ background: 'linear-gradient(145deg, rgba(30,41,59,0.5) 0%, rgba(15,23,42,0.6) 100%)', borderTop: '1px solid rgba(255,255,255,0.15)' }}> <div className="lbl" style={{ marginBottom: '20px' }}> <span style={{width:'8px', height:'20px', background:'#f59e0b', borderRadius:'4px'}}></span> Outdoor Environment • {localWeather.city} </div> <div className="out-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}> <div className="out-metric"> <div className="out-lbl">Weather</div> <div className="out-val" style={{ color: '#fff' }}> <span style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}>{getWeatherDesc(localWeather.code).icon}</span> <span style={{ fontSize: '16px', marginLeft: '4px' }}>{getWeatherDesc(localWeather.code).text}</span> </div> </div> <div className="out-metric"> <div className="out-lbl">Temperature</div> <div className="out-val" style={{ color: getTempColor(localWeather.temp) }}> {localWeather.temp}<span style={{ fontSize: '14px', color: '#94a3b8' }}>°C</span> </div> </div> <div className="out-metric"> <div className="out-lbl">Humidity</div> <div className="out-val" style={{ color: getHumColor(localWeather.hum) }}> {localWeather.hum}<span style={{ fontSize: '14px', color: '#94a3b8' }}>%</span> </div> </div> <div className="out-metric"> <div className="out-lbl">AQI (EAQI)</div> <div className="out-val" style={{ color: getOutdoorAQIColor(localWeather.aqi) }}> {localWeather.aqi}<span style={{ fontSize: '14px', color: '#94a3b8' }}>idx</span> </div> </div> </div> </div> )}
        {!data ? ( <div className="card fi" style={{ height:'40vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'20px' }}> <div style={{ width:'40px', height:'40px', border:'3px solid rgba(255,255,255,0.1)', borderTop:'3px solid #10b981', borderRadius:'50%', animation:'spin 1s linear infinite' }}/> <p style={{ color:'#94a3b8', fontSize:'13px', letterSpacing:'3px', fontWeight: 500, textTransform: 'uppercase' }}>Waiting for live sensor data</p> {status === 'Setup Required (.env missing)' && ( <p style={{ color:'#ef4444', fontSize:'11px', maxWidth: '300px', textAlign: 'center', marginTop: '10px' }}> Missing environment variables. Please configure them in your Vercel project settings. </p> )} </div> ) : ( <> <div className="card mb fi"> <div className="lbl"> <span style={{width:'8px', height:'20px', background:'#3b82f6', borderRadius:'4px'}}></span> Indoor Sensor Readings </div> <div className="gauges"> <Gauge value={data.temp}   min={0} max={50}  label="Temperature" unit="°C"  color={getTempColor(data.temp)}/> <Gauge value={data.hum}    min={0} max={100} label="Humidity"    unit="%"   color={getHumColor(data.hum)}/> <Gauge value={data.aq_raw} min={0} max={500} label="AQ Raw"      unit="raw" color={getAQColor(data.aq_level)}/> <div style={{ flex:'1 1 120px', textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'16px', paddingTop:'8px' }}> <div style={{ width:'96px', height:'96px', borderRadius:'50%', border:`3px solid ${getAQColor(data.aq_level)}`, display:'flex', alignItems:'center', justifyContent:'center', background:`linear-gradient(135deg, ${getAQColor(data.aq_level)}20, transparent)`, boxShadow:`0 0 32px ${getAQColor(data.aq_level)}30, inset 0 0 20px ${getAQColor(data.aq_level)}20`, transition: 'all 0.8s ease' }}> <span style={{ color:getAQColor(data.aq_level), transition: 'color 0.8s ease', fontSize:'15px', fontWeight:'800', letterSpacing:'1px', textTransform:'uppercase' }}> {data.aq_level} </span> </div> <p style={{ color:'#cbd5e1', fontSize:'11px', letterSpacing:'2px', textTransform:'uppercase', fontWeight: 600 }}>Air Quality</p> </div> </div> </div> <div className="g2 fi"> <div className="card"><Sparkline history={history} field="temp" color={getTempColor(data.temp)} label="Temperature" unit="°C"/></div> <div className="card"><Sparkline history={history} field="hum"  color={getHumColor(data.hum)}  label="Humidity"    unit="%"/></div> </div> <div className="card mb fi"> <Sparkline history={history} field="aq_raw" color={getAQColor(data.aq_level)} label="Air Quality Trend" unit=" raw"/> </div> <div className="card fi"> <div className="lbl"> <span style={{width:'8px', height:'20px', background:'#8b5cf6', borderRadius:'4px'}}></span> System Recommendations </div> <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}> {recs.map((r, i) => ( <div key={i} style={{ display:'flex', alignItems:'center', gap:'16px', padding:'16px 20px', borderRadius:'16px', background: `linear-gradient(90deg, ${r.color}15 0%, rgba(255,255,255,0.02) 100%)`, borderLeft: `4px solid ${r.color}`, borderTop: '1px solid rgba(255,255,255,0.03)', borderRight: '1px solid rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.03)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', transition: 'all 0.8s ease' }}> <span style={{ fontSize:'22px', flexShrink:0, filter:'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}>{r.icon}</span> <span style={{ color:'#e2e8f0', fontSize:'14px', fontWeight:'500', lineHeight:'1.5' }}>{r.text}</span> </div> ))} </div> </div> </> )}
      </div>
    </>
  );
}