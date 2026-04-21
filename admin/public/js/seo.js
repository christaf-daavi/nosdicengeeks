function checkTitleLength(title) {
  const len = (title || '').trim().length;
  return { ok: len >= 50 && len <= 60, value: len, label: `Título: ${len} chars (ideal 50-60)` };
}

function checkDescriptionLength(desc) {
  const len = (desc || '').trim().length;
  return { ok: len >= 120 && len <= 160, value: len, label: `Descripción: ${len} chars (ideal 120-160)` };
}

function checkKeywordInTitle(title, keyword) {
  if (!keyword) return { ok: false, label: 'Keyword en título (sin keyword)' };
  const ok = (title || '').toLowerCase().includes(keyword.toLowerCase());
  return { ok, label: `Keyword en título` };
}

function checkKeywordInDescription(desc, keyword) {
  if (!keyword) return { ok: false, label: 'Keyword en descripción (sin keyword)' };
  const ok = (desc || '').toLowerCase().includes(keyword.toLowerCase());
  return { ok, label: `Keyword en descripción` };
}

function checkKeywordInContent(content, keyword) {
  if (!keyword) return { ok: false, label: 'Keyword en contenido (sin keyword)' };
  const ok = (content || '').toLowerCase().includes(keyword.toLowerCase());
  return { ok, label: `Keyword en contenido` };
}

function checkWordCount(content) {
  const text = (content || '').replace(/[#*`_\[\]()>!|-]/g, ' ');
  const count = text.trim().split(/\s+/).filter(Boolean).length;
  return { ok: count >= 300, value: count, label: `Palabras: ${count} (mínimo 300)` };
}

function calculateSEOScore(title, description, content, keyword) {
  const checks = [
    checkTitleLength(title),
    checkDescriptionLength(description),
    checkKeywordInTitle(title, keyword),
    checkKeywordInDescription(description, keyword),
    checkKeywordInContent(content, keyword),
    checkWordCount(content),
  ];
  const passed = checks.filter((c) => c.ok).length;
  return {
    score: Math.round((passed / checks.length) * 100),
    checks,
  };
}

function updateSemaphore(title, description, content, keyword) {
  const { score, checks } = calculateSEOScore(title, description, content, keyword);
  const ids = [
    'seo-title-len',
    'seo-desc-len',
    'seo-kw-title',
    'seo-kw-desc',
    'seo-kw-content',
    'seo-words',
  ];
  ids.forEach((id, i) => {
    const el = document.getElementById(id);
    if (!el) return;
    const dot  = el.querySelector('.seo-dot');
    const text = el.querySelector('.seo-label');
    if (dot)  dot.className  = 'seo-dot ' + (checks[i].ok ? 'seo-green' : 'seo-red');
    if (text) text.textContent = checks[i].label;
  });

  const scoreEl = document.getElementById('seo-score');
  if (scoreEl) {
    scoreEl.textContent = `${score}%`;
    scoreEl.className = 'seo-score-value ' +
      (score >= 80 ? 'score-good' : score >= 50 ? 'score-ok' : 'score-bad');
  }

  const barEl = document.getElementById('seo-score-bar');
  if (barEl) {
    barEl.style.width = `${score}%`;
    barEl.className = 'seo-bar-fill ' +
      (score >= 80 ? 'score-good' : score >= 50 ? 'score-ok' : 'score-bad');
  }
}
