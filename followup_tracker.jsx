import React, { useState, useMemo, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, LabelList,
} from "recharts";
import * as XLSX from "xlsx";
import {
  Upload, Download, Plus, Search, Pencil, Trash2, Check, X, AlertTriangle,
  Info, ArrowUp, ArrowDown, ArrowUpDown, RotateCcw, FileSpreadsheet, CheckCircle2,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Date + value helpers                                                */
/* ------------------------------------------------------------------ */
const now = new Date();
const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
  now.getDate()
).padStart(2, "0")}`;

function isoToDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function dateToIso(dt) {
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
    dt.getDate()
  ).padStart(2, "0")}`;
}
function addDays(iso, n) {
  if (!iso) return "";
  const dt = isoToDate(iso);
  dt.setDate(dt.getDate() + n);
  return dateToIso(dt);
}
function daysBetween(aIso, bIso) {
  return Math.round((isoToDate(bIso) - isoToDate(aIso)) / 86400000);
}
function overdueFrom(dueIso) {
  if (!dueIso) return null;
  return Math.round((isoToDate(todayIso) - isoToDate(dueIso)) / 86400000);
}
function fmtDate(iso) {
  if (!iso) return "—";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dt = isoToDate(iso);
  return `${months[dt.getMonth()]} ${dt.getDate()}, ${dt.getFullYear()}`;
}
function parseDateCell(v) {
  if (v == null || v === "") return "";
  if (v instanceof Date) return dateToIso(v);
  if (typeof v === "number") {
    // Excel serial fallback
    const ms = Math.round((v - 25569) * 86400000);
    const dt = new Date(ms);
    return dateToIso(new Date(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const parsed = new Date(s);
  if (!isNaN(parsed)) return dateToIso(parsed);
  return "";
}
function parsePeriodCell(v) {
  if (v == null || v === "") return null;
  if (v instanceof Date) return null;
  if (typeof v === "number") return Math.round(v);
  const s = String(v).toLowerCase();
  const m = s.match(/(\d+(\.\d+)?)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (/month/.test(s)) return Math.round(n * 30);
  if (/week/.test(s)) return Math.round(n * 7);
  if (/year|yr/.test(s)) return Math.round(n * 365);
  return Math.round(n);
}

/* ------------------------------------------------------------------ */
/* Department providers                                                 */
/* ------------------------------------------------------------------ */
// The four providers in the department. Patients are divided across these.
const PROVIDERS = ["Dr. A. Reyes", "Dr. M. Patel", "Dr. T. Nguyen", "Dr. K. Sullivan"];
const UNASSIGNED = "Unassigned";

// Match a free-text provider value from an import to one of our known providers.
function normalizeProvider(v) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  const exact = PROVIDERS.find((p) => p.toLowerCase() === s.toLowerCase());
  if (exact) return exact;
  // loose match on last name (e.g. "reyes", "Dr Reyes", "A. Reyes")
  const loose = PROVIDERS.find((p) => {
    const last = p.replace(/^dr\.?\s*/i, "").replace(/^[a-z]\.\s*/i, "").toLowerCase();
    return s.toLowerCase().includes(last);
  });
  return loose || s;
}

/* ------------------------------------------------------------------ */
/* Urgency model                                                       */
/* ------------------------------------------------------------------ */
const BAND_META = {
  critical: { label: "Critical", color: "#B3261E", tint: "#FAE9E7" },
  high:     { label: "High",     color: "#C2410C", tint: "#FBEDE2" },
  moderate: { label: "Moderate", color: "#A8730A", tint: "#F8F0DA" },
  due:      { label: "Due today", color: "#3F4A5E", tint: "#EBEEF3" },
  ontrack:  { label: "On track", color: "#177A45", tint: "#E5F2EA" },
  unknown:  { label: "No due date", color: "#8A93A6", tint: "#F0F2F5" },
  resolved: { label: "Resolved", color: "#8A93A6", tint: "#F0F2F5" },
};
const ACTIVE_BANDS = ["critical", "high", "moderate", "due", "ontrack"];

function bandOf(d, status) {
  if (status === "resolved") return "resolved";
  if (d == null) return "unknown";
  if (d > 30) return "critical";
  if (d >= 8) return "high";
  if (d >= 1) return "moderate";
  if (d === 0) return "due";
  return "ontrack";
}

function recompute(r) {
  const dueDate =
    r.dueDateOverride ||
    (r.lastVisit && r.fuPeriodDays !== "" && r.fuPeriodDays != null
      ? addDays(r.lastVisit, Number(r.fuPeriodDays))
      : "");
  const daysOverdue = dueDate ? overdueFrom(dueDate) : null;
  const band = bandOf(daysOverdue, r.status);
  return { ...r, dueDate, daysOverdue, band };
}

/* ------------------------------------------------------------------ */
/* Synthetic seed data (FAKE — for testing only)                       */
/* ------------------------------------------------------------------ */
const SEED = [
  ["Maria", "Alvarez", 90, 72], ["James", "Okafor", 30, 58], ["Wei", "Chen", 180, 45],
  ["Fatima", "Hassan", 90, 40], ["Robert", "Muller", 60, 33], ["Aisha", "Bello", 30, 31],
  ["David", "Kim", 90, 28], ["Sofia", "Rossi", 365, 21], ["Liam", "O'Brien", 30, 15],
  ["Priya", "Nair", 90, 12], ["Noah", "Schmidt", 60, 9], ["Emma", "Johansson", 30, 7],
  ["Carlos", "Mendez", 90, 5], ["Yuki", "Tanaka", 180, 3], ["Grace", "Mwangi", 30, 2],
  ["Omar", "Farouk", 90, 1], ["Hannah", "Berg", 60, 0], ["Ethan", "Walsh", 30, -4],
  ["Leila", "Haddad", 90, -10], ["Tomas", "Silva", 180, -18], ["Anna", "Kowalski", 30, -25],
  ["Ibrahim", "Diallo", 90, -40],
];
const APPT_OFFSETS = { 2: 6, 5: 13, 8: 3, 11: 9, 14: 18, 17: 7, 20: 21, 4: 2 };
function makeSeed() {
  return SEED.map(([first, last, period, target], i) => {
    const due = addDays(todayIso, -target);
    const lastVisit = addDays(due, -period);
    return {
      _id: `seed-${i}`,
      mrn: `MRN-${100201 + i}`,
      first,
      last,
      lastVisit,
      fuPeriodDays: period,
      dueDateOverride: "",
      apptDate: APPT_OFFSETS[i] != null ? addDays(todayIso, APPT_OFFSETS[i]) : "",
      provider: PROVIDERS[i % PROVIDERS.length],
      status: "active",
    };
  });
}

/* ------------------------------------------------------------------ */
/* Column mapping for imports                                          */
/* ------------------------------------------------------------------ */
function mapHeaders(header) {
  const idx = {};
  header.forEach((hRaw, i) => {
    const h = String(hRaw || "").toLowerCase().trim();
    if (idx.mrn == null && (h.includes("mrn") || h === "id" || h.includes("record number"))) idx.mrn = i;
    else if (idx.visit == null && h.includes("visit")) idx.visit = i;
    else if (idx.due == null && h.includes("due")) idx.due = i;
    else if (idx.period == null && h.includes("period")) idx.period = i;
    else if (idx.first == null && h.includes("first")) idx.first = i;
    else if (idx.last == null && h.includes("last") && h.includes("name")) idx.last = i;
    else if (idx.name == null && (h === "name" || h.includes("patient name") || h.includes("full name"))) idx.name = i;
    else if (idx.appt == null && (h.includes("appoint") || h.includes("appt") || h.includes("scheduled"))) idx.appt = i;
    else if (idx.provider == null && (h.includes("provider") || h.includes("doctor") || h.includes("physician") || h.includes("clinician") || h === "md")) idx.provider = i;
    else if (idx.overdue == null && h.includes("overdue")) idx.overdue = i;
  });
  return idx;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */
export default function FollowUpTracker() {
  const [records, setRecords] = useState(makeSeed);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [search, setSearch] = useState("");
  const [bandFilter, setBandFilter] = useState(null);
  const [providerFilter, setProviderFilter] = useState(null);
  const [showResolved, setShowResolved] = useState(false);
  const [needsSched, setNeedsSched] = useState(false);
  const [sortKey, setSortKey] = useState("overdue");
  const [sortDir, setSortDir] = useState("desc");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [toast, setToast] = useState(null);
  const fileRef = useRef(null);

  const flash = (type, msg) => {
    setToast({ type, msg });
    window.clearTimeout(flash._t);
    flash._t = window.setTimeout(() => setToast(null), 3200);
  };

  const computed = useMemo(() => records.map(recompute), [records]);
  const active = useMemo(() => computed.filter((r) => r.status !== "resolved"), [computed]);

  const maxOverdue = useMemo(() => {
    const vals = active.map((r) => r.daysOverdue).filter((d) => d != null && d > 0);
    return vals.length ? Math.max(...vals) : 1;
  }, [active]);

  /* charts */
  const bandData = useMemo(
    () =>
      ACTIVE_BANDS.map((b) => ({
        name: BAND_META[b].label,
        value: active.filter((r) => r.band === b).length,
        color: BAND_META[b].color,
      })),
    [active]
  );
  const bucketData = useMemo(() => {
    const defs = [
      ["Not due", (d) => d < 0, "#177A45"],
      ["Due", (d) => d === 0, "#3F4A5E"],
      ["1–7", (d) => d >= 1 && d <= 7, "#A8730A"],
      ["8–14", (d) => d >= 8 && d <= 14, "#C2410C"],
      ["15–30", (d) => d >= 15 && d <= 30, "#C2410C"],
      ["31–60", (d) => d >= 31 && d <= 60, "#B3261E"],
      ["60+", (d) => d > 60, "#8C1D18"],
    ];
    return defs.map(([name, test, color]) => ({
      name,
      value: active.filter((r) => r.daysOverdue != null && test(r.daysOverdue)).length,
      color,
    }));
  }, [active]);

  /* per-provider breakdown (active patients only) */
  const providerCounts = useMemo(() => {
    const counts = {};
    PROVIDERS.forEach((p) => (counts[p] = 0));
    counts[UNASSIGNED] = 0;
    active.forEach((r) => {
      // anything not one of the four department providers counts as Unassigned,
      // matching how the Unassigned filter selects rows
      const key = PROVIDERS.includes(r.provider) ? r.provider : UNASSIGNED;
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [active]);

  const overdueCount = active.filter((r) => r.daysOverdue != null && r.daysOverdue > 0).length;
  const awaitingCount = active.filter((r) => r.daysOverdue != null && r.daysOverdue >= 0 && !r.apptDate).length;
  const avgOverdue = (() => {
    const v = active.filter((r) => r.daysOverdue != null && r.daysOverdue > 0).map((r) => r.daysOverdue);
    return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : 0;
  })();

  /* visible list */
  const visible = useMemo(() => {
    let list = computed.filter((r) => (showResolved ? true : r.status !== "resolved"));
    if (needsSched) list = list.filter((r) => r.daysOverdue != null && r.daysOverdue >= 0 && !r.apptDate);
    if (bandFilter) list = list.filter((r) => r.band === bandFilter);
    if (providerFilter) {
      list = providerFilter === UNASSIGNED
        ? list.filter((r) => !r.provider || !PROVIDERS.includes(r.provider))
        : list.filter((r) => r.provider === providerFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.mrn.toLowerCase().includes(q) ||
          `${r.first} ${r.last}`.toLowerCase().includes(q)
      );
    }
    const dir = sortDir === "asc" ? 1 : -1;
    const get = (r) => {
      switch (sortKey) {
        case "mrn": return r.mrn;
        case "name": return `${r.last} ${r.first}`.toLowerCase();
        case "lastVisit": return r.lastVisit || "";
        case "dueDate": return r.dueDate || "";
        case "period": return r.fuPeriodDays === "" ? -1 : Number(r.fuPeriodDays);
        case "provider": return (r.provider || "~").toLowerCase();
        case "appt": return r.apptDate || null;
        default: return r.daysOverdue;
      }
    };
    list = [...list].sort((a, b) => {
      const va = get(a), vb = get(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return 0;
    });
    // pin row being edited to top
    if (editingId) {
      const i = list.findIndex((r) => r._id === editingId);
      if (i > 0) { const [row] = list.splice(i, 1); list.unshift(row); }
    }
    return list;
  }, [computed, showResolved, needsSched, bandFilter, providerFilter, search, sortKey, sortDir, editingId]);

  /* ---- editing ---- */
  const startEdit = (r) => {
    setEditingId(r._id);
    setDraft({
      mrn: r.mrn, first: r.first, last: r.last, lastVisit: r.lastVisit,
      fuPeriodDays: r.fuPeriodDays, dueDateOverride: r.dueDateOverride, apptDate: r.apptDate || "",
      provider: r.provider || "",
    });
  };
  const startAdd = () => {
    const id = `new-${Date.now()}`;
    setRecords((prev) => [
      { _id: id, mrn: "", first: "", last: "", lastVisit: "", fuPeriodDays: "", dueDateOverride: "", apptDate: "", provider: providerFilter && providerFilter !== UNASSIGNED ? providerFilter : "", status: "active", _isNew: true },
      ...prev,
    ]);
    setBandFilter(null); setSearch(""); setNeedsSched(false);
    setEditingId(id);
    setDraft({ mrn: "", first: "", last: "", lastVisit: "", fuPeriodDays: "", dueDateOverride: "", apptDate: "", provider: providerFilter && providerFilter !== UNASSIGNED ? providerFilter : "" });
  };
  const cancelEdit = () => {
    setRecords((prev) => prev.filter((r) => !(r._id === editingId && r._isNew)));
    setEditingId(null); setDraft(null);
  };
  const saveEdit = () => {
    setRecords((prev) =>
      prev.map((r) => {
        if (r._id !== editingId) return r;
        const mrn = draft.mrn.trim() || `MRN-${String(Date.now()).slice(-6)}`;
        return {
          ...r, mrn,
          first: draft.first.trim(), last: draft.last.trim(),
          lastVisit: draft.lastVisit,
          fuPeriodDays: draft.fuPeriodDays === "" ? "" : Number(draft.fuPeriodDays),
          dueDateOverride: draft.dueDateOverride,
          apptDate: draft.apptDate,
          provider: draft.provider || "",
          _isNew: undefined,
        };
      })
    );
    setEditingId(null); setDraft(null);
    flash("ok", "Saved");
  };
  const toggleStatus = (r) => {
    setRecords((prev) =>
      prev.map((x) => (x._id === r._id ? { ...x, status: x.status === "resolved" ? "active" : "resolved" } : x))
    );
    flash("ok", r.status === "resolved" ? "Marked active" : "Marked resolved");
  };
  const doDelete = () => {
    setRecords((prev) => prev.filter((r) => r._id !== confirmDelete._id));
    setConfirmDelete(null);
    flash("ok", "Patient removed");
  };

  /* ---- import (upsert merge) ---- */
  const onImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: "array", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });
        if (!aoa.length) { flash("err", "That file looks empty"); return; }
        const idx = mapHeaders(aoa[0]);
        if (idx.mrn == null) { flash("err", "No MRN column found — can't match records"); return; }

        const incoming = [];
        for (let i = 1; i < aoa.length; i++) {
          const row = aoa[i];
          const mrn = String(row[idx.mrn] ?? "").trim();
          if (!mrn) continue;
          let first = idx.first != null ? String(row[idx.first] ?? "").trim() : "";
          let last = idx.last != null ? String(row[idx.last] ?? "").trim() : "";
          if (!first && !last && idx.name != null) {
            const parts = String(row[idx.name] ?? "").trim().split(/\s+/);
            first = parts[0] || ""; last = parts.slice(1).join(" ");
          }
          let lastVisit = idx.visit != null ? parseDateCell(row[idx.visit]) : "";
          let period = idx.period != null ? parsePeriodCell(row[idx.period]) : null;
          let due = idx.due != null ? parseDateCell(row[idx.due]) : "";
          let appt = idx.appt != null ? parseDateCell(row[idx.appt]) : "";
          let provider = idx.provider != null ? normalizeProvider(row[idx.provider]) : "";

          if (due && period == null && lastVisit) period = Math.max(0, daysBetween(lastVisit, due));
          if (due && !lastVisit && period != null) lastVisit = addDays(due, -period);

          incoming.push({
            mrn, first, last, lastVisit,
            fuPeriodDays: period == null ? "" : period,
            dueDateOverride: due || "",
            apptDate: appt || "",
            provider,
          });
        }
        if (!incoming.length) { flash("err", "No rows with an MRN to import"); return; }

        let updated = 0, added = 0;
        setRecords((prev) => {
          const byMrn = new Map(prev.map((r) => [r.mrn, r]));
          incoming.forEach((inc) => {
            if (byMrn.has(inc.mrn)) {
              updated++;
              const ex = byMrn.get(inc.mrn);
              byMrn.set(inc.mrn, {
                ...ex,
                first: inc.first || ex.first,
                last: inc.last || ex.last,
                lastVisit: inc.lastVisit || ex.lastVisit,
                fuPeriodDays: inc.fuPeriodDays !== "" ? inc.fuPeriodDays : ex.fuPeriodDays,
                dueDateOverride: inc.dueDateOverride || ex.dueDateOverride,
                apptDate: inc.apptDate || ex.apptDate,
                provider: inc.provider || ex.provider || "",
                status: "active",
              });
            } else {
              added++;
              byMrn.set(inc.mrn, { ...inc, _id: `imp-${inc.mrn}-${Date.now()}`, status: "active" });
            }
          });
          return Array.from(byMrn.values());
        });
        setBandFilter(null); setSearch("");
        flash("ok", `Imported — ${updated} updated, ${added} added`);
      } catch (err) {
        flash("err", "Couldn't read that file. Is it a valid .xlsx/.csv?");
      }
      if (fileRef.current) fileRef.current.value = "";
    };
    reader.readAsArrayBuffer(file);
  };

  /* ---- exports ---- */
  const exportData = () => {
    const sorted = [...computed].sort((a, b) => (b.daysOverdue ?? -1e9) - (a.daysOverdue ?? -1e9));
    const rows = sorted.map((r) => ({
      MRN: r.mrn,
      "First Name": r.first,
      "Last Name": r.last,
      Provider: r.provider || "",
      "Date of Last Visit": r.lastVisit,
      "F/U Period": r.fuPeriodDays === "" ? "" : `${r.fuPeriodDays} days`,
      "Due Date for F/U": r.dueDate,
      "Days Overdue": r.daysOverdue != null ? Math.max(0, r.daysOverdue) : "",
      "Appointment Scheduled": r.apptDate ? "Yes" : "Not yet",
      "Appointment Date": r.apptDate || "",
      Urgency: BAND_META[r.band].label,
      Status: r.status,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Follow-ups");
    XLSX.writeFile(wb, "followup_organized.xlsx");
  };
  const downloadSample = () => {
    const ex = records.find((r) => r.mrn) || {};
    const header = ["MRN", "First Name", "Last Name", "Provider", "Date of Last Visit", "F/U Period", "Due Date for F/U", "Days Overdue", "Appointment Date"];
    const rows = [
      header,
      // existing MRN: new visit date + a freshly booked appointment -> update
      [ex.mrn || "MRN-100201", ex.first || "Maria", ex.last || "Alvarez", ex.provider || PROVIDERS[0], addDays(todayIso, -10), `${ex.fuPeriodDays || 90} days`, "", "", addDays(todayIso, 8)],
      // two brand-new MRNs -> additions (one scheduled, one not yet)
      ["MRN-204881", "Jordan", "Avery", PROVIDERS[1], addDays(todayIso, -120), "90 days", "", "", addDays(todayIso, 5)],
      ["MRN-204882", "Sam", "Delacroix", PROVIDERS[2], addDays(todayIso, -15), "30 days", "", "", ""],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Weekly report");
    XLSX.writeFile(wb, "followup_sample_import.xlsx");
  };

  const resetDemo = () => {
    setRecords(makeSeed()); setEditingId(null); setDraft(null);
    setBandFilter(null); setProviderFilter(null); setSearch(""); setShowResolved(false);
    flash("ok", "Demo data reset");
  };

  const SortIcon = ({ k }) =>
    sortKey !== k ? <ArrowUpDown size={13} className="ft-sortdim" /> :
    sortDir === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />;
  const setSort = (k) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir(k === "overdue" ? "desc" : "asc"); }
  };

  return (
    <div className="ft-root">
      <style>{CSS}</style>

      {/* PHI / prototype banner */}
      <div className="ft-phi">
        <AlertTriangle size={16} />
        <span>
          <strong>Prototype — synthetic data only.</strong> Do not enter real patient information (PHI).
          This runs in your browser to test the workflow; a production version would run locally inside your
          organization's secured environment.
        </span>
      </div>

      {/* Header */}
      <header className="ft-head">
        <div>
          <div className="ft-eyebrow">Lost to follow-up · weekly caseload</div>
          <h1 className="ft-title">Follow-up Tracker</h1>
          <div className="ft-asof">Overdue calculated as of {fmtDate(todayIso)}</div>
        </div>
        <div className="ft-actions">
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={onImport} hidden />
          <button className="ft-btn ft-btn-primary" onClick={() => fileRef.current?.click()}>
            <Upload size={15} /> Import spreadsheet
          </button>
          <button className="ft-btn" onClick={startAdd}><Plus size={15} /> Add patient</button>
          <button className="ft-btn" onClick={exportData}><Download size={15} /> Export</button>
          <button className="ft-btn ft-btn-ghost" onClick={resetDemo} title="Restore demo data">
            <RotateCcw size={15} />
          </button>
        </div>
      </header>

      {/* Triage strip */}
      <section className="ft-strip">
        <div className="ft-stat">
          <div className="ft-stat-num">{active.length}</div>
          <div className="ft-stat-lab">Active patients</div>
        </div>
        <div className="ft-stat">
          <div className="ft-stat-num" style={{ color: "#B3261E" }}>{overdueCount}</div>
          <div className="ft-stat-lab">Overdue now</div>
        </div>
        <div className="ft-stat">
          <div className="ft-stat-num">{avgOverdue}</div>
          <div className="ft-stat-lab">Avg days overdue</div>
        </div>
        <button
          className={`ft-stat ft-stat-btn${needsSched ? " ft-stat-on" : ""}`}
          onClick={() => setNeedsSched((v) => !v)}
          title="Show only due/overdue patients without an appointment"
        >
          <div className="ft-stat-num" style={{ color: "#C2410C" }}>{awaitingCount}</div>
          <div className="ft-stat-lab">Awaiting scheduling</div>
        </button>
        <div className="ft-chips">
          {ACTIVE_BANDS.map((b) => {
            const c = active.filter((r) => r.band === b).length;
            const on = bandFilter === b;
            return (
              <button
                key={b}
                className={`ft-chip${on ? " ft-chip-on" : ""}`}
                style={on ? { background: BAND_META[b].color, borderColor: BAND_META[b].color, color: "#fff" } : { borderColor: BAND_META[b].color }}
                onClick={() => setBandFilter(on ? null : b)}
                title={`Filter: ${BAND_META[b].label}`}
              >
                <span className="ft-dot" style={{ background: on ? "#fff" : BAND_META[b].color }} />
                {BAND_META[b].label}
                <span className="ft-chip-n">{c}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Charts */}
      <section className="ft-charts">
        <div className="ft-card">
          <div className="ft-card-title">Caseload by urgency</div>
          <div className="ft-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bandData} margin={{ top: 16, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#EDF0F4" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#586079" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#8A93A6" }} axisLine={false} tickLine={false} width={36} />
                <Tooltip cursor={{ fill: "#F4F6F9" }} contentStyle={tooltipStyle} />
                <Bar dataKey="value" radius={[5, 5, 0, 0]} maxBarSize={54}>
                  <LabelList dataKey="value" position="top" style={{ fontSize: 11, fill: "#1B2333", fontWeight: 600 }} />
                  {bandData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="ft-card">
          <div className="ft-card-title">Days overdue — distribution</div>
          <div className="ft-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bucketData} margin={{ top: 16, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#EDF0F4" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#586079" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#8A93A6" }} axisLine={false} tickLine={false} width={36} />
                <Tooltip cursor={{ fill: "#F4F6F9" }} contentStyle={tooltipStyle} />
                <Bar dataKey="value" radius={[5, 5, 0, 0]} maxBarSize={44}>
                  <LabelList dataKey="value" position="top" style={{ fontSize: 11, fill: "#1B2333", fontWeight: 600 }} />
                  {bucketData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Provider division — split caseload across the four department providers */}
      <section className="ft-providers" aria-label="Filter by provider">
        <span className="ft-providers-lab">Provider:</span>
        <button
          className={`ft-prov${providerFilter == null ? " ft-prov-on" : ""}`}
          onClick={() => setProviderFilter(null)}
        >
          All <span className="ft-prov-n">{active.length}</span>
        </button>
        {PROVIDERS.map((p) => {
          const on = providerFilter === p;
          return (
            <button
              key={p}
              className={`ft-prov${on ? " ft-prov-on" : ""}`}
              onClick={() => setProviderFilter(on ? null : p)}
              title={`Show only ${p}'s patients`}
            >
              {p} <span className="ft-prov-n">{providerCounts[p] || 0}</span>
            </button>
          );
        })}
        {providerCounts[UNASSIGNED] > 0 && (
          <button
            className={`ft-prov${providerFilter === UNASSIGNED ? " ft-prov-on" : ""}`}
            onClick={() => setProviderFilter(providerFilter === UNASSIGNED ? null : UNASSIGNED)}
            title="Patients not assigned to a department provider"
          >
            {UNASSIGNED} <span className="ft-prov-n">{providerCounts[UNASSIGNED]}</span>
          </button>
        )}
      </section>

      {/* Toolbar */}
      <div className="ft-toolbar">
        <div className="ft-search">
          <Search size={15} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search MRN or name"
            aria-label="Search by MRN or name"
          />
          {search && <button className="ft-search-x" onClick={() => setSearch("")} aria-label="Clear search"><X size={14} /></button>}
        </div>
        <label className="ft-toggle">
          <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
          Show resolved
        </label>
        {(bandFilter || providerFilter || search || needsSched) && (
          <button className="ft-clear" onClick={() => { setBandFilter(null); setProviderFilter(null); setSearch(""); setNeedsSched(false); }}>Clear filters</button>
        )}
        <div className="ft-count">{visible.length} shown</div>
      </div>

      {/* Table */}
      <div className="ft-tablewrap">
        <table className="ft-table">
          <thead>
            <tr>
              <th className="ft-th-rail" />
              <th><button className="ft-sort" onClick={() => setSort("mrn")}>MRN <SortIcon k="mrn" /></button></th>
              <th><button className="ft-sort" onClick={() => setSort("name")}>Patient <SortIcon k="name" /></button></th>
              <th><button className="ft-sort" onClick={() => setSort("provider")}>Provider <SortIcon k="provider" /></button></th>
              <th><button className="ft-sort" onClick={() => setSort("lastVisit")}>Last visit <SortIcon k="lastVisit" /></button></th>
              <th><button className="ft-sort" onClick={() => setSort("period")}>F/U period <SortIcon k="period" /></button></th>
              <th><button className="ft-sort" onClick={() => setSort("dueDate")}>F/U due <SortIcon k="dueDate" /></button></th>
              <th className="ft-th-over"><button className="ft-sort" onClick={() => setSort("overdue")}>Overdue <SortIcon k="overdue" /></button></th>
              <th className="ft-th-appt"><button className="ft-sort" onClick={() => setSort("appt")}>Appointment <SortIcon k="appt" /></button></th>
              <th className="ft-th-act">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr><td colSpan={10} className="ft-empty">No patients match these filters. Import a spreadsheet or add a patient to begin.</td></tr>
            )}
            {visible.map((r) => {
              const editing = editingId === r._id;
              const meta = BAND_META[r.band];
              return (
                <tr key={r._id} className={editing ? "ft-row-edit" : ""}>
                  <td className="ft-rail" style={{ background: meta.color }} />
                  {/* MRN */}
                  <td className="ft-mono">
                    {editing
                      ? <input className="ft-in ft-in-sm" value={draft.mrn} onChange={(e) => setDraft({ ...draft, mrn: e.target.value })} placeholder="MRN-…" aria-label="MRN" />
                      : r.mrn}
                  </td>
                  {/* Name */}
                  <td>
                    {editing ? (
                      <div className="ft-name-edit">
                        <input className="ft-in" value={draft.first} onChange={(e) => setDraft({ ...draft, first: e.target.value })} placeholder="First" aria-label="First name" />
                        <input className="ft-in" value={draft.last} onChange={(e) => setDraft({ ...draft, last: e.target.value })} placeholder="Last" aria-label="Last name" />
                      </div>
                    ) : (
                      <div className="ft-name">
                        <span className={r.status === "resolved" ? "ft-resolved" : ""}>{r.first} {r.last}</span>
                        {r.status === "resolved" && <span className="ft-badge">Resolved</span>}
                      </div>
                    )}
                  </td>
                  {/* Provider */}
                  <td>
                    {editing ? (
                      <select className="ft-in ft-in-prov" value={draft.provider} onChange={(e) => setDraft({ ...draft, provider: e.target.value })} aria-label="Provider">
                        <option value="">Unassigned</option>
                        {PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    ) : r.provider ? (
                      <span className="ft-provtag">{r.provider}</span>
                    ) : (
                      <span className="ft-muted">—</span>
                    )}
                  </td>
                  {/* Last visit */}
                  <td className="ft-mono">
                    {editing
                      ? <input type="date" className="ft-in ft-in-date" value={draft.lastVisit} onChange={(e) => setDraft({ ...draft, lastVisit: e.target.value })} aria-label="Date of last visit" />
                      : fmtDate(r.lastVisit)}
                  </td>
                  {/* Period */}
                  <td className="ft-mono">
                    {editing ? (
                      <div className="ft-period-edit">
                        <input type="number" min="0" className="ft-in ft-in-num" value={draft.fuPeriodDays} onChange={(e) => setDraft({ ...draft, fuPeriodDays: e.target.value })} aria-label="Follow-up period in days" />
                        <span className="ft-unit">days</span>
                      </div>
                    ) : (r.fuPeriodDays === "" ? "—" : `${r.fuPeriodDays} days`)}
                  </td>
                  {/* Due */}
                  <td className="ft-mono">
                    {editing ? (
                      <input type="date" className="ft-in ft-in-date" value={draft.dueDateOverride} onChange={(e) => setDraft({ ...draft, dueDateOverride: e.target.value })} aria-label="Due date override (optional)" title="Optional — leave blank to compute from last visit + period" />
                    ) : fmtDate(r.dueDate)}
                  </td>
                  {/* Overdue */}
                  <td className="ft-over">
                    {r.daysOverdue == null ? (
                      <span className="ft-muted">—</span>
                    ) : r.daysOverdue > 0 ? (
                      <div className="ft-overcell">
                        <span className="ft-overbar" style={{ width: `${Math.max(8, Math.min(100, (r.daysOverdue / maxOverdue) * 100))}%`, background: meta.color }} />
                        <span className="ft-overnum" style={{ color: meta.color }}>{r.daysOverdue}d</span>
                      </div>
                    ) : r.daysOverdue === 0 ? (
                      <span className="ft-due">Due today</span>
                    ) : (
                      <span className="ft-muted">in {Math.abs(r.daysOverdue)}d</span>
                    )}
                  </td>
                  {/* Appointment */}
                  <td>
                    {editing ? (
                      <input type="date" className="ft-in ft-in-date" value={draft.apptDate} onChange={(e) => setDraft({ ...draft, apptDate: e.target.value })} aria-label="Appointment date" title="Leave blank if no appointment is scheduled" />
                    ) : r.apptDate ? (
                      <div className="ft-appt">
                        <span className="ft-appt-badge ft-appt-yes"><Check size={11} /> Scheduled</span>
                        <span className="ft-appt-date ft-mono">{fmtDate(r.apptDate)}</span>
                      </div>
                    ) : (
                      <button className="ft-appt-badge ft-appt-no" onClick={() => startEdit(r)} title="Click to schedule">Not scheduled</button>
                    )}
                  </td>
                  {/* Actions */}
                  <td className="ft-actcell">
                    {editing ? (
                      <div className="ft-rowbtns">
                        <button className="ft-ibtn ft-ibtn-ok" onClick={saveEdit} title="Save"><Check size={15} /></button>
                        <button className="ft-ibtn" onClick={cancelEdit} title="Cancel"><X size={15} /></button>
                      </div>
                    ) : (
                      <div className="ft-rowbtns">
                        <button className="ft-ibtn" onClick={() => startEdit(r)} title="Edit"><Pencil size={14} /></button>
                        <button className="ft-ibtn" onClick={() => toggleStatus(r)} title={r.status === "resolved" ? "Mark active" : "Mark resolved"}>
                          <CheckCircle2 size={15} className={r.status === "resolved" ? "ft-done" : ""} />
                        </button>
                        <button className="ft-ibtn ft-ibtn-del" onClick={() => setConfirmDelete(r)} title="Delete"><Trash2 size={14} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* How-to-test hint */}
      <div className="ft-hint">
        <Info size={15} />
        <span>
          <strong>Test the merge:</strong> click <em>Export</em> to download your data, or{" "}
          <button className="ft-link" onClick={downloadSample}>download a ready-made sample file</button>{" "}
          (one existing MRN with a changed visit date and a newly booked appointment, plus two new patients). Then{" "}
          <em>Import spreadsheet</em> and watch it update the matching record, fill in appointment dates, and add the new ones — no re-organizing.
        </span>
      </div>

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="ft-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="ft-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ft-modal-title">Remove this patient?</div>
            <div className="ft-modal-body">
              <span className="ft-mono">{confirmDelete.mrn}</span> — {confirmDelete.first} {confirmDelete.last}
              <br />This only affects the prototype data and can't be undone here.
            </div>
            <div className="ft-modal-btns">
              <button className="ft-btn" onClick={() => setConfirmDelete(null)}>Keep</button>
              <button className="ft-btn ft-btn-danger" onClick={doDelete}>Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`ft-toast ft-toast-${toast.type}`}>
          {toast.type === "ok" ? <CheckCircle2 size={16} /> : toast.type === "err" ? <AlertTriangle size={16} /> : <Info size={16} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}

const tooltipStyle = {
  background: "#fff",
  border: "1px solid #E4E8EE",
  borderRadius: 8,
  fontSize: 12,
  boxShadow: "0 6px 20px rgba(20,30,55,0.10)",
};

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */
const CSS = `
.ft-root{
  --bg:#F5F7F9; --surface:#fff; --border:#E4E8EE; --border-strong:#D6DCE5;
  --ink:#1B2333; --ink2:#586079; --muted:#8A93A6;
  --brand:#0E7C86; --brand-d:#0A626B; --brand-tint:#E3F1F2;
  font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  color:var(--ink); background:var(--bg);
  padding:20px; max-width:1180px; margin:0 auto; -webkit-font-smoothing:antialiased;
}
.ft-mono{font-family:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;font-variant-numeric:tabular-nums;font-size:13px;}
*::selection{background:var(--brand-tint);}

.ft-phi{display:flex;gap:10px;align-items:flex-start;background:#FFF6E9;border:1px solid #F2D9A8;
  color:#7A5310;border-radius:10px;padding:11px 14px;font-size:12.5px;line-height:1.45;margin-bottom:18px;}
.ft-phi svg{flex:none;margin-top:1px;color:#C2810C;}
.ft-phi strong{color:#5E3F08;}

.ft-head{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-bottom:18px;}
.ft-eyebrow{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--brand-d);font-weight:600;margin-bottom:5px;}
.ft-title{font-size:25px;font-weight:700;letter-spacing:-.02em;margin:0;line-height:1;}
.ft-asof{font-size:12px;color:var(--muted);margin-top:6px;}
.ft-actions{display:flex;gap:8px;flex-wrap:wrap;}

.ft-btn{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--border-strong);background:var(--surface);
  color:var(--ink);font-size:13px;font-weight:550;padding:8px 13px;border-radius:8px;cursor:pointer;transition:.13s;font-family:inherit;}
.ft-btn:hover{border-color:#B9C2CF;background:#FBFCFD;}
.ft-btn:focus-visible{outline:2px solid var(--brand);outline-offset:2px;}
.ft-btn-primary{background:var(--brand);border-color:var(--brand);color:#fff;}
.ft-btn-primary:hover{background:var(--brand-d);border-color:var(--brand-d);}
.ft-btn-ghost{padding:8px 10px;color:var(--ink2);}
.ft-btn-danger{background:#B3261E;border-color:#B3261E;color:#fff;}
.ft-btn-danger:hover{background:#8C1D18;}

.ft-strip{display:flex;align-items:center;gap:22px;background:var(--surface);border:1px solid var(--border);
  border-radius:12px;padding:14px 18px;margin-bottom:14px;flex-wrap:wrap;}
.ft-stat{display:flex;flex-direction:column;gap:2px;min-width:74px;}
.ft-stat-num{font-size:24px;font-weight:700;line-height:1;font-variant-numeric:tabular-nums;letter-spacing:-.02em;}
.ft-stat-lab{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;}
.ft-chips{display:flex;gap:7px;flex-wrap:wrap;margin-left:auto;}
.ft-chip{display:inline-flex;align-items:center;gap:7px;border:1px solid;background:var(--surface);
  border-radius:20px;padding:5px 11px 5px 9px;font-size:12px;font-weight:550;cursor:pointer;color:var(--ink);transition:.12s;}
.ft-chip:focus-visible{outline:2px solid var(--brand);outline-offset:2px;}
.ft-dot{width:7px;height:7px;border-radius:50%;}
.ft-chip-n{font-variant-numeric:tabular-nums;font-weight:700;opacity:.85;}

.ft-charts{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;}
.ft-card{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 16px 8px;}
.ft-card-title{font-size:12.5px;font-weight:600;color:var(--ink2);margin-bottom:6px;}
.ft-chart{height:208px;width:100%;}

.ft-providers{display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:var(--surface);
  border:1px solid var(--border);border-radius:12px;padding:10px 14px;margin-bottom:14px;}
.ft-providers-lab{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:600;margin-right:2px;}
.ft-prov{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--border-strong);background:var(--surface);
  color:var(--ink);border-radius:8px;padding:6px 11px;font-size:12.5px;font-weight:550;cursor:pointer;transition:.12s;font-family:inherit;}
.ft-prov:hover{border-color:#B9C2CF;background:#FBFCFD;}
.ft-prov:focus-visible{outline:2px solid var(--brand);outline-offset:2px;}
.ft-prov-on{background:var(--brand);border-color:var(--brand);color:#fff;}
.ft-prov-on:hover{background:var(--brand-d);border-color:var(--brand-d);}
.ft-prov-n{font-variant-numeric:tabular-nums;font-weight:700;font-size:11.5px;background:rgba(0,0,0,.07);
  color:inherit;border-radius:10px;padding:1px 7px;}
.ft-prov-on .ft-prov-n{background:rgba(255,255,255,.22);}
.ft-provtag{display:inline-block;font-size:12.5px;color:var(--ink);background:var(--brand-tint);
  border:1px solid #BfE2E4;border-radius:6px;padding:2px 8px;white-space:nowrap;font-weight:550;}
.ft-in-prov{max-width:160px;padding:5px 6px;}

.ft-toolbar{display:flex;align-items:center;gap:12px;margin-bottom:10px;flex-wrap:wrap;}
.ft-search{display:flex;align-items:center;gap:8px;background:var(--surface);border:1px solid var(--border-strong);
  border-radius:8px;padding:7px 11px;min-width:240px;color:var(--muted);}
.ft-search:focus-within{border-color:var(--brand);}
.ft-search input{border:none;outline:none;font-size:13px;background:transparent;color:var(--ink);width:100%;font-family:inherit;}
.ft-search-x{border:none;background:none;cursor:pointer;color:var(--muted);display:flex;padding:0;}
.ft-toggle{display:inline-flex;align-items:center;gap:7px;font-size:13px;color:var(--ink2);cursor:pointer;user-select:none;}
.ft-toggle input{accent-color:var(--brand);width:15px;height:15px;}
.ft-clear{border:none;background:none;color:var(--brand-d);font-size:13px;cursor:pointer;font-weight:550;font-family:inherit;}
.ft-count{margin-left:auto;font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums;}

.ft-tablewrap{background:var(--surface);border:1px solid var(--border);border-radius:12px;overflow:hidden;overflow-x:auto;}
.ft-table{width:100%;border-collapse:collapse;min-width:900px;}
.ft-table thead th{text-align:left;font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);
  font-weight:600;padding:11px 14px;border-bottom:1px solid var(--border);background:#FBFCFD;white-space:nowrap;}
.ft-th-rail{width:4px;padding:0!important;}
.ft-th-over{width:140px;}
.ft-th-act{width:118px;text-align:right;}
.ft-sort{display:inline-flex;align-items:center;gap:5px;border:none;background:none;cursor:pointer;
  font:inherit;font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);font-weight:600;padding:0;}
.ft-sort:hover{color:var(--ink2);}
.ft-sortdim{opacity:.4;}
.ft-table tbody td{padding:10px 14px;border-bottom:1px solid #F0F2F5;font-size:13.5px;vertical-align:middle;}
.ft-table tbody tr:last-child td{border-bottom:none;}
.ft-table tbody tr:hover{background:#FAFBFC;}
.ft-row-edit{background:var(--brand-tint)!important;}
.ft-rail{width:4px;padding:0!important;}

.ft-name{display:flex;align-items:center;gap:8px;font-weight:550;}
.ft-resolved{text-decoration:line-through;color:var(--muted);}
.ft-badge{font-size:10px;text-transform:uppercase;letter-spacing:.05em;background:#EEF1F5;color:var(--muted);
  padding:2px 6px;border-radius:5px;font-weight:600;}
.ft-muted{color:var(--muted);}
.ft-due{color:#3F4A5E;font-weight:600;font-size:12.5px;}

.ft-over{width:140px;}
.ft-overcell{display:flex;align-items:center;gap:9px;}
.ft-overbar{height:7px;border-radius:4px;min-width:6px;}
.ft-overnum{font-family:ui-monospace,monospace;font-variant-numeric:tabular-nums;font-weight:700;font-size:13px;white-space:nowrap;}

.ft-actcell{text-align:right;}
.ft-rowbtns{display:inline-flex;gap:3px;justify-content:flex-end;}
.ft-ibtn{border:1px solid transparent;background:none;cursor:pointer;color:var(--ink2);padding:5px;border-radius:6px;
  display:flex;transition:.12s;}
.ft-ibtn:hover{background:#EEF1F5;color:var(--ink);}
.ft-ibtn:focus-visible{outline:2px solid var(--brand);outline-offset:1px;}
.ft-ibtn-ok{color:#177A45;}.ft-ibtn-ok:hover{background:#E5F2EA;}
.ft-ibtn-del:hover{background:#FAE9E7;color:#B3261E;}
.ft-done{color:#177A45;}

.ft-in{border:1px solid var(--border-strong);border-radius:6px;padding:5px 8px;font-size:13px;font-family:inherit;
  color:var(--ink);background:#fff;outline:none;width:100%;}
.ft-in:focus{border-color:var(--brand);box-shadow:0 0 0 2px var(--brand-tint);}
.ft-in-sm{font-family:ui-monospace,monospace;max-width:120px;}
.ft-in-date{font-family:ui-monospace,monospace;max-width:150px;}
.ft-in-num{max-width:64px;text-align:right;}
.ft-name-edit{display:flex;gap:6px;}
.ft-period-edit{display:flex;align-items:center;gap:6px;}
.ft-unit{font-size:12px;color:var(--muted);}

.ft-empty{text-align:center;color:var(--muted);padding:34px 16px!important;font-size:13.5px;}

.ft-hint{display:flex;gap:9px;align-items:flex-start;margin-top:14px;font-size:12.5px;color:var(--ink2);
  background:var(--surface);border:1px dashed var(--border-strong);border-radius:10px;padding:11px 14px;line-height:1.5;}
.ft-hint svg{flex:none;margin-top:1px;color:var(--brand-d);}
.ft-link{border:none;background:none;color:var(--brand-d);text-decoration:underline;cursor:pointer;font:inherit;padding:0;font-weight:600;}

.ft-overlay{position:fixed;inset:0;background:rgba(20,28,45,.42);display:flex;align-items:center;justify-content:center;z-index:50;padding:20px;}
.ft-modal{background:#fff;border-radius:14px;padding:22px;max-width:400px;width:100%;box-shadow:0 20px 60px rgba(20,30,55,.28);}
.ft-modal-title{font-size:17px;font-weight:650;margin-bottom:8px;}
.ft-modal-body{font-size:13px;color:var(--ink2);line-height:1.55;margin-bottom:18px;}
.ft-modal-btns{display:flex;justify-content:flex-end;gap:9px;}

.ft-toast{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);background:#1B2333;color:#fff;
  display:flex;align-items:center;gap:9px;padding:11px 17px;border-radius:10px;font-size:13.5px;font-weight:500;
  box-shadow:0 10px 34px rgba(20,30,55,.32);z-index:60;animation:ftrise .22s ease;}
.ft-toast-ok svg{color:#5BD99A;}.ft-toast-err svg{color:#FF8C82;}.ft-toast-info svg{color:#7FC4FF;}
@keyframes ftrise{from{opacity:0;transform:translate(-50%,10px);}to{opacity:1;transform:translate(-50%,0);}}

@media (max-width:760px){
  .ft-charts{grid-template-columns:1fr;}
  .ft-chips{margin-left:0;width:100%;}
  .ft-head{align-items:flex-start;}
}
@media (prefers-reduced-motion:reduce){
  *{animation:none!important;transition:none!important;}
}
`;
