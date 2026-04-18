import { useState, useEffect, useRef, useCallback } from "react";

// ── UTILS ────────────────────────────────────────────────────────────────────
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const load = (k, def) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } };
function fmt12(t) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${((h % 12) || 12)}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}
function getNowMins() { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
function toMins(t) { if (!t) return 0; const [h, m] = t.split(":").map(Number); return h * 60 + m; }

async function claude(system, messages, maxTokens = 900) {
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: maxTokens, system, messages })
    });
    const d = await r.json();
    return d.content?.map(c => c.text || "").join("") || "";
  } catch { return "Connection error. Try again."; }
}

// ── CONSTANTS ────────────────────────────────────────────────────────────────
const TABS = [
  { id: "today", label: "Today", icon: "◉" },
  { id: "schedule", label: "Schedule", icon: "◷" },
  { id: "habits", label: "Habits", icon: "◈" },
  { id: "baby", label: "Baby", icon: "✦" },
  { id: "ideas", label: "Ideas", icon: "💡" },
  { id: "quit", label: "Quit", icon: "⊘" },
  { id: "alarms", label: "Alarms", icon: "◆" },
];

const TAG_C = { spirit:"#C8A97E", self:"#C87E7E", health:"#7EC8A9", wealth:"#A97EC8", home:"#7EA9C8", work:"#E8D090", family:"#E8A090", food:"#90E8B0" };

const ONBOARDING_QUESTIONS = [
  { id:"name", q:"What's your name?", type:"text", placeholder:"Your first name" },
  { id:"goal", q:"What's your #1 life goal right now?", type:"text", placeholder:"e.g. Be a great father, grow financially, get fit..." },
  { id:"work", q:"What are your work hours?", type:"select", options:["9am–5pm (day shift)","7pm–4am (night shift)","6am–2pm (early shift)","Flexible / Remote","I don't work fixed hours"] },
  { id:"sleep", q:"When do you usually wake up?", type:"select", options:["5:00 AM","6:00 AM","7:00 AM","8:00 AM","9:00 AM","10:00 AM","11:00 AM","12:00 PM"] },
  { id:"religion", q:"Do you have daily prayers or spiritual practices?", type:"select", options:["Yes — 5 daily prayers (Islam)","Yes — morning/evening prayers","Yes — meditation/mindfulness","No regular practice"] },
  { id:"fitness", q:"What's your fitness situation?", type:"select", options:["I gym regularly","I want to start going","I prefer home workouts","I do yoga/stretching","I'm not active yet"] },
  { id:"family", q:"Family situation?", type:"select", options:["Married, expecting a baby","Married with kids","Married, no kids yet","Single","Other"] },
  { id:"smoke", q:"Do you smoke?", type:"select", options:["Yes, trying to quit","Yes, not trying yet","I quit already","Never smoked"] },
  { id:"dinner", q:"When does your family eat dinner?", type:"select", options:["6–7 PM","7–8 PM","8–9 PM","9–10 PM","After 10 PM","I eat alone"] },
  { id:"challenges", q:"What's your biggest daily challenge?", type:"select", options:["Staying consistent","Managing time","Energy / fatigue","Focus at work","Taking care of family","Financial stress","All of the above"] },
];

// ── ONBOARDING ───────────────────────────────────────────────────────────────
function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [val, setVal] = useState("");
  const [generating, setGenerating] = useState(false);

  const q = ONBOARDING_QUESTIONS[step];
  const isLast = step === ONBOARDING_QUESTIONS.length - 1;

  const next = async () => {
    const newAnswers = { ...answers, [q.id]: val || (q.options?.[0] ?? "") };
    setAnswers(newAnswers);
    setVal("");
    if (isLast) {
      setGenerating(true);
      // Generate personalized schedule
      const prompt = `Based on this person's profile, create a personalized daily schedule with 15–20 items.
Profile: ${JSON.stringify(newAnswers)}
Return ONLY a JSON array like: [{"time":"HH:MM","label":"Task name","tag":"health|spirit|self|wealth|home|work|family|food","icon":"emoji"}]
Make it realistic, specific to their life. Include their work hours, prayers if applicable, meals, fitness, family time. No markdown, just pure JSON array.`;
      const raw = await claude("You are a life planning expert. Return only valid JSON.", [{ role:"user", content:prompt }]);
      let schedule = [];
      try {
        const clean = raw.replace(/```json|```/g, "").trim();
        schedule = JSON.parse(clean);
      } catch {
        schedule = buildDefaultSchedule(newAnswers);
      }
      onComplete(newAnswers, schedule);
      setGenerating(false);
    } else {
      setStep(s => s + 1);
    }
  };

  return (
    <div style={{ minHeight:"100vh", background:"#06060F", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:24 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=DM+Sans:wght@300;400;500;600&display=swap'); *{box-sizing:border-box;margin:0;padding:0;} @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}} @keyframes pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)}}`}</style>
      
      <div style={{ width:"min(480px,100%)", animation:"fadeUp 0.4s ease" }}>
        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:48 }}>
          <div style={{ fontFamily:"'Cinzel',serif", fontSize:28, color:"#C8A97E", letterSpacing:6 }}>LIFE OS</div>
          <div style={{ fontSize:12, color:"#333", letterSpacing:2, marginTop:4 }}>YOUR PERSONAL INTELLIGENCE</div>
        </div>

        {/* Progress */}
        <div style={{ display:"flex", gap:4, marginBottom:32 }}>
          {ONBOARDING_QUESTIONS.map((_, i) => (
            <div key={i} style={{ flex:1, height:2, borderRadius:1, background: i <= step ? "#C8A97E" : "#1A1A2A", transition:"background 0.3s" }} />
          ))}
        </div>

        {generating ? (
          <div style={{ textAlign:"center", padding:60 }}>
            <div style={{ fontFamily:"'Cinzel',serif", fontSize:18, color:"#C8A97E", marginBottom:16 }}>Building Your Life OS...</div>
            <div style={{ fontSize:13, color:"#555", marginBottom:24 }}>AI is personalizing everything for you</div>
            <div style={{ display:"flex", gap:8, justifyContent:"center" }}>
              {[0,1,2,3,4].map(i => <div key={i} style={{ width:8, height:8, borderRadius:"50%", background:"#C8A97E", animation:`pulse 1.4s ${i*0.15}s infinite` }} />)}
            </div>
          </div>
        ) : (
          <div key={step} style={{ animation:"fadeUp 0.35s ease" }}>
            <div style={{ fontSize:11, color:"#444", letterSpacing:2, marginBottom:12 }}>QUESTION {step+1} OF {ONBOARDING_QUESTIONS.length}</div>
            <div style={{ fontSize:22, color:"#fff", fontWeight:600, marginBottom:28, lineHeight:1.4 }}>{q.q}</div>
            
            {q.type === "text" ? (
              <input value={val} onChange={e => setVal(e.target.value)}
                onKeyDown={e => e.key === "Enter" && val.trim() && next()}
                placeholder={q.placeholder}
                autoFocus
                style={{ width:"100%", background:"#0D0D1A", border:"1px solid #2A2A3A", borderRadius:14, padding:"16px 18px", color:"#fff", fontSize:17, outline:"none", fontFamily:"inherit" }}
              />
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {q.options.map(opt => (
                  <button key={opt} onClick={() => { setVal(opt); }}
                    style={{ background: val === opt ? "#C8A97E22" : "#0D0D1A", border:`1px solid ${val===opt?"#C8A97E":"#1E1E2E"}`, borderRadius:12, padding:"14px 18px", color: val===opt?"#C8A97E":"#888", cursor:"pointer", fontSize:14, textAlign:"left", transition:"all 0.15s" }}>
                    {opt}
                  </button>
                ))}
              </div>
            )}

            <button onClick={() => { if (q.type==="text" ? val.trim() : (val||q.options?.[0])) next(); else if(q.type!=="text") { setVal(q.options[0]); next(); } }}
              style={{ marginTop:24, width:"100%", background:"linear-gradient(135deg,#C8A97E,#A97EC8)", border:"none", borderRadius:14, padding:"16px", color:"#0F0F16", fontWeight:700, cursor:"pointer", fontSize:16 }}>
              {isLast ? "Build My Life OS →" : "Continue →"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function buildDefaultSchedule(profile) {
  const isNight = profile.work?.includes("night") || profile.work?.includes("7pm");
  const base = isNight ? [
    {time:"10:00",label:"Wake Up",tag:"self",icon:"☀️"},
    {time:"10:30",label:"Morning Shower & Groom",tag:"self",icon:"🚿"},
    {time:"11:00",label:"Breakfast",tag:"food",icon:"🍳"},
    {time:"11:30",label:"Dhuhr Prayer",tag:"spirit",icon:"🕌"},
    {time:"12:30",label:"Deep Work",tag:"wealth",icon:"💻"},
    {time:"14:30",label:"Asr Prayer",tag:"spirit",icon:"🕌"},
    {time:"15:00",label:"Gym / Workout",tag:"health",icon:"🏋️"},
    {time:"17:00",label:"Family Time",tag:"family",icon:"👨‍👩‍👧"},
    {time:"17:30",label:"Pre-shift Nap",tag:"health",icon:"😴"},
    {time:"18:30",label:"Maghrib Prayer",tag:"spirit",icon:"🌅"},
    {time:"19:00",label:"WORK STARTS",tag:"work",icon:"💼"},
    {time:"20:00",label:"Isha Prayer",tag:"spirit",icon:"🌃"},
    {time:"21:30",label:"Family Dinner",tag:"family",icon:"🍽"},
    {time:"04:00",label:"WORK ENDS",tag:"work",icon:"🏁"},
    {time:"05:30",label:"Fajr Prayer",tag:"spirit",icon:"🌙"},
    {time:"06:00",label:"Sleep",tag:"health",icon:"🛌"},
  ] : [
    {time:"06:00",label:"Wake Up",tag:"self",icon:"☀️"},
    {time:"06:30",label:"Morning Prayer / Meditation",tag:"spirit",icon:"🙏"},
    {time:"07:00",label:"Workout",tag:"health",icon:"🏋️"},
    {time:"08:00",label:"Shower & Groom",tag:"self",icon:"🚿"},
    {time:"08:30",label:"Breakfast",tag:"food",icon:"🍳"},
    {time:"09:00",label:"WORK STARTS",tag:"work",icon:"💼"},
    {time:"13:00",label:"Lunch",tag:"food",icon:"🍽"},
    {time:"17:00",label:"WORK ENDS",tag:"work",icon:"🏁"},
    {time:"18:00",label:"Family Time",tag:"family",icon:"👨‍👩‍👧"},
    {time:"19:00",label:"Dinner",tag:"food",icon:"🍽"},
    {time:"21:00",label:"Reading",tag:"wealth",icon:"📖"},
    {time:"22:30",label:"Sleep",tag:"health",icon:"🛌"},
  ];
  return base;
}

// ── FLOATING AI ───────────────────────────────────────────────────────────────
function FloatingAI({ profile, schedule, habits, alarms, onScheduleChange, onHabitsChange, onAlarmsChange, onTabChange }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pulse, setPulse] = useState(false);
  const scrollRef = useRef();

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs]);

  useEffect(() => {
    const t = setInterval(() => setPulse(p => !p), 3000);
    return () => clearInterval(t);
  }, []);

  const systemPrompt = `You are AXIS, the AI intelligence inside LIFE OS — a personal life management app. You have full control over the user's app. You know everything about them:

USER PROFILE: ${JSON.stringify(profile)}
CURRENT SCHEDULE: ${JSON.stringify(schedule?.map(s => `${s.time} - ${s.label}`))}
CURRENT HABITS: ${JSON.stringify(habits?.map(h => h.label))}
CURRENT ALARMS: ${JSON.stringify(alarms?.map(a => `${a.time} - ${a.label}`))}

You can CONTROL the app. When the user asks you to make changes, respond with plain text explanation AND end your message with a JSON action block like:
<ACTION>{"type":"add_schedule","item":{"time":"21:30","label":"Family Dinner","tag":"family","icon":"🍽"}}</ACTION>
<ACTION>{"type":"delete_schedule","label":"something"}</ACTION>
<ACTION>{"type":"add_habit","item":{"label":"Drink water","tag":"health","icon":"💧","xp":10}}</ACTION>
<ACTION>{"type":"delete_habit","label":"something"}</ACTION>
<ACTION>{"type":"add_alarm","item":{"time":"21:30","label":"Dinner time","repeat":"daily"}}</ACTION>
<ACTION>{"type":"delete_alarm","label":"something"}</ACTION>
<ACTION>{"type":"navigate","tab":"schedule|habits|baby|ideas|quit|alarms|today"}</ACTION>

Multiple actions allowed. Be conversational, direct, warm. Under 120 words in your text response. Always confirm what you did.`;

  const send = async (text) => {
    if (!text.trim()) return;
    const userMsg = { role:"user", content:text };
    const newMsgs = [...msgs, userMsg];
    setMsgs(newMsgs);
    setInput("");
    setLoading(true);
    const reply = await claude(systemPrompt, newMsgs);
    
    // Parse and execute actions
    const actionMatches = [...reply.matchAll(/<ACTION>(.*?)<\/ACTION>/gs)];
    const cleanReply = reply.replace(/<ACTION>.*?<\/ACTION>/gs, "").trim();
    
    for (const match of actionMatches) {
      try {
        const action = JSON.parse(match[1]);
        executeAction(action);
      } catch {}
    }
    
    setMsgs([...newMsgs, { role:"assistant", content: cleanReply }]);
    setLoading(false);
  };

  const executeAction = (action) => {
    switch (action.type) {
      case "add_schedule":
        onScheduleChange(prev => [...prev, { ...action.item, id: Date.now() }].sort((a,b) => toMins(a.time) - toMins(b.time)));
        break;
      case "delete_schedule":
        onScheduleChange(prev => prev.filter(s => !s.label?.toLowerCase().includes(action.label?.toLowerCase())));
        break;
      case "add_habit":
        onHabitsChange(prev => [...prev, { ...action.item, id: Date.now(), done:false, streak:0 }]);
        break;
      case "delete_habit":
        onHabitsChange(prev => prev.filter(h => !h.label?.toLowerCase().includes(action.label?.toLowerCase())));
        break;
      case "add_alarm":
        onAlarmsChange(prev => [...prev, { ...action.item, id: Date.now(), active:true }]);
        break;
      case "delete_alarm":
        onAlarmsChange(prev => prev.filter(a => !a.label?.toLowerCase().includes(action.label?.toLowerCase())));
        break;
      case "navigate":
        onTabChange(action.tab);
        setOpen(false);
        break;
    }
  };

  const quickTaps = [
    "What should I focus on right now?",
    "Add family dinner at 9:30 PM",
    "Show me my schedule",
    "Help me with a craving to smoke",
    "Add a new alarm for Fajr at 5:30 AM",
  ];

  return (
    <>
      {/* Floating button */}
      <button onClick={() => { setOpen(true); if (msgs.length === 0) setTimeout(() => send("Quick check-in — what's my priority for the rest of today?"), 300); }}
        style={{
          position:"fixed", bottom:76, right:18, width:52, height:52, borderRadius:"50%",
          background:"linear-gradient(135deg,#C8A97E,#A97EC8)", border:"none",
          cursor:"pointer", zIndex:150, boxShadow:"0 4px 24px rgba(200,169,126,0.4)",
          display:"flex", alignItems:"center", justifyContent:"center", fontSize:20,
          transform: pulse ? "scale(1.05)" : "scale(1)", transition:"transform 0.5s ease"
        }}>✦</button>

      {/* Chat panel */}
      {open && (
        <div style={{ position:"fixed", inset:0, zIndex:200, display:"flex", alignItems:"flex-end", justifyContent:"center", background:"rgba(4,4,8,0.85)", backdropFilter:"blur(10px)" }}
          onClick={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            width:"min(600px,100%)", background:"#0A0A14", borderRadius:"20px 20px 0 0",
            border:"1px solid #1E1E2E", maxHeight:"80vh", display:"flex", flexDirection:"column",
            boxShadow:"0 -30px 80px rgba(200,169,126,0.1)"
          }}>
            <div style={{ padding:"14px 18px 10px", borderBottom:"1px solid #111120", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ width:32, height:32, borderRadius:"50%", background:"linear-gradient(135deg,#C8A97E,#A97EC8)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>✦</div>
                <div>
                  <div style={{ fontFamily:"'Cinzel',serif", fontSize:14, color:"#C8A97E" }}>AXIS</div>
                  <div style={{ fontSize:10, color:"#444" }}>Controls everything in your app</div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} style={{ background:"none", border:"1px solid #1E1E2E", borderRadius:8, padding:"4px 10px", color:"#555", cursor:"pointer", fontSize:12 }}>✕</button>
            </div>

            <div ref={scrollRef} style={{ flex:1, overflowY:"auto", padding:"14px 16px", display:"flex", flexDirection:"column", gap:10, minHeight:200 }}>
              {msgs.length === 0 && (
                <div style={{ color:"#333", fontSize:13, textAlign:"center", padding:"20px 0" }}>Ask AXIS anything. It can control your entire app.</div>
              )}
              {msgs.map((m, i) => (
                <div key={i} style={{
                  alignSelf: m.role==="user" ? "flex-end" : "flex-start",
                  maxWidth:"88%", background: m.role==="user" ? "#1A1A2E" : "#111120",
                  border:`1px solid ${m.role==="user"?"#2A2A4A":"#1A1A28"}`,
                  borderRadius:12, padding:"10px 14px", fontSize:13, lineHeight:1.7,
                  color:"#C8C8D8", fontFamily: m.role==="assistant" ? "'Georgia',serif" : "inherit",
                  whiteSpace:"pre-line"
                }}>{m.content}</div>
              ))}
              {loading && <div style={{ display:"flex", gap:5 }}>{[0,1,2].map(i => <div key={i} style={{ width:7, height:7, borderRadius:"50%", background:"#C8A97E", animation:`pulse 1.2s ${i*0.2}s infinite` }} />)}</div>}
            </div>

            <div style={{ padding:"8px 12px", display:"flex", gap:6, overflowX:"auto", borderTop:"1px solid #0E0E18" }}>
              {quickTaps.map(q => (
                <button key={q} onClick={() => send(q)} style={{
                  background:"#111120", border:"1px solid #1E1E2E", borderRadius:20,
                  padding:"6px 12px", color:"#666", cursor:"pointer", fontSize:11, whiteSpace:"nowrap", flexShrink:0
                }}>{q}</button>
              ))}
            </div>

            <div style={{ padding:"10px 12px", borderTop:"1px solid #0E0E18", display:"flex", gap:8 }}>
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key==="Enter" && send(input)}
                placeholder="Tell AXIS what to do or ask anything..."
                style={{ flex:1, background:"#111120", border:"1px solid #1E1E2E", borderRadius:10, padding:"10px 14px", color:"#D0D0E0", fontSize:13, outline:"none", fontFamily:"inherit" }}
              />
              <button onClick={() => send(input)} style={{ background:"#C8A97E", border:"none", borderRadius:10, padding:"10px 16px", cursor:"pointer", color:"#0F0F16", fontWeight:700, fontSize:14 }}>→</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── SWIPEABLE ROW ─────────────────────────────────────────────────────────────
function SwipeRow({ children, onDelete, style: extraStyle }) {
  const [offset, setOffset] = useState(0);
  const startX = useRef(null);
  const threshold = 80;

  const onStart = (clientX) => { startX.current = clientX; };
  const onMove = (clientX) => {
    if (startX.current === null) return;
    const dx = clientX - startX.current;
    if (dx < 0) setOffset(Math.max(dx, -threshold - 20));
  };
  const onEnd = () => {
    if (offset < -threshold) { onDelete(); }
    else setOffset(0);
    startX.current = null;
  };

  return (
    <div style={{ position:"relative", overflow:"hidden", ...extraStyle }}>
      <div style={{
        position:"absolute", right:0, top:0, bottom:0, width:threshold,
        background:"#C87E7E22", display:"flex", alignItems:"center", justifyContent:"center",
        borderRadius:"0 12px 12px 0"
      }}>
        <span style={{ color:"#C87E7E", fontSize:18 }}>🗑</span>
      </div>
      <div
        style={{ transform:`translateX(${offset}px)`, transition: startX.current ? "none" : "transform 0.3s ease", background:"inherit" }}
        onMouseDown={e => onStart(e.clientX)}
        onMouseMove={e => onMove(e.clientX)}
        onMouseUp={onEnd}
        onMouseLeave={onEnd}
        onTouchStart={e => onStart(e.touches[0].clientX)}
        onTouchMove={e => onMove(e.touches[0].clientX)}
        onTouchEnd={onEnd}
      >
        {children}
      </div>
    </div>
  );
}

// ── TODAY TAB ─────────────────────────────────────────────────────────────────
function TodayTab({ profile, schedule, habits, onHabitsChange }) {
  const now = getNowMins();
  const current = schedule.find(s => { const m = toMins(s.time); return m <= now && now < m + 90; });
  const next = schedule.find(s => toMins(s.time) > now);
  const h = new Date().getHours();
  const greeting = h >= 19 || h < 4 ? "Good evening" : h < 12 ? "Good morning" : "Good afternoon";

  const done = habits.filter(h => h.done).length;

  const toggle = (id) => onHabitsChange(prev => prev.map(h => h.id === id ? { ...h, done: !h.done } : h));
  const deleteH = (id) => onHabitsChange(prev => prev.filter(h => h.id !== id));

  return (
    <div>
      <div style={{ marginBottom:16, padding:"0 2px" }}>
        <div style={{ fontSize:20, fontWeight:600, color:"#fff" }}>{greeting}, {profile.name} 👋</div>
        <div style={{ fontSize:13, color:"#555", marginTop:3 }}>{done}/{habits.length} habits done today</div>
      </div>

      {/* Now / Next */}
      <div style={{ background:"linear-gradient(135deg,#12101E,#0D1612)", border:"1px solid #2A2A3A", borderRadius:16, padding:"18px 20px", marginBottom:14 }}>
        <div style={{ fontSize:10, color:"#555", letterSpacing:2, marginBottom:8 }}>RIGHT NOW</div>
        <div style={{ fontSize:15, color:"#fff", fontWeight:600, marginBottom:12 }}>
          {current ? `${current.icon} ${current.label}` : "Between tasks — be present."}
        </div>
        {next && <>
          <div style={{ fontSize:10, color:"#555", letterSpacing:2, marginBottom:6 }}>UP NEXT</div>
          <div style={{ fontSize:14, color: TAG_C[next.tag] || "#C8A97E" }}>{next.icon} {fmt12(next.time)} — {next.label}</div>
        </>}
      </div>

      {/* Today's habits */}
      <div style={{ fontSize:11, color:"#444", letterSpacing:2, marginBottom:10 }}>TODAY'S HABITS</div>
      <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
        {habits.slice(0,8).map(habit => (
          <SwipeRow key={habit.id} onDelete={() => deleteH(habit.id)}
            style={{ borderRadius:12, background: habit.done ? `${TAG_C[habit.tag]}0A` : "#0C0C14", border:`1px solid ${habit.done ? `${TAG_C[habit.tag]}33` : "#1A1A28"}` }}>
            <div style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", cursor:"pointer" }}
              onClick={() => toggle(habit.id)}>
              <div style={{
                width:24, height:24, borderRadius:"50%", flexShrink:0,
                border:`2px solid ${habit.done ? TAG_C[habit.tag] : "#2A2A3A"}`,
                background: habit.done ? TAG_C[habit.tag] : "transparent",
                display:"flex", alignItems:"center", justifyContent:"center",
                color:"#0F0F16", fontSize:11, fontWeight:700
              }}>{habit.done ? "✓" : ""}</div>
              <span style={{ fontSize:18 }}>{habit.icon}</span>
              <span style={{ fontSize:14, color: habit.done ? "#555" : "#D0D0E0", textDecoration: habit.done ? "line-through" : "none", flex:1 }}>{habit.label}</span>
              <span style={{ fontSize:10, color:"#333" }}>← swipe to delete</span>
            </div>
          </SwipeRow>
        ))}
        {habits.length === 0 && <div style={{ fontSize:13, color:"#333", padding:"20px 0", textAlign:"center" }}>Ask AXIS to add habits for you</div>}
      </div>
    </div>
  );
}

// ── SCHEDULE TAB ──────────────────────────────────────────────────────────────
function ScheduleTab({ schedule, onScheduleChange }) {
  const now = getNowMins();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ time:"12:00", label:"", tag:"health", icon:"⭐" });

  const del = (id) => onScheduleChange(prev => prev.filter(s => s.id !== id));
  const add = () => {
    if (!form.label.trim()) return;
    onScheduleChange(prev => [...prev, { ...form, id:Date.now() }].sort((a,b) => toMins(a.time)-toMins(b.time)));
    setAdding(false);
    setForm({ time:"12:00", label:"", tag:"health", icon:"⭐" });
  };

  const icons = ["⭐","🏋️","🕌","🍽","💻","🚿","😴","💊","📖","🔧","🍎","🏃","🧘","👨‍👩‍👧","🌙","☀️","💧","📿"];

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <div style={{ fontSize:11, color:"#444", letterSpacing:2 }}>DAILY SCHEDULE</div>
        <button onClick={() => setAdding(p => !p)} style={{ background:"transparent", border:"1px solid #C8A97E", borderRadius:8, padding:"5px 12px", color:"#C8A97E", cursor:"pointer", fontSize:12 }}>+ Add</button>
      </div>

      {adding && (
        <div style={{ background:"#0C0C14", border:"1px solid #2A2A3A", borderRadius:14, padding:"16px", marginBottom:14 }}>
          <div style={{ display:"flex", gap:10, marginBottom:10 }}>
            <input type="time" value={form.time} onChange={e => setForm(p=>({...p,time:e.target.value}))}
              style={{ background:"#13131E", border:"1px solid #2A2A3A", borderRadius:10, padding:"9px 12px", color:"#D0D0E0", fontSize:14, outline:"none", width:110 }} />
            <input value={form.label} onChange={e => setForm(p=>({...p,label:e.target.value}))} placeholder="Task name..."
              style={{ flex:1, background:"#13131E", border:"1px solid #2A2A3A", borderRadius:10, padding:"9px 12px", color:"#D0D0E0", fontSize:13, outline:"none" }} />
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10 }}>
            {icons.map(ic => <button key={ic} onClick={() => setForm(p=>({...p,icon:ic}))}
              style={{ background: form.icon===ic?"#C8A97E22":"transparent", border:`1px solid ${form.icon===ic?"#C8A97E":"#2A2A3A"}`, borderRadius:8, padding:"5px 9px", cursor:"pointer", fontSize:16 }}>{ic}</button>)}
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:12 }}>
            {Object.entries(TAG_C).map(([k,c]) => <button key={k} onClick={() => setForm(p=>({...p,tag:k}))}
              style={{ background: form.tag===k?`${c}22`:"transparent", border:`1px solid ${form.tag===k?c:"#2A2A3A"}`, borderRadius:8, padding:"5px 10px", color: form.tag===k?c:"#555", cursor:"pointer", fontSize:11 }}>{k}</button>)}
          </div>
          <button onClick={add} style={{ width:"100%", background:"#C8A97E", border:"none", borderRadius:10, padding:11, color:"#0F0F16", fontWeight:700, cursor:"pointer" }}>Add to Schedule</button>
        </div>
      )}

      <div style={{ display:"flex", flexDirection:"column" }}>
        {schedule.map((item, i) => {
          const m = toMins(item.time);
          const isNow = m <= now && now < m + 90;
          const isPast = m + 90 < now;
          return (
            <SwipeRow key={item.id || i} onDelete={() => del(item.id)}
              style={{ background:"transparent" }}>
              <div style={{ display:"flex", gap:0 }}>
                <div style={{ width:44, display:"flex", flexDirection:"column", alignItems:"center", flexShrink:0 }}>
                  <div style={{ width:9, height:9, borderRadius:"50%", marginTop:18, background: isNow?"#C8A97E":isPast?"#1E1E2E":TAG_C[item.tag]||"#555", boxShadow: isNow?"0 0 12px #C8A97E88":"none", zIndex:1 }} />
                  {i < schedule.length-1 && <div style={{ width:1, flex:1, background:"#141420", marginTop:2 }} />}
                </div>
                <div style={{ flex:1, padding:"10px 6px 10px 4px", opacity: isPast?0.3:1, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div>
                    <div style={{ display:"flex", gap:8, alignItems:"baseline" }}>
                      <span style={{ fontSize:10, color:"#444", width:50, flexShrink:0 }}>{fmt12(item.time)}</span>
                      <span style={{ fontSize:13, color: isNow?"#fff":"#B0B0C0", fontWeight: isNow?600:400 }}>{item.icon} {item.label}</span>
                    </div>
                  </div>
                  <span style={{ fontSize:9, color:"#222", flexShrink:0 }}>← swipe</span>
                </div>
              </div>
            </SwipeRow>
          );
        })}
      </div>
    </div>
  );
}

// ── HABITS TAB ────────────────────────────────────────────────────────────────
function HabitsTab({ habits, onHabitsChange }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ label:"", tag:"health", icon:"⭐", xp:15 });

  const toggle = (id) => onHabitsChange(prev => prev.map(h => h.id===id ? {...h, done:!h.done, streak: h.done?Math.max(0,h.streak-1):h.streak+1} : h));
  const del = (id) => onHabitsChange(prev => prev.filter(h => h.id!==id));
  const add = () => {
    if (!form.label.trim()) return;
    onHabitsChange(prev => [...prev, { ...form, id:Date.now(), done:false, streak:0 }]);
    setAdding(false);
    setForm({ label:"", tag:"health", icon:"⭐", xp:15 });
  };

  const icons = ["⭐","🏋️","🕌","🍽","💻","🚿","😴","💊","📖","🔧","🍎","🏃","🧘","💧","📿","⊘","✦","💰"];
  const byTag = Object.keys(TAG_C).map(tag => ({ tag, items: habits.filter(h => h.tag===tag) })).filter(g => g.items.length > 0);

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
        <div>
          <div style={{ fontSize:11, color:"#444", letterSpacing:2 }}>HABIT TRACKER</div>
          <div style={{ fontSize:13, color:"#7EC8A9", marginTop:2 }}>{habits.filter(h=>h.done).length}/{habits.length} done today</div>
        </div>
        <button onClick={() => setAdding(p=>!p)} style={{ background:"transparent", border:"1px solid #7EC8A9", borderRadius:8, padding:"5px 12px", color:"#7EC8A9", cursor:"pointer", fontSize:12 }}>+ Add</button>
      </div>

      {adding && (
        <div style={{ background:"#0C0C14", border:"1px solid #2A2A3A", borderRadius:14, padding:"16px", marginBottom:14 }}>
          <input value={form.label} onChange={e => setForm(p=>({...p,label:e.target.value}))} placeholder="Habit name..."
            style={{ width:"100%", background:"#13131E", border:"1px solid #2A2A3A", borderRadius:10, padding:"10px 12px", color:"#D0D0E0", fontSize:14, outline:"none", marginBottom:10 }} />
          <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10 }}>
            {icons.map(ic => <button key={ic} onClick={() => setForm(p=>({...p,icon:ic}))}
              style={{ background: form.icon===ic?"#C8A97E22":"transparent", border:`1px solid ${form.icon===ic?"#C8A97E":"#2A2A3A"}`, borderRadius:8, padding:"5px 9px", cursor:"pointer", fontSize:16 }}>{ic}</button>)}
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:12 }}>
            {Object.entries(TAG_C).map(([k,c]) => <button key={k} onClick={() => setForm(p=>({...p,tag:k}))}
              style={{ background: form.tag===k?`${c}22`:"transparent", border:`1px solid ${form.tag===k?c:"#2A2A3A"}`, borderRadius:8, padding:"5px 10px", color: form.tag===k?c:"#555", cursor:"pointer", fontSize:11 }}>{k}</button>)}
          </div>
          <button onClick={add} style={{ width:"100%", background:"#7EC8A9", border:"none", borderRadius:10, padding:11, color:"#0F0F16", fontWeight:700, cursor:"pointer" }}>Add Habit</button>
        </div>
      )}

      {byTag.map(group => (
        <div key={group.tag} style={{ marginBottom:16 }}>
          <div style={{ fontSize:10, color:TAG_C[group.tag]||"#555", letterSpacing:1.5, marginBottom:8 }}>{group.tag.toUpperCase()}</div>
          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {group.items.map(habit => (
              <SwipeRow key={habit.id} onDelete={() => del(habit.id)}
                style={{ borderRadius:12, background: habit.done?`${TAG_C[habit.tag]}0A`:"#0C0C14", border:`1px solid ${habit.done?`${TAG_C[habit.tag]}33`:"#1A1A28"}` }}>
                <div style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", cursor:"pointer" }} onClick={() => toggle(habit.id)}>
                  <div style={{
                    width:24, height:24, borderRadius:"50%", flexShrink:0,
                    border:`2px solid ${habit.done?TAG_C[habit.tag]:"#2A2A3A"}`,
                    background: habit.done?TAG_C[habit.tag]:"transparent",
                    display:"flex", alignItems:"center", justifyContent:"center",
                    color:"#0F0F16", fontSize:11, fontWeight:700
                  }}>{habit.done?"✓":""}</div>
                  <span style={{ fontSize:18 }}>{habit.icon}</span>
                  <span style={{ flex:1, fontSize:14, color: habit.done?"#555":"#D0D0E0", textDecoration: habit.done?"line-through":"none" }}>{habit.label}</span>
                  {habit.streak > 0 && <span style={{ fontSize:10, color:"#C8A97E" }}>🔥{habit.streak}</span>}
                </div>
              </SwipeRow>
            ))}
          </div>
        </div>
      ))}
      {habits.length === 0 && <div style={{ textAlign:"center", color:"#333", padding:"40px 0", fontSize:13 }}>No habits yet. Ask AXIS to add some, or tap + above.</div>}
    </div>
  );
}

// ── BABY TAB ─────────────────────────────────────────────────────────────────
function BabyTab() {
  const [view, setView] = useState("names");
  const [gender, setGender] = useState("boy");
  const [saved, setSaved] = useState(() => load("baby_names", []));
  const [custom, setCustom] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [checked, setChecked] = useState(() => load("baby_checks", {}));

  useEffect(() => { save("baby_names", saved); }, [saved]);
  useEffect(() => { save("baby_checks", checked); }, [checked]);

  const boyNames = ["Adam","Ibrahim","Yusuf","Omar","Ali","Hassan","Hussain","Zaid","Khalid","Tariq","Bilal","Hamza","Anas","Nuh","Ismail","Idris","Dawud","Sulaiman","Musa","Isa","Rayyan","Jibreel","Mikail","Luqman","Zakariya"];
  const girlNames = ["Aisha","Fatima","Maryam","Khadijah","Zainab","Hafsa","Ruqayyah","Layla","Noor","Amina","Sara","Hana","Lina","Rania","Yasmin","Dina","Sana","Aya","Reem","Lujain","Asiya","Safiyya","Jannah","Nada","Huda"];
  const names = gender==="boy" ? boyNames : girlNames;

  const checklist = [
    { cat:"7th Month Urgent", items:["Book next prenatal checkup","Pack hospital bag","Finalize birth plan","Take iron + folate supplements","Do pelvic floor exercises","Tour the hospital","Set up emergency contacts","Research pediatricians"] },
    { cat:"Nursery", items:["Crib / Bassinet","Crib mattress + cover","Changing table","Baby monitor","White noise machine","Blackout curtains","Nightlight"] },
    { cat:"Feeding", items:["Nursing pillow","Breast pump","Bottles + sterilizer","Burp cloths ×8","Formula (backup)","Nursing bras ×3"] },
    { cat:"Clothing 0-3m", items:["Onesies ×10","Sleepsuits ×6","Socks ×8","Hats ×3","Mittens ×3","Swaddle blankets ×4"] },
    { cat:"Bath & Care", items:["Baby bathtub","Baby wash & shampoo","Baby lotion","Nail clippers","Thermometer","Nasal aspirator","Diaper cream"] },
    { cat:"Diapers", items:["Newborn diapers ×80","Size 1 diapers ×150","Baby wipes ×400","Diaper bag","Travel changing mat"] },
    { cat:"Travel & Safety", items:["Infant car seat (installed)","Stroller","Baby carrier","Baby-proof home","Smoke detector checked"] },
  ];

  const total = checklist.reduce((s,c) => s+c.items.length, 0);
  const done = Object.values(checked).filter(Boolean).length;

  const getAINames = async () => {
    setAiLoading(true);
    const r = await claude("Return only a clean list, no intro text.",
      [{ role:"user", content:`Give 8 beautiful ${gender} names. Mix classic Islamic with elegant modern Arabic/Islamic names. Format: Name — meaning (one phrase). One per line.` }]);
    setAiSuggestions(r);
    setAiLoading(false);
  };

  return (
    <div>
      <div style={{ background:"linear-gradient(135deg,#150D20,#0D1520)", border:"1px solid #2A1A3A", borderRadius:16, padding:"16px 20px", marginBottom:16 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontFamily:"'Cinzel',serif", fontSize:15, color:"#C8A97E" }}>7th Month ✦</div>
            <div style={{ fontSize:12, color:"#7EA9C8", marginTop:2 }}>~8–10 weeks to arrival</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:22, fontWeight:700, color:"#fff" }}>{done}<span style={{ fontSize:13, color:"#444" }}>/{total}</span></div>
            <div style={{ fontSize:10, color:"#555" }}>items ready</div>
          </div>
        </div>
        <div style={{ height:3, background:"#1A1A2A", borderRadius:2, marginTop:12 }}>
          <div style={{ height:"100%", width:`${(done/total)*100}%`, background:"linear-gradient(90deg,#C8A97E,#A97EC8)", borderRadius:2, transition:"width 0.5s" }} />
        </div>
      </div>

      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        {["names","checklist"].map(v => (
          <button key={v} onClick={() => setView(v)} style={{ flex:1, padding:"10px", background: view===v?"#C8A97E22":"transparent", border:`1px solid ${view===v?"#C8A97E":"#1E1E2E"}`, borderRadius:10, color: view===v?"#C8A97E":"#555", cursor:"pointer", fontSize:13 }}>
            {v==="names"?"✦ Names":"☑ Checklist"}
          </button>
        ))}
      </div>

      {view==="names" && (
        <>
          <div style={{ display:"flex", gap:8, marginBottom:14 }}>
            {["boy","girl"].map(g => <button key={g} onClick={() => setGender(g)} style={{ flex:1, padding:"8px", background: gender===g?(g==="boy"?"#7EA9C822":"#C87E7E22"):"transparent", border:`1px solid ${gender===g?(g==="boy"?"#7EA9C8":"#C87E7E"):"#1E1E2E"}`, borderRadius:10, color: gender===g?(g==="boy"?"#7EA9C8":"#C87E7E"):"#555", cursor:"pointer", fontSize:13 }}>{g==="boy"?"♂ Boy":"♀ Girl"}</button>)}
          </div>
          <div style={{ display:"flex", gap:8, marginBottom:14 }}>
            <input value={custom} onChange={e => setCustom(e.target.value)} placeholder="Your own name idea..."
              style={{ flex:1, background:"#0C0C14", border:"1px solid #1E1E2E", borderRadius:10, padding:"9px 12px", color:"#D0D0E0", fontSize:13, outline:"none" }} />
            <button onClick={() => { if(custom.trim()){setSaved(p=>[...p,custom.trim()]);setCustom("");} }} style={{ background:"#C8A97E", border:"none", borderRadius:10, padding:"9px 16px", cursor:"pointer", color:"#0F0F16", fontWeight:700 }}>+</button>
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginBottom:14 }}>
            {names.map(name => { const isSaved=saved.includes(name); return (
              <button key={name} onClick={() => setSaved(p=>isSaved?p.filter(n=>n!==name):[...p,name])} style={{ background:isSaved?"#C8A97E22":"#0C0C14", border:`1px solid ${isSaved?"#C8A97E":"#1E1E2E"}`, borderRadius:10, padding:"7px 13px", color:isSaved?"#C8A97E":"#888", cursor:"pointer", fontSize:13 }}>{name}{isSaved?" ♥":""}</button>);
            })}
          </div>
          <button onClick={getAINames} style={{ width:"100%", background:"transparent", border:"1px solid #A97EC8", borderRadius:12, padding:11, color:"#A97EC8", cursor:"pointer", fontSize:13, marginBottom:12 }}>
            {aiLoading?"Finding names...":"✦ AI Name Suggestions with Meanings"}
          </button>
          {aiSuggestions && <div style={{ background:"#0C0C14", border:"1px solid #1A1A28", borderRadius:12, padding:"14px 16px", fontSize:13, color:"#B0B0C0", lineHeight:1.9, whiteSpace:"pre-line" }}>{aiSuggestions}</div>}
          {saved.length > 0 && (
            <div style={{ marginTop:14, background:"#0C1A0C", border:"1px solid #1A2A1A", borderRadius:12, padding:"14px 16px" }}>
              <div style={{ fontSize:10, color:"#7EC8A9", letterSpacing:1.5, marginBottom:10 }}>SHORTLISTED ♥</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                {saved.map(n => <span key={n} onClick={() => setSaved(p=>p.filter(x=>x!==n))} style={{ background:"#7EC8A922", border:"1px solid #7EC8A966", borderRadius:8, padding:"6px 12px", fontSize:13, color:"#7EC8A9", cursor:"pointer" }}>{n} ✕</span>)}
              </div>
            </div>
          )}
        </>
      )}

      {view==="checklist" && (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {checklist.map(section => {
            const secDone = section.items.filter(item => checked[`${section.cat}:${item}`]).length;
            return (
              <div key={section.cat} style={{ background:"#0C0C14", border:"1px solid #1A1A28", borderRadius:14, overflow:"hidden" }}>
                <div style={{ padding:"11px 16px", display:"flex", justifyContent:"space-between", borderBottom:"1px solid #141420" }}>
                  <span style={{ fontSize:13, fontWeight:600, color:"#C8A97E" }}>{section.cat}</span>
                  <span style={{ fontSize:11, color: secDone===section.items.length?"#7EC8A9":"#444" }}>{secDone}/{section.items.length}</span>
                </div>
                {section.items.map(item => { const key=`${section.cat}:${item}`; const isDone=checked[key]; return (
                  <div key={item} onClick={() => setChecked(p=>({...p,[key]:!p[key]}))} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 16px", cursor:"pointer", borderBottom:"1px solid #0E0E18" }}>
                    <div style={{ width:17, height:17, borderRadius:5, flexShrink:0, border:`1.5px solid ${isDone?"#7EC8A9":"#2A2A3A"}`, background:isDone?"#7EC8A920":"transparent", display:"flex", alignItems:"center", justifyContent:"center", color:"#7EC8A9", fontSize:10 }}>{isDone?"✓":""}</div>
                    <span style={{ fontSize:13, color:isDone?"#444":"#B0B0C0", textDecoration:isDone?"line-through":"none" }}>{item}</span>
                  </div>);
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── IDEAS TAB ─────────────────────────────────────────────────────────────────
function IdeasTab() {
  const [ideas, setIdeas] = useState(() => load("ideas_v2", []));
  const [input, setInput] = useState("");
  const [active, setActive] = useState(null);
  const [chat, setChat] = useState([]);
  const [chatIn, setChatIn] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { save("ideas_v2", ideas); }, [ideas]);

  const addIdea = () => {
    if (!input.trim()) return;
    setIdeas(p => [{ id:Date.now(), text:input.trim(), created:new Date().toLocaleDateString(), status:"seed" }, ...p]);
    setInput("");
  };

  const openIdea = async (idea) => {
    setActive(idea); setLoading(true);
    const r = await claude("You are AXIS, a sharp strategic mentor. Be direct, concise, practical. Under 180 words.", [{ role:"user", content:`My rough idea: "${idea.text}"\n\n1) What this actually is in ONE sentence\n2) The 3 most important first steps (numbered)\n3) The one thing that will kill this idea if ignored` }]);
    setChat([{ role:"assistant", content:r }]);
    setLoading(false);
  };

  const sendChat = async () => {
    if (!chatIn.trim()) return;
    const uMsg = { role:"user", content:chatIn };
    const newChat = [...chat, uMsg];
    setChat(newChat); setChatIn(""); setLoading(true);
    const r = await claude(`You are AXIS developing the idea: "${active?.text}". Be concise, actionable. Under 120 words.`, newChat);
    setChat([...newChat, { role:"assistant", content:r }]);
    setLoading(false);
  };

  const statusC = { seed:"#C8A97E", growing:"#7EA9C8", active:"#7EC8A9", done:"#A97EC8" };

  return (
    <div>
      {!active ? (
        <>
          <div style={{ background:"#0C0C14", border:"1px solid #1A1A28", borderRadius:14, padding:"16px", marginBottom:14 }}>
            <div style={{ fontSize:10, color:"#555", letterSpacing:2, marginBottom:10 }}>PLANT AN IDEA</div>
            <textarea value={input} onChange={e => setInput(e.target.value)} placeholder="Dump any rough idea... a business, habit, project, thing you want to fix or build. Don't filter it."
              style={{ width:"100%", background:"#13131E", border:"1px solid #2A2A3A", borderRadius:10, padding:"11px", color:"#D0D0E0", fontSize:14, outline:"none", resize:"none", minHeight:80, fontFamily:"inherit", lineHeight:1.6 }} />
            <button onClick={addIdea} style={{ marginTop:10, width:"100%", background:"#C8A97E", border:"none", borderRadius:10, padding:11, color:"#0F0F16", fontWeight:700, cursor:"pointer" }}>Plant This Idea →</button>
          </div>
          {ideas.map(idea => (
            <SwipeRow key={idea.id} onDelete={() => setIdeas(p=>p.filter(x=>x.id!==idea.id))}
              style={{ background:"#0C0C14", border:"1px solid #1A1A28", borderRadius:14, marginBottom:8 }}>
              <div onClick={() => openIdea(idea)} style={{ padding:"14px 16px", cursor:"pointer" }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                  <span style={{ fontSize:10, color:statusC[idea.status] }}>{idea.status.toUpperCase()}</span>
                  <span style={{ fontSize:10, color:"#333" }}>{idea.created}</span>
                </div>
                <div style={{ fontSize:14, color:"#D0D0E0", lineHeight:1.5 }}>{idea.text}</div>
                <div style={{ fontSize:11, color:"#444", marginTop:8 }}>Tap to develop with AXIS →</div>
              </div>
            </SwipeRow>
          ))}
          {ideas.length === 0 && <div style={{ textAlign:"center", color:"#333", padding:"40px 0", fontSize:13 }}>No ideas yet. Drop your first rough thought above.</div>}
        </>
      ) : (
        <>
          <button onClick={() => { setActive(null); setChat([]); }} style={{ background:"transparent", border:"1px solid #1E1E2E", borderRadius:8, padding:"6px 12px", color:"#555", cursor:"pointer", fontSize:12, marginBottom:12 }}>← Ideas</button>
          <div style={{ background:"#0C0C14", border:"1px solid #C8A97E33", borderRadius:12, padding:"13px 16px", marginBottom:12 }}>
            <div style={{ fontSize:10, color:"#C8A97E", marginBottom:5 }}>YOUR IDEA</div>
            <div style={{ fontSize:14, color:"#D0D0E0", lineHeight:1.6 }}>{active.text}</div>
          </div>
          <div style={{ background:"#0C0C14", border:"1px solid #1A1A28", borderRadius:12, padding:"14px", marginBottom:12, minHeight:180 }}>
            {loading && chat.length===0 ? <div style={{ display:"flex", gap:5 }}>{[0,1,2].map(i=><div key={i} style={{ width:7,height:7,borderRadius:"50%",background:"#C8A97E",animation:`pulse 1.2s ${i*.2}s infinite` }}/>)}</div>
            : chat.map((m,i) => <div key={i} style={{ alignSelf:m.role==="user"?"flex-end":"flex-start", marginBottom:10, maxWidth:"90%", background:m.role==="user"?"#1A1A2E":"#111120", border:`1px solid ${m.role==="user"?"#2A2A4A":"#1A1A28"}`, borderRadius:12, padding:"10px 13px", fontSize:13, color:"#C8C8D8", lineHeight:1.7, whiteSpace:"pre-line", fontFamily:m.role==="assistant"?"'Georgia',serif":"inherit" }}>{m.content}</div>)}
            {loading && chat.length>0 && <div style={{ display:"flex", gap:5 }}>{[0,1,2].map(i=><div key={i} style={{ width:6,height:6,borderRadius:"50%",background:"#C8A97E",animation:`pulse 1.2s ${i*.2}s infinite` }}/>)}</div>}
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <input value={chatIn} onChange={e=>setChatIn(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendChat()} placeholder="Keep developing this idea..."
              style={{ flex:1, background:"#0C0C14", border:"1px solid #1E1E2E", borderRadius:10, padding:"10px 13px", color:"#D0D0E0", fontSize:13, outline:"none" }} />
            <button onClick={sendChat} style={{ background:"#C8A97E", border:"none", borderRadius:10, padding:"10px 16px", cursor:"pointer", color:"#0F0F16", fontWeight:700 }}>→</button>
          </div>
        </>
      )}
    </div>
  );
}

// ── QUIT TAB ──────────────────────────────────────────────────────────────────
function QuitTab() {
  const [quitDate, setQuitDate] = useState(() => localStorage.getItem("quit_date") || "");
  const [perDay] = useState(15);
  const [craving, setCraving] = useState(false);
  const [cravingTip, setCravingTip] = useState("");
  const [loading, setLoading] = useState(false);

  const days = quitDate ? Math.max(0, Math.floor((new Date()-new Date(quitDate))/(1000*60*60*24))) : 0;
  const cigsSaved = days * perDay;
  const moneySaved = ((cigsSaved/20)*5).toFixed(2);

  const handleCraving = async () => {
    setCraving(true); setLoading(true);
    const r = await claude("You are a no-nonsense quit-smoking coach. Two sentences max. Make it visceral, real, motivating.",
      [{ role:"user", content:"Craving right now. Help me get through the next 5 minutes without smoking." }]);
    setCravingTip(r); setLoading(false);
  };

  const milestones = [
    {days:1,label:"24 Hours",desc:"Carbon monoxide gone. Heart attack risk falling.",icon:"❤️"},
    {days:3,label:"3 Days",desc:"Nicotine leaves your body entirely.",icon:"🫁"},
    {days:7,label:"1 Week",desc:"Nerve endings start regrowing.",icon:"⚡"},
    {days:14,label:"2 Weeks",desc:"Circulation improves. More energy.",icon:"🔋"},
    {days:30,label:"1 Month",desc:"Coughing and congestion clear.",icon:"✨"},
    {days:90,label:"3 Months",desc:"Lung function up 30%.",icon:"🌿"},
    {days:365,label:"1 Year",desc:"Heart disease risk cut in half.",icon:"🏆"},
  ];

  return (
    <div>
      {!quitDate ? (
        <div style={{ background:"#0C0C14", border:"1px solid #2A1A1A", borderRadius:16, padding:"22px" }}>
          <div style={{ fontFamily:"'Cinzel',serif", fontSize:16, color:"#C87E7E", marginBottom:8 }}>Set Your Quit Date</div>
          <div style={{ fontSize:13, color:"#666", lineHeight:1.7, marginBottom:18 }}>Your baby is coming. Your wife needs you healthy. Your lungs will thank you in 90 days.</div>
          <input type="date" value={quitDate} onChange={e => { setQuitDate(e.target.value); localStorage.setItem("quit_date",e.target.value); }}
            style={{ width:"100%", background:"#13131E", border:"1px solid #2A2A3A", borderRadius:10, padding:"11px 14px", color:"#D0D0E0", fontSize:14, outline:"none", marginBottom:14, boxSizing:"border-box" }} />
          <button onClick={() => { const t=new Date().toISOString().split("T")[0]; setQuitDate(t); localStorage.setItem("quit_date",t); }}
            style={{ width:"100%", background:"#C87E7E", border:"none", borderRadius:12, padding:14, color:"#0F0F16", fontWeight:700, cursor:"pointer", fontSize:15 }}>⊘ I Quit Today</button>
        </div>
      ) : (
        <>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>
            {[{l:"Days Free",v:days,c:"#C87E7E"},{l:"$ Saved",v:`$${moneySaved}`,c:"#7EC8A9"},{l:"Cigs Avoided",v:cigsSaved,c:"#7EA9C8"},{l:"Hours Reclaimed",v:Math.round(cigsSaved*11/60),c:"#A97EC8"}].map(s => (
              <div key={s.l} style={{ background:"#0C0C14", border:`1px solid ${s.c}22`, borderRadius:13, padding:"14px" }}>
                <div style={{ fontSize:10, color:"#555", marginBottom:5 }}>{s.l.toUpperCase()}</div>
                <div style={{ fontSize:22, fontWeight:700, color:s.c }}>{s.v}</div>
              </div>
            ))}
          </div>
          <button onClick={handleCraving} style={{ width:"100%", background:craving?"#140808":"transparent", border:"2px solid #C87E7E", borderRadius:14, padding:15, cursor:"pointer", marginBottom:12 }}>
            <div style={{ fontSize:15, fontWeight:700, color:"#C87E7E" }}>⊘ CRAVING RIGHT NOW</div>
            <div style={{ fontSize:11, color:"#666", marginTop:3 }}>Tap for instant help</div>
          </button>
          {craving && (
            <div style={{ background:"#140808", border:"1px solid #C87E7E33", borderRadius:12, padding:"14px 16px", marginBottom:12 }}>
              {loading ? <div style={{ display:"flex", gap:5 }}>{[0,1,2].map(i=><div key={i} style={{ width:7,height:7,borderRadius:"50%",background:"#C87E7E",animation:`pulse 1.2s ${i*.2}s infinite` }}/>)}</div>
              : <div style={{ fontSize:14, color:"#D0C0C0", lineHeight:1.7, fontStyle:"italic", fontFamily:"'Georgia',serif" }}>{cravingTip}</div>}
            </div>
          )}
          <div style={{ background:"#0C0C14", border:"1px solid #1A1A28", borderRadius:14, padding:"14px 16px" }}>
            <div style={{ fontSize:10, color:"#555", letterSpacing:2, marginBottom:12 }}>MILESTONES</div>
            {milestones.map(m => {
              const reached = days >= m.days;
              return <div key={m.days} style={{ display:"flex", gap:10, alignItems:"center", padding:"8px 0", borderBottom:"1px solid #0E0E18", opacity:reached?1:0.35 }}>
                <span style={{ fontSize:17 }}>{reached?m.icon:"○"}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, color:reached?"#fff":"#555", fontWeight:reached?600:400 }}>{m.label}</div>
                  <div style={{ fontSize:11, color:"#555" }}>{m.desc}</div>
                </div>
                {reached && <span style={{ fontSize:11, color:"#7EC8A9" }}>✓</span>}
              </div>;
            })}
          </div>
          <button onClick={() => { setQuitDate(""); localStorage.removeItem("quit_date"); }} style={{ marginTop:10, width:"100%", background:"transparent", border:"1px solid #1A1A28", borderRadius:10, padding:9, color:"#333", cursor:"pointer", fontSize:11 }}>Reset tracker</button>
        </>
      )}
    </div>
  );
}

// ── ALARMS TAB ────────────────────────────────────────────────────────────────
function AlarmsTab({ alarms, onAlarmsChange }) {
  const [form, setForm] = useState({ time:"10:00", label:"", repeat:"daily" });
  const [permGranted, setPermGranted] = useState(false);
  const timerRef = useRef();

  useEffect(() => { if ("Notification" in window && Notification.permission==="granted") setPermGranted(true); }, []);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      const d = new Date();
      const nowStr = `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
      alarms.filter(a => a.active && a.time===nowStr).forEach(a => {
        if (permGranted) new Notification("⏰ LIFE OS", { body: a.label || "Reminder" });
      });
    }, 10000);
    return () => clearInterval(timerRef.current);
  }, [alarms, permGranted]);

  const add = () => {
    if (!form.label.trim()) return;
    onAlarmsChange(p => [...p, { ...form, id:Date.now(), active:true }]);
    setForm({ time:"10:00", label:"", repeat:"daily" });
  };
  const toggle = (id) => onAlarmsChange(p => p.map(a => a.id===id?{...a,active:!a.active}:a));
  const del = (id) => onAlarmsChange(p => p.filter(a => a.id!==id));

  return (
    <div>
      {!permGranted && (
        <div style={{ background:"#14100A", border:"1px solid #C8A97E44", borderRadius:12, padding:"13px 16px", marginBottom:14 }}>
          <div style={{ fontSize:13, color:"#C8A97E", marginBottom:8 }}>Enable notifications to receive alarms</div>
          <button onClick={async () => { const p=await Notification.requestPermission(); setPermGranted(p==="granted"); }} style={{ background:"#C8A97E", border:"none", borderRadius:8, padding:"7px 14px", color:"#0F0F16", fontWeight:700, cursor:"pointer", fontSize:13 }}>Enable</button>
        </div>
      )}
      <div style={{ background:"#0C0C14", border:"1px solid #1A1A28", borderRadius:14, padding:"16px", marginBottom:14 }}>
        <div style={{ fontSize:10, color:"#555", letterSpacing:2, marginBottom:12 }}>NEW ALARM</div>
        <div style={{ display:"flex", gap:10, marginBottom:10 }}>
          <input type="time" value={form.time} onChange={e => setForm(p=>({...p,time:e.target.value}))}
            style={{ background:"#13131E", border:"1px solid #2A2A3A", borderRadius:10, padding:"9px 12px", color:"#D0D0E0", fontSize:14, outline:"none", width:100 }} />
          <input value={form.label} onChange={e => setForm(p=>({...p,label:e.target.value}))} placeholder="Alarm label..."
            style={{ flex:1, background:"#13131E", border:"1px solid #2A2A3A", borderRadius:10, padding:"9px 12px", color:"#D0D0E0", fontSize:13, outline:"none" }} />
        </div>
        <div style={{ display:"flex", gap:8, marginBottom:12 }}>
          {["once","daily","weekdays"].map(r => <button key={r} onClick={() => setForm(p=>({...p,repeat:r}))} style={{ flex:1, background:form.repeat===r?"#7EA9C822":"transparent", border:`1px solid ${form.repeat===r?"#7EA9C8":"#2A2A3A"}`, borderRadius:8, padding:"7px", color:form.repeat===r?"#7EA9C8":"#555", cursor:"pointer", fontSize:11, textTransform:"capitalize" }}>{r}</button>)}
        </div>
        <button onClick={add} style={{ width:"100%", background:"#7EA9C8", border:"none", borderRadius:10, padding:11, color:"#0F0F16", fontWeight:700, cursor:"pointer" }}>Set Alarm</button>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {alarms.sort((a,b)=>a.time.localeCompare(b.time)).map(alarm => (
          <SwipeRow key={alarm.id} onDelete={() => del(alarm.id)}
            style={{ background: alarm.active?"#0C0C14":"#090910", border:`1px solid ${alarm.active?"#1E2A1E":"#111118"}`, borderRadius:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px" }}>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:15, fontWeight:600, color:alarm.active?"#fff":"#444" }}>{fmt12(alarm.time)}</div>
                <div style={{ fontSize:12, color:alarm.active?"#888":"#333", marginTop:1 }}>{alarm.label} · {alarm.repeat}</div>
              </div>
              <div onClick={() => toggle(alarm.id)} style={{ width:36, height:20, borderRadius:10, cursor:"pointer", background:alarm.active?"#7EC8A9":"#1A1A2A", position:"relative", transition:"background 0.2s", flexShrink:0 }}>
                <div style={{ width:14, height:14, borderRadius:"50%", background:"#fff", position:"absolute", top:3, left:alarm.active?19:3, transition:"left 0.2s" }} />
              </div>
            </div>
          </SwipeRow>
        ))}
        {alarms.length===0 && <div style={{ textAlign:"center", color:"#333", padding:"30px 0", fontSize:13 }}>No alarms set. Tell AXIS to add one, or use the form above.</div>}
      </div>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function LifeOSv3() {
  const [profile, setProfile] = useState(() => load("los_profile", null));
  const [schedule, setSchedule] = useState(() => load("los_schedule", []));
  const [habits, setHabits] = useState(() => load("los_habits", []));
  const [alarms, setAlarms] = useState(() => load("los_alarms", []));
  const [tab, setTab] = useState("today");

  // Reset habits daily
  useEffect(() => {
    const lastDate = localStorage.getItem("los_last_date");
    const today = new Date().toDateString();
    if (lastDate !== today) {
      setHabits(p => p.map(h => ({ ...h, done:false })));
      localStorage.setItem("los_last_date", today);
    }
  }, []);

  useEffect(() => { save("los_schedule", schedule); }, [schedule]);
  useEffect(() => { save("los_habits", habits); }, [habits]);
  useEffect(() => { save("los_alarms", alarms); }, [alarms]);

  const handleOnboardingComplete = useCallback((prof, sched) => {
    setProfile(prof);
    save("los_profile", prof);
    // Build initial habits from profile
    const initHabits = [];
    if (prof.religion?.includes("5 daily")) {
      ["Fajr Prayer","Dhuhr Prayer","Asr Prayer","Maghrib Prayer","Isha Prayer"].forEach((label,i) => {
        initHabits.push({ id:Date.now()+i, label, tag:"spirit", icon:"🕌", done:false, streak:0, xp:20 });
      });
    }
    if (prof.fitness?.includes("gym")||prof.fitness?.includes("start")) initHabits.push({ id:Date.now()+10, label:"Gym / Workout", tag:"health", icon:"🏋️", done:false, streak:0, xp:30 });
    initHabits.push({ id:Date.now()+20, label:"Morning Shower & Groom", tag:"self", icon:"🚿", done:false, streak:0, xp:10 });
    initHabits.push({ id:Date.now()+21, label:"Drink 8 glasses of water", tag:"health", icon:"💧", done:false, streak:0, xp:15 });
    initHabits.push({ id:Date.now()+22, label:"Deep Work (2hrs)", tag:"wealth", icon:"💻", done:false, streak:0, xp:30 });
    if (prof.smoke?.includes("quit")) initHabits.push({ id:Date.now()+30, label:"No cigarettes today", tag:"self", icon:"⊘", done:false, streak:0, xp:50 });
    setHabits(initHabits);
    save("los_habits", initHabits);

    // Add dinner alarm automatically
    const dinnerTime = prof.dinner?.includes("9–10") ? "21:30" : prof.dinner?.includes("8–9") ? "20:30" : prof.dinner?.includes("7–8") ? "19:30" : prof.dinner?.includes("6–7") ? "18:30" : "21:30";
    const dinnerAlarm = { id:Date.now()+100, time:dinnerTime, label:"Family Dinner Time 🍽", repeat:"daily", active:true };
    setAlarms([dinnerAlarm]);
    save("los_alarms", [dinnerAlarm]);

    // Add dinner to schedule
    const dinnerItem = { id:Date.now()+200, time:dinnerTime, label:"Family Dinner", tag:"family", icon:"🍽" };
    const finalSched = [...sched, dinnerItem].sort((a,b) => toMins(a.time)-toMins(b.time));
    setSchedule(finalSched);
    save("los_schedule", finalSched);
  }, []);

  if (!profile) return <Onboarding onComplete={handleOnboardingComplete} />;

  const now = new Date();
  const greet = now.getHours() >= 19 || now.getHours() < 4 ? "🌙" : now.getHours() < 12 ? "☀️" : "🌤";

  return (
    <div style={{ minHeight:"100vh", background:"#070710", fontFamily:"'DM Sans','Segoe UI',sans-serif", color:"#D0D0E0", paddingBottom:80 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=DM+Sans:wght@300;400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:3px;} ::-webkit-scrollbar-thumb{background:#2A2A3A;border-radius:4px;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:1;transform:scale(1.2)}}
        input[type="date"]::-webkit-calendar-picker-indicator,input[type="time"]::-webkit-calendar-picker-indicator{filter:invert(1);opacity:.4;}
        textarea:focus,input:focus{border-color:#2A2A4A !important;}
      `}</style>

      <div style={{ position:"fixed", inset:0, pointerEvents:"none", background:"radial-gradient(ellipse at 20% 0%,rgba(200,169,126,0.04) 0%,transparent 50%),radial-gradient(ellipse at 80% 100%,rgba(126,169,200,0.04) 0%,transparent 50%)" }} />

      <div style={{ maxWidth:640, margin:"0 auto" }}>
        {/* Header */}
        <div style={{ padding:"20px 18px 14px", borderBottom:"1px solid #0E0E18", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontFamily:"'Cinzel',serif", fontSize:18, color:"#C8A97E", letterSpacing:4 }}>LIFE OS</div>
            <div style={{ fontSize:11, color:"#444", marginTop:2 }}>{greet} {now.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}</div>
          </div>
          <button onClick={() => { save("los_profile",null); localStorage.removeItem("los_profile"); window.location.reload(); }}
            style={{ background:"transparent", border:"1px solid #1A1A28", borderRadius:8, padding:"5px 10px", color:"#333", cursor:"pointer", fontSize:10 }}>
            👤 {profile.name}
          </button>
        </div>

        {/* Content */}
        <div style={{ padding:"18px 16px", animation:"fadeUp 0.3s ease" }} key={tab}>
          {tab==="today" && <TodayTab profile={profile} schedule={schedule} habits={habits} onHabitsChange={setHabits} />}
          {tab==="schedule" && <ScheduleTab schedule={schedule} onScheduleChange={setSchedule} />}
          {tab==="habits" && <HabitsTab habits={habits} onHabitsChange={setHabits} />}
          {tab==="baby" && <BabyTab />}
          {tab==="ideas" && <IdeasTab />}
          {tab==="quit" && <QuitTab />}
          {tab==="alarms" && <AlarmsTab alarms={alarms} onAlarmsChange={setAlarms} />}
        </div>
      </div>

      {/* Bottom Nav */}
      <div style={{ position:"fixed", bottom:0, left:0, right:0, background:"rgba(7,7,16,0.97)", borderTop:"1px solid #0E0E18", backdropFilter:"blur(20px)", padding:"6px 0 10px", zIndex:100 }}>
        <div style={{ maxWidth:640, margin:"0 auto", display:"flex", justifyContent:"space-around" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ background:"none", border:"none", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:2, padding:"3px 6px" }}>
              <div style={{ fontSize:15, color:tab===t.id?"#C8A97E":"#2A2A3A" }}>{t.icon}</div>
              <div style={{ fontSize:8, color:tab===t.id?"#C8A97E":"#2A2A3A", letterSpacing:0.3 }}>{t.label.toUpperCase()}</div>
              {tab===t.id && <div style={{ width:14, height:2, background:"#C8A97E", borderRadius:1 }} />}
            </button>
          ))}
        </div>
      </div>

      {/* Floating AXIS */}
      <FloatingAI
        profile={profile}
        schedule={schedule}
        habits={habits}
        alarms={alarms}
        onScheduleChange={setSchedule}
        onHabitsChange={setHabits}
        onAlarmsChange={setAlarms}
        onTabChange={setTab}
      />
    </div>
  );
}
