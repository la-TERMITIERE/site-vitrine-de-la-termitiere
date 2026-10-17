/* =========================================================
   LA TERMITIÈRE — Assistant IA « Termi » (bulle de discussion)
   FAQ sur l'entreprise, conseils santé & sport, jeux et quiz.
   Le texte est envoyé à /api/chat (service chat-proxy).
   ========================================================= */
(() => {
  const ENDPOINT = '/api/chat';
  const STORAGE_KEY = 'termitiere-chat';
  const WELCOME = "Bonjour ! Je suis **Termi**, l'assistant de La Termitière. Je peux répondre à vos questions sur nos secteurs, vous donner des conseils santé et sport, ou lancer un petit jeu. Que souhaitez-vous ?";
  const SUGGESTIONS = [
    { label: '🏢 Nos secteurs', text: 'Présente-moi les secteurs de La Termitière.' },
    { label: '💪 Tarifs Maxi Gym', text: 'Quels sont les tarifs et horaires de Maxi Gym ?' },
    { label: '🎯 Quiz La Termitière', text: 'Lance un quiz « Connais-tu La Termitière ? »' },
    { label: '🥗 Quiz santé & sport', text: 'Lance un quiz santé et sport.' },
    { label: '🔥 Défi forme du jour', text: 'Propose-moi un défi forme du jour, je suis débutant.' },
  ];

  let history = [];  // [{ role: 'user' | 'assistant', content: string }]
  let busy = false;

  try { history = JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || []; } catch (e) { history = []; }
  const save = () => { try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-40))); } catch (e) { /* ignore */ } };

  /* ---------- Rendu sûr d'un Markdown minimal (gras, listes, liens) ---------- */
  const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function inline(text) {
    let html = escapeHtml(text);
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // Liens Markdown [texte](https://... ou /page.html)
    html = html.replace(/\[([^\]]+)\]\((https:\/\/[^\s)]+|\/[^\s)]*)\)/g, (m, label, url) => (url.startsWith('/')
      ? `<a href="${url}">${label}</a>`
      : `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`));
    html = html.replace(/(^|[\s(])(https:\/\/[^\s<)]+[^\s<).,;:!?])/g, (m, pre, url) => `${pre}<a href="${url}" target="_blank" rel="noopener noreferrer">${url.replace(/^https:\/\//, '')}</a>`);
    html = html.replace(/(^|[\s(])(\/[a-z0-9-]+\.html(?:[?#][^\s<).,;:!]*)?)/gi, (m, pre, path) => `${pre}<a href="${path}">${path}</a>`);
    return html;
  }

  function renderMarkdown(text) {
    const out = [];
    let list = null;
    const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
    text.split('\n').forEach((raw) => {
      const line = raw.trimEnd();
      const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
      const numbered = line.match(/^\s*\d+[.)]\s+(.*)$/);
      if (bullet || numbered) {
        const tag = bullet ? 'ul' : 'ol';
        if (list !== tag) { closeList(); out.push(`<${tag}>`); list = tag; }
        out.push(`<li>${inline((bullet || numbered)[1])}</li>`);
      } else if (!line.trim()) {
        closeList();
      } else {
        closeList();
        out.push(`<p>${inline(line.replace(/^#+\s*/, ''))}</p>`);
      }
    });
    closeList();
    return out.join('');
  }

  /* ---------- Construction de l'interface ---------- */
  function build() {
    const root = document.createElement('div');
    root.className = 'chatbot';
    root.innerHTML = `
      <button class="chatbot-launcher" type="button" aria-label="Ouvrir l'assistant Termi" aria-expanded="false" aria-controls="chatbot-panel">
        <svg class="chatbot-icon-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a8 8 0 01-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1121 12z"/><path stroke-linecap="round" d="M8.5 12h.01M12 12h.01M15.5 12h.01"/></svg>
        <svg class="chatbot-icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
        <span class="chatbot-launcher-label">Une question ?</span>
      </button>
      <div class="chatbot-panel" id="chatbot-panel" role="dialog" aria-label="Assistant Termi" hidden>
        <div class="chatbot-head">
          <span class="chatbot-avatar"><img src="/images/logo/logo.png" alt=""></span>
          <div class="chatbot-title">
            <strong>Termi</strong>
            <span>Assistant IA de La Termitière</span>
          </div>
          <button class="chatbot-reset" type="button" aria-label="Nouvelle conversation" title="Nouvelle conversation">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v6h6M20 20v-6h-6M5.5 15a7 7 0 0011.9 2.5L20 14M4 10l2.6-3.5A7 7 0 0118.5 9"/></svg>
          </button>
          <button class="chatbot-close" type="button" aria-label="Fermer l'assistant">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>
        <div class="chatbot-log" aria-live="polite"></div>
        <div class="chatbot-suggestions"></div>
        <form class="chatbot-form">
          <label class="sr-only" for="chatbot-input">Votre message</label>
          <textarea id="chatbot-input" rows="1" maxlength="1500" placeholder="Écrivez votre message…"></textarea>
          <button type="submit" class="chatbot-send" aria-label="Envoyer">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M13 6l6 6-6 6"/></svg>
          </button>
        </form>
        <p class="chatbot-disclaimer">Réponses générées par IA, à vérifier auprès de nos équipes. Ne remplace pas un avis médical.</p>
      </div>`;
    document.body.appendChild(root);

    const launcher = root.querySelector('.chatbot-launcher');
    const panel = root.querySelector('.chatbot-panel');
    const log = root.querySelector('.chatbot-log');
    const suggestions = root.querySelector('.chatbot-suggestions');
    const form = root.querySelector('.chatbot-form');
    const input = root.querySelector('#chatbot-input');
    const sendBtn = root.querySelector('.chatbot-send');

    const scrollDown = () => { log.scrollTop = log.scrollHeight; };

    function addBubble(role, text) {
      const el = document.createElement('div');
      el.className = `chatbot-msg chatbot-msg--${role === 'user' ? 'user' : 'bot'}`;
      if (role === 'user') el.textContent = text;
      else el.innerHTML = renderMarkdown(text);
      log.appendChild(el);
      scrollDown();
      return el;
    }

    function renderSuggestions() {
      suggestions.innerHTML = '';
      if (history.length > 0) return;
      SUGGESTIONS.forEach((s) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'chatbot-chip';
        b.textContent = s.label;
        b.addEventListener('click', () => send(s.text));
        suggestions.appendChild(b);
      });
    }

    function renderAll() {
      log.innerHTML = '';
      addBubble('assistant', WELCOME);
      history.forEach((m) => addBubble(m.role, m.content));
      renderSuggestions();
    }

    function setBusy(v) {
      busy = v;
      sendBtn.disabled = v;
      root.classList.toggle('chatbot--busy', v);
    }

    async function send(text) {
      text = text.trim();
      if (!text || busy) return;
      history.push({ role: 'user', content: text });
      save();
      addBubble('user', text);
      renderSuggestions();
      input.value = '';
      autoGrow();
      setBusy(true);

      const bubble = addBubble('assistant', '');
      bubble.classList.add('chatbot-msg--typing');
      bubble.innerHTML = '<span class="chatbot-dots"><i></i><i></i><i></i></span>';

      let answer = '';
      let error = null;
      try {
        const res = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: history }),
        });
        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "L'assistant est momentanément indisponible.");
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();
          for (const line of lines) {
            if (!line.trim()) continue;
            const evt = JSON.parse(line);
            if (evt.t) {
              answer += evt.t;
              bubble.classList.remove('chatbot-msg--typing');
              bubble.innerHTML = renderMarkdown(answer);
              scrollDown();
            } else if (evt.error) {
              error = evt.error;
            }
          }
        }
      } catch (err) {
        error = err.message || "Connexion impossible. Vérifiez votre réseau et réessayez.";
      }

      bubble.classList.remove('chatbot-msg--typing');
      if (answer) {
        history.push({ role: 'assistant', content: answer });
        save();
        if (error) bubble.insertAdjacentHTML('beforeend', `<p class="chatbot-error">${escapeHtml(error)}</p>`);
      } else {
        // Échec complet : on retire la question pour pouvoir la renvoyer telle quelle
        history.pop();
        save();
        bubble.classList.add('chatbot-msg--error');
        bubble.textContent = error || "Je n'ai pas pu répondre. Réessayez dans un instant.";
        input.value = text;
        autoGrow();
      }
      setBusy(false);
      input.focus();
    }

    function autoGrow() {
      input.style.height = 'auto';
      input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
      input.style.overflowY = input.scrollHeight > 120 ? 'auto' : 'hidden';
    }

    function toggle(open) {
      panel.hidden = !open;
      root.classList.toggle('chatbot--open', open);
      launcher.setAttribute('aria-expanded', String(open));
      launcher.setAttribute('aria-label', open ? "Fermer l'assistant Termi" : "Ouvrir l'assistant Termi");
      if (open) { scrollDown(); setTimeout(() => input.focus(), 50); }
    }

    launcher.addEventListener('click', () => toggle(panel.hidden));
    root.querySelector('.chatbot-close').addEventListener('click', () => { toggle(false); launcher.focus(); });
    root.querySelector('.chatbot-reset').addEventListener('click', () => {
      if (busy) return;
      history = [];
      save();
      renderAll();
      input.focus();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) { toggle(false); launcher.focus(); } });
    form.addEventListener('submit', (e) => { e.preventDefault(); send(input.value); });
    input.addEventListener('input', autoGrow);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(input.value); }
    });

    renderAll();
  }

  // Feuille de style dédiée, chargée avant d'afficher la bulle
  function init() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/css/chatbot.css';
    link.addEventListener('load', build, { once: true });
    document.head.appendChild(link);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
