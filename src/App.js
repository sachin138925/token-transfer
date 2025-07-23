import React, { useState, useEffect } from "react";
import {
  Wallet,
  isAddress,
  parseEther,
  formatEther,
  JsonRpcProvider,
  Contract,
  formatUnits,
  parseUnits,
} from "ethers";
import { Toaster, toast } from "react-hot-toast";
import clsx from "clsx";
import QRCode from "react-qr-code";
import "./App.css";

// --- CONFIGURATION ---
const RPC_URL = "https://bsc-testnet-dataseed.bnbchain.org";
const USDT_CONTRACT_ADDRESS = "0x787A697324dbA4AB965C58CD33c13ff5eeA6295F";
const USDC_CONTRACT_ADDRESS = "0x342e3aA1248AB77E319e3331C6fD3f1F2d4B36B1";
const API_URL = "http://localhost:5000";

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];

// --- REUSABLE COMPONENTS ---
const Card = ({ title, children, className }) => (
  <section className={clsx("card", className)}>
    {title && <h3>{title}</h3>}
    {children}
  </section>
);

const QrModal = ({ address, onClose }) => (
  <div className="modal-backdrop" onClick={onClose}>
    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
      <h4>Wallet Address</h4>
      <div className="qr-container">
        <QRCode value={address} size={256} />
      </div>
      <p>{address}</p>
      <button className="btn btn-secondary" onClick={onClose}>Close</button>
    </div>
  </div>
);


// --- MAIN APP COMPONENT ---
export default function App() {
  const [mode, setMode] = useState("create");
  const [walletName, setWalletName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [loading, setLoading] = useState(false);

  const [walletData, setWalletData] = useState(null);
  const [balance, setBalance] = useState(null);
  const [usdtBalance, setUsdtBalance] = useState(null);
  const [usdcBalance, setUsdcBalance] = useState(null);
  
  const [activeTab, setActiveTab] = useState("send");
  const [qrOpen, setQrOpen] = useState(false);
  
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [sendToken, setSendToken] = useState("BNB");
  
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  const [revealInput, setRevealInput] = useState("");
  const [showSensitive, setShowSensitive] = useState(false);
  
  const provider = new JsonRpcProvider(RPC_URL);

  const fetchAllBalances = async (address) => {
    try {
      const bnbBal = await provider.getBalance(address);
      setBalance(formatEther(bnbBal));
      const usdt = new Contract(USDT_CONTRACT_ADDRESS, ERC20_ABI, provider);
      const usdtBal = await usdt.balanceOf(address);
      setUsdtBalance(formatUnits(usdtBal, await usdt.decimals()));
      const usdc = new Contract(USDC_CONTRACT_ADDRESS, ERC20_ABI, provider);
      const usdcBal = await usdc.balanceOf(address);
      setUsdcBalance(formatUnits(usdcBal, await usdc.decimals()));
    } catch (e) {
      toast.error("Failed to fetch balances.");
    }
  };

  const handleSubmit = async () => {
    if (!walletName.trim() || !password.trim()) return toast.error("Fill all fields");
    if (mode === "create" && password !== confirmPw) return toast.error("Passwords don’t match");
    setLoading(true);
    try {
      if (mode === "create") {
        const wallet = Wallet.createRandom();
        const payload = { name: walletName, address: wallet.address, privateKey: wallet.privateKey, mnemonic: wallet.mnemonic.phrase, password };
        const res = await fetch(`${API_URL}/api/wallet`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (res.ok) {
          toast.success("Wallet created & saved!");
          setWalletName(""); setPassword(""); setConfirmPw("");
        } else {
          const msg = (await res.json()).error || "Save failed";
          toast.error(msg);
        }
      } else {
        const res = await fetch(`${API_URL}/api/wallet/${walletName}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
        const data = await res.json();
        if (data.error) {
          toast.error(data.error);
        } else {
          toast.success(`Wallet "${data.name}" loaded!`);
          setWalletData(data);
          fetchAllBalances(data.address);
        }
      }
    } catch (e) {
      toast.error("A network error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const logTransaction = async (hash) => {
    try {
      await fetch(`${API_URL}/api/tx/${hash}`, { method: "POST" });
    } catch (e) {
      console.error("Auto-logging failed for tx:", hash, e);
    }
  };

  const handleSend = async () => {
    if (!walletData) return toast.error("Load wallet first");
    if (!isAddress(recipient)) return toast.error("Invalid recipient address");
    if (!amount || parseFloat(amount) <= 0) return toast.error("Invalid amount");
    setLoading(true);
    const toastId = toast.loading(`Sending ${sendToken}...`);
    try {
      const wallet = new Wallet(walletData.privateKey, provider);
      let tx;
      if (sendToken === "BNB") {
        tx = await wallet.sendTransaction({ to: recipient, value: parseEther(amount) });
      } else {
        const contractAddress = sendToken === "USDT" ? USDT_CONTRACT_ADDRESS : USDC_CONTRACT_ADDRESS;
        const tokenContract = new Contract(contractAddress, ERC20_ABI, wallet);
        const decimals = await tokenContract.decimals();
        tx = await tokenContract.transfer(recipient, parseUnits(amount, decimals));
      }
      await tx.wait();
      await logTransaction(tx.hash);
      toast.success(<span><b>{sendToken} sent!</b><br/><a href={`https://testnet.bscscan.com/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer">View on BscScan</a></span>, { id: toastId, duration: 6000 });
      setAmount("");
      setRecipient("");
      fetchAllBalances(wallet.address);
      if(activeTab === 'history') {
        fetchHistory();
      }
    } catch (e) {
      console.error(e);
      toast.error("Transaction failed", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    if (!walletData) return;
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/history/${walletData.address}`);
      const data = await res.json();
      setHistory(data);
    } catch (e) {
      toast.error("Could not load history");
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "history" && walletData) {
      fetchHistory();
    }
  }, [activeTab, walletData]);

  if (!walletData) {
    return (
      <div className="app-pre-login">
        <Toaster position="top-center" toastOptions={{ className: 'toast-custom' }}/>
        <div className="login-box">
          <h1 className="title">🦊 CryptoNest</h1>
          <p className="subtitle">Your Simple & Secure BSC Wallet</p>
          <div className="pill-toggle">
            <span className={clsx({ active: mode === "create" })} onClick={() => setMode("create")}>Create Wallet</span>
            <span className={clsx({ active: mode === "fetch" })} onClick={() => setMode("fetch")}>Access Wallet</span>
          </div>
          <div className="input-group">
            <input placeholder="Wallet Name" value={walletName} onChange={(e) => setWalletName(e.target.value)} />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
            {mode === "create" && (<input type="password" placeholder="Confirm Password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />)}
          </div>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? "Loading..." : (mode === "create" ? "Create & Secure Wallet" : "Access My Wallet")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-logged-in">
      <Toaster position="top-center" toastOptions={{ className: 'toast-custom' }}/>
      {qrOpen && <QrModal address={walletData.address} onClose={() => setQrOpen(false)} />}
      <header className="app-header">
        <h1 className="title-small">🦊 CryptoNest</h1>
        <button className="btn btn-secondary" onClick={() => { setWalletData(null); setPassword('')}}>Lock Wallet</button>
      </header>
      <main className="app-main">
        <div className="wallet-sidebar">
          <Card title={`Wallet: ${walletData.name}`}>
            <div className="address-bar">
                <span>{`${walletData.address.slice(0, 6)}...${walletData.address.slice(-4)}`}</span>
                <button onClick={() => setQrOpen(true)} title="Show QR Code">📷</button>
                <button onClick={() => navigator.clipboard.writeText(walletData.address).then(() => toast.success('Address copied!'))} title="Copy Address">📋</button>
            </div>
          </Card>
          <Card title="Balances">
             <p className="balance-row"><strong>BNB:</strong> <span>{balance ? parseFloat(balance).toFixed(5) : "…"}</span></p>
             <p className="balance-row"><strong>USDT:</strong> <span>{usdtBalance ? parseFloat(usdtBalance).toFixed(2) : "…"}</span></p>
             <p className="balance-row"><strong>USDC:</strong> <span>{usdcBalance ? parseFloat(usdcBalance).toFixed(2) : "…"}</span></p>
             <button className="btn btn-secondary" style={{width: '100%', marginTop: '10px'}} onClick={() => fetchAllBalances(walletData.address)}>Refresh</button>
          </Card>
        </div>
        <div className="wallet-main">
            <div className="main-tabs">
                <button className={clsx('tab-btn', {active: activeTab === 'send'})} onClick={() => setActiveTab('send')}>🚀 Send</button>
                <button className={clsx('tab-btn', {active: activeTab === 'history'})} onClick={() => setActiveTab('history')}>📜 History</button>
                <button className={clsx('tab-btn', {active: activeTab === 'security'})} onClick={() => setActiveTab('security')}>🔐 Security</button>
            </div>
            <div className="tab-content">
                {activeTab === 'send' && ( <Card> <div className="input-group"> <label>Recipient Address</label> <input placeholder="0x..." value={recipient} onChange={(e) => setRecipient(e.target.value)} /> </div> <div className="input-group-row"> <div className="input-group"> <label>Amount</label> <input placeholder="0.0" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /> </div> <div className="input-group"> <label>Token</label> <select value={sendToken} onChange={(e) => setSendToken(e.target.value)}> <option value="BNB">BNB</option> <option value="USDT">USDT</option> <option value="USDC">USDC</option> </select> </div> </div> <button className="btn btn-primary" onClick={handleSend} disabled={loading}>{loading ? "Processing..." : `Send ${sendToken}`}</button> </Card> )}
                
                {activeTab === 'history' && (
                   <Card>
                     {historyLoading ? <p>Loading history...</p> : (
                       <ul className="history-list">
                         {history.length > 0 ? history.map(tx => {
                            const isSent = tx.from.toLowerCase() === walletData.address.toLowerCase();
                            const txDate = new Date(tx.timestamp);
                            return (
                              <li key={tx.hash}>
                                <div className={clsx('tx-direction', {sent: isSent, received: !isSent})}>{isSent ? 'OUT' : 'IN'}</div>
                                
                                {/* ✅ FIXED: Rewritten to match the requested format */}
                                <div className="tx-details">
                                  <p>
                                    <strong>Amount:</strong>
                                    {`${parseFloat(tx.amount).toFixed(4)} ${tx.tokenName}`}
                                  </p>
                                  <p>
                                    <strong>Date:</strong>
                                    {txDate.toLocaleDateString()}
                                  </p>
                                  <p>
                                    <strong>Time:</strong>
                                    {txDate.toLocaleTimeString()}
                                  </p>
                                  <p>
                                    <strong>{isSent ? 'To' : 'From'}:</strong>
                                    <span>{isSent ? tx.to : tx.from}</span>
                                  </p>
                                </div>
                                
                                <a href={`https://testnet.bscscan.com/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer" className="tx-link">View ↗</a>
                              </li>
                            )
                         }) : <p>No transactions found. Send a transaction to see it here!</p>}
                       </ul>
                     )}
                   </Card>
                )}

                {activeTab === 'security' && ( <Card title="Reveal Private key & Mnemonic"> <p className="warning-text">Only do this if you know what you are doing. Never share these with anyone.</p> <div className="input-group"> <label>Enter Your Wallet Password to Reveal</label> <input type="password" placeholder="********" value={revealInput} onChange={(e) => setRevealInput(e.target.value)} /> </div> <button className="btn btn-danger" onClick={() => { if(revealInput === password) setShowSensitive(p => !p); else toast.error("Incorrect password!") }}> {showSensitive ? "Hide Secrets" : "Reveal Secrets"} </button> {showSensitive && ( <div className="secrets-box"> <div className="input-group"> <label>Private Key</label> <textarea readOnly value={walletData.privateKey} rows={2} /> </div> <div className="input-group"> <label>Mnemonic Phrase</label> <textarea readOnly value={walletData.mnemonic} rows={3} /> </div> </div> )} </Card> )}
            </div>
        </div>
      </main>
    </div>
  );
}