"use client";

import React, { useState, useEffect } from "react";
import { FaMobileAlt, FaEye, FaCircle, FaChevronLeft, FaSearch, FaFingerprint, FaUser, FaSkull, FaShoppingCart, FaTasks, FaKey } from "react-icons/fa";
import { FaLocationPin, FaShield } from "react-icons/fa6";
import {
  PhoneAppId,
  PhoneAppEpisodeData,
  PHONE_APPS,
  EpisodePhoneConfig,
  DEFAULT_PHONE_CONFIG,
  CameraEntry,
  CryptoTransaction,
} from "./phoneApps";
import { useWalletBalance } from "./playerStats";
import { darkwebItems, darkwebMissions } from "./darkwebData";

// ─── Types re-exported for convenience ───────────────────────────────────────
/** The currently active phone app, or null for the home screen */
export type PhoneApp = PhoneAppId | null;

export interface PhonePanelProps {
  phoneOpen: boolean;
  setPhoneOpen: (open: boolean) => void;
  phoneActiveApp: PhoneApp;
  setPhoneActiveApp: (app: PhoneApp) => void;
  /** Episode phone config loaded from meta.json — defaults to disabled */
  phoneConfig?: EpisodePhoneConfig;
}

// ─── PhoneBar ─────────────────────────────────────────────────────────────────
export function PhoneBar({
  phoneOpen,
  setPhoneOpen,
  setPhoneActiveApp,
  phoneConfig = DEFAULT_PHONE_CONFIG,
}: Omit<PhonePanelProps, "phoneActiveApp">) {
  const handleClick = () => {
    if (!phoneConfig.enabled) return; // phone disabled in this episode
    if (phoneOpen) {
      setPhoneOpen(false);
      setPhoneActiveApp(null);
    } else {
      setPhoneOpen(true);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-[60]">
      <div className="bg-white/10 backdrop-blur-2xl rounded-2xl px-3 py-2 border border-white/20 shadow-2xl">
        <div className="flex items-end gap-2">
          <div
            onClick={handleClick}
            className={`w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl transition-all ${
              !phoneConfig.enabled
                ? "opacity-30 cursor-not-allowed bg-gradient-to-br from-gray-600 to-gray-800"
                : phoneOpen
                ? "cursor-pointer hover:scale-110 bg-gradient-to-br from-emerald-400 to-teal-600 shadow-[0_0_14px_rgba(52,211,153,0.6)]"
                : "cursor-pointer hover:scale-110 bg-gradient-to-br from-emerald-500 to-teal-700"
            }`}
            title={phoneConfig.enabled ? "Telefon" : "Bu bölümde telefon kullanılamıyor"}
          >
            <FaMobileAlt />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── PhonePanel ───────────────────────────────────────────────────────────────
export function PhonePanel({
  phoneOpen,
  setPhoneOpen,
  phoneActiveApp,
  setPhoneActiveApp,
  phoneConfig = DEFAULT_PHONE_CONFIG,
}: PhonePanelProps) {
  const [notifications, setNotifications] = useState<Array<{id: string, app: string, message: string}>>([]);
  const [leavingNotifs, setLeavingNotifs] = useState<string[]>([]);
  const [isVpnActive, setIsVpnActive] = useState(false);
  const pendingNotifsCountRef = React.useRef(0);
  const openedByNotificationRef = React.useRef(false);
  const phoneOpenRef = React.useRef(phoneOpen);

  // MDT States
  const [mdtSearchTerm, setMdtSearchTerm] = useState("");
  const [mdtResults, setMdtResults] = useState<Array<any> | null>(null);
  const [mdtSearching, setMdtSearching] = useState(false);

  // Live CryptoWallet Transactions — loaded from localStorage + live events
  const [liveTransactions, setLiveTransactions] = useState<CryptoTransaction[]>(() => {
    // Pre-populate from persisted history on mount
    try {
      return JSON.parse(localStorage.getItem('pz_tx_history') || '[]');
    } catch {
      return [];
    }
  });

  // Keep in sync if episode changes (appData.transactions stays as fallback for meta.json entries)
  useEffect(() => {
    const metaTxs = phoneConfig?.appData?.CryptoWallet?.transactions || [];
    const storedTxs: CryptoTransaction[] = (() => {
      try { return JSON.parse(localStorage.getItem('pz_tx_history') || '[]'); } catch { return []; }
    })();
    // Merge: stored first (most recent), then any meta.json ones not already present
    const storedIds = new Set(storedTxs.map(t => t.id));
    const merged = [...storedTxs, ...metaTxs.filter(t => !storedIds.has(t.id))];
    setLiveTransactions(merged);
  }, [phoneConfig?.appData?.CryptoWallet?.transactions]);

  // Listen for live transactions pushed from story log
  useEffect(() => {
    const handleLiveTx = (e: any) => {
      const newTx = e.detail as CryptoTransaction;
      setLiveTransactions((prev) => {
        // Avoid duplicates if event fires multiple times
        if (prev.some(t => t.id === newTx.id)) return prev;
        return [newTx, ...prev];
      });
    };

    window.addEventListener('phone_crypto_tx', handleLiveTx);
    return () => {
      window.removeEventListener('phone_crypto_tx', handleLiveTx);
    };
  }, []);

  useEffect(() => {
    phoneOpenRef.current = phoneOpen;
  }, [phoneOpen]);

  useEffect(() => {
    const handleNotify = (e: Event) => {
      const customEvent = e as CustomEvent;
      const newNotif = { id: Math.random().toString(), ...customEvent.detail };
      
      // 1. Mark that we have an active process and open phone immediately
      pendingNotifsCountRef.current += 1;
      
      const wasAlreadyOpen = phoneOpenRef.current;

      // If the phone was closed prior to this notification, remember it was opened automatically
      if (!wasAlreadyOpen) {
        openedByNotificationRef.current = true;
      }
      setPhoneOpen(true);

      const showDelay = wasAlreadyOpen ? 0 : 1000;

      // 2. Wait depending on if phone was open, then show notification
      setTimeout(() => {
        setNotifications(prev => [...prev, newNotif]);

        // 3. Keep notification visible for 4s, then trigger slide-out animation
        setTimeout(() => {
          setLeavingNotifs(prev => [...prev, newNotif.id]);

          // Wait 300ms for slide-out animation to finish before removing from array
          setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== newNotif.id));
            setLeavingNotifs(prev => prev.filter(id => id !== newNotif.id));
            
            // Mark process as finished
            pendingNotifsCountRef.current -= 1;
          }, 300);

        }, 4000);

      }, showDelay);
    };

    window.addEventListener('phone_notify', handleNotify);
    return () => {
      window.removeEventListener('phone_notify', handleNotify);
    };
  }, [setPhoneOpen]);

  // Handle auto-closing: when notifications array empties, if no app is active, wait 1s then close.
  useEffect(() => {
    let autoCloseTimer: NodeJS.Timeout;

    // We MUST check pendingNotifsCountRef.current === 0, otherwise right after we open the phone (before 1s delay)
    // the notifications array is empty and it triggers a close immediately!
    if (
      pendingNotifsCountRef.current === 0 && 
      notifications.length === 0 && 
      phoneActiveApp === null && 
      phoneOpen && 
      openedByNotificationRef.current
    ) {
      autoCloseTimer = setTimeout(() => {
         // double check to ensure no new notification arrived during this 1s interval
         if (pendingNotifsCountRef.current === 0) {
            setPhoneOpen(false);
            openedByNotificationRef.current = false;
         }
      }, 1000);
    }

    return () => clearTimeout(autoCloseTimer);
  }, [notifications.length, phoneActiveApp, phoneOpen, setPhoneOpen]);

  // Reset origin state if phone closes manually
  useEffect(() => {
    if (!phoneOpen) {
      openedByNotificationRef.current = false;
    }
  }, [phoneOpen]);

  const handleHomeBar = () => {
    if (phoneActiveApp !== null) {
      setPhoneActiveApp(null);
    } else {
      setPhoneOpen(false);
    }
  };

  // The apps to show on the home grid (all apps)
  const availableApps = Object.values(PHONE_APPS);

  return (
    <div
      className={`fixed top-0 right-0 h-full z-50 flex items-center pr-6 transition-transform duration-300 ease-in-out font-sans ${
        phoneOpen ? "translate-x-0" : "translate-x-[120%]"
      }`}
    >
      {/* Outer phone shell */}
      <div className="relative w-[420px] h-[820px] bg-[#0a0a0f] rounded-[52px] border-[3px] border-[#2a2a3a] shadow-[0_0_80px_rgba(0,0,0,0.18),inset_0_0_40px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden">
        {/* Side buttons (decorative) */}
        <div className="absolute -left-[5px] top-[120px] w-[3px] h-[44px] bg-[#1a1a2a] rounded-l-full" />
        <div className="absolute -left-[5px] top-[175px] w-[3px] h-[70px] bg-[#1a1a2a] rounded-l-full" />
        <div className="absolute -right-[5px] top-[150px] w-[3px] h-[80px] bg-[#1a1a2a] rounded-r-full" />

        {/* Status Bar */}
        <div className="flex-none px-7 pt-5 pb-1 flex items-center justify-between">
          <span className="text-white/80 text-[14px] font-semibold font-mono tracking-tight">
            {new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
          </span>
          {/* Notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[100px] h-[30px] bg-[#0a0a0f] rounded-b-[20px] flex items-center justify-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#1a1a2a] border border-[#2a2a3a]" />
            <div className="w-[6px] h-[6px] rounded-full bg-[#0d4d3a]" />
          </div>
          {/* Signal / Battery */}
          <div className="flex items-center gap-1 text-white/70">
            {isVpnActive ? (
              <div className="flex items-center gap-1">
                <FaKey className="text-[14px] text-white/80" />
                <span className="text-[11px] font-sans font-bold text-white/80">VPN</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <div className="flex items-end gap-[2px] h-3">
                  {[2, 3, 4, 5].map((h) => (
                    <div key={h} className="w-[3px] bg-white/80 rounded-sm" style={{ height: `${h * 2}px` }} />
                  ))}
                </div>
                <div className="text-[10px] font-sans">5G</div>
              </div>
            )}
            <div className="flex items-center gap-[2px] ml-1">
              <div className="w-[20px] h-[10px] border border-white/60 rounded-[2px] flex items-center px-[1px]">
                <div className="h-[7px] w-[14px] bg-emerald-400 rounded-[1px]" />
              </div>
              <div className="w-[2px] h-[5px] bg-white/40 rounded-r-sm" />
            </div>
          </div>
        </div>

        {/* Notifications Overlay */}
        <div className="absolute top-12 left-0 right-0 z-[60] flex flex-col items-center gap-2 px-4 pointer-events-none">
          {notifications.map(n => {
            const isLeaving = leavingNotifs.includes(n.id);
            const appInfo = PHONE_APPS[n.app as PhoneAppId];
            return (
              <div 
                key={n.id} 
                className={`bg-[#888888]/20 backdrop-blur-md border border-white/10 w-full rounded-2xl p-4 shadow-2xl pointer-events-auto flex items-start flex-col ${
                  isLeaving ? "animate-slide-up-out" : "animate-slide-down-in"
                }`}
              >
                <div className="flex items-center gap-2 w-full mb-1">
                  <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] text-white/80 ${appInfo ? `bg-gradient-to-br ${appInfo.iconBg}` : 'bg-white/10'}`}>
                    {appInfo ? <appInfo.icon /> : "❖"}
                  </span>
                  <span className="text-white/90 font-semibold text-[13px]">{appInfo ? appInfo.label : n.app}</span>
                  <span className="text-white/40 text-[11px] ml-auto font-sans">şimdi</span>
                </div>
                <p className="text-white/80 text-[13px] leading-tight mt-1">{n.message}</p>
              </div>
            );
          })}
        </div>

        {/* Screen Content */}
        <div className="flex-1 overflow-hidden px-5 pt-2 mt-5">
          {phoneActiveApp === null ? (
            /* ── Home Screen ── */
            <div className="h-full flex flex-col">
              {/* App Grid — dynamic from episode config */}
              <div className="grid grid-cols-4 gap-5 px-2">
                {availableApps.map((app) => {
                  const appData = phoneConfig.appData?.[app.id];
                  const isLocked = appData?.locked ?? false;
                  const label = appData?.label ?? app.label;

                  return (
                    <div
                      key={app.id}
                      className={`flex flex-col items-center gap-2 ${isLocked ? "opacity-40 cursor-not-allowed" : "cursor-pointer group"}`}
                      onClick={() => {
                        if (isLocked) return;
                        if (app.id === "Darkweb" && !isVpnActive) {
                          window.dispatchEvent(new CustomEvent('phone_notify', { 
                            detail: { app: "Darkweb", message: "Bağlantı güvensiz. Darkweb'e erişim reddedildi." } 
                          }));
                          return;
                        }
                        setPhoneActiveApp(app.id);
                      }}
                    >
                      <div className={`w-[68px] h-[68px] bg-gradient-to-br ${app.iconBg} rounded-[18px] flex items-center justify-center text-white text-3xl shadow-lg border border-white/10 ${!isLocked ? "group-hover:scale-110 transition-transform" : ""}`}>
                        <app.icon />
                      </div>
                      <span className="text-white/70 text-[12px] font-medium truncate w-full text-center">{label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ── Active App Screen ── */
            <AppScreen
              appId={phoneActiveApp}
              appData={phoneConfig.appData?.[phoneActiveApp]}
              liveTransactions={liveTransactions}
              isVpnActive={isVpnActive}
              setIsVpnActive={setIsVpnActive}
            />
          )}
        </div>

        {/* Home Indicator */}
        <div
          className="flex-none pb-4 pt-2 flex justify-center cursor-pointer group"
          onClick={handleHomeBar}
        >
          <div className="w-28 h-1.5 bg-white/25 rounded-full group-hover:bg-white/50 group-active:scale-95 transition-all" />
        </div>
      </div>
    </div>
  );
}

// ─── App Screen Router ────────────────────────────────────────────────────────


interface AppScreenProps {
  appId: PhoneAppId;
  appData?: PhoneAppEpisodeData;
  liveTransactions?: CryptoTransaction[];
  isVpnActive?: boolean;
  setIsVpnActive?: (active: boolean) => void;
}

function AppScreen({ appId, appData, liveTransactions = [], isVpnActive, setIsVpnActive }: AppScreenProps) {
  switch (appId) {
    case "OmniWatch":
      return (
        <OmniWatchScreen
          cameras={appData?.cameras ?? []}
          requiredIp={appData?.requiredIp}
        />
      );
    case "CryptoWallet":
      return (
        <CryptoWalletScreen
          balanceOverride={appData?.balance}
          transactions={liveTransactions}
        />
      );
    case "MDT":
      return <MdtScreen records={appData?.records} />;
    case "Darkweb":
      return <DarkwebScreen />;
    case "VPN":
      return <VpnScreen isVpnActive={isVpnActive!} setIsVpnActive={setIsVpnActive!} />;
    case "EchoTrace":
      return <EchoTraceScreen />;
    default:
      return (
        <div className="h-full flex items-center justify-center">
          <p className="text-white/30 text-[11px] font-sans">Uygulama bulunamadı</p>
        </div>
      );
  }
}

// ─── Individual App Screens ───────────────────────────────────────────────────

function OmniWatchScreen({
  cameras,
  requiredIp,
}: {
  cameras: CameraEntry[];
  requiredIp?: string;
}) {
  const [ipInput, setIpInput] = useState("");
  const [authenticated, setAuthenticated] = useState(!requiredIp);
  const [error, setError] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [selected, setSelected] = useState<CameraEntry | null>(null);

  const handleConnect = () => {
    if (!requiredIp || ipInput.trim() === requiredIp) {
      setConnecting(true);
      setError(false);
      setTimeout(() => {
        setConnecting(false);
        setAuthenticated(true);
      }, 1200);
    } else {
      setError(false);
      // Small timeout to allow React to flush the false state before setting true again, 
      // guaranteeing the animation restarts even if they spam enter
      setTimeout(() => setError(true), 10);
    }
  };

  // ── IP Gate screen ──
  if (!authenticated) {
    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <span className="text-rose-400 text-[14px] font-sans tracking-widest">OmniWatch</span>
          <div className="flex items-center gap-1.5">
            <FaCircle className="text-rose-900 text-[7px]" />
            <span className="text-rose-900/80 text-[13px] font-mono">BAĞLI DEĞİL</span>
          </div>
        </div>

        {/* Gate panel */}
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-2">
          {/* Eye icon */}
          <div className="relative">
            <div className="w-20 h-20 rounded-[24px] bg-rose-500/10 border border-rose-900/50 flex items-center justify-center">
              <FaEye className="text-rose-500/40 text-4xl" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-rose-900 border-2 border-[#0a0a0f] flex items-center justify-center">
              <FaCircle className="text-rose-700 text-[6px]" />
            </div>
          </div>

          <div className="text-center">
            <p className="text-white/60 text-[15px] font-mono mb-1">Sunucu Bağlantısı</p>
            <p className="text-white/30 text-[12px] font-sans">Hedef IP adresini girin</p>
          </div>

          {/* IP input */}
          <div
            className={`w-full ${error ? "animate-shake" : ""}`}
            onAnimationEnd={() => setError(false)}
          >
            <div className={`flex items-center gap-2 bg-[#0d0d18] border ${
              error ? "border-rose-500" : "border-white/10 focus-within:border-rose-500/60"
            } rounded-xl px-4 py-3 transition-colors`}>
              <span className="text-rose-500/50 font-mono text-[14px] select-none">IP://</span>
              <input
                type="text"
                value={ipInput}
                onChange={(e) => setIpInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleConnect()}
                placeholder="000.00.00.00"
                className="flex-1 bg-transparent text-white font-mono text-[15px] placeholder:text-white/20 outline-none"
                spellCheck={false}
                autoComplete="off"
              />
            </div>
            {error && (
              <p className="text-rose-500 text-[12px] font-mono mt-1.5 text-center">Hatalı IP adresi — erişim reddedildi</p>
            )}
          </div>

          {/* Connect button */}
          <button
            onClick={handleConnect}
            disabled={connecting || !ipInput.trim()}
            className="w-full py-3.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-900/60 hover:border-rose-500/50 text-rose-400 text-[14px] font-sans tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {connecting ? (
              <span className="flex items-center justify-center gap-2">
                <FaCircle className="text-[6px] animate-pulse" />
                BAĞLANIYOR...
              </span>
            ) : (
              "BAĞLAN"
            )}
          </button>
        </div>
      </div>
    );
  }

  if (selected) {
    // ── Detail view ──
    return (
      <div className="h-full flex flex-col gap-2">
        {/* Header */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelected(null)}
            className="text-rose-400/70 hover:text-rose-400 transition-colors"
          >
            <FaChevronLeft className="text-[14px]"/>
          </button>
          <span className="text-rose-400 text-[14px] font-sans tracking-widest flex-1">OmniWatch</span>
          <span className="text-white/30 text-[12px] font-mono">{selected.id}</span>
        </div>

        {/* Fake camera viewfinder */}
        <div className="relative bg-[#080810] rounded-2xl border border-rose-900/40 overflow-hidden" style={{ height: 200 }}>
          {/* Scan-line grid overlay */}
          <div className="absolute inset-0"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg, transparent, transparent 7px, rgba(220,38,38,0.04) 8px)",
            }}
          />
          {/* Corner brackets */}
          <div className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-rose-500/50 rounded-tl" />
          <div className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-rose-500/50 rounded-tr" />
          <div className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 border-rose-500/50 rounded-bl" />
          <div className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-rose-500/50 rounded-br" />
          {/* Scanline animation */}
          <div className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-rose-500/40 to-transparent animate-[scanline_3s_linear_infinite]" />
          {/* Center watermark */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            <FaEye className="text-rose-500/20 text-4xl" />
            <span className="text-rose-500/30 text-[12px] font-mono tracking-widest">CANLI YAYIM</span>
          </div>
          {/* Status badge */}
          <div className="absolute top-2.5 right-10 flex items-center gap-1">
            <FaCircle className="text-rose-500 text-[7px] animate-pulse" />
            <span className="text-rose-400 text-[13px] font-mono">REC</span>
          </div>
        </div>

        {/* Camera info */}
        <div className="bg-[#0d0d18] rounded-2xl border border-white/5 p-4 flex flex-col gap-2">
          <p className="text-white/80 text-[16px] font-semibold leading-tight">{selected.name}</p>
          <p className="text-rose-400/70 text-[12px] font-mono">{selected.street}</p>
        </div>

        {/* Feed description */}
        <div className="flex-1 bg-[#0d0d18]/60 rounded-2xl border border-white/5 p-4 overflow-y-auto">
          <p className="text-white/30 text-[12px] font-mono uppercase tracking-widest mb-2">KAMERA GÖRÜNTÜSÜ</p>
          <p className="text-white/65 text-[15px] leading-relaxed">{selected.feed}</p>
        </div>
      </div>
    );
  }

  // ── Camera list view ──
  return (
    <div className="h-full flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-rose-400 text-[14px] font-sans tracking-widest">OmniWatch</span>
        <div className="flex items-center gap-1">
          <FaCircle className="text-rose-500 text-[7px] animate-pulse" />
          <span className="text-rose-400/60 text-[13px] font-mono">BAĞLI</span>
        </div>
      </div>

      {/* Camera list */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-rose-500/30 hover:scrollbar-thumb-rose-500/60 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-rose-500/30 [&::-webkit-scrollbar-thumb]:rounded-full">
        {cameras.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-white/20 text-[12px] font-sans">Bu bölüm için kamera verisi yok</p>
          </div>
        ) : (
          cameras.map((cam) => (
            <button
              key={cam.id}
              onClick={() => setSelected(cam)}
              className="w-full text-left bg-[#0d0d18] hover:bg-[#141420] border border-rose-900/30 hover:border-rose-500/40 rounded-xl px-4 py-3.5 transition-all group"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-rose-400/70 text-[13px] font-mono">{cam.id}</span>
                <FaCircle className="text-rose-500/60 text-[7px] animate-pulse" />
              </div>
              <p className="text-white/80 text-[14px] font-mono leading-tight truncate">{cam.name}</p>
              <p className="text-white/35 text-[12px] font-mono mt-1 truncate">{cam.street}</p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function MdtScreen({ records = [] }: { records?: Array<any> }) {
  const [mdtSearchTerm, setMdtSearchTerm] = useState("");
  const [mdtResults, setMdtResults] = useState<Array<any> | null>(null);
  const [mdtSearching, setMdtSearching] = useState(false);

  const handleMdtSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mdtSearchTerm.trim()) return;

    setMdtSearching(true);
    setMdtResults(null);

    // Simulate network request delay
    setTimeout(() => {
      const query = mdtSearchTerm.toLowerCase().trim();
      
      const matched = records.filter((r: any) => 
        (r.firstName && r.firstName.toLowerCase().includes(query)) ||
        (r.lastName && r.lastName.toLowerCase().includes(query)) ||
        (r.idNumber && r.idNumber.includes(query))
      );

      setMdtResults(matched);
      setMdtSearching(false);
    }, 600);
  };

  return (
    <div className="h-full flex flex-col gap-2">
      <div className="flex items-center gap-2 px-1">
        <h3 className="text-blue-500/90 font-sans text-[14px]">MDT</h3>
      </div>

      <div className="flex-1 bg-[#0a0f1a] rounded-xl border border-blue-900/40 p-3 flex flex-col gap-3 font-mono relative overflow-hidden">
        
        {/* Header */}
        <div className="w-full text-center border-b border-blue-900/50 pb-2">
          <h4 className="text-blue-400 font-bold tracking-widest text-[12px]">MOBİLE DATA TERMİNAL</h4>
        </div>

        {/* Search Form */}
        <form onSubmit={handleMdtSearch} className="flex flex-col gap-2 relative z-10">

          <div className="flex items-center gap-2 bg-[#05080f] border border-blue-800/40 focus-within:border-blue-500/60 rounded px-2 py-1.5 transition-colors">
            <FaSearch className="text-blue-500/50 text-[12px]" />
            <input 
              type="text" 
              value={mdtSearchTerm}
              onChange={(e) => setMdtSearchTerm(e.target.value)}
              placeholder="İsim, soyisim veya Kimlik No girin.."
              className="bg-transparent outline-none text-white/90 text-[12px] w-full"
            />
          </div>
          <button 
            type="submit" 
            disabled={mdtSearching || !mdtSearchTerm.trim()}
            className="bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 text-[12px] py-1.5 rounded transition-colors disabled:opacity-50"
          >
            {mdtSearching ? "SORGULANIYOR..." : "SORGULA"}
          </button>
        </form>

        {/* Results Area */}
        <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] mt-1 border-t border-blue-900/30 pt-2 relative z-10">
          {mdtSearching ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 opacity-50">
              <span className="text-blue-400 text-[10px] animate-pulse">Veriler çekiliyor...</span>
            </div>
          ) : mdtResults !== null ? (
            mdtResults.length > 0 ? (
              <div className="flex flex-col gap-3">
                <p className="text-blue-400 text-[10px] mb-1">{mdtResults.length} KAYIT BULUNDU</p>
                {mdtResults.map((record: any, idx) => {
                  if (record.isHacker) {
                    return (
                      <div key={idx} className="bg-black border-2 border-rose-600/50 rounded flex flex-col divide-y divide-rose-900/50 relative overflow-hidden group">
                        {/* Hacker Scanline effect */}
                        <div className="absolute inset-x-0 h-[2px] bg-rose-500/20 animate-[scanline_2s_linear_infinite]" />
                        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSc0JyBoZWlnaHQ9JzQnPgo8cmVjdCB3aWR0aD0nNCcgaGVpZ2h0PSc0JyBmaWxsPSdibGFjaycvPgo8cmVjdCB3aWR0aD0nNCcgaGVpZ2h0PScxJyBmaWxsPSdyZ2JhKDI1NSwgMCwgMCwgMC4xNSknLz4KPC9zdmc+')] opacity-50 pointer-events-none" />

                        <div className="p-3 flex gap-3 items-center bg-rose-900/10 relative z-10">
                          <div className="w-14 h-16 bg-black border border-rose-500/50 rounded flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(225,29,72,0.4)]">
                            <FaSkull className="text-rose-500/80 text-3xl animate-pulse" />
                          </div>
                          <div className="flex flex-col flex-1">
                            <div className="flex justify-between items-start">
                               <span className="text-rose-500 font-bold text-[14px] leading-tight drop-shadow-[0_0_5px_rgba(225,29,72,0.8)] tracking-wider">
                                  {record.firstName} {record.lastName}
                               </span>
                            </div>
                            <span className="text-rose-400/80 text-[10px] font-mono mt-0.5 tracking-widest">[ ŞİFRELENMİŞ KİMLİK ]</span>
                          </div>
                        </div>

                        <div className="p-3 flex flex-col gap-2 text-[11px] relative z-10 font-mono">
                          <div className="bg-rose-900/20 border border-rose-500/30 p-2 rounded text-center mb-1">
                             <span className="text-rose-500 text-[12px] font-bold tracking-widest animate-pulse">BAĞLANTI REDDEDİLDİ</span>
                          </div>
                          
                          <div className="flex justify-between items-center pb-1 text-[11px]">
                            <span className="text-rose-400/60">D.Tarihi:</span> 
                            <span className="text-rose-400 bg-rose-900/30 px-1">*** REDACTED ***</span>
                          </div>
                          <div className="flex justify-between items-center pb-1 text-[11px]">
                            <span className="text-rose-400/60">Cinsiyet:</span> 
                            <span className="text-rose-400 bg-rose-900/30 px-1">*** REDACTED ***</span>
                          </div>
                          <div className="flex justify-between items-center pb-1 text-[11px]">
                            <span className="text-rose-400/60">Meslek:</span> 
                            <span className="text-rose-400 bg-rose-900/30 px-1">*** REDACTED ***</span>
                          </div>
                          <div className="flex flex-col gap-0.5 mt-1">
                            <span className="text-rose-400/60">Adres:</span> 
                            <span className="text-rose-500 font-bold tracking-widest filter blur-[2px] group-hover:blur-[1px] transition-all">
                               BILINMEYEN_AĞ_DÜĞÜMÜ
                            </span>
                          </div>

                          <div className="flex flex-col items-center justify-center mt-2 pt-2 border-t border-rose-500/40">
                             <span className="text-[11px] text-rose-500/60 uppercase tracking-[0.2em]">Sistem İhlali Tespit Edildi</span>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return (
                  <div key={idx} className="bg-[#05080f] border border-blue-900/50 rounded flex flex-col divide-y divide-blue-900/30">
                    <div className="p-2 flex gap-3 items-center bg-blue-900/10">
                      <div className="w-14 h-16 bg-gradient-to-b from-blue-800/20 to-blue-900/40 border border-blue-500/30 rounded flex items-center justify-center shrink-0 shadow-inner">
                        <FaUser className="text-blue-400/50 text-2xl" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-white font-bold text-[14px] leading-tight">{record.firstName} {record.lastName}</span>
                        <span className="text-blue-400/80 text-[10px] font-mono mt-0.5">{record.idNumber}</span>
                      </div>
                    </div>
                    <div className="p-2 flex flex-col gap-1.5 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-white/40">D.Tarihi:</span> <span className="text-white/80">{record.dob}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/40">Cinsiyet:</span> <span className="text-white/80">{record.gender}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-white/40">Meslek:</span> <span className="text-white/80">{record.job}</span>
                      </div>
                      <div className="flex flex-col gap-0.5 mt-1">
                        <span className="text-white/40">Adres:</span> 
                        <span className="text-white/80 leading-snug">{record.address}</span>
                      </div>
                      
                      {(record.criminalRecord?.length > 0) && (
                        <div className="flex flex-col gap-0.5 mt-1.5 pt-1.5 border-t border-rose-900/30">
                          <span className="text-rose-400 font-bold mb-0.5">SABIKA KAYDI:</span> 
                          <ul className="list-disc list-inside text-rose-300">
                            {record.criminalRecord.map((c: string, i: number) => (
                              <li key={i}>{c}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="flex flex-col gap-0.5 mt-1.5 pt-1.5 border-t border-blue-900/30">
                        <span className="text-blue-400/80 mb-0.5">NOTLAR:</span> 
                        <span className="text-white/70 leading-snug italic">{record.notes}</span>
                      </div>
                    </div>
                  </div>
                )})}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-white/40 text-[11px]">
                <span>(0) KAYIT</span>
                <span>Eşleşme bulunamadı.</span>
              </div>
            )
          ) : (
             <div className="flex flex-col items-center justify-center h-full opacity-30 text-white flex gap-2">
               <FaFingerprint className="text-4xl" />
               <span className="text-[10px]">KİMLİK SORGUSU</span>
             </div>
          )}
        </div>
      </div>
    </div>
  );
}

const EMPTY_TRANSACTIONS: CryptoTransaction[] = [];

function CryptoWalletScreen({
  balanceOverride,
  transactions = EMPTY_TRANSACTIONS,
}: {
  balanceOverride?: number;
  transactions?: CryptoTransaction[];
}) {
  const globalBalance = useWalletBalance();
  const displayBalance = balanceOverride ?? globalBalance;
  const [intPart, fracPart] = displayBalance.toFixed(2).split(".");

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-yellow-600 text-[14px] font-sans tracking-widest">Wallet</span>
      </div>

      {/* Main Balance Card */}
      <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-500/20 border border-white/10 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        {/* Decorative background elements */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl" />

        <div className="relative z-10 flex flex-col items-center gap-1">
          <p className="text-white/50 text-[12px] font-medium tracking-wide">Toplam Bakiye</p>
          <div className="flex items-start gap-1">
            <span className="text-white/60 text-2xl mt-1">BTC</span>
            <span className="text-white text-5xl font-light tracking-tight">{Number(intPart).toLocaleString("en-US")}</span>
            <span className="text-white/60 text-2xl mt-4">.{fracPart}</span>
          </div>
          <div className="mt-0">
            <span className="text-emerald-400/80 text-[14px] font-sans tracking-wide font-medium">
              ~ ${(displayBalance * 67403).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto px-1 pr-2 pb-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-yellow-500/20 hover:scrollbar-thumb-yellow-500/40 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-yellow-500/20 [&::-webkit-scrollbar-thumb]:rounded-full">
        <div className="flex flex-col gap-4 pt-2">
          {transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center mt-6 text-white/30 text-[12px] font-sans">
              <p>İşlem geçmişi bulunamadı.</p>
            </div>
          ) : (
            transactions.map((tx) => (
              <div key={tx.id} className="flex items-start gap-3 bg-gradient-to-br from-yellow-500/5 to-yellow-500/10 border border-yellow-500/10 rounded-2xl p-4">
                <div className={`w-10 h-10 rounded-full border flex items-center justify-center text-xl font-light ${
                  tx.type === "receive" 
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                    : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                }`}>
                  {tx.type === "receive" ? "+" : "-"}
                </div>
                <div className="flex-1 border-b border-white/5 pb-4">
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-white/90 font-medium text-[14px]">{tx.title}</p>
                    <p className={`font-medium text-[14px] ${
                      tx.type === "receive" ? "text-emerald-400" : "text-rose-400"
                    }`}>
                      {tx.type === "receive" ? "+" : "-"}{tx.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}BTC
                    </p>
                  </div>
                  <div className="flex justify-between items-center text-[12px]">
                    <p className="text-white/40 font-sans">
                      {tx.type === "receive" ? "Kimden: " : "Kime: "}{tx.fromTo}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const VPN_LOCATIONS = [
  "İzlanda, Reykjavik",
  "İsviçre, Zürih",
  "Romanya, Bükreş",
  "Panama, Panama City",
  "Seyşeller, Victoria",
  "Kosta Rika, San Jose",
  "Hollanda, Amsterdam"
];

let globalVpnIp = "198.51.100.0";
let globalVpnLocation = "İzlanda, Reykjavik";

function VpnScreen({ isVpnActive, setIsVpnActive }: { isVpnActive: boolean, setIsVpnActive: (val: boolean) => void }) {
  const [connecting, setConnecting] = useState(false);
  const [randomIp, setRandomIp] = useState(globalVpnIp);
  const [randomLocation, setRandomLocation] = useState(globalVpnLocation);

  const toggleVpn = () => {
    if (connecting) return;
    if (isVpnActive) {
      setIsVpnActive(false);
    } else {
      setConnecting(true);
      setTimeout(() => {
        globalVpnIp = `198.51.100.${Math.floor(Math.random()*255)}`;
        globalVpnLocation = VPN_LOCATIONS[Math.floor(Math.random() * VPN_LOCATIONS.length)];
        setRandomIp(globalVpnIp);
        setRandomLocation(globalVpnLocation);
        setConnecting(false);
        setIsVpnActive(true);
      }, 1500);
    }
  };

  return (
    <div className="h-full flex flex-col gap-2">
      <div className="flex items-center justify-between px-1 mb-2">
        <h3 className="text-purple-500/90 font-sans text-[14px] tracking-widest uppercase">Shadow VPN</h3>
      </div>

      <div className="flex-1 bg-gradient-to-b from-[#0a0510] to-[#050510] rounded-xl border border-purple-900/40 flex flex-col items-center justify-center gap-8 font-mono relative overflow-hidden shadow-[inset_0_0_30px_rgba(0,0,0,0.8)] p-6">
         {/* Background Elements */}
         <div className={`absolute -top-20 -right-20 w-48 h-48 rounded-full blur-[80px] transition-colors duration-1000 ${isVpnActive ? 'bg-emerald-500/20' : 'bg-purple-600/10'}`}></div>
         <div className={`absolute -bottom-20 -left-20 w-48 h-48 rounded-full blur-[80px] transition-colors duration-1000 ${isVpnActive ? 'bg-teal-500/20' : 'bg-rose-600/10'}`}></div>

         {/* Shield Icon Container */}
         <div className="relative group">
            <div className={`absolute inset-0 rounded-full blur-xl transition-all duration-700 ${
              isVpnActive ? 'bg-emerald-500/40 scale-150' : connecting ? 'bg-purple-500/40 scale-125 animate-pulse' : 'bg-rose-500/10 scale-100'
            }`}></div>
            <div className={`w-32 h-32 rounded-full border flex items-center justify-center relative z-10 backdrop-blur-md transition-all duration-500 bg-black/40 ${
              isVpnActive ? 'shadow-[0_0_40px_rgba(16,185,129,0.3)] border-emerald-500/40' : 
              connecting ? 'shadow-[0_0_20px_rgba(168,85,247,0.4)] border-purple-500/50' : 
              'shadow-none border-rose-500/30'
            }`}>
               <FaShield className={`text-5xl transition-all duration-500 ${
                 isVpnActive ? 'text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.8)]' :
                 connecting ? 'text-purple-400 animate-pulse' :
                 'text-rose-500/40'
               }`} />
            </div>
            
            {/* Orbital Rings - only animate when active or connecting */}
            {(isVpnActive || connecting) && (
              <>
                <div className={`absolute inset-[-10px] rounded-full border-t-2 border-l-2 border-transparent transition-colors duration-500 ${isVpnActive ? 'border-t-emerald-500/50 border-l-emerald-500/30' : 'border-t-purple-500/60 border-l-purple-500/30'} animate-[spin_3s_linear_infinite]`}></div>
                <div className={`absolute inset-[-20px] rounded-full border-b-2 border-r-2 border-transparent transition-colors duration-500 ${isVpnActive ? 'border-b-teal-500/40 border-r-teal-500/20' : 'border-b-purple-500/40 border-r-purple-500/20'} animate-[spin_4s_linear_infinite_reverse]`}></div>
              </>
            )}
         </div>

         {/* Status Text Area */}
         <div className="flex flex-col items-center gap-1.5 z-10 text-center h-16 w-full">
            <h2 className={`text-xl font-bold tracking-widest uppercase transition-colors duration-500 ${
              isVpnActive ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 
              connecting ? 'text-purple-400' : 
              'text-rose-400/80'
            }`}>
              {isVpnActive ? "BAĞLI" : connecting ? "BAĞLANIYOR" : "KORUMASIZ"}
            </h2>
            <p className="text-white/40 text-[12px] uppercase tracking-wide px-2 text-center w-full">
              {isVpnActive ? "Bağlantı Şifrelendi" : connecting ? "Uçtan Uca Şifreleme Kuruluyor" : "Korunmuyorsunuz"}
            </p>
         </div>

         {/* Connection Button */}
         <button 
           onClick={toggleVpn}
           disabled={connecting}
           className={`relative z-10 overflow-hidden w-full max-w-[200px] py-3.5 rounded font-bold tracking-widest text-[14px] uppercase transition-all duration-300 group ${
             isVpnActive 
               ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]' 
               : connecting
               ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30 cursor-not-allowed'
               : 'bg-rose-500/10 text-rose-400 border border-rose-500/40 hover:bg-rose-500/20 hover:shadow-[0_0_20px_rgba(244,63,94,0.3)]'
           }`}
         >
           <div className={`absolute inset-0 w-full h-full bg-gradient-to-r transition-transform duration-700 -translate-x-full ${
             isVpnActive ? 'from-transparent via-emerald-500/10 to-transparent group-hover:translate-x-full' : 'from-transparent via-rose-500/10 to-transparent group-hover:translate-x-full'
           } `}></div>
           <span className="relative z-10 drop-shadow-md">
             {isVpnActive ? "BAĞLANTIYI KES" : connecting ? "BEKLEYİN" : "BAĞLAN"}
           </span>
         </button>

         {/* Connection Details */}
         <div className={`w-full flex w-[85%] flex-col gap-2 z-10 transition-all duration-500 ${isVpnActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none absolute bottom-4'}`}>
            <div className="flex justify-between items-center text-[12px] text-white/40 border-b border-white/5 pb-1">
              <span>IP Adresi:</span>
              <span className="text-emerald-400/80 font-mono tracking-wider">{randomIp}</span>
            </div>
            <div className="flex justify-between items-center text-[12px] text-white/40 border-b border-white/5 pb-1">
              <span>Konum:</span>
              <span className="text-white/70 font-mono">{randomLocation}</span>
            </div>
            <div className="flex justify-between items-center text-[12px] text-white/40 border-b border-white/5 pb-1">
              <span>Ağ Tipi:</span>
              <span className="text-emerald-500/70 font-mono font-bold">TOR / VPN</span>
            </div>
         </div>
      </div>
    </div>
  );
}

function DarkwebScreen() {
  // const [tab, setTab] = useState<"items" | "missions">("items");
  return (
    <div className="h-full flex flex-col gap-2">
      <div className="flex items-center gap-2 px-1">
        <h3 className="text-emerald-500/90 font-mono text-[14px] tracking-widest uppercase">Darkweb</h3>
      </div>

      <div className="flex-1 bg-[#050f0a] rounded-xl border border-emerald-900/40 flex flex-col items-center justify-center gap-4 font-mono relative overflow-hidden">
         <FaSkull className="text-emerald-500/30 text-6xl drop-shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-pulse" />
         <p className="text-emerald-500/50 tracking-widest text-[16px] font-bold uppercase animate-pulse">YAKINDA...</p>
      </div>

      {/* <div className="flex gap-2 px-1 mb-2">
         <button onClick={() => setTab("items")} className={`flex-1 py-1.5 text-[12px] rounded uppercase font-bold tracking-widest transition-colors ${tab === "items" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40" : "bg-black/40 text-white/40 border border-white/5 hover:text-white/60"}`}>
            Pazar
         </button>
         <button onClick={() => setTab("missions")} className={`flex-1 py-1.5 text-[12px] rounded uppercase font-bold tracking-widest transition-colors ${tab === "missions" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40" : "bg-black/40 text-white/40 border border-white/5 hover:text-white/60"}`}>
            Görevler
         </button>
      </div> */}

      {/* <div className="flex-1 bg-[#050f0a] rounded-xl border border-emerald-900/40 p-3 flex flex-col gap-3 font-mono relative overflow-hidden">
         <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {tab === "items" && (
                <div className="flex flex-col gap-3">
                   {darkwebItems.map(item => (
                       <div key={item.id} className="bg-[#030906] border border-emerald-900/50 rounded flex flex-col p-3 gap-2">
                          <div className="flex justify-between items-start">
                             <span className="text-white font-bold text-[13px] leading-tight">{item.name}</span>
                             <span className="text-emerald-400 text-[12px] whitespace-nowrap">{item.priceBTC} BTC</span>
                          </div>
                          <span className="text-white/60 text-[11px] italic">{item.description}</span>
                          <div className="flex justify-between items-center mt-1">
                              <span className="text-white/40 text-[11px] uppercase border border-white/10 px-1.5 rounded">{item.category} • Stok: {item.stock}</span>
                              <button className="bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-[11px] px-3 py-1 rounded transition-colors flex items-center gap-1">
                                  <FaShoppingCart className="text-[11px]" /> SATIN AL
                              </button>
                          </div>
                       </div>
                   ))}
                </div>
            )}
            
            {tab === "missions" && (
                <div className="flex flex-col gap-3">
                   {darkwebMissions.map(msn => (
                       <div key={msn.id} className="bg-[#030906] border border-emerald-900/50 rounded flex flex-col p-3 gap-2">
                          <div className="flex justify-between items-start">
                             <div className="flex flex-col w-[75%]">
                                <span className="text-rose-400/90 font-bold text-[13px] leading-tight">{msn.title}</span>
                                <span className="text-white/40 text-[9px]">İşveren: {msn.client}</span>
                             </div>
                             <span className="text-emerald-400 text-[12px] font-bold whitespace-nowrap">+{msn.rewardBTC} BTC</span>
                          </div>
                          <span className="text-white/70 text-[11px] leading-snug">{msn.description}</span>
                          <div className="flex justify-between items-center mt-1">
                              <span className="text-white/40 text-[11px] uppercase border border-white/10 px-1.5 rounded flex items-center gap-1">
                                  Zorluk: 
                                  <span className={msn.difficulty === "Zor" || msn.difficulty === "Ekstrem" ? "text-rose-400" : msn.difficulty === "Orta" ? "text-yellow-400" : "text-emerald-400"}>{msn.difficulty}</span>
                              </span>
                              <button className="bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 text-[11px] px-3 py-1 rounded transition-colors flex items-center gap-1">
                                  <FaTasks className="text-[11px]" /> KABUL ET
                              </button>
                          </div>
                       </div>
                   ))}
                </div>
            )}
         </div>
      </div> */}
    </div>
  );
}

function EchoTraceScreen() {
  // const [tab, setTab] = useState<"Bugs" | "GPS">("Bugs");
  return (
    <div className="h-full flex flex-col gap-2">
      <div className="flex items-center gap-2 px-1">
        <h3 className="text-orange-500/90 font-sans text-[14px] tracking-widest">EchoTrace</h3>
      </div>

      <div className="flex-1 bg-[#050f0a] rounded-xl border border-orange-900/40 flex flex-col items-center justify-center gap-4 font-mono relative overflow-hidden">
         <FaLocationPin className="text-orange-500/30 text-6xl drop-shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-pulse" />
         <p className="text-orange-500/50 tracking-widest text-[16px] font-bold uppercase animate-pulse">YAKINDA...</p>
      </div>
    </div>
  );
}
