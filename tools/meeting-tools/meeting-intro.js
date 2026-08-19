// tools/meeting-intro.js
// Meeting presentation - 7 slides, no data capture.

(function injectStyles() {
  const existing = document.getElementById("meeting-intro-css");
  if (existing) existing.remove();
  const s = document.createElement("style");
  s.id = "meeting-intro-css";
  s.textContent = `
    .mi-wrapper { display:flex; flex-direction:column; height:100%; width:100%; position:relative; }

    .mi-progress { display:flex; align-items:center; justify-content:center; gap:0.4rem; padding:0.75rem 0 0.5rem; flex-shrink:0; }
    .mi-dot { width:5px; height:5px; border-radius:50%; background:rgba(212,168,67,0.25); border:none; padding:0; box-sizing:content-box; transition:background 0.25s, transform 0.25s; cursor:pointer; flex-shrink:0; }
    .mi-dot:hover { background:rgba(212,168,67,0.55); }
    .mi-dot.active { background:#d4a843; transform:scale(1.4); }

    .mi-stage { flex:1; min-height:0; position:relative; overflow:hidden; }
    .mi-slide { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:clamp(1rem,3vh,1.75rem) clamp(1.5rem,4vw,2.5rem); opacity:0; transform:translateX(40px); transition:opacity 0.3s ease, transform 0.3s ease; pointer-events:none; text-align:center; gap:1.5rem; overflow-y:auto; }
    .mi-slide.active { opacity:1; transform:translateX(0); pointer-events:auto; }
    .mi-slide.exit-left { opacity:0; transform:translateX(-40px); }

    .mi-sections { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3.5rem; width:100%; height:100%; }
    .mi-section { text-align:center; transition:opacity 0.4s ease, transform 0.4s ease; }
    .mi-sec-hidden { display:none; }
    .mi-sec-entering { opacity:0 !important; transform:translateX(40px) !important; }

    .mi-label { font-family:var(--fb); font-size:0.65rem; font-weight:700; letter-spacing:0.12em; text-transform:uppercase; color:var(--gold); opacity:0.8; flex-shrink:0; }
    .mi-title { font-family:var(--fd); font-size:clamp(2rem,5.5vh,3.4rem); font-weight:800; line-height:1.15; color:var(--white); letter-spacing:-0.02em; flex-shrink:0; }
    .mi-title em { font-style:italic; color:var(--gold); }
    .mi-body { font-family:var(--fb); font-size:clamp(0.82rem,1.8vh,0.98rem); color:var(--muted); max-width:480px; line-height:1.65; }

    .mi-client-name { cursor:pointer; border-bottom:1px dashed rgba(212,168,67,0.4); transition:border-color 0.2s; outline:none; min-width:4ch; display:inline-block; }
    .mi-client-name:hover { border-bottom-color:rgba(212,168,67,0.8); }
    .mi-client-name[contenteditable="true"] { border-bottom-color:var(--gold); cursor:text; }
    .mi-client-name.is-placeholder { opacity:0.55; }

    .mi-nav { display:flex; align-items:center; justify-content:center; gap:0.75rem; padding:0.6rem 1rem 0.85rem; flex-shrink:0; }
    .mi-arrow { width:28px; height:28px; background:none; border:none; color:var(--gold); display:flex; align-items:center; justify-content:center; cursor:pointer; opacity:0.4; transition:opacity 0.2s; flex-shrink:0; }
    .mi-arrow:hover { opacity:1; }
    .mi-arrow:disabled { opacity:0.12; cursor:default; }

    /* ── Agenda ── */
    .mi-agenda { display:flex; flex-direction:column; gap:0.4rem; width:100%; max-width:420px; }
    .mi-agenda-item { display:flex; align-items:center; gap:0.7rem; padding:0.5rem 0.85rem; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:0.5rem; text-align:left; }
    .mi-agenda-num { font-family:var(--fd); font-size:0.9rem; font-weight:800; color:var(--gold); flex-shrink:0; min-width:1rem; }
    .mi-agenda-text { font-family:var(--fb); font-size:0.78rem; color:var(--muted); line-height:1.3; }
    .mi-agenda-item.mi-agenda-highlight { background:rgba(212,168,67,0.07); border-color:rgba(212,168,67,0.2); }
    .mi-agenda-item.mi-agenda-highlight .mi-agenda-text { color:rgba(212,168,67,0.85); }

    /* ── Advisor intro ── */
    .mi-intro-list { display:flex; flex-direction:column; gap:0.5rem; width:100%; max-width:400px; }
    .mi-intro-item { display:flex; align-items:flex-start; gap:0.65rem; text-align:left; padding:0.55rem 0.85rem; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:0.5rem; }
    .mi-intro-arrow { color:var(--gold); font-size:0.85rem; flex-shrink:0; margin-top:0.05rem; }
    .mi-intro-text { font-family:var(--fb); font-size:0.82rem; color:var(--muted); line-height:1.4; }

    /* ── Life considerations ── */
    .mi-risk-grid { display:grid; grid-template-columns:repeat(5,1fr); gap:0.6rem; width:100%; align-items:start; }
    .mi-risk-card { background:rgba(100,140,210,0.06); border:1px solid rgba(110,150,220,0.18); border-radius:0.65rem; overflow:hidden; transition:border-color 0.3s, background 0.3s; }
    .mi-risk-head { display:flex; flex-direction:column; align-items:center; text-align:center; gap:0.6rem; padding:1rem 0.6rem; }
    .mi-risk-icon { font-size:1.8rem; }
    .mi-risk-name { font-family:var(--fb); font-size:0.78rem; font-weight:700; color:var(--white); line-height:1.35; }

    /* ── Goals ── */
    .mi-goals-wrap { display:flex; flex-direction:column; gap:0.5rem; width:100%; max-width:420px; }
    .mi-goal-step { display:flex; align-items:flex-start; gap:0.75rem; padding:0.65rem 0.9rem; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:0.55rem; text-align:left; }
    .mi-goal-num { font-family:var(--fd); font-size:1.15rem; font-weight:800; color:var(--gold); line-height:1; flex-shrink:0; padding-top:0.05rem; }
    .mi-goal-content { flex:1; }
    .mi-goal-title { font-family:var(--fb); font-size:0.82rem; font-weight:700; color:var(--white); margin-bottom:0.2rem; }
    .mi-goal-desc { font-family:var(--fb); font-size:0.72rem; color:var(--muted); line-height:1.45; }

    /* ── Building blocks ── */
    .mi-house { display:flex; flex-direction:column; width:100%; max-width:460px; }
    .mi-house-layer { border:1px solid rgba(212,168,67,0.2); border-bottom:none; overflow:hidden; cursor:pointer; transition:background 0.2s, border-color 0.2s; background:rgba(212,168,67,0.05); }
    .mi-house-layer:first-child { border-radius:0.5rem 0.5rem 0 0; }
    .mi-house-layer:last-child { border-bottom:1px solid rgba(212,168,67,0.2); border-radius:0 0 0.5rem 0.5rem; }
    .mi-house-layer:hover { background:rgba(212,168,67,0.1); border-color:rgba(212,168,67,0.4); }
    .mi-house-layer.open { background:rgba(212,168,67,0.12); border-color:rgba(212,168,67,0.5); }
    .mi-house-layer-head { display:flex; align-items:center; gap:0.6rem; padding:0.6rem 0.9rem; }
    .mi-house-layer-icon { font-size:1rem; flex-shrink:0; }
    .mi-house-layer-title { font-family:var(--fb); font-size:0.8rem; font-weight:700; color:var(--white); flex:1; text-align:left; }
    .mi-house-layer-sub { font-family:var(--fb); font-size:0.65rem; color:var(--gold); opacity:0.7; text-align:right; flex-shrink:0; }
    .mi-house-layer-chevron { margin-left:0.25rem; flex-shrink:0; color:var(--gold); opacity:0.5; transition:transform 0.25s; }
    .mi-house-layer.open .mi-house-layer-chevron { transform:rotate(180deg); opacity:1; }
    .mi-house-layer-body { max-height:0; overflow:hidden; transition:max-height 0.35s ease; }
    .mi-house-layer.open .mi-house-layer-body { max-height:100px; }
    .mi-house-layer-body-inner { font-family:var(--fb); font-size:0.72rem; color:var(--muted); line-height:1.5; padding:0 0.9rem 0.7rem; text-align:left; border-top:1px solid rgba(212,168,67,0.15); }
    .mi-house-foundation { background:rgba(212,168,67,0.09); }

    /* ── FAIS transition ── */
    .mi-fais-wrap { display:flex; flex-direction:column; align-items:center; gap:1.5rem; width:100%; max-width:400px; }
    .mi-fais-journey { display:flex; align-items:center; width:100%; }
    .mi-fais-step { display:flex; flex-direction:column; align-items:center; gap:0.35rem; flex-shrink:0; }
    .mi-fais-step-dot { width:10px; height:10px; border-radius:50%; background:rgba(212,168,67,0.2); flex-shrink:0; }
    .mi-fais-step.s-done .mi-fais-step-dot { background:var(--gold); opacity:0.7; }
    .mi-fais-step.s-current .mi-fais-step-dot { background:var(--gold); width:14px; height:14px; box-shadow:0 0 0 3px rgba(212,168,67,0.22); }
    .mi-fais-step-label { font-family:var(--fb); font-size:0.62rem; color:var(--muted); text-align:center; white-space:nowrap; }
    .mi-fais-step.s-done .mi-fais-step-label { color:rgba(212,168,67,0.65); }
    .mi-fais-step.s-current .mi-fais-step-label { color:var(--gold); font-weight:700; }
    .mi-fais-line { flex:1; height:1px; background:rgba(212,168,67,0.15); margin-bottom:1.35rem; }
    .mi-fais-line.l-done { background:rgba(212,168,67,0.45); }
    .mi-fais-box { background:rgba(212,168,67,0.06); border:1px solid rgba(212,168,67,0.22); border-radius:0.75rem; padding:1rem 1.2rem; text-align:left; width:100%; box-sizing:border-box; }
    .mi-fais-box-title { font-family:var(--fb); font-size:0.68rem; font-weight:700; color:var(--gold); margin-bottom:0.45rem; letter-spacing:0.08em; text-transform:uppercase; }
    .mi-fais-box-text { font-family:var(--fb); font-size:0.76rem; color:var(--muted); line-height:1.6; }

    /* ── House visual ── */
    .mi-hv { width:100%; max-width:700px; display:flex; flex-direction:column; }
    .mi-hv-part { transition:opacity 0.45s ease, transform 0.45s ease; }
    .mi-hv-part.up { opacity:0; transform:translateY(22px); pointer-events:none; }
    .mi-hv-part.down { opacity:0; transform:translateY(-22px); pointer-events:none; }
    .mi-hv-part.visible { opacity:1; transform:none; pointer-events:auto; }
    .mi-hv-roof svg { display:block; width:100%; height:auto; }
    .mi-hv-body { display:grid; grid-template-columns:3rem 1fr 3rem; min-height:330px; background:rgba(100,150,210,0.08); border:1px solid rgba(100,150,210,0.2); border-top:none; border-bottom:none; }
    .mi-hv-pillar { background:rgba(212,168,67,0.15); border-right:2px solid rgba(212,168,67,0.35); display:flex; align-items:center; justify-content:center; writing-mode:vertical-rl; font-family:var(--fb); font-size:0.62rem; font-weight:700; letter-spacing:0.13em; text-transform:uppercase; color:var(--gold); }
    .mi-hv-pillar:last-child { border-right:none; border-left:2px solid rgba(212,168,67,0.35); }
    .mi-hv-rooms { display:grid; grid-template-columns:repeat(3,1fr); }
    .mi-hv-room { padding:0.9rem 1rem; border-right:1px dashed rgba(255,255,255,0.08); text-align:center; }
    .mi-hv-room:last-child { border-right:none; }
    .mi-hv-room-label { padding-top: 6rem; font-family:var(--fb); font-size:0.68rem; font-weight:700; color:var(--gold); text-transform:uppercase; letter-spacing:0.08em; margin-bottom:0.5rem; }
    .mi-hv-room-item { font-family:var(--fb); font-size:0.85rem; color:var(--muted); line-height:1.7; }
    .mi-hv-foundation { margin-top: 0.75rem; background:rgba(212,168,67,0.15); border:2px solid rgba(212,168,67,0.35); border-top:none; padding:0.7rem 1rem; text-align:center; font-family:var(--fb); font-size:0.92rem; font-weight:700; color:var(--gold); border-radius:0 0 0.5rem 0.5rem; }
  `;
  document.head.appendChild(s);
})();

// ─────────────────────────────────────────────────────────────
// SLIDES
// ─────────────────────────────────────────────────────────────

const MeetingSlides = [
  // 1 ── WELCOME / WHAT TO EXPECT / WHO AM I  (3 sub-steps, one slide)
  {
    id: "welcome",
    label: "Welcome",
    _substep: 0,
    _clientName: "",
    _guides: [
      {
        heading: "Opening the meeting",
        html: `<p>Settle the client in. Confirm you have 45–60 minutes and no interruptions.</p>
               <p>Key line: <em>"By the end of today, we'll both have a clear picture of where you want to go and what's standing in the way."</em></p>`,
      },
      {
        heading: "What to expect",
        html: `<p>Walk the client through the menu on the left - click each section and give a one-sentence preview of what you'll do there.</p>
               <p>This isn't a pitch, it's a map. Clients relax when they can see the full shape of the meeting before it starts.</p>`,
      },
      {
        heading: "Introducing yourself",
        html: `<p>Keep this to 60 seconds. Clients don't need your CV - they need to know you're trustworthy and that you care.</p>
               <p>Cover: who you are, what makes your approach different, and why you're passionate about financial wellness.</p>
               <p>Then flip it immediately: <em>"But enough about me - tell me about you."</em></p>`,
      },
    ],
    get guide() {
      return this._guides[this._substep];
    },
    render() {
      const display = this._clientName || "[Client name]";
      const ph = this._clientName ? "" : " is-placeholder";
      return `
        <div class="mi-sections">
          <div class="mi-section" id="mi-sec-0">
            <h2 class="mi-title">Welcome,<br/><em><span class="mi-client-name${ph}" contenteditable="false" id="mi-client-name-span">${display}</span></em></h2>
          </div>
          <div class="mi-section mi-sec-hidden" id="mi-sec-1">
            <h2 class="mi-title">What to <em>expect</em></h2>
          </div>
          <div class="mi-section mi-sec-hidden" id="mi-sec-2">
            <h2 class="mi-title">A little about <em>who I am</em></h2>
          </div>
        </div>
      `;
    },
    step() {
      if (this._substep >= 2) return false;
      this._substep++;
      const el = document.getElementById(`mi-sec-${this._substep}`);
      if (el) {
        el.classList.remove("mi-sec-hidden");
        el.classList.add("mi-sec-entering");
        el.offsetHeight;
        requestAnimationFrame(() => el.classList.remove("mi-sec-entering"));
      }
      if (window.App?.setGuide) window.App.setGuide(this._guides[this._substep].heading, this._guides[this._substep].html, true);
      return true;
    },
    stepBack() {
      if (this._substep <= 0) return false;
      const el = document.getElementById(`mi-sec-${this._substep}`);
      if (el) el.classList.add("mi-sec-hidden");
      this._substep--;
      if (window.App?.setGuide) window.App.setGuide(this._guides[this._substep].heading, this._guides[this._substep].html, true);
      return true;
    },
    mount() {
      this._substep = 0;
      const span = document.getElementById("mi-client-name-span");
      if (!span) return;
      const slide = this;
      span.addEventListener("click", () => {
        if (span.getAttribute("contenteditable") === "true") return;
        if (span.classList.contains("is-placeholder")) {
          span.textContent = "";
          span.classList.remove("is-placeholder");
        }
        span.setAttribute("contenteditable", "true");
        span.focus();
        const r = document.createRange();
        r.selectNodeContents(span);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(r);
      });
      span.addEventListener("blur", () => {
        span.setAttribute("contenteditable", "false");
        const val = span.textContent.trim();
        if (val) {
          slide._clientName = val;
          span.textContent = val;
          span.classList.remove("is-placeholder");
        } else {
          slide._clientName = "";
          span.textContent = "[Client name]";
          span.classList.add("is-placeholder");
        }
        window.MeetingState?.set("meetingIntro", {
          intro_name: slide._clientName,
          meetingDate: new Date().toLocaleDateString("en-ZA"),
        });
      });
      span.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          span.blur();
        }
        if (e.key === "Escape") {
          span.textContent = slide._clientName || "[Client name]";
          if (!slide._clientName) span.classList.add("is-placeholder");
          span.blur();
        }
      });
    },
  },

  // 4 ── LIFE CONSIDERATIONS
  {
    id: "considerations",
    label: "Considerations",
    _substep: 0,
    _risks: [
      {
        icon: "🦽",
        name: "Disability & dread disease",
      },
      {
        icon: "🕊️",
        name: "Dying too soon",
      },
      {
        icon: "📈",
        name: "Inflation & taxes",
      },
      {
        icon: "⏳",
        name: "Living too long",
      },
      {
        icon: "🚨",
        name: "Emergencies",
      },
    ],
    _pillars: [
      {
        icon: "🛡️",
        name: "Risk",
      },
      {
        icon: "📈",
        name: "Investments",
      },
    ],
    _guides: [
      {
        heading: "What is your greatest asset?",
        html: `<p>Ask the client this question and let them answer. Most will say their house, their business, or their investments.</p><p>The answer is <em>their ability to earn an income</em>. That's what everything else depends on — and that's what we protect first.</p>`,
      },
      {
        heading: "Pillars of Financial Planning",
        html: `<p>Everything a financial plan does falls under one of two pillars: protecting what you have (Risk), and growing what you have (Investments).</p>`,
      },
      {
        heading: "Risk",
        html: `<p>Risk cover protects the plan from the things that could end it overnight - dying too soon, disability, dread disease, and emergencies.</p>`,
      },
      {
        heading: "Investments",
        html: `<p>Investments grow and protect wealth over time - the answer to inflation, tax, and living longer than expected.</p>`,
      },
      {
        heading: "Why we financial plan",
        html: `<p>Reveal the answer: their income is their greatest asset — and it's fragile. These are the five threats every financial plan must address.</p>`,
      },
      {
        heading: "Disability & dread disease",
        html: `<p>This is the most underestimated risk. Statistically, you are far more likely to be disabled than to die during your working years.</p><p>Ask: <em>"If you couldn't work tomorrow, how long could you survive on savings?"</em></p>`,
      },
      {
        heading: "Dying too soon",
        html: `<p>The question isn't whether they have life cover - it's whether they have <em>enough</em>.</p><p>Ask: <em>"If you weren't here, would your family maintain their current lifestyle?"</em></p>`,
      },
      {
        heading: "Inflation & taxes",
        html: `<p>Money sitting still is money going backwards. Inflation at 6% halves purchasing power in 12 years.</p><p>Ask: <em>"Is your money growing faster than inflation right now?"</em></p>`,
      },
      {
        heading: "Living too long",
        html: `<p>Most people plan to retire but don't plan for how long retirement lasts. 20–30 years of no income is a real possibility.</p><p>Ask: <em>"What age do you plan to retire, and how long do you think you'll live?"</em></p>`,
      },
      {
        heading: "Emergencies",
        html: `<p>Without an emergency fund, one unexpected event forces people to crack open long-term savings - destroying compounding.</p><p>Ask: <em>"If something went wrong tomorrow, what would you do?"</em></p>`,
      },
    ],
    get guide() {
      return this._guides[this._substep];
    },
    _show(id) {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove("mi-sec-hidden");
      el.classList.add("mi-sec-entering");
      el.offsetHeight;
      requestAnimationFrame(() => el.classList.remove("mi-sec-entering"));
    },
    _hide(id) {
      const el = document.getElementById(id);
      if (el) el.classList.add("mi-sec-hidden");
    },
    render() {
      const cards = this._risks.map((r, i) => `
        <div class="mi-risk-card mi-sec-hidden" id="mi-risk-card-${i}">
          <div class="mi-risk-head">
            <span class="mi-risk-icon">${r.icon}</span>
            <span class="mi-risk-name">${r.name}</span>
          </div>
        </div>`).join("");
      const pillarCards = this._pillars.map((p, i) => `
        <div class="mi-risk-card mi-sec-hidden" id="mi-pillar-card-${i}" style="grid-column:${i === 0 ? "2 / 3" : "4 / 5"}">
          <div class="mi-risk-head">
            <span class="mi-risk-icon">${p.icon}</span>
            <span class="mi-risk-name">${p.name}</span>
          </div>
        </div>`).join("");
      return `
        <div id="mi-cons-q" style="display:flex;flex-direction:column;align-items:center;text-align:center;">
          <h2 class="mi-title">What is your<br/><em>greatest asset?</em></h2>
        </div>
        <div id="mi-cons-pillars-heading" class="mi-sec-hidden" style="text-align:center;margin-top:1.5rem;">
          <h2 class="mi-title">Pillars of<br/><em>Financial Planning</em></h2>
        </div>
        <div id="mi-cons-pillars-grid" style="width:100%">
          <div class="mi-risk-grid">${pillarCards}</div>
        </div>
        <div id="mi-cons-heading" class="mi-sec-hidden" style="text-align:center;margin-top:1.5rem;">
          <h2 class="mi-title">Why we<br/><em>financial plan</em></h2>
        </div>
        <div id="mi-cons-grid" style="width:100%">
          <div class="mi-risk-grid">${cards}</div>
        </div>
      `;
    },
    step() {
      if (this._substep === 0) {
        // Q → pillars heading
        this._substep = 1;
        this._hide("mi-cons-q");
        this._show("mi-cons-pillars-heading");
      } else if (this._substep >= 1 && this._substep < 3) {
        // reveal pillar cards one by one (Risk, then Investments)
        this._substep++;
        this._show(`mi-pillar-card-${this._substep - 2}`);
      } else if (this._substep === 3) {
        // last pillar card → why heading
        this._substep = 4;
        this._show("mi-cons-heading");
      } else if (this._substep >= 4 && this._substep < 9) {
        // reveal risk cards one by one
        this._substep++;
        this._show(`mi-risk-card-${this._substep - 5}`);
      } else {
        return false;
      }
      const g = this._guides[this._substep];
      if (window.App?.setGuide) window.App.setGuide(g.heading, g.html, true);
      return true;
    },
    stepBack() {
      if (this._substep <= 0) return false;
      if (this._substep === 1) {
        // pillars heading → Q
        this._substep = 0;
        this._hide("mi-cons-pillars-heading");
        this._show("mi-cons-q");
      } else if (this._substep >= 2 && this._substep <= 3) {
        // hide last revealed pillar card
        this._hide(`mi-pillar-card-${this._substep - 2}`);
        this._substep--;
      } else if (this._substep === 4) {
        // why heading → last pillar card
        this._substep = 3;
        this._hide("mi-cons-heading");
      } else {
        // hide last revealed risk card (substep 5..9)
        this._hide(`mi-risk-card-${this._substep - 5}`);
        this._substep--;
      }
      const g = this._guides[this._substep];
      if (window.App?.setGuide) window.App.setGuide(g.heading, g.html, true);
      return true;
    },
    mount() {
      this._substep = 0;
    },
  },

  // 5 ── BUILDING BLOCKS
  {
    id: "building-blocks",
    label: "Building blocks",
    _substep: 0,
    _guides: [
      {
        heading: "Building your financial plan",
        html: `<p>Use this to walk the client through the structure of a sound financial plan - built from the ground up.</p>
               <p>The key message: <em>order matters</em>. You can't build walls without a foundation, and you can't put a roof on without walls.</p>`,
      },
      {
        heading: "The foundation",
        html: `<p>Every plan starts here. Without this layer, one unexpected event unravels everything above it.</p>
               <p><strong>Risk plan:</strong> Life, disability, and dread disease cover to protect the income that funds everything else.</p>`,
      },
      {
        heading: "The walls",
        html: `<p>With the foundation secure, we build toward goals across three time horizons.</p>
               <p><strong>Short term:</strong> Emergency fund.<br/><strong>Medium term:</strong> Education, holidays, vehicle.<br/><strong>Long term:</strong> Retirement - the biggest goal of all.</p>`,
      },
      {
        heading: "The roof",
        html: `<p>The final layer - protecting and passing on what's been built.</p>
               <p><strong>Will:</strong> Ensures your estate goes to the right people.<br/><strong>Estate plan:</strong> Minimises tax and delay, and structures the transfer of wealth efficiently.</p>`,
      },
    ],
    get guide() {
      return this._guides[this._substep];
    },
    render() {
      return `
        <h2 class="mi-title">Building your<br/><em>financial plan</em></h2>
        <div class="mi-hv" id="mi-hv">

          <div class="mi-hv-part down" id="mi-hv-roof">
            <svg viewBox="0 0 500 155" xmlns="http://www.w3.org/2000/svg">
              <polygon points="250,25 8,147 492,147" fill="rgba(212,168,67,0.07)" stroke="#d4a843" stroke-width="2.5" stroke-linejoin="round"/>
              <text transform="rotate(-27,141,97)" x="141" y="101" text-anchor="middle" fill="#d4a843" font-weight="700" font-size="14" font-family="Georgia,serif">Will</text>
              <text transform="rotate(27,359,97)"  x="359" y="101" text-anchor="middle" fill="#d4a843" font-weight="700" font-size="14" font-family="Georgia,serif">Estate plan</text>
            </svg>
          </div>

          <div class="mi-hv-part up" id="mi-hv-body" style="display:grid;grid-template-columns:2.5rem 1fr 2.5rem;min-height:330px;">
            <div class="mi-hv-pillar">Investment</div>
            <div class="mi-hv-rooms" style="display:grid;grid-template-columns:repeat(3,1fr);">
              <div class="mi-hv-room">
                <div class="mi-hv-room-label">Short term</div>
                <div class="mi-hv-room-item">Emergency fund</div>
              </div>
              <div class="mi-hv-room">
                <div class="mi-hv-room-label">Medium term</div>
                <div class="mi-hv-room-item">Education savings</div>
                <div class="mi-hv-room-item">Holiday savings</div>
                <div class="mi-hv-room-item">Vehicle deposit</div>
              </div>
              <div class="mi-hv-room">
                <div class="mi-hv-room-label">Long term</div>
                <div class="mi-hv-room-item">Retirement savings</div>
              </div>
            </div>
            <div class="mi-hv-pillar">Investment</div>
          </div>

          <div class="mi-hv-part up mi-hv-foundation" id="mi-hv-foundation">
            Risk plan: Life, disability &amp; dread disease
          </div>

        </div>
      `;
    },
    _reveal(id, fromClass) {
      const el = document.getElementById(id);
      if (!el) return;
      el.offsetHeight;
      requestAnimationFrame(() => {
        el.classList.remove(fromClass);
        el.classList.add("visible");
      });
    },
    _hide(id, toClass) {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.remove("visible");
      el.classList.add(toClass);
    },
    step() {
      if (this._substep >= 3) return false;
      this._substep++;
      if (this._substep === 1) this._reveal("mi-hv-foundation", "up");
      if (this._substep === 2) this._reveal("mi-hv-body", "up");
      if (this._substep === 3) this._reveal("mi-hv-roof", "down");
      const g = this._guides[this._substep];
      if (window.App?.setGuide) window.App.setGuide(g.heading, g.html, true);
      return true;
    },
    stepBack() {
      if (this._substep <= 0) return false;
      if (this._substep === 3) this._hide("mi-hv-roof", "down");
      if (this._substep === 2) this._hide("mi-hv-body", "up");
      if (this._substep === 1) this._hide("mi-hv-foundation", "up");
      this._substep--;
      const g = this._guides[this._substep];
      if (window.App?.setGuide) window.App.setGuide(g.heading, g.html, true);
      return true;
    },
    mount() {
      this._substep = 0;
    },
  },

  // 4 ── BEFORE WE BEGIN (FAIS)
  {
    id: "fais",
    label: "FAIS",
    guide: {
      heading: "Before we begin",
      html: ``,
    },
    render() {
      return `
        <h2 class="mi-title">Before we<br/><em>begin</em></h2>
      `;
    },
  },
];

// ─────────────────────────────────────────────────────────────
// ENGINE
// ─────────────────────────────────────────────────────────────

window.MeetingIntro = {
  slides: MeetingSlides,
  current: 0,

  init(container) {
    this.current = 0;
    container.innerHTML = `
      <div class="mi-wrapper">
        <div class="mi-stage" id="mi-stage"></div>
        <div class="mi-progress" id="mi-progress"></div>
      </div>
    `;
    this._buildProgress();
    this._buildSlides();
    this._goto(0, false);
    this._keyHandler = (e) => {
      if (e.target.matches("input,textarea,[contenteditable]")) return;
      if (e.key === "ArrowRight") this.next();
      if (e.key === "ArrowLeft") this.prev();
    };
    document.addEventListener("keydown", this._keyHandler);
  },

  destroy() {
    if (this._keyHandler) document.removeEventListener("keydown", this._keyHandler);
  },

  _buildProgress() {
    const bar = document.getElementById("mi-progress");
    this.slides.forEach((s, i) => {
      const dot = document.createElement("button");
      dot.className = "mi-dot";
      dot.title = s.label;
      dot.addEventListener("click", () => this._goto(i));
      bar.appendChild(dot);
    });
  },

  _buildSlides() {
    const stage = document.getElementById("mi-stage");
    this.slides.forEach((s, i) => {
      const el = document.createElement("div");
      el.className = "mi-slide";
      el.id = `mi-slide-${i}`;
      el.innerHTML = s.render();
      stage.appendChild(el);
      s.mount?.();
    });
  },

  _goto(index, animate = true) {
    const prev = this.current;
    this.current = index;

    this.slides.forEach((_, i) => {
      const el = document.getElementById(`mi-slide-${i}`);
      if (!el) return;
      if (i === index) {
        el.classList.add("active");
        el.classList.remove("exit-left");
      } else if (i === prev && animate) {
        el.classList.remove("active");
        el.classList.add("exit-left");
        setTimeout(() => el.classList.remove("exit-left"), 350);
      } else {
        el.classList.remove("active", "exit-left");
      }
    });

    document.querySelectorAll(".mi-dot").forEach((d, i) => d.classList.toggle("active", i === index));

    const slide = this.slides[index];
    if (slide.guide && window.App?.setGuide) {
      window.App.setGuide(slide.guide.heading, slide.guide.html, true);
    }
  },

  next() {
    const slide = this.slides[this.current];
    if (slide.step && slide.step()) return;
    if (this.current < this.slides.length - 1) this._goto(this.current + 1);
  },
  prev() {
    const slide = this.slides[this.current];
    if (slide.stepBack && slide.stepBack()) return;
    if (this.current > 0) this._goto(this.current - 1);
  },
};

window.App?.register("meeting-intro", {
  id: "meeting-intro",
  title: "Meeting Intro",
  guide: {
    intro: {
      heading: "Opening the meeting",
      html: `<p>Start by settling the client in. Confirm you have 45–60 minutes and that there are no interruptions.</p>
             <p>The purpose of today is simple: <em>to listen and understand</em> - not to sell.</p>`,
    },
  },
  mount(wrapper) {
    const glass = document.createElement("div");
    glass.className = "glass-panel calc-glass";
    wrapper.appendChild(glass);
    if (!MeetingSlides[0]._clientName && window._activeClientFirstName) {
      MeetingSlides[0]._clientName = window._activeClientFirstName;
    }
    window.MeetingIntro.init(glass);
  },
  unmount() {
    window.MeetingIntro.destroy();
  },
  getState() {
    return {
      slideIdx: window.MeetingIntro?.current ?? 0,
      clientName: MeetingSlides[0]._clientName || "",
    };
  },
  setState(extra) {
    if (!extra) return;
    if (extra.clientName) {
      MeetingSlides[0]._clientName = extra.clientName;
      const span = document.getElementById("mi-client-name-span");
      if (span) {
        span.textContent = extra.clientName;
        span.classList.remove("is-placeholder");
      }
      window.MeetingState?.set("meetingIntro", { intro_name: extra.clientName, meetingDate: new Date().toLocaleDateString("en-ZA") });
    }
    if (extra.slideIdx > 0 && window.MeetingIntro) {
      window.MeetingIntro._goto(extra.slideIdx, false);
    }
  },
});
