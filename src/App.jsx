import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  TrendingUp, TrendingDown, RefreshCw, Activity, 
  Clock, Search, Plus, X, Sun, Moon, Sparkles, XCircle, Send, MessageSquare 
} from 'lucide-react';

// --- YOUR API KEY ---
const API_KEY = "AIzaSyD0pCGf0CD9szyDc78onBBrMDgr-G3Lpk4";

const App = () => {
  // --- STATE ---
  const [isDark, setIsDark] = useState(() => JSON.parse(localStorage.getItem('theme')) ?? true);
  
  const [activeTokens, setActiveTokens] = useState(() => {
    const saved = localStorage.getItem('userTokens');
    if (!saved) return ['bitcoin', 'ethereum', 'solana'];
    try {
      const parsed = JSON.parse(saved);
      return (parsed.length > 0 && typeof parsed[0] === 'object') ? parsed.map(t => t.id) : parsed;
    } catch (e) { return ['bitcoin', 'ethereum', 'solana']; }
  });

  const [coinData, setCoinData] = useState({});
  const [initialLoad, setInitialLoad] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [timer, setTimer] = useState(15);
  
  // --- AI STATES ---
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState("");
  const [aiInput, setAiInput] = useState(""); // User's custom question
  const [chatHistory, setChatHistory] = useState([]); // To show Q&A style

  const REFRESH_INTERVAL = 15;

  // --- EFFECTS ---
  useEffect(() => localStorage.setItem('userTokens', JSON.stringify(activeTokens)), [activeTokens]);
  useEffect(() => localStorage.setItem('theme', JSON.stringify(isDark)), [isDark]);

  useEffect(() => {
    fetchMarketData();
    const interval = setInterval(fetchMarketData, REFRESH_INTERVAL * 1000);
    return () => clearInterval(interval);
  }, [activeTokens]);

  useEffect(() => {
    const timerId = setInterval(() => setTimer(p => p > 0 ? p - 1 : 0), 1000);
    return () => clearInterval(timerId);
  }, []);

  const fetchMarketData = async () => {
    if (activeTokens.length === 0) return;
    setIsUpdating(true);
    try {
      const ids = activeTokens.join(',');
      const cacheBuster = `&t=${new Date().getTime()}`;
      const response = await axios.get(
        `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=false&price_change_percentage=24h${cacheBuster}`
      );
      const dataMap = response.data.reduce((acc, coin) => { acc[coin.id] = coin; return acc; }, {});
      setCoinData(dataMap);
      setInitialLoad(false);
    } catch (err) { console.error("Fetch Error:", err); } 
    finally { setIsUpdating(false); setTimer(REFRESH_INTERVAL); }
  };

  // --- AI LOGIC ---
  const askAI = async (customQuestion = null) => {
    if (!showAIModal) setShowAIModal(true);
    setAiLoading(true);

    // If it's a new question, clear previous response to show loading
    if (customQuestion) {
        setAiResponse(""); 
    }

    try {
      // 1. Prepare Live Market Context
      const marketSummary = Object.values(coinData).map(c => 
        `${c.name}: $${c.current_price} (${c.price_change_percentage_24h.toFixed(2)}%)`
      ).join(', ');

      const baseContext = `You are a crypto expert. Current Market Data: [${marketSummary}].`;
      
      let prompt = "";
      if (customQuestion) {
        prompt = `${baseContext} User Question: "${customQuestion}". Answer concisely.`;
      } else {
        prompt = `${baseContext} Give a 3-sentence summary of this market data. Is sentiment Bullish or Bearish?`;
      }

      // 2. Auto-Discover Model
      const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
      const listRes = await axios.get(listUrl);
      const availableModels = listRes.data.models.filter(m => m.supportedGenerationMethods?.includes("generateContent"));
      
      let bestModel = availableModels.find(m => m.name.includes('flash')) || 
                      availableModels.find(m => m.name.includes('pro')) || 
                      availableModels[0];
      
      const modelName = bestModel.name.replace('models/', '');

      // 3. Call API
      const generateUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${API_KEY}`;
      const response = await axios.post(generateUrl, {
        contents: [{ parts: [{ text: prompt }] }]
      }, { headers: { 'Content-Type': 'application/json' } });

      const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response.";
      
      setAiResponse(text);
      if (customQuestion) setAiInput(""); // Clear input after send

    } catch (error) {
      console.error("AI Error:", error);
      setAiResponse(`⚠️ Error: ${error.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  // Initial analysis when button is clicked
  const handleOpenAI = () => {
    setShowAIModal(true);
    if (!aiResponse) askAI(); // Only auto-analyze if empty
  };

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    if (!aiInput.trim()) return;
    askAI(aiInput);
  };

  // --- HELPERS ---
  const handleSearch = async (e) => {
    e.preventDefault(); if (!searchQuery.trim()) return;
    setShowSearchResults(true);
    try {
      const res = await axios.get(`https://api.coingecko.com/api/v3/search?query=${searchQuery}`);
      setSearchResults(res.data.coins.slice(0, 5));
    } catch (err) { console.error(err); }
  };

  const addToken = (id) => {
    if (!activeTokens.includes(id)) { setActiveTokens(p => [...p, id]); setInitialLoad(true); }
    setSearchQuery(''); setShowSearchResults(false);
  };

  const formatCompact = (n) => n ? new Intl.NumberFormat('en-US', { notation: 'compact', style: 'currency', currency: 'USD' }).format(n) : '-';
  const formatPrice = (n) => n ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 6 }) : '-';

  const theme = {
    bg: isDark ? 'radial-gradient(circle at 15% 50%, #1e1e2e 0%, #0b0e14 85%)' : 'radial-gradient(circle at 15% 50%, #f1f5f9 0%, #cbd5e1 85%)',
    textMain: isDark ? '#e2e8f0' : '#0f172a',
    textSub: isDark ? '#94a3b8' : '#64748b',
    cardBg: isDark ? 'rgba(30, 41, 59, 0.4)' : 'rgba(255, 255, 255, 0.6)',
    cardBorder: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.4)',
    modalBg: isDark ? '#1e293b' : '#ffffff',
    modalText: isDark ? '#e2e8f0' : '#1e293b',
    inputBg: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)',
  };

  return (
    <div style={{...styles.container, background: theme.bg, color: theme.textMain}}>
      
      {/* AI MODAL POPUP */}
      {showAIModal && (
        <div style={styles.modalOverlay}>
          <div style={{...styles.modal, background: theme.modalBg, color: theme.modalText}}>
            
            {/* Header */}
            <div style={styles.modalHeader}>
              <div style={{display:'flex', alignItems:'center', gap:10}}>
                <Sparkles color="#a855f7" />
                <h2 style={{margin:0, fontSize:'1.2rem'}}>Market AI Agent</h2>
              </div>
              <button onClick={() => setShowAIModal(false)} style={{...styles.iconBtn, color: theme.textMain}}>
                <XCircle size={24} />
              </button>
            </div>
            
            {/* Response Area */}
            <div style={styles.modalBody}>
              {aiLoading ? (
                <div style={{display:'flex', alignItems:'center', gap:10, color: theme.textSub, justifyContent:'center', height: '100%'}}>
                  <RefreshCw className="spin" size={24} /> 
                  <span>Thinking...</span>
                </div>
              ) : (
                <div style={{lineHeight: '1.6', fontSize: '1rem', whiteSpace: 'pre-wrap'}}>
                   {aiResponse ? aiResponse : "Ask me anything about your dashboard tokens!"}
                </div>
              )}
            </div>

            {/* Input Bar */}
            <form onSubmit={handleCustomSubmit} style={{...styles.inputBar, borderTop: `1px solid ${theme.cardBorder}`}}>
                <input 
                  type="text" 
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  placeholder="Ask a question (e.g. 'Why is BTC up?')"
                  style={{...styles.chatInput, background: theme.inputBg, color: theme.textMain}}
                />
                <button type="submit" style={styles.sendBtn} disabled={aiLoading}>
                  <Send size={18} />
                </button>
            </form>

          </div>
        </div>
      )}

      <div style={styles.content}>
        <header style={styles.header}>
          <div style={styles.brand}>
            <Activity size={28} color="#00d2ff" />
            <h1 style={styles.title}>Crypto<span style={{color:'#00d2ff'}}>Dash</span></h1>
          </div>
          <div style={styles.controls}>
            {/* AI BUTTON */}
            <button onClick={handleOpenAI} style={styles.aiBtn}>
              <MessageSquare size={16} /> <span className="mobile-hide">Ask AI</span>
            </button>

            <div style={styles.searchWrapper}>
              <form onSubmit={handleSearch} style={{...styles.searchBox, background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.5)'}}>
                <Search size={16} color={theme.textSub} />
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Add Coin..." style={{...styles.input, color: theme.textMain}} />
              </form>
              {showSearchResults && searchResults.length > 0 && (
                <div style={{...styles.dropdown, background: isDark ? '#1e293b' : '#fff', borderColor: theme.cardBorder}}>
                  {searchResults.map(c => (
                    <div key={c.id} style={styles.dropItem} onClick={() => addToken(c.id)}>
                      <img src={c.thumb} alt="" style={{width:16, borderRadius:'50%'}}/> 
                      <span style={{color: theme.textMain}}>{c.symbol}</span> 
                      <Plus size={14} style={{marginLeft:'auto', color: theme.textMain}}/>
                    </div>
                  ))}
                  <div onClick={() => setShowSearchResults(false)} style={{...styles.closeDrop, color: theme.textSub}}>Close</div>
                </div>
              )}
            </div>
            <button onClick={() => setIsDark(!isDark)} style={{...styles.iconBtn, color: theme.textMain}}>
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </header>

        <main style={styles.grid}>
          {activeTokens.map(id => {
            const coin = coinData[id];
            if (!coin && initialLoad) return <div key={id} style={styles.skeleton}></div>;
            if (!coin) return null;
            const isPositive = coin.price_change_percentage_24h >= 0;

            return (
              <div key={id} style={{...styles.card, background: theme.cardBg, borderColor: theme.cardBorder}}>
                <button onClick={() => {
                  const newList = activeTokens.filter(t => t !== id);
                  setActiveTokens(newList);
                }} style={{...styles.deleteBtn, color: theme.textSub}}><X size={16}/></button>
                
                <div style={styles.cardTop}>
                  <img src={coin.image} alt={coin.symbol} style={{width: 32, height: 32, borderRadius: '50%'}} />
                  <div>
                    <div style={{fontWeight: '800', fontSize:'1.1rem'}}>{coin.symbol.toUpperCase()}</div>
                    <div style={{fontSize:'0.8rem', color: theme.textSub}}>{coin.name}</div>
                  </div>
                </div>

                <div style={styles.priceSection}>
                  <div style={styles.bigPrice}>{formatPrice(coin.current_price)}</div>
                  <div style={{...styles.changeChip, color: isPositive ? '#34d399' : '#f87171', background: isPositive ? 'rgba(52, 211, 153, 0.1)' : 'rgba(248, 113, 113, 0.1)'}}>
                    {isPositive ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                    {coin.price_change_percentage_24h?.toFixed(2)}%
                  </div>
                </div>

                <div style={styles.statsGrid}>
                  <StatBox label="Mkt Cap" value={formatCompact(coin.market_cap)} theme={theme} />
                  <StatBox label="FDV" value={formatCompact(coin.fully_diluted_valuation)} theme={theme} />
                </div>
              </div>
            );
          })}
        </main>
        
        <footer style={{...styles.footer, color: theme.textSub}}>
           <Clock size={14} style={{marginRight:6}}/> Next update in: {timer}s
        </footer>
      </div>

      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .spin { animation: spin 0.8s linear infinite; }
        @media (max-width: 600px) { .mobile-hide { display: none; } }
      `}</style>
    </div>
  );
};

const StatBox = ({ label, value, theme }) => (
  <div style={{display:'flex', flexDirection:'column', gap:'2px'}}>
    <span style={{fontSize:'0.7rem', fontWeight:'600', color: theme.textSub, textTransform:'uppercase'}}>{label}</span>
    <span style={{fontSize:'0.9rem', fontWeight:'500'}}>{value}</span>
  </div>
);

const styles = {
  container: { minHeight: '100vh', width: '100vw', fontFamily: 'Inter, sans-serif', transition: '0.3s' },
  content: { maxWidth: '1200px', margin: '0 auto', padding: '20px', display: 'flex', flexDirection: 'column', height: '100vh' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap:'wrap', gap:15 },
  brand: { display: 'flex', alignItems: 'center', gap: 10 },
  title: { fontSize: '1.5rem', fontWeight: '800', margin: 0 },
  controls: { display: 'flex', gap: 10, alignItems: 'center' },
  searchWrapper: { position: 'relative' },
  searchBox: { display: 'flex', alignItems: 'center', padding: '6px 12px', borderRadius: 20, gap: 8 },
  input: { background: 'transparent', border: 'none', outline: 'none', width: 100 },
  dropdown: { position: 'absolute', top: '120%', left: 0, right: 0, borderRadius: 8, overflow: 'hidden', zIndex: 100, border: '1px solid', boxShadow:'0 10px 20px rgba(0,0,0,0.3)' },
  dropItem: { padding: 10, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', borderBottom:'1px solid rgba(255,255,255,0.05)' },
  closeDrop: { padding: 8, textAlign: 'center', fontSize: '0.8rem', cursor: 'pointer', opacity: 0.7 },
  iconBtn: { background: 'transparent', border: 'none', cursor: 'pointer', padding: 5 },
  aiBtn: { background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)', border: 'none', borderRadius: '20px', padding: '8px 16px', color: 'white', fontWeight: '600', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', boxShadow: '0 4px 10px rgba(168, 85, 247, 0.4)', transition: 'transform 0.2s' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)', zIndex: 999, display: 'flex', justifyContent: 'center', alignItems: 'center' },
  modal: { width: '90%', maxWidth: '600px', borderRadius: '20px', padding: '0', boxShadow: '0 20px 50px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column', height: '60vh', overflow: 'hidden' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', padding: '20px', borderBottom: '1px solid rgba(128,128,128,0.2)' },
  modalBody: { flex: 1, padding: '20px', overflowY: 'auto' },
  inputBar: { display: 'flex', gap: '10px', padding: '15px' },
  chatInput: { flex: 1, padding: '12px', borderRadius: '10px', border: 'none', outline: 'none' },
  sendBtn: { background: '#00d2ff', border: 'none', borderRadius: '10px', padding: '0 15px', cursor: 'pointer', color: '#000', display: 'flex', alignItems: 'center' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20, alignContent: 'start', flex: 1, overflowY: 'auto', paddingBottom: 20 },
  card: { borderRadius: 20, padding: 20, border: '1px solid', position: 'relative', display:'flex', flexDirection:'column', gap: 20, backdropFilter:'blur(10px)', transition:'all 0.3s' },
  deleteBtn: { position: 'absolute', top: 15, right: 15, background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.5 },
  cardTop: { display: 'flex', gap: 12, alignItems: 'center' },
  priceSection: { display: 'flex', justifyContent:'space-between', alignItems:'baseline' },
  bigPrice: { fontSize: '1.8rem', fontWeight: '700' },
  changeChip: { padding: '4px 8px', borderRadius: 6, fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: 4 },
  statsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px 0', borderTop: '1px solid rgba(128,128,128,0.2)', paddingTop: 15 },
  skeleton: { height: 200, borderRadius: 20, background: 'rgba(255,255,255,0.05)', animation: 'spin 1s infinite alternate' },
  footer: { textAlign: 'center', fontSize: '0.8rem', paddingTop: 20, display:'flex', justifyContent:'center', alignItems:'center' }
};

export default App;