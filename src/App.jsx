
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  initializeApp,
  deleteApp
} from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  reauthenticateWithCredential,
  EmailAuthProvider,
  updatePassword
} from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDoc,
  query,
  where,
  writeBatch,
  serverTimestamp
} from "firebase/firestore";
import {
  LayoutDashboard,
  Bed,
  Users,
  CalendarCheck,
  Wallet,
  UserRoundCog,
  BarChart3,
  Settings,
  LogOut,
  MessageCircle,
  Bell,
  Pencil,
  Trash2,
  FileText,
  Plus,
  Search,
  Building2
} from "lucide-react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from "recharts";
import jsPDF from "jspdf";
import "./style.css";

/*
  COLE A CONFIGURAÇÃO DO FIREBASE AQUI.
  Firebase Console > Project settings > General > Your apps > Web app.
*/
const firebaseConfig = {
  apiKey: "AIzaSyBLIAZfv-2WMe8Db9G3UJHtoGW_SF39bp8",
  authDomain: "padc-991e3.firebaseapp.com",
  projectId: "padc-991e3",
  storageBucket: "padc-991e3.firebasestorage.app",
  messagingSenderId: "595615890936",
  appId: "1:595615890936:web:a28e0d8750917f7df9aa0d"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const WHATSAPP = "5571985610497";
const AUTH_TIMEOUT_MS = 12000;
const ALLOWED_ROLES = ["admin", "gerente", "funcionario", "recepcao", "recepção", "recepção"];
const ROOM_BLUEPRINT = [
  { floor: 1, numbers: ["201", "202", "203", "204", "205", "206", "207", "208", "209"] },
  { floor: 2, numbers: ["210", "211", "212", "213", "214", "215", "216", "217", "218", "220", "221", "223", "224"] },
  { floor: 3, numbers: ["225", "226", "227", "228", "229", "230", "231", "232", "233", "234", "235"] }
];
function appLog(message, payload) {
  if (payload !== undefined) console.log(`[Firebase] ${message}`, payload);
  else console.log(`[Firebase] ${message}`);
}

function firebaseErrorMessage(err) {
  const code = err?.code || "";
  if (code === "permission-denied" || code === "firestore/permission-denied") {
    return "Seu usuário está autenticado, mas não tem permissão para acessar estes dados. Confirme se existe um documento em users com o mesmo UID do login e active true.";
  }
  if (code === "unauthenticated" || code === "auth/user-token-expired") {
    return "Sua sessão expirou. Entre novamente para continuar.";
  }
  if (code === "unavailable" || code === "deadline-exceeded") {
    return "Não foi possível conectar ao Firebase agora. Verifique sua internet e tente novamente.";
  }
  return err?.message || "Não foi possível carregar os dados do sistema.";
}

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

function normalizeActiveFlag(data) {
  const activeValue = data?.active;
  const statusValue = String(data?.status || "").trim().toLowerCase();
  return activeValue === true || String(activeValue).trim().toLowerCase() === "true" || statusValue === "ativo";
}

function normalizeProfile(id, data, authUser) {
  if (!data) return null;
  const role = normalizeRole(data.role || data.perfil || data.cargo);
  const active = normalizeActiveFlag(data);
  return {
    id,
    ...data,
    uid: data.uid || id || authUser?.uid || "",
    name: data.name || data.nome || authUser?.displayName || authUser?.email || "Usuário",
    email: data.email || authUser?.email || "",
    status: String(data.status || "").toLowerCase(),
    active,
    role
  };
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = window.setTimeout(() => {
      reject(new Error(`${label} demorou mais de ${Math.round(ms / 1000)} segundos.`));
    }, ms);
  });

  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timer));
}

function cpfToEmail(cpf) {
  const digits = String(cpf).replace(/\D/g, "");
  return `${digits}@pousadaaltodacruz.local`;
}

function normalizeEmailOrCpf(value) {
  const trimmed = String(value || "").trim();
  return trimmed.includes("@") ? trimmed : cpfToEmail(trimmed);
}

function formatCPF(value) {
  const v = String(value).replace(/\D/g, "").slice(0, 11);
  return v
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function money(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function brDate(date) {
  if (!date) return "";
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatTimestamp(value) {
  if (!value) return "-";
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR");
}

function nextDay() {
  return new Date(Date.now() + 86400000).toISOString().slice(0, 10);
}

function canAdmin(profile) {
  return normalizeRole(profile?.role) === "admin";
}

function canReception(profile) {
  return ["recepcao", "recepção", "recepção", "recepção"].includes(normalizeRole(profile?.role));
}

function canReadUsers(profile) {
  return canAdmin(profile);
}

function canStaff(profile) {
  const role = normalizeRole(profile?.role);
  return ["funcionario", "gerente", "recepcao", "recepção", "recepção", "recepção"].includes(role);
}

function isCheckedInToday(reservation) {
  return reservation.entry === today() && !["Cancelada", "Finalizada", "Rejeitada"].includes(reservation.status);
}

function isCheckedOutToday(reservation) {
  return reservation.exit === today() && !["Cancelada", "Finalizada", "Rejeitada"].includes(reservation.status);
}

function canAccessPage(profile, page) {
  if (canAdmin(profile)) return true;
  return ["dashboard", "quartos", "hospedes", "reservas", "caixa", "relatorios", "config"].includes(page);
}

function canUseSystem(profile) {
  const role = normalizeRole(profile?.role);
  return Boolean(profile?.uid && profile?.active === true && (ALLOWED_ROLES.includes(role) || canAdmin(profile) || canReception(profile)));
}

function companyUid(profile) {
  return profile?.adminUid || profile?.ownerUid || profile?.uid || profile?.id || auth.currentUser?.uid || "";
}

function ownershipFields(profile) {
  const uid = companyUid(profile);
  return {
    ownerUid: uid,
    adminUid: uid,
    updatedBy: auth.currentUser?.uid || ""
  };
}

function auditProfileData(profile) {
  return {
    userId: auth.currentUser?.uid || profile?.uid || profile?.id || "",
    userName: profile?.name || profile?.nome || auth.currentUser?.email || "Usuário",
    role: profile?.role || "sem-role"
  };
}

async function logAudit(profile, action, module, description) {
  try {
    await addDoc(collection(db, "auditLogs"), {
      ...auditProfileData(profile),
      action,
      module,
      description,
      createdAt: serverTimestamp(),
      ip: "",
      device: navigator.userAgent || ""
    });
  } catch (err) {
    console.warn("[Firebase] Falha ao registrar auditoria", { action, module, err });
  }
}

async function auditAndSignOut(profile) {
  await logAudit(profile, "logout", "auth", "Usuário saiu do sistema.");
  await signOut(auth);
}

function downloadJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const emptyState = {
  rooms: [],
  guests: [],
  reservations: [],
  cash: [],
  users: [],
  shifts: [],
  settings: {
    pousada: "Pousada Alto Da Cruz",
    cidade: "Salvador",
    whatsapp: "+55 71 98561-0497"
  }
};

function useCollection(name, profile, options = {}) {
  const [items, setItems] = useState([]);
  const enabled = options.enabled ?? true;
  const onError = options.onError;
  const scopeCompany = options.scopeCompany ?? true;

  useEffect(() => {
    if (!profile || !enabled || !canUseSystem(profile)) {
      setItems([]);
      return undefined;
    }

    const uid = companyUid(profile);
    if (scopeCompany && !uid) {
      appLog(`Coleção ${name} ignorada: perfil sem adminUid/ownerUid/uid.`, profile);
      setItems([]);
      return undefined;
    }

    const ref = scopeCompany ? query(collection(db, name), where("adminUid", "==", uid)) : collection(db, name);
    appLog(`Abrindo listener da coleção ${name}`, { adminUid: uid });

    const unsub = onSnapshot(
      ref,
      (snap) => {
        appLog(`Coleção ${name} carregada`, { total: snap.size });
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.error(`[Firebase] Falha ao ler coleção ${name}`, err);
        setItems([]);
        if (onError) onError(name, err);
      }
    );

    return () => unsub();
  }, [name, profile?.id, profile?.uid, profile?.adminUid, profile?.ownerUid, profile?.active, profile?.status, profile?.role, enabled, scopeCompany]);
  return items;
}

function AppMain() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [authMessage, setAuthMessage] = useState("");
  const [systemError, setSystemError] = useState("");
  const [dataErrors, setDataErrors] = useState({});
  const [permissionMessage, setPermissionMessage] = useState("");
  const [online, setOnline] = useState(() => navigator.onLine);
  const [globalSearch, setGlobalSearch] = useState("");
  const [toast, setToast] = useState("");

  const notify = useCallback((message) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  }, []);

  const handleCollectionError = useCallback((name, err) => {
    const message = firebaseErrorMessage(err);
    setDataErrors((current) => ({ ...current, [name]: message }));
    if (err?.code === "permission-denied" || err?.code === "firestore/permission-denied") {
      setSystemError(`Sem permissão para ler a coleção ${name}. ${message}`);
    }
  }, []);

  const adminScope = !canAdmin(profile);
  const rooms = useCollection("rooms", profile, { scopeCompany: adminScope, onError: handleCollectionError });
  const guests = useCollection("guests", profile, { scopeCompany: adminScope, onError: handleCollectionError });
  const reservations = useCollection("reservations", profile, { scopeCompany: adminScope, onError: handleCollectionError });
  const cash = useCollection("cash", profile, { scopeCompany: adminScope, onError: handleCollectionError });
  const users = useCollection("users", profile, { enabled: canReadUsers(profile), scopeCompany: false, onError: handleCollectionError });
  const shifts = useCollection("shifts", profile, { scopeCompany: adminScope, onError: handleCollectionError });
  const auditLogs = useCollection("auditLogs", profile, { enabled: canAdmin(profile), scopeCompany: false, onError: handleCollectionError });

  const state = useMemo(() => ({ ...emptyState, rooms, guests, reservations, cash, users: canReadUsers(profile) ? users : profile ? [profile] : [], shifts, auditLogs }), [rooms, guests, reservations, cash, users, profile, shifts, auditLogs]);

  const notifications = useMemo(() => {
    const pendingSite = reservations.filter((r) => r.status === "pendente" && r.source === "site").length;
    const checkins = reservations.filter(isCheckedInToday).length;
    const checkouts = reservations.filter(isCheckedOutToday).length;
    const maintenance = rooms.filter((r) => r.status === "Manutenção").length;
    return [
      pendingSite ? `${pendingSite} reserva(s) do site aguardando aprovação` : "",
      checkins ? `${checkins} check-in(s) para hoje` : "",
      checkouts ? `${checkouts} check-out(s) para hoje` : "",
      maintenance ? `${maintenance} quarto(s) em manutenção` : ""
    ].filter(Boolean);
  }, [reservations, rooms]);

  const globalResults = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (!q) return [];
    const roomResults = rooms
      .filter((r) => `${r.number || ""} ${r.name || ""} ${r.status || ""} ${r.guest || ""}`.toLowerCase().includes(q))
      .slice(0, 3)
      .map((item) => ({ label: `Quarto ${item.number}`, detail: item.status || "Sem status", page: "quartos" }));
    const guestResults = guests
      .filter((g) => `${g.name || ""} ${g.doc || ""} ${g.phone || ""}`.toLowerCase().includes(q))
      .slice(0, 3)
      .map((item) => ({ label: item.name || "Hóspede", detail: item.phone || item.doc || "", page: "hospedes" }));
    const reservationResults = reservations
      .filter((r) => `${r.guest || ""} ${r.guestName || ""} ${r.room || ""} ${r.status || ""}`.toLowerCase().includes(q))
      .slice(0, 3)
      .map((item) => ({ label: item.guest || item.guestName || "Reserva", detail: item.room ? `Quarto ${item.room}` : item.status || "", page: "reservas" }));
    return [...roomResults, ...guestResults, ...reservationResults].slice(0, 6);
  }, [globalSearch, rooms, guests, reservations]);

  useEffect(() => {
    if (profile && !canAccessPage(profile, page)) {
      setPermissionMessage("Você não possui permissão para acessar esta área.");
      setPage("dashboard");
    }
  }, [profile, page]);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    const stopAuthTimeout = window.setTimeout(() => {
      appLog("Timeout no carregamento inicial de autenticação.");
      setLoading(false);
      setProfile(null);
      setSystemError("O Firebase demorou demais para responder. Atualize a página ou entre novamente.");
    }, AUTH_TIMEOUT_MS);

    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      appLog("Estado de autenticação recebido", { uid: u?.uid || null, email: u?.email || null });
      setLoading(true);
      setSystemError("");
      setDataErrors({});

      if (!u) {
        window.clearTimeout(stopAuthTimeout);
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        setUser(u);
        const profileRef = doc(db, "users", u.uid);
        appLog("Buscando perfil por UID em users/{uid}", { uid: u.uid });
        const snap = await withTimeout(getDoc(profileRef), AUTH_TIMEOUT_MS, "A leitura do perfil");

        if (!snap.exists()) {
          appLog("Perfil não encontrado para o UID autenticado", { uid: u.uid, email: u.email });
          setUser(null);
          setProfile(null);
          setAuthMessage("Login encontrado, mas este UID não existe na coleção users. Peça ao administrador para cadastrar seu usuário.");
          await signOut(auth);
          return;
        }

        const userProfile = normalizeProfile(snap.id, snap.data(), u);
        appLog("Perfil carregado", { uid: userProfile.uid, role: userProfile.role, active: userProfile.active, status: userProfile.status, adminUid: userProfile.adminUid });

        if (!canUseSystem(userProfile)) {
          setUser(null);
          setProfile(null);
          setAuthMessage("Usuário sem permissão ativa. Seu perfil precisa ter active true e role admin, gerente, funcionario ou recepcao.");
          await signOut(auth);
          return;
        }

        setAuthMessage("");
        setProfile(userProfile);
        const loginFlag = `audit-login-${u.uid}`;
        if (!sessionStorage.getItem(loginFlag)) {
          await logAudit(userProfile, "login", "auth", "Usuário entrou no sistema.");
          sessionStorage.setItem(loginFlag, "true");
        }
      } catch (err) {
        console.error("[Firebase] Falha no carregamento inicial do usuário", err);
        const message = firebaseErrorMessage(err);
        setUser(null);
        setProfile(null);
        setSystemError(message);
        setAuthMessage(message);
        try {
          await signOut(auth);
        } catch (signOutErr) {
          console.error("[Firebase] Falha ao encerrar sessão após erro inicial", signOutErr);
        }
      } finally {
        window.clearTimeout(stopAuthTimeout);
        setLoading(false);
      }
    });

    return () => {
      window.clearTimeout(stopAuthTimeout);
      unsubscribe();
    };
  }, []);

  if (loading) return <LoadingScreen />;
  if (systemError && !user) return <Login message={systemError || authMessage} />;
  if (!user) return <Login message={authMessage} />;
  if (!profile) return <AccessDenied message={systemError || "Não foi possível carregar seu perfil de acesso."} />;

  return (
    <div className="app">
      <Sidebar page={page} setPage={setPage} profile={profile} />
      <main>
        <header>
          <div className="global-search-wrap">
            <div className="search-box global-search">
              <Search size={17} />
              <input value={globalSearch} onChange={(e) => setGlobalSearch(e.target.value)} placeholder="Buscar quarto, hóspede ou reserva..." />
            </div>
            {globalResults.length > 0 && (
              <div className="global-results">
                {globalResults.map((result, index) => (
                  <button key={`${result.page}-${result.label}-${index}`} onClick={() => { setPage(result.page); setGlobalSearch(""); }}>
                    <b>{result.label}</b>
                    <small>{result.detail}</small>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="top-user">
            <div className="notification-pill" title={notifications.join(" | ") || "Sem alertas"}>
              <Bell size={18} />
              {notifications.length > 0 && <span>{notifications.length}</span>}
            </div>
            <span className={`connection ${online ? "online" : "offline"}`}>{online ? "Online" : "Offline"}</span>
            <span className="avatar blue">{profile?.name?.[0] || "U"}</span>
            <b>{profile?.name || "Usuário"}</b>
          </div>
        </header>

        <section className="content">
          {!online && <div className="notice-box">Você está offline. Os dados já carregados continuam visíveis, mas novas ações dependem da reconexão com o Firebase.</div>}
          {permissionMessage && <div className="notice-box">{permissionMessage}</div>}
          {systemError && <InlineError message={systemError} details={dataErrors} />}
          {page === "dashboard" && <Dashboard state={state} profile={profile} setPage={setPage} notifications={notifications} notify={notify} />}
          {page === "quartos" && <Rooms rooms={rooms} profile={profile} notify={notify} />}
          {page === "hospedes" && <Guests guests={guests} reservations={reservations} profile={profile} notify={notify} />}
          {page === "reservas" && <Reservations state={state} profile={profile} notify={notify} />}
          {page === "caixa" && <Cash cash={cash} profile={profile} notify={notify} />}
          {page === "equipe" && <Team users={state.users} shifts={shifts} profile={profile} />}
          {page === "relatorios" && <Reports state={state} />}
          {page === "config" && <Config profile={profile} />}
          {page === "logs" && <AuditLogs logs={auditLogs} profile={profile} />}
        </section>
      </main>
      {toast && <div className="toast">{toast}</div>}
      <a
        className="whatsapp"
        href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent("Olá, Pousada Alto Da Cruz!")}`}
        target="_blank"
      >
        <MessageCircle size={31} />
      </a>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="center loading-screen">
      <div className="loading-card">
        <img src="/logo.svg" className="loading-logo" />
        <b>Carregando sistema...</b>
        <span>Validando login, perfil e permissões no Firebase.</span>
      </div>
    </div>
  );
}

function AccessDenied({ message }) {
  return (
    <div className="login-screen">
      <div className="login-card">
        <img src="/logo.svg" className="login-logo" />
        <h1>Acesso não autorizado</h1>
        <p>{message}</p>
        <div className="notice-box">
          Verifique se o UID autenticado existe em users, se active está true e se a role é permitida.
        </div>
        <button className="primary full" onClick={() => signOut(auth)}>
          Voltar para login
        </button>
      </div>
    </div>
  );
}

function InlineError({ message, details }) {
  const entries = Object.entries(details || {});
  return (
    <div className="inline-error">
      <b>Atenção ao Firebase</b>
      <span>{message}</span>
      {entries.length > 0 && (
        <small>
          Coleções com falha: {entries.map(([name]) => name).join(", ")}.
        </small>
      )}
    </div>
  );
}

function Login({ message }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    try {
      setError("");
      setBusy(true);
      const email = normalizeEmailOrCpf(identifier);
      appLog("Tentando login", { email });
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      console.error("[Firebase] Falha no login", err);
      setError(firebaseErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <img src="/logo.svg" className="login-logo" />
        <h1>Bem Vindo ao Pousada AltoDaCruz<br />Manager</h1>
        <p>Entre com Email ou CPF e senha</p>
        {message && <div className="notice-box">{message}</div>}
        {error && <div className="notice-box">{error}</div>}

        <label>Email ou CPF</label>
        <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="email@empresa.com ou CPF" />

        <label>Senha</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="••••••" />

        <button className="primary full" onClick={submit} disabled={busy}>
          {busy ? "Aguarde..." : "Entrar"}
        </button>
      </div>
    </div>
  );
}

function Sidebar({ page, setPage, profile }) {
  const allItems = [
    ["dashboard", LayoutDashboard, "Dashboard"],
    ["quartos", Bed, "Quartos"],
    ["hospedes", Users, "Hóspedes"],
    ["reservas", CalendarCheck, "Reservas"],
    ["caixa", Wallet, "Caixa"],
    ["equipe", UserRoundCog, "Equipe & Escala"],
    ["relatorios", BarChart3, "Relatórios"],
    ["logs", FileText, "Logs do Sistema"],
    ["config", Settings, "Configurações"]
  ];
  const items = canAdmin(profile)
    ? allItems
    : allItems.filter(([id]) => ["dashboard", "quartos", "hospedes", "reservas", "caixa", "relatorios", "config"].includes(id));

  return (
    <aside className="sidebar">
      <div className="brand">
        <img src="/logo.svg" />
        <div>
          <b>POUSADA</b>
          <span>Alto Da Cruz</span>
          <small>★★★★</small>
        </div>
      </div>

      <nav>
        {items.map(([id, Icon, label]) => (
          <button key={id} className={`nav ${page === id ? "active" : ""}`} onClick={() => setPage(id)}>
            <Icon size={19} /> {label}
          </button>
        ))}
      </nav>

      <div className="user-box">
        <span className="avatar">{profile?.name?.[0] || "U"}</span>
        <div>
          <b>{profile?.name || "Usuário"}</b>
          <small>{profile?.role || "funcionário"}</small>
        </div>
        <button onClick={() => auditAndSignOut(profile)}><LogOut size={18} /></button>
      </div>
    </aside>
  );
}

function Dashboard({ state, profile, setPage, notifications, notify }) {
  const [openCheckin, setOpenCheckin] = useState(false);

  const hoje = today();

  const livres = state.rooms.filter((r) => r.status === "Livre").length;
  const ocupados = state.rooms.filter((r) => r.status === "Ocupado").length;
  const limpeza = state.rooms.filter((r) => r.status === "Limpeza").length;
  const totalQuartos = state.rooms.length;

  const checkinsHoje = state.reservations.filter((r) => r.entry === hoje).length;
  const reservasAtivas = state.reservations.filter((r) => r.status === "Ativa").length;

  const entradasHoje = state.cash
    .filter((c) => c.type === "Entrada" && c.date === hoje)
    .reduce((s, c) => s + Number(c.value || 0), 0);

  const saidasHoje = state.cash
    .filter((c) => c.type === "Saída" && c.date === hoje)
    .reduce((s, c) => s + Number(c.value || 0), 0);

  const receitaTotal = state.cash
    .filter((c) => c.type === "Entrada")
    .reduce((s, c) => s + Number(c.value || 0), 0);

  const ocupacaoPercentual = state.rooms.length
    ? Math.round((ocupados / state.rooms.length) * 100)
    : 0;

  const ultimasReservas = [...state.reservations].slice(-5).reverse();

  const chartData = [
    { dia: "Seg", qtd: 0 },
    { dia: "Ter", qtd: 0 },
    { dia: "Qua", qtd: 0 },
    { dia: "Qui", qtd: 0 },
    { dia: "Sex", qtd: 0 },
    { dia: "Sáb", qtd: 0 },
    { dia: "Dom", qtd: 0 }
  ];

  state.reservations.forEach((r) => {
    if (!r.entry) return;
    const d = new Date(r.entry + "T00:00:00");
    const index = d.getDay();
    const map = [6, 0, 1, 2, 3, 4, 5];
    chartData[map[index]].qtd += 1;
  });

  return (
    <>
      <div className="dash-hero">
        <div className="welcome">
          <img src="/logo.svg" className="logo-mini" />
          <div>
            <h1>Bem-vindo(a) à <span>Pousada Alto Da Cruz!</span></h1>
            <p>Olá, {profile?.name || "Administrador"} — painel profissional em tempo real.</p>
          </div>
        </div>

        <div className="dash-summary">
          <div>
            <small>Ocupação atual</small>
            <b>{ocupacaoPercentual}%</b>
          </div>
          <div>
            <small>Receita total</small>
            <b>{money(receitaTotal)}</b>
          </div>
          <div>
            <small>Alertas internos</small>
            <b>{notifications.length}</b>
          </div>
        </div>
      </div>

      <div className="premium-cards">
        <div className="premium-card yellow">
          <div className="premium-icon"><Bed /></div>
          <div>
            <span>Total de Quartos</span>
            <b>{totalQuartos}</b>
          </div>
        </div>

        <div className="premium-card blue">
          <div className="premium-icon"><Users /></div>
          <div>
            <span>Quartos Ocupados</span>
            <b>{ocupados}</b>
          </div>
        </div>

        <div className="premium-card light">
          <div className="premium-icon"><CalendarCheck /></div>
          <div>
            <span>Quartos Livres</span>
            <b>{livres}</b>
          </div>
        </div>

        <div className="premium-card dark">
          <div className="premium-icon"><Building2 /></div>
          <div>
            <span>Em Limpeza</span>
            <b>{limpeza}</b>
          </div>
        </div>
      </div>

      <div className="cards">
        <div className="card metric"><b>Taxa de Ocupação</b><h2>{ocupacaoPercentual}%</h2></div>
        <div className="card metric"><b>Check-ins Hoje</b><h2>{checkinsHoje}</h2></div>
        <div className="card metric"><b>Reservas Ativas</b><h2>{reservasAtivas}</h2></div>
      </div>

      <div className="actions">
        <button className="primary" onClick={() => setOpenCheckin(true)}>
          <Plus size={17} /> Novo Check-In
        </button>
        <button className="secondary" onClick={() => setPage("quartos")}>Ver Quartos</button>
        <button className="gold" onClick={() => setPage("caixa")}>Abrir Caixa</button>
      </div>

      <div className="dashboard-grid">
        <div className="card premium-chart">
          <div className="card-title">
            <div>
              <h3>Ocupação da Semana</h3>
              <p>Check-ins registrados por dia</p>
            </div>
            <span className="badge">{reservasAtivas} ativas</span>
          </div>

          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="dia" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="qtd" fill="#1463e8" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <div className="card-title">
            <div>
              <h3>Check-ins Recentes</h3>
              <p>Últimas reservas lançadas</p>
            </div>
          </div>

          {ultimasReservas.length === 0 ? (
            <div className="empty-box">Nenhum check-in cadastrado ainda.</div>
          ) : (
            ultimasReservas.map((r) => (
              <div className="list-row premium-row" key={r.id}>
                <div>
                  <b>{r.guest}</b>
                  <small>Quarto {r.room} • {brDate(r.entry)}</small>
                </div>
                <span className="badge">{money(r.value)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="dashboard-grid small-grid">
        <div className="card metric in">
          <h3>Entradas Hoje</h3>
          <h2>{money(entradasHoje)}</h2>
        </div>

        <div className="card metric out">
          <h3>Saídas Hoje</h3>
          <h2>{money(saidasHoje)}</h2>
        </div>

        <div className="card metric">
          <h3>Saldo Hoje</h3>
          <h2>{money(entradasHoje - saidasHoje)}</h2>
        </div>
      </div>

      {openCheckin && (
        <CheckinForm state={state} profile={profile} notify={notify} onClose={() => setOpenCheckin(false)} />
      )}
    </>
  );
}

function PageTitle({ title, children }) {
  return <div className="title-row"><h1>{title}</h1><div className="title-actions">{children}</div></div>;
}

function Modal({ title, children, onClose, className = "" }) {
  return (
    <div className="modal">
      <div className={`modal-box ${className}`}>
        <button className="close" onClick={onClose}>×</button>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

function Rooms({ rooms, profile, notify }) {
  const [open, setOpen] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [floorFilter, setFloorFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [roomSearch, setRoomSearch] = useState("");

  async function generateRoomsByFloor() {
    if (!canAdmin(profile)) {
      setError("Apenas administradores podem gerar quartos.");
      return;
    }

    try {
      setMessage("");
      setError("");
      setGenerating(true);
      const existingNumbers = new Set(rooms.map((room) => String(room.number || "").trim()));
      const roomsToCreate = ROOM_BLUEPRINT.flatMap(({ floor, numbers }) =>
        numbers
          .filter((number) => !existingNumbers.has(number))
          .map((number) => ({ floor, number }))
      );

      if (roomsToCreate.length === 0) {
        setMessage("Nenhum quarto novo criado. Todos os quartos ja existem.");
        return;
      }

      const batch = writeBatch(db);
      roomsToCreate.forEach(({ floor, number }) => {
        const roomRef = doc(collection(db, "rooms"));
        batch.set(roomRef, {
          number,
          name: `Quarto ${number}`,
          floor,
          type: "Quarto Casal",
          dailyValue: 180,
          status: "Livre",
          guest: "",
          active: true,
          ...ownershipFields(profile),
          createdAt: serverTimestamp()
        });
      });

      await batch.commit();
      await logAudit(profile, "criação de quartos", "quartos", `${roomsToCreate.length} quarto(s) criado(s) automaticamente por andar.`);
      setMessage(`${roomsToCreate.length} quarto(s) criado(s) com sucesso.`);
      notify?.(`${roomsToCreate.length} quarto(s) criado(s).`);
    } catch (err) {
      console.error("[Firebase] Erro ao gerar quartos", err);
      setError(firebaseErrorMessage(err));
    } finally {
      setGenerating(false);
    }
  }

  async function remove(id) {
    if (!canAdmin(profile)) return alert("Apenas administradores podem excluir quartos.");
    const room = rooms.find((item) => item.id === id);
    if (confirm("Excluir quarto?")) {
      try {
        await deleteDoc(doc(db, "rooms", id));
        await logAudit(profile, "exclusão de quartos", "quartos", `Quarto ${room?.number || id} excluído.`);
        notify?.(`Quarto ${room?.number || id} excluído.`);
      } catch (err) {
        console.error("[Firebase] Erro ao excluir quarto", err);
        setError(firebaseErrorMessage(err));
      }
    }
  }

  async function quickStatus(room, status) {
    try {
      setMessage("");
      setError("");
      await updateDoc(doc(db, "rooms", room.id), {
        status,
        guest: status === "Livre" || status === "Limpeza" || status === "Manutenção" ? "" : room.guest || "",
        ...ownershipFields(profile)
      });
      await logAudit(profile, status === "Limpeza" ? "limpeza" : status === "Manutenção" ? "manutenção" : "alteração de status", "quartos", `Quarto ${room.number} marcado como ${status}.`);
      setMessage(`Quarto ${room.number} marcado como ${status}.`);
      notify?.(`Quarto ${room.number} marcado como ${status}.`);
    } catch (err) {
      console.error("[Firebase] Erro ao alterar status do quarto", err);
      setError(firebaseErrorMessage(err));
    }
  }

  const filteredRooms = rooms.filter((room) => {
    const floor = Number(room.floor || Math.floor(Number(room.number || 0) / 100) || 0);
    const matchesFloor = floorFilter === "todos" || String(floor) === floorFilter;
    const matchesStatus = statusFilter === "todos" || room.status === statusFilter;
    const matchesSearch = !roomSearch.trim() || String(room.number || "").includes(roomSearch.trim());
    return matchesFloor && matchesStatus && matchesSearch;
  });
  const sortedRooms = [...filteredRooms].sort((a, b) => Number(a.number || 0) - Number(b.number || 0));
  const roomsByFloor = sortedRooms.reduce((groups, room) => {
    const floor = Number(room.floor || Math.floor(Number(room.number || 0) / 100) || 0);
    return { ...groups, [floor]: [...(groups[floor] || []), room] };
  }, {});
  const orderedFloors = Object.keys(roomsByFloor).map(Number).sort((a, b) => a - b);
  const roomSummary = {
    total: rooms.length,
    livre: rooms.filter((room) => room.status === "Livre").length,
    ocupado: rooms.filter((room) => room.status === "Ocupado").length,
    limpeza: rooms.filter((room) => room.status === "Limpeza").length,
    manutencao: rooms.filter((room) => room.status === "Manutenção").length
  };

  return (
    <>
      <PageTitle title="Quartos">
        {canAdmin(profile) && <button className="secondary" onClick={generateRoomsByFloor} disabled={generating}><Building2 size={17} /> {generating ? "Gerando..." : "Gerar quartos por andar"}</button>}
        {canAdmin(profile) && <button className="primary" onClick={() => setOpen({})}><Plus size={17} /> Novo Quarto</button>}
      </PageTitle>
      {message && <div className="success-box">{message}</div>}
      {error && <div className="notice-box">{error}</div>}
      <div className="room-summary">
        <div><b>{roomSummary.total}</b><span>Total quartos</span></div>
        <div><b>{roomSummary.livre}</b><span>Livres</span></div>
        <div><b>{roomSummary.ocupado}</b><span>Ocupados</span></div>
        <div><b>{roomSummary.limpeza}</b><span>Limpeza</span></div>
        <div><b>{roomSummary.manutencao}</b><span>Manutenção</span></div>
      </div>
      <div className="filters-row">
        <div className="search-box"><Search size={17} /><input value={roomSearch} onChange={(e) => setRoomSearch(e.target.value)} placeholder="Buscar quarto..." /></div>
        <select value={floorFilter} onChange={(e) => setFloorFilter(e.target.value)}>
          <option value="todos">Todos os andares</option>
          <option value="1">1º andar</option>
          <option value="2">2º andar</option>
          <option value="3">3º andar</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="todos">Todos os status</option>
          <option>Livre</option>
          <option>Ocupado</option>
          <option>Limpeza</option>
          <option>Manutenção</option>
        </select>
      </div>
      <Table heads={["Quarto", "Andar", "Tipo", "Status", "Hóspede", "Valor", "Ações"]}>
        {orderedFloors.length === 0 && (
          <tr><td colSpan={7}><div className="empty-box">Nenhum quarto encontrado.</div></td></tr>
        )}
        {orderedFloors.map((floor) => {
          const floorRooms = roomsByFloor[floor];
          const occupied = floorRooms.filter((room) => room.status === "Ocupado").length;
          const free = floorRooms.filter((room) => room.status === "Livre").length;
          const cleaning = floorRooms.filter((room) => room.status === "Limpeza").length;
          const maintenance = floorRooms.filter((room) => room.status === "Manutenção").length;

          return (
            <React.Fragment key={floor}>
              <tr className="floor-header-row">
                <td colSpan={7}>
                  <b>{floor}º ANDAR</b>
                  <span>{floorRooms.length} quartos - {free} livres - {occupied} ocupados - {cleaning} limpeza - {maintenance} manutenção</span>
                </td>
              </tr>
              {floorRooms.map((r) => (
                <tr key={r.id}>
                  <td><b>{r.number}</b><small>{r.name || `Quarto ${r.number}`}</small></td>
                  <td>{r.floor || "-"}</td>
                  <td>{r.type}</td>
                  <td><span className={`pill ${r.status}`}>{r.status}</span></td>
                  <td>{r.guest || "-"}</td>
                  <td>{money(r.dailyValue ?? r.price)}</td>
                  <td className="right">
                    <div className="quick-actions">
                      <button className="secondary small" onClick={() => quickStatus(r, "Livre")}>Livre</button>
                      <button className="secondary small" onClick={() => quickStatus(r, "Ocupado")}>Ocupado</button>
                      <button className="secondary small" onClick={() => quickStatus(r, "Limpeza")}>Limpeza</button>
                      <button className="secondary small" onClick={() => quickStatus(r, "Manutenção")}>Manut.</button>
                    </div>
                    {canAdmin(profile) && <button className="icon" onClick={() => setOpen(r)}><Pencil size={17} /></button>}
                    {canAdmin(profile) && <button className="icon danger-text" onClick={() => remove(r.id)}><Trash2 size={17} /></button>}
                  </td>
                </tr>
              ))}
            </React.Fragment>
          );
        })}
      </Table>
      {open && <RoomForm room={open} profile={profile} notify={notify} onClose={() => setOpen(null)} />}
    </>
  );
}

function RoomForm({ room, profile, notify, onClose }) {
  const [form, setForm] = useState({
    number: room.number || "",
    name: room.name || (room.number ? `Quarto ${room.number}` : ""),
    floor: room.floor || 1,
    type: room.type || "Quarto Casal",
    status: room.status || "Livre",
    guest: room.guest || "",
    dailyValue: room.dailyValue ?? room.price ?? 180,
    active: room.active ?? true,
    capacity: room.capacity || "",
    beds: room.beds || "",
    notes: room.notes || room.obs || ""
  });
  const [error, setError] = useState("");

  async function saveRoom() {
    if (!canAdmin(profile)) return alert("Apenas administradores podem criar ou editar quartos.");
    try {
      setError("");
      if (!String(form.number).trim()) {
        setError("Informe o número do quarto.");
        return;
      }
      const payload = {
        ...form,
        floor: Number(form.floor),
        dailyValue: Number(form.dailyValue),
        active: form.active === true || String(form.active).toLowerCase() === "true",
        capacity: form.capacity === "" ? "" : Number(form.capacity),
        beds: form.beds,
        notes: form.notes,
        ...ownershipFields(profile)
      };
      if (room.id) {
        await updateDoc(doc(db, "rooms", room.id), payload);
        await logAudit(profile, "edição de quartos", "quartos", `Quarto ${form.number} editado.`);
        notify?.(`Quarto ${form.number} atualizado.`);
      } else {
        await addDoc(collection(db, "rooms"), { ...payload, createdAt: serverTimestamp() });
        await logAudit(profile, "criação de quartos", "quartos", `Quarto ${form.number} criado.`);
        notify?.(`Quarto ${form.number} criado.`);
      }
      onClose();
    } catch (err) {
      console.error("[Firebase] Erro ao salvar quarto", err);
      setError(firebaseErrorMessage(err));
    }
  }

  return (
    <Modal title={room.id ? "Editar Quarto" : "Novo Quarto"} onClose={onClose} className="room-modal">
      {error && <div className="notice-box modal-notice">{error}</div>}
      <div className="form-section">
        <h3>Dados principais</h3>
        <div className="form-grid room-form-grid">
          <div>
            <label>Numero</label>
            <input value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value, name: form.name || `Quarto ${e.target.value}` })} />
          </div>

          <div>
            <label>Nome</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          <div>
            <label>Andar</label>
            <input type="number" value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} />
          </div>

          <div>
            <label>Tipo</label>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option>Quarto Casal</option>
              <option>Quarto Solteiro</option>
              <option>Quarto Duplo</option>
              <option>Suíte</option>
              <option>Família</option>
            </select>
          </div>

          <div>
            <label>Valor da diária</label>
            <input type="number" value={form.dailyValue} onChange={(e) => setForm({ ...form, dailyValue: e.target.value })} />
          </div>

          <div>
            <label>Status</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option>Livre</option>
              <option>Ocupado</option>
              <option>Limpeza</option>
              <option>Manutenção</option>
            </select>
          </div>

          <div className="wide">
            <label>Ativo</label>
            <select value={String(form.active)} onChange={(e) => setForm({ ...form, active: e.target.value === "true" })}>
              <option value="true">Ativo</option>
              <option value="false">Inativo</option>
            </select>
          </div>
        </div>
      </div>

      <div className="form-section">
        <h3>Detalhes do quarto</h3>
        <div className="form-grid room-form-grid">
          <div>
            <label>Capacidade</label>
            <input type="number" min="0" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} placeholder="Ex: 2" />
          </div>

          <div>
            <label>Camas</label>
            <input value={form.beds} onChange={(e) => setForm({ ...form, beds: e.target.value })} placeholder="Ex: 1 casal" />
          </div>

          <div className="wide">
            <label>Observações</label>
            <textarea rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Observações internas do quarto" />
          </div>
        </div>
      </div>

      <div className="form-actions sticky-actions">
        <button className="secondary" onClick={onClose}>Cancelar</button>
        <button className="primary" onClick={saveRoom}>Salvar alterações</button>
      </div>
    </Modal>
  );
}

function Guests({ guests, reservations, profile, notify }) {
  const [open, setOpen] = useState(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const filtered = guests.filter((g) => `${g.name} ${g.doc} ${g.phone} ${g.obs}`.toLowerCase().includes(q.toLowerCase()));
  async function remove(id) {
    const guest = guests.find((item) => item.id === id);
    if (confirm("Excluir hospede?")) {
      try {
        await deleteDoc(doc(db, "guests", id));
        await logAudit(profile, "exclusão de hóspedes", "hóspedes", `Hóspede ${guest?.name || id} excluído.`);
        notify?.(`Hóspede ${guest?.name || id} excluído.`);
      } catch (err) {
        console.error("[Firebase] Erro ao excluir hóspede", err);
        setError(firebaseErrorMessage(err));
      }
    }
  }
  return (
    <>
      <PageTitle title="Hóspedes">
        <div className="search-box"><Search size={17} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar hospede..." /></div>
        <button className="primary" onClick={() => setOpen({})}><Plus size={17} /> Novo Hóspede</button>
      </PageTitle>
      {error && <div className="notice-box">{error}</div>}
      <Table heads={["Nome", "CPF", "Telefone", "Observacoes", "Historico", "Ações"]}>
        {filtered.map((g) => {
          const history = reservations.filter((r) => r.guest === g.name);
          return (
            <tr key={g.id}>
              <td>{g.name}</td><td>{g.doc}</td><td>{g.phone}</td><td>{g.obs || "-"}</td>
              <td>{history.length} hospedagem(ns)</td>
              <td className="right"><button className="icon" onClick={() => setOpen(g)}><Pencil size={17} /></button>{canAdmin(profile) && <button className="icon danger-text" onClick={() => remove(g.id)}><Trash2 size={17} /></button>}</td>
            </tr>
          );
        })}
      </Table>
      {open && <GuestForm guest={open} profile={profile} notify={notify} onClose={() => setOpen(null)} />}
    </>
  );
}
function GuestForm({ guest, profile, notify, onClose }) {
  const [form, setForm] = useState({
    name: guest.name || "",
    doc: guest.doc || "",
    phone: guest.phone || "",
    email: guest.email || "",
    city: guest.city || "",
    obs: guest.obs || ""
  });
  const [error, setError] = useState("");
  async function saveGuest() {
    try {
      setError("");
      if (!form.name.trim()) {
        setError("Informe o nome do hóspede.");
        return;
      }
      if (guest.id) {
        await updateDoc(doc(db, "guests", guest.id), { ...form, ...ownershipFields(profile) });
        await logAudit(profile, "edição de hóspedes", "hóspedes", `Hóspede ${form.name} editado.`);
        notify?.(`Hóspede ${form.name} atualizado.`);
      } else {
        await addDoc(collection(db, "guests"), { ...form, ...ownershipFields(profile), createdAt: serverTimestamp() });
        await logAudit(profile, "criação de hóspedes", "hóspedes", `Hóspede ${form.name} criado.`);
        notify?.(`Hóspede ${form.name} cadastrado.`);
      }
      onClose();
    } catch (err) {
      console.error("[Firebase] Erro ao salvar hóspede", err);
      setError(firebaseErrorMessage(err));
    }
  }
  return (
    <Modal title={guest.id ? "Editar Hóspede" : "Novo Hóspede"} onClose={onClose}>
      {error && <div className="notice-box">{error}</div>}
      <div className="form-grid">
        <div className="wide"><label>Nome Completo</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><label>CPF / Documento</label><input value={form.doc} onChange={(e) => setForm({ ...form, doc: e.target.value })} /></div>
        <div><label>Telefone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div><label>Email</label><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div><label>Cidade</label><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
        <div className="wide"><label>Observações</label><input value={form.obs} onChange={(e) => setForm({ ...form, obs: e.target.value })} /></div>
      </div>
      <div className="form-actions"><button className="secondary" onClick={onClose}>Cancelar</button><button className="primary" onClick={saveGuest}>Salvar</button></div>
    </Modal>
  );
}

function Reservations({ state, profile, notify }) {
  const [open, setOpen] = useState(false);
  const [approveModal, setApproveModal] = useState(null);
  const [approveForm, setApproveForm] = useState({});
  const [error, setError] = useState("");
  
  const pendingReservations = state.reservations.filter((r) => r.status === "pendente" && r.source === "site");
  const activeReservations = state.reservations.filter((r) => r.status !== "pendente" && r.status !== "Cancelada" && r.status !== "Finalizada");
  
  async function checkout(r) {
    try {
      setError("");
      await updateDoc(doc(db, "reservations", r.id), { status: "Finalizada", ...ownershipFields(profile) });
      const room = state.rooms.find((x) => x.number === r.room);
      if (room) await updateDoc(doc(db, "rooms", room.id), { status: "Limpeza", guest: "", ...ownershipFields(profile) });
      await logAudit(profile, "check-out", "reservas", `Check-out de ${r.guest} no quarto ${r.room}.`);
      notify?.(`Check-out de ${r.guest} concluído.`);
    } catch (err) {
      console.error("[Firebase] Erro no check-out", err);
      setError(firebaseErrorMessage(err));
    }
  }
  async function cancelReservation(r) {
    try {
      setError("");
      await updateDoc(doc(db, "reservations", r.id), { status: "Cancelada", ...ownershipFields(profile) });
      const room = state.rooms.find((x) => x.number === r.room);
      if (room && room.guest === r.guest) await updateDoc(doc(db, "rooms", room.id), { status: "Livre", guest: "", ...ownershipFields(profile) });
      await logAudit(profile, "cancelamento", "reservas", `Reserva de ${r.guest} no quarto ${r.room} cancelada.`);
      notify?.(`Reserva de ${r.guest} cancelada.`);
    } catch (err) {
      console.error("[Firebase] Erro ao cancelar reserva", err);
      setError(firebaseErrorMessage(err));
    }
  }
  
  async function approvePendingReservation() {
    if (!approveForm.guest || !approveForm.room) {
      setError("Selecione hóspede e quarto.");
      return;
    }
    const reservation = pendingReservations.find((r) => r.id === approveModal.id);
    if (!reservation) return;
    
    const selectedRoom = state.rooms.find((r) => r.number === approveForm.room);
    const days = Math.max(1, Math.ceil((new Date(approveForm.exit) - new Date(approveForm.entry)) / 86400000));
    const value = days * Number(selectedRoom?.dailyValue ?? selectedRoom?.price ?? 0);
    
    try {
      const guestRef = await addDoc(collection(db, "guests"), {
        name: approveForm.guest,
        doc: reservation.cpf || "",
        phone: reservation.phone,
        obs: reservation.notes || "",
        ...ownershipFields(profile),
        createdAt: serverTimestamp()
      });
      
      await updateDoc(doc(db, "reservations", reservation.id), {
        status: "Ativa",
        guest: approveForm.guest,
        room: approveForm.room,
        entry: approveForm.entry,
        exit: approveForm.exit,
        people: reservation.people,
        payment: approveForm.payment || "PIX",
        value: value,
        ...ownershipFields(profile)
      });
      
      await addDoc(collection(db, "cash"), {
        desc: `Check-in - ${approveForm.guest} - Quarto ${approveForm.room} (Site)`,
        type: "Entrada",
        cat: "Diária",
        pay: approveForm.payment || "PIX",
        value,
        date: approveForm.entry,
        ...ownershipFields(profile),
        createdAt: serverTimestamp()
      });
      
      await updateDoc(doc(db, "rooms", selectedRoom.id), {
        status: "Ocupado",
        guest: approveForm.guest,
        ...ownershipFields(profile)
      });
      
      await logAudit(profile, "aprovação de reserva", "reservas", `Reserva do site de ${approveForm.guest} aprovada e vinculada ao quarto ${approveForm.room}.`);
      notify?.(`Reserva do site aprovada para o quarto ${approveForm.room}.`);
      setApproveModal(null);
      setApproveForm({});
    } catch (error) {
      console.error("Erro ao aprovar reserva:", error);
      setError(firebaseErrorMessage(error));
    }
  }
  
  async function rejectPendingReservation(id) {
    if (!confirm("Rejeitar esta reserva?")) return;
    const reservation = state.reservations.find((r) => r.id === id);
    try {
      setError("");
      await updateDoc(doc(db, "reservations", id), { status: "Rejeitada", ...ownershipFields(profile) });
      await logAudit(profile, "rejeição de reserva", "reservas", `Reserva do site de ${reservation?.guestName} foi rejeitada.`);
      notify?.("Reserva do site rejeitada.");
    } catch (err) {
      console.error("[Firebase] Erro ao rejeitar reserva", err);
      setError(firebaseErrorMessage(err));
    }
  }
  
  function pdf(r) {
    const docPdf = new jsPDF({ format: "a5" });
    docPdf.setFontSize(16);
    docPdf.text("Pousada Alto Da Cruz", 20, 20);
    docPdf.setFontSize(12);
    docPdf.text("Resumo da Reserva", 20, 32);
    docPdf.text(`Hóspede: ${r.guest}`, 20, 50);
    docPdf.text(`Quarto: ${r.room}`, 20, 60);
    docPdf.text(`Entrada: ${brDate(r.entry)}`, 20, 70);
    docPdf.text(`Saída: ${brDate(r.exit)}`, 20, 80);
    docPdf.text(`Pagamento: ${r.payment}`, 20, 90);
    docPdf.text(`Valor: ${money(r.value)}`, 20, 100);
    docPdf.text("Obrigado pela preferência!", 20, 122);
    docPdf.save(`reserva-${r.guest}.pdf`);
  }
  
  return (
    <>
      <PageTitle title="Reservas">
        <button className="primary" onClick={() => setOpen(true)}><Plus size={17} /> Nova Reserva</button>
      </PageTitle>
      {error && <div className="notice-box">{error}</div>}
      
      {pendingReservations.length > 0 && (
        <div className="pending-site-block">
          <h3>Reservas Pendentes do Site ({pendingReservations.length})</h3>
          <Table heads={["Hóspede", "Telefone", "CPF", "Entrada", "Saída", "Hóspedes", "Tipo Quarto", "Observações", "Ações"]}>
            {pendingReservations.map((r) => (
              <tr key={r.id}>
                <td>{r.guestName}</td>
                <td>{r.phone}</td>
                <td>{r.cpf || "-"}</td>
                <td>{brDate(r.checkIn)}</td>
                <td>{brDate(r.checkOut)}</td>
                <td>{r.people}</td>
                <td>{r.roomType}</td>
                <td>{r.notes || "-"}</td>
                <td className="right">
                  <button className="secondary small" onClick={() => {
                    setApproveForm({
                      guest: r.guestName,
                      room: "",
                      entry: r.checkIn,
                      exit: r.checkOut,
                      payment: "PIX"
                    });
                    setApproveModal(r);
                  }}>Aprovar</button>
                  <button className="secondary small" onClick={() => rejectPendingReservation(r.id)}>Rejeitar</button>
                </td>
              </tr>
            ))}
          </Table>
        </div>
      )}
      
      <h3 className="section-heading">Reservas Ativas</h3>
      <Table heads={["Hóspede", "Quarto", "Entrada", "Saída", "Valor", "Pagamento", "Status", "Ações"]}>
        {activeReservations.map((r) => (
          <tr key={r.id}>
            <td>{r.guest}</td><td>{r.room}</td><td>{brDate(r.entry)}</td><td>{brDate(r.exit)}</td><td><b>{money(r.value)}</b></td><td>{r.payment}</td><td><span className={`pill ${r.status}`}>{r.status}</span></td>
            <td className="right"><button className="icon text-btn" onClick={() => pdf(r)}><FileText size={17} /> PDF</button><button className="secondary small" onClick={() => checkout(r)}>Check-Out</button><button className="secondary small" onClick={() => cancelReservation(r)}>Cancelar</button></td>
          </tr>
        ))}
      </Table>
      {open && <CheckinForm state={state} profile={profile} notify={notify} onClose={() => setOpen(false)} />}
      
      {approveModal && (
        <Modal title="Aprovar Reserva do Site" onClose={() => { setApproveModal(null); setApproveForm({}); }}>
          <div className="form-grid">
            <div className="wide">
              <label>Hóspede</label>
              <input value={approveForm.guest} readOnly className="readonly-input" />
            </div>
            <div><label>Data de Entrada</label><input type="date" value={approveForm.entry} onChange={(e) => setApproveForm({ ...approveForm, entry: e.target.value })} /></div>
            <div><label>Data de Saída</label><input type="date" value={approveForm.exit} onChange={(e) => setApproveForm({ ...approveForm, exit: e.target.value })} /></div>
            <div><label>Quarto</label><select value={approveForm.room} onChange={(e) => setApproveForm({ ...approveForm, room: e.target.value })}><option value="">Selecionar quarto...</option>{state.rooms.filter((r) => r.status === "Livre").map((r) => <option key={r.id} value={r.number}>{r.number} - {r.type}</option>)}</select></div>
            <div><label>Pagamento</label><select value={approveForm.payment} onChange={(e) => setApproveForm({ ...approveForm, payment: e.target.value })}><option value="PIX">PIX</option><option value="Débito">Débito</option><option value="Crédito">Crédito</option><option value="Dinheiro">Dinheiro</option></select></div>
          </div>
          <div className="form-actions">
            <button className="secondary" onClick={() => { setApproveModal(null); setApproveForm({}); }}>Cancelar</button>
            <button className="primary" onClick={approvePendingReservation}>Aprovar Reserva</button>
          </div>
        </Modal>
      )}
    </>
  );
}

function CheckinForm({ state, profile, notify, onClose }) {
  const freeRooms = state.rooms.filter((r) => r.status === "Livre");
  const [guest, setGuest] = useState(state.guests[0]?.name || "");
  const [room, setRoom] = useState(freeRooms[0]?.number || "");
  const [entry, setEntry] = useState(today());
  const [exit, setExit] = useState(nextDay());
  const [payment, setPayment] = useState("PIX");
  const [error, setError] = useState("");

  const selectedRoom = state.rooms.find((r) => r.number === room);
  const days = Math.max(1, Math.ceil((new Date(exit) - new Date(entry)) / 86400000));
  const value = days * Number(selectedRoom?.dailyValue ?? selectedRoom?.price ?? 0);

  async function saveCheckin() {
    try {
      setError("");
      if (!guest || !room) {
        setError("Selecione hóspede e quarto.");
        return;
      }
      if (!selectedRoom?.id) {
        setError("Quarto selecionado não está disponível.");
        return;
      }
      const owner = ownershipFields(profile);
      const reservation = { guest, room, entry, exit, payment, value, status: "Ativa", ...owner, createdAt: serverTimestamp() };
      await addDoc(collection(db, "reservations"), reservation);
      await addDoc(collection(db, "cash"), {
        desc: `Check-in - ${guest} - Quarto ${room}`,
        type: "Entrada",
        cat: "Diária",
        pay: payment,
        value,
        date: entry,
        ...owner,
        createdAt: serverTimestamp()
      });
      await updateDoc(doc(db, "rooms", selectedRoom.id), { status: "Ocupado", guest, ...owner });
      await logAudit(profile, "check-in", "reservas", `Check-in de ${guest} no quarto ${room}.`);
      await logAudit(profile, "criação de reservas", "reservas", `Reserva criada para ${guest} no quarto ${room}.`);
      notify?.(`Check-in de ${guest} confirmado.`);
      onClose();
    } catch (err) {
      console.error("[Firebase] Erro ao confirmar check-in", err);
      setError(firebaseErrorMessage(err));
    }
  }

  return (
    <Modal title="Nova Reserva" onClose={onClose}>
      {error && <div className="notice-box">{error}</div>}
      {state.guests.length === 0 && <div className="notice-box">Cadastre um hóspede antes de criar uma reserva.</div>}
      {freeRooms.length === 0 && <div className="notice-box">Não há quartos livres para check-in.</div>}
      <label>Hóspede</label><select value={guest} onChange={(e) => setGuest(e.target.value)}>{state.guests.map((g) => <option key={g.id}>{g.name}</option>)}</select>
      <label>Quarto</label><select value={room} onChange={(e) => setRoom(e.target.value)}>{freeRooms.map((r) => <option key={r.id} value={r.number}>{r.number} - {r.type}</option>)}</select>
      <div className="form-grid">
        <div><label>Data de Entrada</label><input type="date" value={entry} onChange={(e) => setEntry(e.target.value)} /></div>
        <div><label>Data de Saída</label><input type="date" value={exit} onChange={(e) => setExit(e.target.value)} /></div>
        <div><label>Diárias</label><input value={days} readOnly /></div>
        <div><label>Valor Previsto</label><input value={money(value)} readOnly /></div>
      </div>
      <label>Forma de Pagamento</label><select value={payment} onChange={(e) => setPayment(e.target.value)}><option>Dinheiro</option><option>PIX</option><option>Cartão</option></select>
      <div className="form-actions"><button className="secondary" onClick={onClose}>Cancelar</button><button className="primary" onClick={saveCheckin}>Confirmar</button></div>
    </Modal>
  );
}

function Cash({ cash, profile, notify }) {
  const [open, setOpen] = useState(false);
  const entradas = cash.filter((c) => c.type === "Entrada").reduce((s, c) => s + Number(c.value || 0), 0);
  const saidas = cash.filter((c) => c.type === "Saída").reduce((s, c) => s + Number(c.value || 0), 0);
  const hoje = today();
  const entradasHoje = cash.filter((c) => c.type === "Entrada" && c.date === hoje).reduce((s, c) => s + Number(c.value || 0), 0);
  const saidasHoje = cash.filter((c) => c.type === "Saída" && c.date === hoje).reduce((s, c) => s + Number(c.value || 0), 0);  return (
    <>
      <PageTitle title="Caixa"><button className="primary" onClick={() => setOpen(true)}><Plus size={17} /> Nova Movimentação</button></PageTitle>
      <div className="cards">
        <div className="card metric in"><b>Entradas</b><h2>{money(entradas)}</h2></div>
        <div className="card metric out"><b>Saídas</b><h2>{money(saidas)}</h2></div>
        <div className="card metric"><b>Saldo</b><h2>{money(entradas - saidas)}</h2></div>
      </div>
      <div className="card day-report">
        <h3>Relatório simples do dia</h3>
        <p>Entradas hoje: <b>{money(entradasHoje)}</b></p>
        <p>Saídas hoje: <b>{money(saidasHoje)}</b></p>
        <p>Saldo hoje: <b>{money(entradasHoje - saidasHoje)}</b></p>
      </div>      <Table heads={["Descrição", "Tipo", "Categoria", "Pagamento", "Valor", "Data"]}>
        {cash.map((c) => (
          <tr key={c.id}>
            <td>{c.desc}</td><td><span className={`pill ${c.type}`}>{c.type}</span></td><td>{c.cat}</td><td>{c.pay}</td><td><b className={c.type === "Saída" ? "danger-text" : "gold-text"}>{money(c.value)}</b></td><td>{brDate(c.date)}</td>
          </tr>
        ))}
      </Table>
      {open && <CashForm profile={profile} notify={notify} onClose={() => setOpen(false)} />}
    </>
  );
}

function CashForm({ profile, notify, onClose }) {
  const [form, setForm] = useState({ desc: "", type: "Entrada", cat: "Diária", pay: "PIX", value: 0, date: today() });
  const [error, setError] = useState("");
  async function saveCash() {
    try {
      setError("");
      if (!Number(form.value)) {
        setError("Informe um valor maior que zero.");
        return;
      }
      await addDoc(collection(db, "cash"), { ...form, value: Number(form.value), ...ownershipFields(profile), createdAt: serverTimestamp() });
      const cat = normalizeRole(form.cat);
      const action = cat.includes("abertura") ? "abertura de caixa" : cat.includes("fechamento") ? "fechamento de caixa" : cat.includes("sangria") ? "sangria" : "movimentação de caixa";
      await logAudit(profile, action, "caixa", `${form.type} de ${money(form.value)} registrada: ${form.desc || form.cat}.`);
      notify?.("Movimentação de caixa registrada.");
      onClose();
    } catch (err) {
      console.error("[Firebase] Erro ao salvar movimentação", err);
      setError(firebaseErrorMessage(err));
    }
  }
  return (
    <Modal title="Nova Movimentação" onClose={onClose}>
      {error && <div className="notice-box">{error}</div>}
      <label>Descrição</label><input value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} />
      <label>Tipo</label><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option>Entrada</option><option>Saída</option></select>
      <label>Categoria</label><select value={form.cat} onChange={(e) => setForm({ ...form, cat: e.target.value })}><option>Diária</option><option>Abertura de caixa</option><option>Fechamento de caixa</option><option>Sangria</option><option>Despesa</option><option>Outros</option></select>
      <label>Pagamento</label><select value={form.pay} onChange={(e) => setForm({ ...form, pay: e.target.value })}><option>PIX</option><option>Dinheiro</option><option>Cartão</option></select>
      <label>Valor</label><input type="number" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
      <label>Data</label><input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
      <div className="form-actions"><button className="secondary" onClick={onClose}>Cancelar</button><button className="primary" onClick={saveCash}>Salvar</button></div>
    </Modal>
  );
}

function Team({ users, shifts, profile }) {
  const [open, setOpen] = useState(false);
  const visibleUsers = Array.isArray(users) ? users : [];
  const groupedByShift = visibleUsers.reduce((groups, user) => {
    const shift = user.shift || user.cargo || "Sem turno";
    return { ...groups, [shift]: [...(groups[shift] || []), user] };
  }, {});
  const hasShiftUsers = Object.keys(groupedByShift).length > 0;

  async function sendShift(s) {
    window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Escala Pousada Alto Da Cruz: ${s.name} em ${brDate(s.date)} das ${s.time}`)}`);
  }

  async function removeUser(user) {
    if (!canAdmin(profile)) return;
    const id = user.id || user.uid;
    if (!id) return alert("Usuário sem UID para excluir.");
    if (id === auth.currentUser?.uid) return alert("Você não pode excluir sua própria conta por aqui.");
    if (confirm(`Excluir usuário ${user.name || user.email || id}?`)) {
      await deleteDoc(doc(db, "users", id));
      await logAudit(profile, "alterações administrativas", "usuários", `Usuário ${user.name || user.email || id} excluído.`);
    }
  }

  return (
    <>
      <PageTitle title="Equipe & Escala">
        {canAdmin(profile) && <button className="primary" onClick={() => setOpen(true)}><Plus size={17} /> Cadastrar Usuário</button>}
      </PageTitle>
      <div className="grid2">
        <div className="card">
          <h3>Usuários</h3>
          {visibleUsers.length === 0 ? (
            <div className="empty-box">Nenhum usuário cadastrado</div>
          ) : (
            <div className="user-list">
              {visibleUsers.map((u) => (
                <div className="user-detail-row" key={u.id || u.uid || u.email}>
                  <div>
                    <b>{u.name || u.nome || "Sem nome"}</b>
                    <small>CPF: {u.cpf || "-"}</small>
                    <small>Email: {u.email || "-"}</small>
                    <small>Role: {u.role || "-"}</small>
                    <small>Turno: {u.shift || u.cargo || "-"}</small>
                  </div>
                  <span className={`badge ${u.active === true || String(u.active).toLowerCase() === "true" ? "success-badge" : "muted-badge"}`}>
                    {u.active === true || String(u.active).toLowerCase() === "true" ? "active: true" : "active: false"}
                  </span>
                  {canAdmin(profile) && (
                    <div className="table-actions">
                      <button className="icon" onClick={() => setOpen(u)}><Pencil size={17} /></button>
                      <button className="icon danger-text" onClick={() => removeUser(u)}><Trash2 size={17} /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <h3>Escala 12h</h3>
          {hasShiftUsers ? (
            Object.entries(groupedByShift).map(([shift, people]) => (
              <div className="shift-group" key={shift}>
                <h4>{shift}</h4>
                {people.map((u) => (
                  <div className="list-row" key={u.id || u.uid || `${shift}-${u.email}`}>
                    <div><b>{u.name || u.nome || "Sem nome"}</b><small>{u.role || "-"} - {u.email || u.cpf || "-"}</small></div>
                  </div>
                ))}
              </div>
            ))
          ) : shifts.length === 0 ? (
            <div className="empty-box">Nenhuma escala cadastrada</div>
          ) : (
            shifts.map((s) => (
              <div className="list-row" key={s.id}>
                <div><b>{s.name}</b><small>{brDate(s.date)} - {s.time}</small></div>
                <button className="secondary small" onClick={() => sendShift(s)}>WhatsApp</button>
              </div>
            ))
          )}
        </div>
      </div>
      {open && <UserForm profile={profile} user={open === true ? null : open} onClose={() => setOpen(false)} />}
    </>
  );
}

function UserForm({ profile, user, onClose }) {
  const editing = Boolean(user?.id || user?.uid);
  const [form, setForm] = useState({
    name: user?.name || user?.nome || "",
    email: user?.email || "",
    cpf: user?.cpf || "",
    password: "",
    role: user?.role || "funcionario",
    cargo: user?.cargo || "",
    shift: user?.shift || "Diurno 07h-19h",
    active: user?.active === true || String(user?.active).toLowerCase() === "true",
    status: user?.status || "ativo"
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function saveUser() {
    setError("");
    setMessage("");
    if (!canAdmin(profile)) {
      setError("Apenas administradores podem cadastrar contas.");
      return;
    }
    if (!form.name.trim()) {
      setError("Informe o nome do usuário.");
      return;
    }
    if (!editing && !form.email.trim() && !form.cpf.trim()) {
      setError("Informe email ou CPF para criar o login.");
      return;
    }
    if (!editing && form.password.length < 6) {
      setError("A senha inicial precisa ter pelo menos 6 caracteres.");
      return;
    }

    let secondary;
    try {
      setError("");
      setMessage("");
      setSaving(true);
      const owner = ownershipFields(profile);
      const payload = {
        nome: form.name,
        name: form.name,
        email: form.email ? form.email.trim() : user?.email || "",
        cpf: formatCPF(form.cpf),
        cargo: form.cargo || form.shift,
        shift: form.shift,
        role: form.role,
        active: form.active,
        status: form.status,
        ...owner,
      };

      if (editing) {
        const id = user.id || user.uid;
        await updateDoc(doc(db, "users", id), {
          ...payload,
          uid: user.uid || id,
          updatedAt: serverTimestamp()
        });
        await logAudit(profile, "alterações administrativas", "usuários", `Usuário ${form.name} atualizado.`);
        setMessage("Usuário atualizado com sucesso.");
      } else {
        secondary = initializeApp(firebaseConfig, "secondary-" + Date.now());
        const secondaryAuth = getAuth(secondary);
        const userEmail = form.email ? form.email.trim() : cpfToEmail(form.cpf);
        const cred = await createUserWithEmailAndPassword(secondaryAuth, userEmail, form.password);
        await setDoc(doc(db, "users", cred.user.uid), {
          ...payload,
          uid: cred.user.uid,
          email: userEmail,
          active: true,
          createdAt: serverTimestamp()
        });
        await signOut(secondaryAuth);
        await logAudit(profile, "alterações administrativas", "usuários", `Usuário ${form.name} cadastrado.`);
        setMessage("Usuário cadastrado com sucesso.");
      }
      onClose();
    } catch (err) {
      console.error("[Firebase] Erro ao criar usuário", err);
      setError(firebaseErrorMessage(err));
    } finally {
      if (secondary) await deleteApp(secondary);
      setSaving(false);
    }
  }

  return (
    <Modal title={editing ? "Editar Usuário" : "Cadastrar Usuário"} onClose={onClose}>
      {message && <div className="success-box">{message}</div>}
      {error && <div className="notice-box">{error}</div>}
      <label>Nome</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <label>Email</label><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@empresa.com" />
      <label>CPF</label><input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: formatCPF(e.target.value) })} placeholder="000.000.000-00" />
      {!editing && (
        <>
          <label>Senha inicial</label><input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </>
      )}
      <label>Role</label><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option>funcionario</option><option>recepcao</option><option>gerente</option><option>admin</option></select>
      <label>Status</label><input value={form.status} readOnly />
      <label>Ativo</label><select value={String(form.active)} onChange={(e) => setForm({ ...form, active: e.target.value === "true" })}><option value="true">true</option><option value="false">false</option></select>
      <label>Função / Cargo</label><input value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} placeholder="Recepção, Gerência..." />
      <label>Turno</label><select value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })}><option>Diurno 07h-19h</option><option>Noturno 19h-07h</option></select>
      <div className="form-actions"><button className="secondary" onClick={onClose}>Cancelar</button><button className="primary" onClick={saveUser} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</button></div>
    </Modal>
  );
}
function Reports({ state }) {
  const entradas = state.cash.filter((c) => c.type === "Entrada").reduce((s, c) => s + Number(c.value || 0), 0);
  const saidas = state.cash.filter((c) => c.type === "Saída").reduce((s, c) => s + Number(c.value || 0), 0);
  return (
    <>
      <PageTitle title="Relatórios" />
      <div className="cards">
        <div className="card"><h3>Receita</h3><h2>{money(entradas)}</h2></div>
        <div className="card"><h3>Despesas</h3><h2>{money(saidas)}</h2></div>
        <div className="card"><h3>Lucro</h3><h2>{money(entradas - saidas)}</h2></div>
      </div>
      <div className="card">
        <h3>Resumo Geral</h3>
        <p>Quartos cadastrados: <b>{state.rooms.length}</b></p>
        <p>Hóspedes cadastrados: <b>{state.guests.length}</b></p>
        <p>Reservas ativas: <b>{state.reservations.filter((r) => r.status === "Ativa").length}</b></p>
      </div>
    </>
  );
}

function Config({ profile }) {
  const [form, setForm] = useState({
    pousada: "Pousada Alto Da Cruz",
    endereco: "Endereço da pousada",
    telefone: "(00) 00000-0000",
  });
  const [settingsMessage, setSettingsMessage] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [passwordForm, setPasswordForm] = useState({ current: "", next: "", confirm: "" });
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);

  async function salvar() {
    try {
      setSettingsMessage("");
      setSettingsError("");
      await setDoc(doc(db, "settings", "pousada"), {
        ...form,
        ...ownershipFields(profile),
        updatedAt: serverTimestamp(),
      });
      await logAudit(profile, "alterações administrativas", "configurações", "Configurações administrativas da pousada atualizadas.");
      setSettingsMessage("Configurações salvas com sucesso.");
    } catch (err) {
      console.error("[Firebase] Erro ao salvar configuracoes", err);
      setSettingsError(firebaseErrorMessage(err));
    }
  }

  async function changePassword() {
    try {
      setPasswordMessage("");
      setPasswordError("");

      if (!auth.currentUser) {
        setPasswordError("Sessao expirada. Entre novamente para alterar a senha.");
        return;
      }
      if (!auth.currentUser.email) {
        setPasswordError("Nao foi possivel identificar o email do login atual.");
        return;
      }
      if (passwordForm.next.length < 6) {
        setPasswordError("A nova senha precisa ter pelo menos 6 caracteres.");
        return;
      }
      if (passwordForm.next !== passwordForm.confirm) {
        setPasswordError("A nova senha e a confirmacao precisam ser iguais.");
        return;
      }
      if (!passwordForm.current) {
        setPasswordError("Informe a senha atual.");
        return;
      }

      setPasswordBusy(true);
      const credential = EmailAuthProvider.credential(auth.currentUser.email, passwordForm.current);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, passwordForm.next);
      await logAudit(profile, "alteração de senha", "configurações", "Usuário alterou a própria senha.");
      setPasswordForm({ current: "", next: "", confirm: "" });
      setPasswordMessage("Senha alterada com sucesso.");
    } catch (err) {
      console.error("[Firebase] Erro ao alterar senha", err);
      setPasswordError(firebaseErrorMessage(err));
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <>
      <PageTitle title="Configurações" />

      <div className="grid2">
        <div className="card">
          <h3>Minha conta</h3>

          <label>Nome</label>
          <input value={profile?.name || profile?.nome || auth.currentUser?.displayName || "Usuário"} readOnly />

          <label>Email / CPF</label>
          <input value={profile?.email || auth.currentUser?.email || profile?.cpf || "CPF Login"} readOnly />

          <label>Cargo</label>
          <input value={profile?.cargo || profile?.role || "-"} readOnly />

          <label>Turno</label>
          <input value={profile?.shift || "-"} readOnly />

          <h3 className="section-subtitle">Alterar senha</h3>
          {passwordMessage && <div className="success-box">{passwordMessage}</div>}
          {passwordError && <div className="notice-box">{passwordError}</div>}

          <label>Senha atual</label>
          <input type="password" value={passwordForm.current} onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })} />

          <label>Nova senha</label>
          <input type="password" value={passwordForm.next} onChange={(e) => setPasswordForm({ ...passwordForm, next: e.target.value })} />

          <label>Confirmar nova senha</label>
          <input type="password" value={passwordForm.confirm} onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })} />

          <div className="form-actions">
            <button className="secondary" onClick={() => auditAndSignOut(profile)}>Sair da Conta</button>
            <button className="primary" onClick={changePassword} disabled={passwordBusy}>{passwordBusy ? "Alterando..." : "Alterar senha"}</button>
          </div>
        </div>

        {canAdmin(profile) && (
        <div className="card">
          <h3>Informacoes da Pousada</h3>
          {settingsMessage && <div className="success-box">{settingsMessage}</div>}
          {settingsError && <div className="notice-box">{settingsError}</div>}

          <label>Nome</label>
          <input
            value={form.pousada}
            onChange={(e) => setForm({ ...form, pousada: e.target.value })}
          />

          <label>Endereço</label>
          <input
            value={form.endereco}
            onChange={(e) => setForm({ ...form, endereco: e.target.value })}
          />

          <label>Telefone</label>
          <input
            value={form.telefone}
            onChange={(e) => setForm({ ...form, telefone: e.target.value })}
          />

          <div className="form-actions">
            <button className="primary" onClick={salvar}>Salvar Configurações</button>
          </div>
        </div>
        )}
      </div>

      <div className="card">
        <h3>Sistema Premium</h3>
        <p>Login por CPF</p>
        <p>Firebase conectado</p>
        <p>Banco online Firestore</p>
        <p>Multiusuário</p>
        <p>Instalavel no computador e celular</p>
      </div>
    </>
  );
}

function AuditLogs({ logs, profile }) {
  const [q, setQ] = useState("");
  const safeLogs = Array.isArray(logs) ? logs : [];
  const sortedLogs = [...safeLogs].sort((a, b) => {
    const da = a.createdAt?.seconds || 0;
    const dbb = b.createdAt?.seconds || 0;
    return dbb - da;
  });
  const filtered = sortedLogs.filter((log) =>
    `${log.userName || ""} ${log.role || ""} ${log.action || ""} ${log.module || ""} ${log.description || ""}`.toLowerCase().includes(q.toLowerCase())
  );

  if (!canAdmin(profile)) {
    return <AccessPanel message="Você não possui permissão para acessar esta área." />;
  }

  return (
    <>
      <PageTitle title="Logs do Sistema">
        <div className="search-box"><Search size={17} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nos logs..." /></div>
      </PageTitle>
      <div className="card">
        <h3>Auditoria</h3>
        <p className="muted-text">Eventos de login, caixa, reservas, quartos, hóspedes e alterações administrativas.</p>
      </div>
      <Table heads={["Data", "Usuário", "Role", "Módulo", "Ação", "Descrição"]}>
        {filtered.length === 0 && (
          <tr><td colSpan={6}><div className="empty-box">Nenhum log encontrado.</div></td></tr>
        )}
        {filtered.map((log) => (
          <tr key={log.id}>
            <td>{formatTimestamp(log.createdAt)}</td>
            <td>{log.userName || log.userId || "-"}</td>
            <td>{log.role || "-"}</td>
            <td>{log.module || "-"}</td>
            <td><span className="badge">{log.action || "-"}</span></td>
            <td>{log.description || "-"}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}

function AccessPanel({ message }) {
  return (
    <div className="card">
      <h3>Acesso restrito</h3>
      <div className="notice-box">{message}</div>
    </div>
  );
}

function Table({ heads, children }) {
  return (
    <div className="table-wrap">
      <table>
        <thead><tr>{heads.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<AppMain />);
