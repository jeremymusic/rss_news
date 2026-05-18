(function () {
  'use strict';

  // ── Theme ──────────────────────────────────────────────────────────────────
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.dataset.theme = savedTheme;

  document.getElementById('theme-toggle').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('theme', next);
  });

  // ── DOM refs ───────────────────────────────────────────────────────────────
  const sourceButtons = document.getElementById('source-buttons');
  const placeholder   = document.getElementById('placeholder');
  const spinner       = document.getElementById('spinner');
  const errorBox      = document.getElementById('error-box');
  const feedMeta      = document.getElementById('feed-meta');
  const feedTitle     = document.getElementById('feed-title');
  const feedDesc      = document.getElementById('feed-desc');
  const articlesList  = document.getElementById('articles');

  let activeSource = null;
  let activeBtn    = null;

  // ── Show / hide helpers ────────────────────────────────────────────────────
  function showOnly(el) {
    [placeholder, spinner, errorBox, feedMeta, articlesList].forEach(e => {
      e.classList.toggle('hidden', e !== el && el !== 'feed');
    });
    if (el === 'feed') {
      feedMeta.classList.remove('hidden');
      articlesList.classList.remove('hidden');
    }
  }

  function showError(msg) {
    errorBox.textContent = `Error: ${msg}`;
    errorBox.classList.remove('hidden');
    feedMeta.classList.add('hidden');
    articlesList.classList.add('hidden');
    spinner.classList.add('hidden');
    placeholder.classList.add('hidden');
  }

  // ── Load source buttons ────────────────────────────────────────────────────
  async function loadSources() {
    try {
      const res = await fetch('/api/sources');
      const sources = await res.json();
      sourceButtons.innerHTML = '';
      sources.forEach(({ id, label }) => {
        const btn = document.createElement('button');
        btn.className = 'source-btn';
        btn.textContent = label;
        btn.dataset.source = id;
        btn.addEventListener('click', () => selectSource(id, btn));
        sourceButtons.appendChild(btn);
      });
    } catch {
      sourceButtons.innerHTML = '<span class="nav-loading">Failed to load sources.</span>';
    }
  }

  // ── Select & fetch a source ────────────────────────────────────────────────
  function selectSource(id, btn) {
    if (id === activeSource) return;
    activeSource = id;

    if (activeBtn) activeBtn.classList.remove('active');
    btn.classList.add('active');
    activeBtn = btn;

    showOnly(spinner);
    articlesList.innerHTML = '';
    fetchFeed(id);
  }

  async function fetchFeed(id) {
    try {
      const res = await fetch(`/api/feed/${id}`);

      if (!res.ok) {
        const json = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        return showError(json.error || `HTTP ${res.status}`);
      }

      const text = await res.text();
      const doc = new DOMParser().parseFromString(text, 'application/xml');
      const parseErr = doc.querySelector('parsererror');
      if (parseErr) return showError('Feed could not be parsed as XML.');

      renderFeed(doc);
    } catch (err) {
      showError(err.message);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  function renderFeed(doc) {
    // Support RSS 2.0 and Atom
    const isAtom = !!doc.querySelector('feed');
    const title   = text(doc, isAtom ? 'feed > title' : 'channel > title');
    const desc    = text(doc, isAtom ? 'feed > subtitle' : 'channel > description');
    const items   = isAtom
      ? [...doc.querySelectorAll('feed > entry')]
      : [...doc.querySelectorAll('channel > item')];

    feedTitle.textContent = title || 'News Feed';
    feedDesc.textContent  = desc  || '';
    articlesList.innerHTML = '';

    if (items.length === 0) {
      articlesList.innerHTML = '<li style="color:var(--muted);padding:20px 0">No articles found in this feed.</li>';
    } else {
      items.slice(0, 40).forEach(item => articlesList.appendChild(buildCard(item, isAtom)));
    }

    showOnly('feed');
  }

  function buildCard(item, isAtom) {
    const title   = text(item, isAtom ? 'title' : 'title');
    const link    = isAtom
      ? (item.querySelector('link[rel="alternate"]')?.getAttribute('href') || item.querySelector('link')?.getAttribute('href') || '')
      : (text(item, 'link') || item.querySelector('link')?.textContent || '');
    const pubDate = text(item, isAtom ? 'published,updated' : 'pubDate');
    const author  = text(item, isAtom ? 'author > name' : 'author,dc\\:creator');
    const rawDesc = text(item, isAtom ? 'summary,content' : 'description');
    const desc    = stripHtml(rawDesc);

    const li = document.createElement('li');
    li.className = 'article-card';

    const formatted = pubDate ? formatDate(pubDate) : '';

    li.innerHTML = `
      <a href="${escAttr(link)}" target="_blank" rel="noopener noreferrer">
        <div class="article-title">${escHtml(title || 'Untitled')}</div>
        <div class="article-meta">
          ${formatted ? `<span>${escHtml(formatted)}</span>` : ''}
          ${author    ? `<span>${escHtml(author)}</span>`    : ''}
        </div>
        ${desc ? `<div class="article-desc">${escHtml(desc)}</div>` : ''}
      </a>`;

    return li;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function text(node, selector) {
    const selectors = selector.split(',');
    for (const s of selectors) {
      const el = node.querySelector(s.trim());
      if (el && el.textContent.trim()) return el.textContent.trim();
    }
    return '';
  }

  function stripHtml(html) {
    if (!html) return '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  function formatDate(str) {
    try {
      return new Intl.DateTimeFormat('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: 'numeric', minute: '2-digit',
      }).format(new Date(str));
    } catch {
      return str;
    }
  }

  function escHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escAttr(s) {
    return String(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  loadSources();
})();
