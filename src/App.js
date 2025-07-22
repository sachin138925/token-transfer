import React, { useState } from "react";
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
import QRCode from "react-qr-code"; // 👈 Add QR Code import
import "./App.css";

const RPC_URL = "https://bsc-testnet-dataseed.bnbchain.org";
const USDT_CONTRACT_ADDRESS = "0x787A697324dbA4AB965C58CD33c13ff5eeA6295F";
const USDC_CONTRACT_ADDRESS = "0x342e3aA1248AB77E319e3331C6fD3f1F2d4B36B1";

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
];

const Card = ({ title, children }) => (
  <section className="card">
    {title && <h3>{title}</h3>}
    {children}
  </section>
);

export default function App() {
  const [mode, setMode] = useState("create");
  const [walletName, setWalletName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [revealInput, setRevealInput] = useState("");
  const [showSensitive, setShowSensitive] = useState(false);
  const [sending, setSending] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  const [walletData, setWalletData] = useState(null);
  const [balance, setBalance] = useState(null);
  const [usdtBalance, setUsdtBalance] = useState(null);
  const [usdcBalance, setUsdcBalance] = useState(null);

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [sendToken, setSendToken] = useState("BNB");
  const [lastSentTx, setLastSentTx] = useState("");

  const [txHash, setTxHash] = useState("");
  const [txReceipt, setTxReceipt] = useState(null);
  const [txAmount, setTxAmount] = useState("");

  const provider = new JsonRpcProvider(RPC_URL);

  const fetchBalance = async (addr) => {
    const bal = await provider.getBalance(addr);
    setBalance(formatEther(bal));
  };
  const getUSDTBalance = async (addr) => {
    const usdt = new Contract(USDT_CONTRACT_ADDRESS, ERC20_ABI, provider);
    const bal = await usdt.balanceOf(addr);
    const dec = await usdt.decimals();
    setUsdtBalance(formatUnits(bal, dec));
  };
  const getUSDCBalance = async (addr) => {
    const usdc = new Contract(USDC_CONTRACT_ADDRESS, ERC20_ABI, provider);
    const bal = await usdc.balanceOf(addr);
    const dec = await usdc.decimals();
    setUsdcBalance(formatUnits(bal, dec));
  };

  const handleSubmit = async () => {
    if (!walletName.trim() || !password.trim()) {
      toast.error("Fill all fields");
      return;
    }
    if (mode === "create" && password !== confirmPw) {
      toast.error("Passwords don’t match");
      return;
    }

    try {
      if (mode === "create") {
        const wallet = Wallet.createRandom();
        const payload = {
          name: walletName,
          address: wallet.address,
          privateKey: wallet.privateKey,
          mnemonic: wallet.mnemonic.phrase,
          password,
        };
        const res = await fetch("http://localhost:5000/api/wallet", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          toast.success("Wallet created & saved");
          setWalletName(""); setPassword(""); setConfirmPw("");
        } else {
          const msg = await res.text();
          toast.error(msg || "Save failed");
        }
      } else {
        const res = await fetch(`http://localhost:5000/api/wallet/${walletName}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        const data = await res.json();
        if (data.error) {
          toast.error(data.error);
        } else {
          setWalletData(data);
          fetchBalance(data.address);
          getUSDTBalance(data.address);
          getUSDCBalance(data.address);
        }
      }
    } catch (e) {
      toast.error("Network error");
    }
  };

  const handleSend = async () => {
    if (!walletData) return toast.error("Load wallet first");
    if (!isAddress(recipient)) return toast.error("Invalid address");
    if (!amount || parseFloat(amount) <= 0) return toast.error("Invalid amount");

    setSending(true);
    try {
      const wallet = new Wallet(walletData.privateKey, provider);
      let tx;
      if (sendToken === "BNB") {
        tx = await wallet.sendTransaction({ to: recipient, value: parseEther(amount) });
      } else if (sendToken === "USDT") {
        const usdt = new Contract(USDT_CONTRACT_ADDRESS, ERC20_ABI, wallet);
        const decimals = await usdt.decimals();
        tx = await usdt.transfer(recipient, parseUnits(amount, decimals));
      } else if (sendToken === "USDC") {
        const usdc = new Contract(USDC_CONTRACT_ADDRESS, ERC20_ABI, wallet);
        const decimals = await usdc.decimals();
        tx = await usdc.transfer(recipient, parseUnits(amount, decimals));
      }
      await tx.wait();
      toast.success(`${sendToken} sent: ${tx.hash}`);
      setLastSentTx(tx.hash);
      setAmount("");
      fetchBalance(wallet.address);
      getUSDTBalance(wallet.address);
      getUSDCBalance(wallet.address);
    } catch (e) {
      toast.error("Transaction failed");
    } finally {
      setSending(false);
    }
  };

  const fetchReceipt = async () => {
    const trimmed = txHash.trim();
    if (!/^0x([A-Fa-f0-9]{64})$/i.test(trimmed)) {
      toast.error("Invalid transaction hash");
      return;
    }
    try {
      const res = await fetch(`http://localhost:5000/api/tx/${trimmed}`);
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
        return;
      }
      setTxReceipt({
        hash: data.hash,
        blockNumber: data.blockNumber,
        status: data.status,
        gasUsed: data.gasUsed,
        from: data.from,
        to: data.to,
      });
      setTxAmount(data.amountSent);
    } catch (e) {
      toast.error("Error fetching receipt");
    }
  };

  return (
    <div className="app">
      <Toaster position="top-center" />
      <h1 className="title">🦊 CryptoNest</h1>

      <section className="card">
        <div className="inputRow">
          <div className="pillToggle">
            <span className={clsx({ active: mode === "create" })} onClick={() => setMode("create")}>Create</span>
            <span className={clsx({ active: mode === "fetch" })} onClick={() => setMode("fetch")}>Fetch</span>
          </div>
          <input placeholder="Wallet Name" value={walletName} onChange={(e) => setWalletName(e.target.value)} />
          <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {mode === "create" && (
            <input type="password" placeholder="Confirm" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
          )}
        </div>
        <button className="btn" onClick={handleSubmit}>
          {mode === "create" ? "Generate & Save" : "Fetch Wallet"}
        </button>
      </section>

      {walletData && (
        <>
          <Card title="🔐 Wallet Details">
            <p><strong>Name:</strong> {walletData.name}</p>
            <p>
              <strong>Address:</strong>{" "}
              <a
                href={`https://testnet.bscscan.com/address/${walletData.address}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {walletData.address}
              </a>
            </p>
            <p><strong>BNB Balance:</strong> {balance ?? "…"} BNB</p>
            <p><strong>USDT Balance:</strong> {usdtBalance ?? "…"} USDT</p>
            <p><strong>USDC Balance:</strong> {usdcBalance ?? "…"} USDC</p>

            <button className="btn" onClick={() => setQrOpen(!qrOpen)}>
  {qrOpen ? "Hide QR Code" : "Show QR Code"}
</button>
{qrOpen && (
  <div style={{ marginTop: "1rem" }}>
    <strong></strong>
    <div style={{ background: "white", padding: "10px", display: "inline-block", marginTop: "1.0rem" }}>
      <QRCode value={walletData.address} size={128} />
    </div>
  </div>
)}
          </Card>

          <Card title="👁 Reveal Private key and Mnemonic">
            <div className="inputRow">
              <input
                type="password"
                placeholder="Enter password"
                value={revealInput}
                onChange={(e) => setRevealInput(e.target.value)}
              />
              <button className="btn" onClick={() => setShowSensitive((p) => !p)}>
                {showSensitive ? "Hide" : "Reveal"}
              </button>
            </div>

            {showSensitive && (
              <div className="secretsBox">
                <p><strong>Private Key:</strong></p>
                <textarea rows={2} readOnly value={walletData.privateKey} />
                <p style={{ marginTop: "0.8rem" }}><strong>Mnemonic:</strong></p>
                <textarea rows={2} readOnly value={walletData.mnemonic} />
              </div>
            )}
          </Card>

          <Card title="🚀 Send Tokens">
            <div className="inputRow">
              <input placeholder="Recipient Address" value={recipient} onChange={(e) => setRecipient(e.target.value)} />
            </div>
            <div className="inputRow">
              <input placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <select value={sendToken} onChange={(e) => setSendToken(e.target.value)}>
                <option value="BNB">BNB</option>
                <option value="USDT">USDT</option>
                <option value="USDC">USDC</option>
              </select>
            </div>
            <button className="btn" onClick={handleSend} disabled={sending}>
              {sending ? "Sending…" : `Send ${sendToken}`}
            </button>
            {lastSentTx && (
              <p style={{ marginTop: "0.5rem", fontSize: "0.9rem" }}>
                Last tx:{" "}
                <a
                  href={`https://testnet.bscscan.com/tx/${lastSentTx}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {lastSentTx}
                </a>
              </p>
            )}
          </Card>

          <Card title="🔍 Verify Any Transaction">
            <div className="inputRow">
              <input
                placeholder="Paste transaction hash"
                value={txHash}
                onChange={(e) => {
                  setTxHash(e.target.value.trim());
                  setTxReceipt(null);
                  setTxAmount("");
                }}
              />
              <button className="btn" onClick={fetchReceipt}>Lookup</button>
            </div>

            {txReceipt && (
              <div style={{ marginTop: "0.8rem", fontSize: "0.9rem" }}>
                <p>
                  <strong>Hash:</strong>{" "}
                  <a
                    href={`https://testnet.bscscan.com/tx/${txReceipt.hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {txReceipt.hash}
                  </a>
                </p>
                <p><strong>Block:</strong> #{txReceipt.blockNumber}</p>
                <p><strong>Status:</strong> {Number(txReceipt.status) === 1 ? "✅ Success" : "❌ Reverted"}</p>
                <p><strong>Gas used:</strong> {txReceipt.gasUsed.toString()}</p>
                <p><strong>From:</strong> {txReceipt.from}</p>
                <p><strong>To:</strong> {txReceipt.to}</p>
                <p><strong>Amount sent:</strong> {txAmount}</p>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
