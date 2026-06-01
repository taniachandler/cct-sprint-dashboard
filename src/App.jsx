import { useState, useEffect, useCallback } from "react";

// ─── Constants ───────────────────────────────────────────────────────────────
const SPRINT_START = new Date("2026-06-01");
const SPRINT_END = new Date("2026-08-29");
const TOTAL_DAYS = 90;
const WEEKLY_GOALS = { shortForm: 21, youtube: 1, newsletter: 1 };
const DAILY_TARGET = { shortForm: 3 };

const PLATFORMS = [
  { id: "tiktok", label: "TikTok", emoji: "🎵", color: "#00f2ea" },
  { id: "instagram", label: "Instagram", emoji: "📸", color: "#E1306C" },
  { id: "threads", label: "Threads", emoji: "🧵", color: "#a8b4bf" },
  { id: "facebook", label: "Facebook", emoji: "👥", color: "#1877F2" },
  { id: "pinterest", label: "Pinterest", emoji: "📌", color: "#E60023" },
  { id: "substack", label: "Substack", emoji: "📬", color: "#FF6719" },
];

const CCT_GREEN = "#3ddc84";
const CCT_DARK = "#0d1117";
const CCT_CARD = "#161b22";
const CCT_BORDER = "#21262d";
const CCT_ACCENT = "#58a6ff";
const CCT_GOLD = "#f0c040";
const CCT_MUTED = "#8b949e";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function daysSinceStart() {
  const now = new Date();
  const diff = Math.floor((now - SPRINT_START) / (1000 * 60 * 60 * 24));
  return Math.max(0, Math.min(diff, TOTAL_DAYS));
}

function currentWeek() {
  return Math.floor(daysSinceStart() / 7) + 1;
}

function sprintProgress() {
  return Math.round((daysSinceStart() / TOTAL_DAYS) * 100);
}

function paceStatus(completed, dayOfWeek) {
  if (dayOfWeek === 0) dayOfWeek = 7;
  const expected = dayOfWeek * DAILY_TARGET.shortForm;
  const ratio = completed / expected;
  if (ratio >= 1.15) return { label: "🚀 Ahead", color: CCT_GREEN, bg: "#0d2818" };
  if (ratio >= 0.85) return { label: "✅ On Track", color: CCT_ACCENT, bg: "#0d1b2e" };
  return { label: "⚠️ Behind", color: "#f85149", bg: "#2d1217" };
}

function getDayOfWeek() {
  const day = new Date().getDay();
  return day === 0 ? 7 : day; // Mon=1 ... Sun=7
}

// ─── API Calls ────────────────────────────────────────────────────────────────
async function fetchTodoistTasks() {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: `You are a data extraction assistant. The user will ask you to summarize Todoist task completion data for the CCT Sprint project. 
Return ONLY valid JSON with this exact shape, no markdown, no preamble:
{
  "shortFormCompleted": <number>,
  "youtubeCompleted": <number>,
  "newsletterCompleted": <number>,
  "engagementCompleted": <number>,
  "tasksToday": [{"content": "...", "done": true/false}]
}`,
      mcp_servers: [{ type: "url", url: "https://ai.todoist.net/mcp", name: "todoist" }],
      messages: [
        {
          role: "user",
          content: `Check the CCT 90-Day Sprint 🚀 project in Todoist. 
For the current week (Week ${currentWeek()}, starting ${new Date(SPRINT_START.getTime() + (currentWeek() - 1) * 7 * 86400000).toDateString()}):
- Count completed tasks labeled "short-form" 
- Count completed tasks labeled "youtube"
- Count completed tasks labeled "newsletter"  
- Count completed tasks labeled "community" this week
- List today's tasks and whether they are done

Return only JSON, no other text.`,
        },
      ],
    }),
  });
  const data = await res.json();
  const textBlock = data.content?.find((b) => b.type === "text");
  if (!textBlock) throw new Error("No text in response");
  const clean = textBlock.text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

async function fetchTrends() {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1200,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      system: `You research trending personal finance content for social media creators. 
Return ONLY valid JSON, no markdown, no preamble:
{
  "tiktokHashtags": ["#tag1","#tag2","#tag3","#tag4","#tag5"],
  "igHashtags": ["#tag1","#tag2","#tag3","#tag4","#tag5"],
  "googleKeywords": ["keyword1","keyword2","keyword3","keyword4","keyword5"],
  "trendingTopics": [
    {"topic": "...", "why": "...", "angle": "..."},
    {"topic": "...", "why": "...", "angle": "..."},
    {"topic": "...", "why": "...", "angle": "..."}
  ],
  "weekOf": "${new Date().toLocaleDateString()}"
}`,
      messages: [
        {
          role: "user",
          content: `Search for trending personal finance hashtags and keywords this week (${new Date().toLocaleDateString()}). 
Focus on: budgeting, money mindset, dual-income households, financial systems, wealth building for everyday people.
Platforms: TikTok and Instagram. Also pull top Google search trends in personal finance.
Suggest 3 trending topic angles with a content hook.
Return only JSON.`,
        },
      ],
    }),
  });
  const data = await res.json();
  const textBlock = data.content?.find((b) => b.type === "text");
  if (!textBlock) throw new Error("No trend data");
  const clean = textBlock.text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

async function fetchReflectionPrompt(weekNum) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 600,
      messages: [
        {
          role: "user",
          content: `You are a content strategy coach for Common Cents Tania - a personal finance brand targeting dual-income households who need a financial system (not just tips). 
Generate 3 sharp, specific weekly reflection questions for Week ${weekNum} of her 90-day relaunch sprint. 
Questions should help her figure out what language, tone, hooks, and formats are resonating with her audience.
Return ONLY a JSON array of 3 strings. No markdown, no preamble.`,
        },
      ],
    }),
  });
  const data = await res.json();
  const textBlock = data.content?.find((b) => b.type === "text");
  const clean = textBlock.text.replace(/```json|```/g, "").trim();
  return JSON.parse(clean);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SprintHeader() {
  const days = daysSinceStart();
  const progress = sprintProgress();
  const week = currentWeek();
  const daysLeft = TOTAL_DAYS - days;

  return (
    <div style={{
      background: `linear-gradient(135deg, ${CCT_CARD} 0%, #1a2332 100%)`,
      border: `1px solid ${CCT_BORDER}`,
      borderRadius: 16,
      padding: "28px 32px",
      marginBottom: 24,
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: -40, right: -40,
        width: 200, height: 200,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${CCT_GREEN}18 0%, transparent 70%)`,
        pointerEvents: "none",
      }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <span style={{ fontSize: 28 }}>💰</span>
            <h1 style={{ margin: 0, fontSize: 26, fontFamily: "'Playfair Display', Georgia, serif", color: "#fff", letterSpacing: "-0.5px" }}>
              Common Cents Tania
            </h1>
          </div>
          <p style={{ margin: 0, color: CCT_MUTED, fontSize: 13, fontFamily: "monospace", letterSpacing: 2, textTransform: "uppercase" }}>
            90-Day Relaunch Sprint · Jun 1 – Aug 29, 2026
          </p>
        </div>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          {[
            { label: "Day", value: days },
            { label: "Week", value: week },
            { label: "Days Left", value: daysLeft },
          ].map((s) => (
            <div key={s.label} style={{ textAlign: "center", background: "#0d1117", borderRadius: 10, padding: "10px 18px", border: `1px solid ${CCT_BORDER}` }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: CCT_GREEN, fontFamily: "monospace" }}>{s.value}</div>
              <div style={{ fontSize: 11, color: CCT_MUTED, textTransform: "uppercase", letterSpacing: 1 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: CCT_MUTED, fontFamily: "monospace" }}>SPRINT PROGRESS</span>
          <span style={{ fontSize: 12, color: CCT_GREEN, fontFamily: "monospace", fontWeight: 700 }}>{progress}%</span>
        </div>
        <div style={{ background: "#21262d", borderRadius: 100, height: 8, overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 100,
            width: `${progress}%`,
            background: `linear-gradient(90deg, ${CCT_GREEN}, ${CCT_ACCENT})`,
            transition: "width 1s ease",
          }} />
        </div>
      </div>
    </div>
  );
}

function PaceCard({ todoData, loading }) {
  const dayOfWeek = getDayOfWeek();
  const completed = todoData?.shortFormCompleted ?? 0;
  const pace = paceStatus(completed, dayOfWeek);
  const expected = dayOfWeek * DAILY_TARGET.shortForm;
  const diff = completed - expected;

  return (
    <div style={{
      background: pace.bg,
      border: `1px solid ${pace.color}40`,
      borderRadius: 14,
      padding: "20px 24px",
      flex: 1,
      minWidth: 200,
    }}>
      <div style={{ fontSize: 11, color: CCT_MUTED, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 8, fontFamily: "monospace" }}>Daily Pace Check</div>
      {loading ? (
        <div style={{ color: CCT_MUTED, fontSize: 14 }}>Checking Todoist...</div>
      ) : (
        <>
          <div style={{ fontSize: 28, fontWeight: 800, color: pace.color, marginBottom: 4 }}>{pace.label}</div>
          <div style={{ color: CCT_MUTED, fontSize: 13 }}>
            {completed} posted · {expected} expected by end of day {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][dayOfWeek - 1]}
          </div>
          {diff !== 0 && (
            <div style={{ marginTop: 6, fontSize: 12, color: diff > 0 ? CCT_GREEN : "#f85149" }}>
              {diff > 0 ? `+${diff} ahead of pace` : `${Math.abs(diff)} behind pace`}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function WeeklyProgress({ todoData, loading }) {
  const goals = [
    { label: "Short-Form Posts", key: "shortFormCompleted", goal: WEEKLY_GOALS.shortForm, emoji: "🎬", color: CCT_GREEN },
    { label: "YouTube Video", key: "youtubeCompleted", goal: WEEKLY_GOALS.youtube, emoji: "▶️", color: "#FF0000" },
    { label: "Newsletter", key: "newsletterCompleted", goal: WEEKLY_GOALS.newsletter, emoji: "📧", color: CCT_GOLD },
  ];

  return (
    <div style={{
      background: CCT_CARD,
      border: `1px solid ${CCT_BORDER}`,
      borderRadius: 14,
      padding: "20px 24px",
      flex: 2,
      minWidth: 280,
    }}>
      <div style={{ fontSize: 11, color: CCT_MUTED, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 16, fontFamily: "monospace" }}>
        Week {currentWeek()} Output Goals
      </div>
      {goals.map((g) => {
        const val = todoData?.[g.key] ?? 0;
        const pct = Math.min(100, Math.round((val / g.goal) * 100));
        return (
          <div key={g.key} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 13, color: "#cdd9e5" }}>{g.emoji} {g.label}</span>
              <span style={{ fontSize: 13, fontFamily: "monospace", color: pct >= 100 ? CCT_GREEN : CCT_MUTED }}>
                {loading ? "–" : `${val} / ${g.goal}`}
              </span>
            </div>
            <div style={{ background: "#21262d", borderRadius: 100, height: 6 }}>
              <div style={{
                height: "100%", borderRadius: 100,
                width: loading ? "0%" : `${pct}%`,
                background: pct >= 100 ? CCT_GREEN : g.color,
                transition: "width 0.8s ease",
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CommunityTracker({ followers, setFollowers }) {
  return (
    <div style={{ background: CCT_CARD, border: `1px solid ${CCT_BORDER}`, borderRadius: 14, padding: "20px 24px" }}>
      <div style={{ fontSize: 11, color: CCT_MUTED, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 16, fontFamily: "monospace" }}>
        Community Growth · Week {currentWeek()}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
        {PLATFORMS.map((p) => (
          <div key={p.id} style={{
            background: "#0d1117",
            border: `1px solid ${CCT_BORDER}`,
            borderRadius: 10,
            padding: "12px 14px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: "#cdd9e5" }}>{p.emoji} {p.label}</span>
            </div>
            <input
              type="number"
              placeholder="Count"
              value={followers[p.id] ?? ""}
              onChange={(e) => setFollowers((prev) => ({ ...prev, [p.id]: e.target.value }))}
              style={{
                width: "100%", background: "#161b22", border: `1px solid ${CCT_BORDER}`,
                borderRadius: 6, color: p.color, padding: "6px 10px",
                fontSize: 16, fontFamily: "monospace", fontWeight: 700,
                outline: "none", boxSizing: "border-box",
              }}
            />
            <div style={{ fontSize: 10, color: CCT_MUTED, marginTop: 4, fontFamily: "monospace" }}>
              Update Sunday after analytics pull
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendCard({ trends, loading, onRefresh }) {
  return (
    <div style={{ background: CCT_CARD, border: `1px solid ${CCT_BORDER}`, borderRadius: 14, padding: "20px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: CCT_MUTED, textTransform: "uppercase", letterSpacing: 1.5, fontFamily: "monospace" }}>
          🔍 Trending This Week · Personal Finance
        </div>
        <button onClick={onRefresh} disabled={loading} style={{
          background: "transparent", border: `1px solid ${CCT_BORDER}`,
          color: CCT_ACCENT, borderRadius: 6, padding: "4px 12px", cursor: "pointer",
          fontSize: 11, fontFamily: "monospace",
        }}>
          {loading ? "Researching..." : "↻ Refresh"}
        </button>
      </div>

      {loading ? (
        <div style={{ color: CCT_MUTED, fontSize: 13, padding: "20px 0", textAlign: "center" }}>
          🔍 Searching TikTok, IG & Google trends...
        </div>
      ) : trends ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          <div>
            <div style={{ fontSize: 11, color: "#00f2ea", fontFamily: "monospace", marginBottom: 8, textTransform: "uppercase" }}>TikTok Tags</div>
            {trends.tiktokHashtags?.map((t, i) => (
              <div key={i} style={{ fontSize: 13, color: CCT_MUTED, marginBottom: 4, fontFamily: "monospace" }}>{t}</div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 11, color: "#E1306C", fontFamily: "monospace", marginBottom: 8, textTransform: "uppercase" }}>IG Tags</div>
            {trends.igHashtags?.map((t, i) => (
              <div key={i} style={{ fontSize: 13, color: CCT_MUTED, marginBottom: 4, fontFamily: "monospace" }}>{t}</div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: 11, color: CCT_GOLD, fontFamily: "monospace", marginBottom: 8, textTransform: "uppercase" }}>Google Keywords</div>
            {trends.googleKeywords?.map((t, i) => (
              <div key={i} style={{ fontSize: 13, color: CCT_MUTED, marginBottom: 4, fontFamily: "monospace" }}>{t}</div>
            ))}
          </div>
          <div style={{ gridColumn: "1 / -1", borderTop: `1px solid ${CCT_BORDER}`, paddingTop: 14, marginTop: 4 }}>
            <div style={{ fontSize: 11, color: CCT_GREEN, fontFamily: "monospace", marginBottom: 10, textTransform: "uppercase" }}>🔥 Trending Topics & Angles</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {trends.trendingTopics?.map((t, i) => (
                <div key={i} style={{ background: "#0d1117", borderRadius: 8, padding: "10px 12px", border: `1px solid ${CCT_BORDER}` }}>
                  <div style={{ fontWeight: 700, color: "#cdd9e5", fontSize: 13, marginBottom: 4 }}>{t.topic}</div>
                  <div style={{ fontSize: 11, color: CCT_MUTED, marginBottom: 4 }}>Why: {t.why}</div>
                  <div style={{ fontSize: 11, color: CCT_ACCENT }}>Hook: {t.angle}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ color: CCT_MUTED, fontSize: 13, padding: "20px 0", textAlign: "center" }}>
          Click Refresh to pull this week's trends
        </div>
      )}
      {trends?.weekOf && (
        <div style={{ marginTop: 12, fontSize: 11, color: CCT_MUTED, fontFamily: "monospace" }}>Last updated: {trends.weekOf}</div>
      )}
    </div>
  );
}

function ReflectionCard({ prompts, loading, onRefresh, notes, setNotes }) {
  return (
    <div style={{ background: CCT_CARD, border: `1px solid ${CCT_BORDER}`, borderRadius: 14, padding: "20px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: CCT_MUTED, textTransform: "uppercase", letterSpacing: 1.5, fontFamily: "monospace" }}>
          🎯 Message Refinement · Week {currentWeek()} Reflection
        </div>
        <button onClick={onRefresh} disabled={loading} style={{
          background: "transparent", border: `1px solid ${CCT_BORDER}`,
          color: CCT_ACCENT, borderRadius: 6, padding: "4px 12px", cursor: "pointer",
          fontSize: 11, fontFamily: "monospace",
        }}>
          {loading ? "Generating..." : "↻ New Prompts"}
        </button>
      </div>
      {loading ? (
        <div style={{ color: CCT_MUTED, fontSize: 13, textAlign: "center", padding: "20px 0" }}>Crafting your reflection prompts...</div>
      ) : prompts?.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {prompts.map((q, i) => (
            <div key={i} style={{ background: "#0d1117", borderRadius: 8, padding: "12px 14px", border: `1px solid ${CCT_BORDER}` }}>
              <div style={{ fontSize: 13, color: "#cdd9e5", marginBottom: 8, lineHeight: 1.5 }}>
                <span style={{ color: CCT_ACCENT, fontFamily: "monospace", marginRight: 8 }}>Q{i + 1}.</span>{q}
              </div>
              <textarea
                placeholder="Your notes..."
                value={notes[i] ?? ""}
                onChange={(e) => setNotes((prev) => ({ ...prev, [i]: e.target.value }))}
                rows={2}
                style={{
                  width: "100%", background: "#161b22", border: `1px solid ${CCT_BORDER}`,
                  borderRadius: 6, color: "#cdd9e5", padding: "8px 10px",
                  fontSize: 12, resize: "vertical", outline: "none",
                  fontFamily: "inherit", boxSizing: "border-box",
                }}
              />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ color: CCT_MUTED, fontSize: 13, textAlign: "center", padding: "20px 0" }}>
          Click "New Prompts" to generate this week's reflection questions
        </div>
      )}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function CCTDashboard() {
  const [todoData, setTodoData] = useState(null);
  const [todoLoading, setTodoLoading] = useState(false);
  const [trends, setTrends] = useState(null);
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [prompts, setPrompts] = useState([]);
  const [promptsLoading, setPromptsLoading] = useState(false);
  const [followers, setFollowers] = useState({});
  const [notes, setNotes] = useState({});
  const [lastSync, setLastSync] = useState(null);

  const syncTodoist = useCallback(async () => {
    setTodoLoading(true);
    try {
      const data = await fetchTodoistTasks();
      setTodoData(data);
      setLastSync(new Date().toLocaleTimeString());
    } catch (e) {
      console.error("Todoist sync error:", e);
    } finally {
      setTodoLoading(false);
    }
  }, []);

  const refreshTrends = useCallback(async () => {
    setTrendsLoading(true);
    try {
      const data = await fetchTrends();
      setTrends(data);
    } catch (e) {
      console.error("Trends error:", e);
    } finally {
      setTrendsLoading(false);
    }
  }, []);

  const refreshPrompts = useCallback(async () => {
    setPromptsLoading(true);
    try {
      const data = await fetchReflectionPrompt(currentWeek());
      setPrompts(data);
    } catch (e) {
      console.error("Prompts error:", e);
    } finally {
      setPromptsLoading(false);
    }
  }, []);

  // Auto-sync Todoist on load
  useEffect(() => {
    syncTodoist();
  }, []);

  return (
    <div style={{
      minHeight: "100vh",
      background: CCT_DARK,
      color: "#cdd9e5",
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      padding: "28px 24px",
      maxWidth: 1100,
      margin: "0 auto",
    }}>
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=DM+Sans:wght@400;500;600&display=swap');
        input:focus, textarea:focus { border-color: #58a6ff !important; }
        button:hover:not(:disabled) { opacity: 0.85; }
        ::-webkit-scrollbar { width: 6px; } 
        ::-webkit-scrollbar-track { background: #0d1117; }
        ::-webkit-scrollbar-thumb { background: #30363d; border-radius: 3px; }
      `}</style>

      <SprintHeader />

      {/* Sync bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: CCT_MUTED, fontFamily: "monospace" }}>
          {lastSync ? `✓ Todoist synced at ${lastSync}` : "Not yet synced"}
        </div>
        <button
          onClick={syncTodoist}
          disabled={todoLoading}
          style={{
            background: CCT_GREEN + "18", border: `1px solid ${CCT_GREEN}50`,
            color: CCT_GREEN, borderRadius: 8, padding: "6px 16px",
            cursor: "pointer", fontSize: 12, fontFamily: "monospace",
          }}
        >
          {todoLoading ? "Syncing..." : "↻ Sync Todoist"}
        </button>
      </div>

      {/* Row 1: Pace + Weekly Goals */}
      <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
        <PaceCard todoData={todoData} loading={todoLoading} />
        <WeeklyProgress todoData={todoData} loading={todoLoading} />
      </div>

      {/* Row 2: Community Tracker */}
      <div style={{ marginBottom: 20 }}>
        <CommunityTracker followers={followers} setFollowers={setFollowers} />
      </div>

      {/* Row 3: Trends */}
      <div style={{ marginBottom: 20 }}>
        <TrendCard trends={trends} loading={trendsLoading} onRefresh={refreshTrends} />
      </div>

      {/* Row 4: Reflection */}
      <div style={{ marginBottom: 20 }}>
        <ReflectionCard
          prompts={prompts}
          loading={promptsLoading}
          onRefresh={refreshPrompts}
          notes={notes}
          setNotes={setNotes}
        />
      </div>

      {/* Footer */}
      <div style={{ textAlign: "center", paddingTop: 16, borderTop: `1px solid ${CCT_BORDER}` }}>
        <span style={{ fontSize: 11, color: CCT_MUTED, fontFamily: "monospace", letterSpacing: 1 }}>
          CCT SPRINT DASHBOARD · JUNE 1 – AUG 29, 2026 · POWERED BY CLAUDE + TODOIST
        </span>
      </div>
    </div>
  );
}
