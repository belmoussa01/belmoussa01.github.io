"use strict";

/* =============================================
   KAMEL BELMOUSSA — app.js
   Portfolio v3 — veille cliquable + filtres réactifs
============================================= */

/* ========== Helpers ========== */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ========== Onglets projets ========== */
function initTabs() {
  const tabs = $$(".tabs .tab");
  if (!tabs.length) return;
  tabs.forEach(btn => {
    btn.addEventListener("click", () => {
      $$(".tabs .tab").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      $$(".cards-grid").forEach(g => g.classList.add("hidden"));
      const target = btn.getAttribute("data-target");
      const el = target ? $(target) : null;
      if (el) el.classList.remove("hidden");
    });
  });
}

/* ========== Veille — flux RSS ========== */

const FEEDS = [
  { url: "https://www.cert.ssi.gouv.fr/feed/",                                                theme: "Cybersécurité", source: "CERT-FR (ANSSI)" },
  { url: "https://www.zataz.com/feed/",                                                       theme: "Cybersécurité", source: "Zataz" },
  { url: "https://www.lemondeinformatique.fr/flux-rss/thematique/securite/rss.xml",           theme: "Cybersécurité", source: "Le Monde Informatique" },
  { url: "https://www.lemondeinformatique.fr/flux-rss/thematique/systemes-reseaux/rss.xml",   theme: "Réseau",        source: "Le Monde Informatique" },
  { url: "https://www.lemondeinformatique.fr/flux-rss/thematique/intelligence-artificielle/rss.xml", theme: "IA",      source: "Le Monde Informatique" },
  { url: "https://www.zdnet.fr/feeds/rss/actualites/",                                        theme: "Système",       source: "ZDNet France" },
  { url: "https://www.developpez.com/index/rss",                                              theme: "Système",       source: "Developpez.com" },
];

const VEILLE_CACHE_KEY = "veille-cache-v3";
const VEILLE_CACHE_MS  = 60 * 60 * 1000; // 1 heure
const FETCH_TIMEOUT_MS = 8000;          // chaque tentative coupe au bout de 8s

const VEILLE_FALLBACK = [
  { theme: "Cybersécurité", source: "CERT-FR (ANSSI)", pubDate: new Date().toISOString(),
    title: "Bulletins de sécurité du CERT-FR",
    desc: "Le CERT-FR publie régulièrement des bulletins sur les vulnérabilités critiques touchant les SI français.",
    link: "https://www.cert.ssi.gouv.fr/" },
  { theme: "Système",       source: "ZDNet France",      pubDate: new Date().toISOString(),
    title: "Actualités systèmes et IT",
    desc: "Suivi des annonces Microsoft, Linux, cloud et infrastructure.",
    link: "https://www.zdnet.fr/" },
  { theme: "Réseau",        source: "Le Monde Informatique", pubDate: new Date().toISOString(),
    title: "Actualités systèmes & réseaux",
    desc: "Veille sur les équipements, protocoles et architectures réseau utilisés en entreprise.",
    link: "https://www.lemondeinformatique.fr/" },
];

const CORS_PROXIES = [
  (url) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(url),
  (url) => "https://corsproxy.io/?" + encodeURIComponent(url),
  (url) => "https://api.codetabs.com/v1/proxy/?quest=" + encodeURIComponent(url),
];

function cleanHtml(html) {
  if (!html) return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  const txt = tmp.textContent || tmp.innerText || "";
  return txt.replace(/\s+/g, " ").trim();
}

// fetch + timeout via AbortController
function fetchWithTimeout(url, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { cache: "no-store", signal: ctrl.signal })
    .finally(() => clearTimeout(timer));
}

async function fetchFeed(feed) {
  for (const proxy of CORS_PROXIES) {
    try {
      const res = await fetchWithTimeout(proxy(feed.url), FETCH_TIMEOUT_MS);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const xmlText = await res.text();
      const xml = new DOMParser().parseFromString(xmlText, "text/xml");
      if (xml.querySelector("parsererror")) throw new Error("XML parse error");

      let items = [...xml.querySelectorAll("item")].map(it => ({
        title: cleanHtml(it.querySelector("title")?.textContent),
        link: (it.querySelector("link")?.textContent || "").trim(),
        pubDate: it.querySelector("pubDate")?.textContent?.trim() || new Date().toISOString(),
        desc: cleanHtml(it.querySelector("description")?.textContent).slice(0, 220),
        source: feed.source,
        theme: feed.theme,
      }));

      if (items.length === 0) {
        items = [...xml.querySelectorAll("entry")].map(it => ({
          title: cleanHtml(it.querySelector("title")?.textContent),
          link: it.querySelector("link")?.getAttribute("href") || "",
          pubDate: (it.querySelector("updated")?.textContent?.trim() ||
                    it.querySelector("published")?.textContent?.trim() ||
                    new Date().toISOString()),
          desc: cleanHtml(it.querySelector("summary")?.textContent || it.querySelector("content")?.textContent).slice(0, 220),
          source: feed.source,
          theme: feed.theme,
        }));
      }
      if (items.length > 0) return items;
    } catch (e) {
      console.warn("Proxy KO pour", feed.url, "—", e.message);
    }
  }
  return [];
}

function renderVeille(items) {
  const wrap = $("#veille-list");
  if (!wrap) return;
  if (!items || !items.length) {
    wrap.innerHTML = '<p class="muted">Aucun article pour ce filtre.</p>';
    return;
  }
  wrap.innerHTML = items.map(it => {
    let dateStr = "";
    try {
      const d = new Date(it.pubDate || it.date);
      if (!isNaN(d)) dateStr = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
    } catch (e) {}
    const desc = (it.desc || "").trim();
    const safeTitle = it.title || "Sans titre";

    if (it.link) {
      return `
        <a class="veille-item" data-theme="${it.theme}" href="${it.link}" target="_blank" rel="noopener">
          <span class="veille-theme">${it.theme}</span>
          <div class="veille-meta">
            <span class="veille-source">${it.source}</span>
            <span>${dateStr}</span>
          </div>
          <h3>${safeTitle}</h3>
          ${desc ? `<p>${desc}${desc.length >= 200 ? "…" : ""}</p>` : "<p></p>"}
          <span class="read-more">Lire la source →</span>
        </a>`;
    }
    return `
      <article class="veille-item" data-theme="${it.theme}">
        <span class="veille-theme">${it.theme}</span>
        <div class="veille-meta">
          <span class="veille-source">${it.source}</span>
          <span>${dateStr}</span>
        </div>
        <h3>${safeTitle}</h3>
        ${desc ? `<p>${desc}${desc.length >= 200 ? "…" : ""}</p>` : "<p></p>"}
      </article>`;
  }).join("");
}

let VEILLE_ALL = [];

function filterAndRender(theme) {
  const filtered = theme === "all" ? VEILLE_ALL : VEILLE_ALL.filter(i => i.theme === theme);
  renderVeille(filtered);
}

async function initVeille() {
  const wrap = $("#veille-list");
  if (!wrap) return;

  // ✅ FIX MAJEUR : on attache les listeners IMMÉDIATEMENT, avant tout await.
  // Avant, ils étaient à la fin de la fonction → bloqués pendant tout le fetch.
  const filters = $$(".filter-btn");
  filters.forEach(btn => {
    btn.addEventListener("click", () => {
      filters.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      filterAndRender(btn.dataset.theme);
    });
  });

  // 1) Affiche le cache s'il est encore frais
  let hasCache = false;
  try {
    const cached = JSON.parse(localStorage.getItem(VEILLE_CACHE_KEY) || "null");
    if (cached && (Date.now() - cached.ts) < VEILLE_CACHE_MS && cached.items?.length) {
      VEILLE_ALL = cached.items;
      renderVeille(VEILLE_ALL);
      hasCache = true;
    }
  } catch (e) {}

  if (!hasCache) {
    wrap.innerHTML = '<p class="muted">⏳ Chargement des flux de veille…</p>';
  }

  // 2) Récupère tous les flux en parallèle
  try {
    const results = await Promise.all(FEEDS.map(fetchFeed));
    let all = results.flat();

    // Dédoublonnage par lien
    const seen = new Set();
    all = all.filter(it => {
      const key = (it.link || it.title || "").toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    all = all.filter(it => it.title && it.title.length > 3);
    all.sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));

    // Limite par source pour diversifier (max 3 par source)
    const bySource = new Map();
    const diverse = [];
    for (const it of all) {
      const c = bySource.get(it.source) || 0;
      if (c < 3) { diverse.push(it); bySource.set(it.source, c + 1); }
    }
    diverse.sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));
    VEILLE_ALL = diverse.slice(0, 15);

    if (!VEILLE_ALL.length) VEILLE_ALL = VEILLE_FALLBACK;

    const activeBtn = $(".filter-btn.active");
    const activeTheme = activeBtn?.dataset.theme || "all";
    filterAndRender(activeTheme);

    try { localStorage.setItem(VEILLE_CACHE_KEY, JSON.stringify({ ts: Date.now(), items: VEILLE_ALL })); } catch (e) {}
  } catch (e) {
    console.error("Erreur chargement veille:", e);
    if (!VEILLE_ALL.length) {
      VEILLE_ALL = VEILLE_FALLBACK;
      renderVeille(VEILLE_ALL);
    }
  }
}

/* ========== Mobile sidebar toggle ========== */
function initMobile() {
  const btn = $("#mobile-toggle");
  if (!btn) return;
  btn.addEventListener("click", () => {
    document.body.classList.toggle("sidebar-open");
  });
  $$(".sidebar nav a").forEach(a => {
    a.addEventListener("click", () => document.body.classList.remove("sidebar-open"));
  });
  document.addEventListener("click", (e) => {
    if (document.body.classList.contains("sidebar-open")) {
      if (!e.target.closest(".sidebar") && !e.target.closest("#mobile-toggle")) {
        document.body.classList.remove("sidebar-open");
      }
    }
  });
}

/* ========== Theme toggle ========== */
function initTheme() {
  const btn = $("#theme-toggle");
  const root = document.documentElement;

  function apply(theme) {
    root.setAttribute("data-theme", theme);
    if (btn) btn.textContent = theme === "dark" ? "☀️" : "🌙";
    try { localStorage.setItem("theme", theme); } catch (e) {}
  }

  let saved = null;
  try { saved = localStorage.getItem("theme"); } catch (e) {}
  apply(saved || "dark");

  if (btn) {
    btn.addEventListener("click", () => {
      const current = root.getAttribute("data-theme");
      apply(current === "dark" ? "light" : "dark");
    });
  }
}

/* ========== Lancement ========== */
/* ========== Contact form (mailto submission + validation) ========== */
function initContact() {
  const form = document.getElementById("contact-form");
  if (!form) return;

  const feedback = document.getElementById("cf-feedback");

  function showFeedback(type, message) {
    feedback.className = "form-feedback " + type;
    feedback.textContent = message;
    feedback.hidden = false;
    setTimeout(() => { feedback.hidden = true; }, 6000);
  }

  function validateEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const company = form.company.value.trim();
    const subject = form.subject.value.trim();
    const message = form.message.value.trim();

    if (!name || !email || !subject || !message) {
      showFeedback("error", "❌ Merci de remplir tous les champs obligatoires.");
      return;
    }
    if (!validateEmail(email)) {
      showFeedback("error", "❌ L'adresse email ne semble pas valide.");
      return;
    }
    if (message.length < 10) {
      showFeedback("error", "❌ Votre message est un peu court — détaillez un peu plus.");
      return;
    }

    // Build the mailto URL
    const body = [
      "Bonjour Kamel,",
      "",
      message,
      "",
      "—",
      `De : ${name}` + (company ? ` (${company})` : ""),
      `Email : ${email}`
    ].join("\n");

    const mailto = "mailto:belmoussa01510@gmail.com" +
      "?subject=" + encodeURIComponent("[Portfolio] " + subject) +
      "&body=" + encodeURIComponent(body);

    window.location.href = mailto;

    showFeedback("success", "✅ Votre messagerie va s'ouvrir avec le message pré-rempli. Cliquez sur Envoyer.");
  });
}

document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initVeille();
  initMobile();
  initTheme();
  initContact();
});
