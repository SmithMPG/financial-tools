// tools/wrapping-up.js
// Wrapping Up — will questions, service rating, and referrals table.

(function () {
  // ── CSS ────────────────────────────────────────────────────────────────────

  function _injectCSS() {
    if (document.getElementById("wu-styles")) return;
    const s = document.createElement("style");
    s.id = "wu-styles";
    s.textContent = `
      /* Rating */
      .cm-rating-wrap { display: flex; flex-direction: column; gap: 0.55rem; }
      .cm-rating-row { display: flex; align-items: center; gap: 0.9rem; }
      .cm-rating-val {
        font-family: var(--fb); font-size: 1.6rem; font-weight: 700; min-width: 2rem;
        text-align: center; color: var(--navy-3); line-height: 1;
      }
      .cm-rating-labels { display: flex; justify-content: space-between; font-family: var(--fb); font-size: 0.62rem; color: var(--navy-5); padding: 0 2px; }
      input[type="range"].cm-rating-slider {
        -webkit-appearance: none; appearance: none;
        flex: 1; height: 8px; border-radius: 99px; outline: none; cursor: pointer;
        background: transparent;
      }
      input[type="range"].cm-rating-slider::-webkit-slider-runnable-track {
        height: 8px; border-radius: 99px;
        background: linear-gradient(to right,#ef4444,#f97316,#facc15,#84cc16,#22c55e);
      }
      input[type="range"].cm-rating-slider::-moz-range-track {
        height: 8px; border-radius: 99px;
        background: linear-gradient(to right,#ef4444,#f97316,#facc15,#84cc16,#22c55e);
      }
      input[type="range"].cm-rating-slider::-webkit-slider-thumb {
        -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%;
        background: white; border: 2px solid rgba(0,0,0,0.18);
        box-shadow: 0 1px 4px rgba(0,0,0,0.18); cursor: pointer; transition: opacity 0.15s;
        margin-top: -6px;
      }
      input[type="range"].cm-rating-slider.cm-rating-unset::-webkit-slider-thumb { opacity: 0; margin-top: -6px; }
      input[type="range"].cm-rating-slider::-moz-range-thumb {
        width: 20px; height: 20px; border-radius: 50%;
        background: white; border: 2px solid rgba(0,0,0,0.18);
        box-shadow: 0 1px 4px rgba(0,0,0,0.18); cursor: pointer;
      }
      input[type="range"].cm-rating-slider.cm-rating-unset::-moz-range-thumb { opacity: 0; }
      .cm-rating-prompt {
        font-family: var(--fb); font-size: 0.78rem; color: var(--navy-5);
        text-align: center; padding: 0.2rem 0; opacity: 0.6;
      }
      .cm-sec-pad { padding: 0.75rem 1rem; display: flex; flex-direction: column; gap: 0; }
      /* FAIS disclosure link */
      /* Matches .mt-yn's 32px footprint (28px button + 2px padding each side)
         so the link row and the yes/no row below it line up at equal height. */
      .wu-fais-link-btn {
        display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        width: 32px; height: 32px; border-radius: 6px;
        background: rgba(0,0,0,0.06); color: var(--navy-3);
        font-size: 1rem; text-decoration: none; transition: background 0.15s, color 0.15s;
      }
      .wu-fais-link-btn:hover { background: rgba(0,0,0,0.1); color: var(--navy-2); }
      /* Referrals */
      .cm-referrals-sec { display: none; }
      .cm-referrals-sec.cm-visible { display: block; animation: cm-fade-in 0.25s ease; }
      @keyframes cm-fade-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
      .cm-ref-grid {
        display: grid; gap: 0.25rem 0.45rem; align-items: center;
        grid-template-columns: minmax(140px, 2fr) minmax(100px, 1fr) minmax(110px, 1fr) minmax(120px, 1fr);
        padding-left: 1.25rem; padding-right: 1.25rem;
      }
    `;
    document.head.appendChild(s);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  const _yn    = (id)        => MtUI.yn(id);
  const _ynRow = (id, label) => MtUI.ynRow(id, label);

  // ── Referral row ───────────────────────────────────────────────────────────

  function _referralRow() {
    return `<div class="mt-secondary" style="display:contents">
      <div class="mt-secondary-cell" style="display:flex;align-items:center;gap:0.35rem">
        <button class="mt-secondary-x" type="button" title="Remove">×</button>
        <input class="mt-input-sm" type="text" placeholder="Full name" autocomplete="off" style="flex:1;min-width:0">
      </div>
      <div class="mt-secondary-cell"><input class="mt-input-sm" type="text" placeholder="e.g. Colleague" autocomplete="off"></div>
      <div class="mt-secondary-cell"><input class="mt-input-sm" type="text" placeholder="e.g. Teacher" autocomplete="off"></div>
      <div class="mt-secondary-cell"><input class="mt-input-sm" type="text" placeholder="e.g. 082 000 0000" autocomplete="off"></div>
    </div>`;
  }

  // ── Template ───────────────────────────────────────────────────────────────

  function _template() {
    return `<div class="mt-panel calc-glass">
      <div class="mt-pane">

        <!-- Section 0: FAIS Disclosure -->
        <div class="mt-primary collapsed" id="wu_fais_sec">
          <div class="mt-primary-hdr">
            <div class="mt-primary-title">FAIS Disclosure</div>
            <span class="mt-chev"></span>
          </div>
          <div class="mt-primary-body">
            <div style="display:flex;flex-direction:column;gap:0.45rem;">
              <div class="mt-q-row">
                <span class="mt-q-text">Intro Letter</span>
                <a class="wu-fais-link-btn" href="https://www.blueprintonline.co.za/nblue/StandardForms/AdminAdvisorCapture/GetConsultantDetails?SelectedAdvisor=4950010952638&consultantCode=4950010952638" target="_blank" rel="noopener noreferrer" aria-label="Open FAIS intro letter" title="Open FAIS intro letter">&rarr;</a>
              </div>
              ${_ynRow("wu_fais_signed", "FAIS Disclosure signed?")}
            </div>
          </div>
        </div>

        <!-- Section 1: Will -->
        <div class="mt-primary collapsed" id="wu_will_sec">
          <div class="mt-primary-hdr">
            <div class="mt-primary-title">Will</div>
            <span class="mt-chev"></span>
          </div>
          <div class="mt-primary-body">
            <div style="display:flex;flex-direction:column;gap:0.45rem;">
              ${_ynRow("wu_has_will", "Do you have a will?")}
              <div class="mt-q-row"><span class="mt-q-text">When was it last updated?</span><input class="mt-input" id="wu_will_updated" type="text" placeholder="e.g. 2021" autocomplete="off" style="width:130px;flex-shrink:0;"></div>
              <div class="mt-q-row"><span class="mt-q-text">Where is your will kept?</span><input class="mt-input" id="wu_will_location" type="text" placeholder="e.g. Home safe, attorney's office" autocomplete="off" style="width:220px;flex-shrink:0;"></div>
              <div class="mt-q-row"><span class="mt-q-text">Who set up your will?</span><input class="mt-input" id="wu_will_attorney" type="text" placeholder="e.g. Name / firm" autocomplete="off" style="width:220px;flex-shrink:0;"></div>
              ${_ynRow("wu_will_contact", "May we contact you to update / draft your will?")}
            </div>
          </div>
        </div>


        <!-- Section 2: Service rating (referrals table appears inline once rated) -->
        <div class="mt-primary collapsed" id="wu_rating_sec">
          <div class="mt-primary-hdr">
            <div class="mt-primary-title">Service Rating</div>
            <span class="mt-chev"></span>
          </div>
          <div class="mt-primary-body">
            <div class="cm-sec-pad">
              <div class="cm-rating-wrap">
                <div class="cm-rating-row">
                  <input type="range" class="cm-rating-slider" id="wu_service_rating" min="0" max="10" value="0">
                  <div class="cm-rating-val" id="wu_service_rating_val">-</div>
                </div>
                <div class="cm-rating-labels"><span>0 - Poor</span><span>10 - Excellent</span></div>
              </div>
              <div class="cm-rating-prompt" id="wu_rating_prompt">Slide to rate</div>
            </div>
            <div class="cm-referrals-sec" id="wu_referrals_sec">
              <div class="cm-sec-pad">
                <div class="mt-primary-title" style="margin-bottom:0.5rem">Referrals</div>
                <div class="cm-ref-grid" id="wu_ref_rows">
                  <div class="mt-secondary-label">Name</div>
                  <div class="mt-secondary-label">Relation to Client</div>
                  <div class="mt-secondary-label">Occupation</div>
                  <div class="mt-secondary-label">Contact Number</div>
                </div>
                <button class="cm-add-row-btn" data-add="wu-referral">+ Add referral</button>
              </div>
            </div>
          </div>
        </div>

        <!-- Section 3: Next Meeting -->
        <div class="mt-primary collapsed" id="wu_next_meeting_sec">
          <div class="mt-primary-hdr">
            <div class="mt-primary-title">Next Meeting</div>
            <span class="mt-chev"></span>
          </div>
          <div class="mt-primary-body">
            <div class="mt-q-row">
              <span class="mt-q-text">Date &amp; time</span>
              <div style="display:flex;align-items:center;gap:0.5rem;flex-shrink:0;">
                <input class="mt-input" id="wu_next_meeting_date" type="date" autocomplete="off" style="width:170px;">
                <input class="mt-input" id="wu_next_meeting_time" type="time" autocomplete="off" style="width:130px;">
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>`;
  }

  // ── MeetingState sync ──────────────────────────────────────────────────────

  function _sync(w, ratingTouched) {
    if (!window.MeetingState) return;
    const willYn = (id) => w.querySelector(`.mt-yn[data-yn="${id}"] .mt-yn-btn.active-yes, .mt-yn[data-yn="${id}"] .mt-yn-btn.active-no`)?.dataset.ans || "";
    const g      = (id) => w.querySelector(`#${id}`)?.value || "";

    const referrals = [];
    w.querySelectorAll("#wu_ref_rows .mt-secondary").forEach((row) => {
      const inputs = row.querySelectorAll("input");
      referrals.push({ name: inputs[0]?.value || "", relation: inputs[1]?.value || "", occupation: inputs[2]?.value || "", contact: inputs[3]?.value || "" });
    });

    window.MeetingState.set("wrapUp", {
      faisSigned:    willYn("wu_fais_signed"),
      hasWill:       willYn("wu_has_will"),
      willUpdated:   g("wu_will_updated"),
      willLocation:  g("wu_will_location"),
      willAttorney:  g("wu_will_attorney"),
      willContact:   willYn("wu_will_contact"),
      serviceRating: ratingTouched ? g("wu_service_rating") : "",
      referrals,
      nextMeetingDate: g("wu_next_meeting_date"),
      nextMeetingTime: g("wu_next_meeting_time"),
    });
  }

  // ── Module ─────────────────────────────────────────────────────────────────

  window.App?.register("wrapping-up", {
    id: "wrapping-up",
    title: "Wrap Up",
    guide: {
      intro: {
        heading: "Wrapping Up",
        html: `<p>Start by getting the FAIS intro letter signed, now that the meeting's substance has been covered.</p>
               <p>Then capture the client's will status and service rating before closing the meeting.</p>
               <p>Once the client rates the conversation, the referrals table appears with rows matching their score.</p>
               <p>Finish by locking in the date and time of the next meeting.</p>`,
      },
    },

    mount(wrapper) {
      _injectCSS();
      wrapper.insertAdjacentHTML("beforeend", _template());
      const w = wrapper.querySelector(".mt-panel");

      let _ratingTouched = false;

      const slider     = w.querySelector("#wu_service_rating");
      const valDisplay = w.querySelector("#wu_service_rating_val");
      const prompt     = w.querySelector("#wu_rating_prompt");
      const refSec     = w.querySelector("#wu_referrals_sec");
      const refRows    = w.querySelector("#wu_ref_rows");

      function _setRatingRows(target) {
        const current = refRows.querySelectorAll(".mt-secondary").length;
        if (target > current) {
          for (let i = current; i < target; i++) refRows.insertAdjacentHTML("beforeend", _referralRow());
        } else if (target < current) {
          const rows = refRows.querySelectorAll(".mt-secondary");
          for (let i = current - 1; i >= target; i--) {
            const hasData = [...rows[i].querySelectorAll("input")].some(inp => inp.value.trim() !== "");
            if (!hasData) rows[i].remove();
          }
        }
      }

      slider.addEventListener("input", (e) => {
        const val = parseInt(e.target.value, 10);
        if (!_ratingTouched) {
          _ratingTouched = true;
          slider.dataset.touched = "true";
          prompt.style.display = "none";
        }
        valDisplay.textContent = val;
        if (val > 0) {
          refSec.classList.add("cm-visible");
          _setRatingRows(val);
        } else {
          refSec.classList.remove("cm-visible");
          _setRatingRows(0);
        }
        _sync(w, _ratingTouched);
      });

      MtUI.initSections(w, { accordion: true });
      MtUI.initYn(w, () => _sync(w, _ratingTouched));

      w.addEventListener("click", (e) => {
        if (e.target.closest('[data-add="wu-referral"]')) {
          refRows.insertAdjacentHTML("beforeend", _referralRow());
          _sync(w, _ratingTouched);
        }
      });

      w.addEventListener("input", () => _sync(w, _ratingTouched));
    },

    getState() {
      const w = window.App._wrappers[this.id]?.querySelector(".mt-panel");
      if (!w) return null;

      const ynButtons = {};
      w.querySelectorAll("[data-yn]").forEach((grp) => {
        ynButtons[grp.dataset.yn] = grp.querySelector(".mt-yn-btn.active-yes, .mt-yn-btn.active-no")?.dataset.ans || "";
      });

      const slider       = w.querySelector("#wu_service_rating");
      const ratingTouched = slider && slider.dataset.touched === "true";
      const ratingVal    = ratingTouched ? (slider?.value || "") : "";

      const referralRows = [...w.querySelectorAll("#wu_ref_rows .mt-secondary")].map((row) =>
        [...row.querySelectorAll("input")].map((inp) => inp.value || "")
      );

      return { ynButtons, ratingTouched, ratingVal, referralRows };
    },

    setState(extra) {
      if (!extra) return;
      const w = window.App._wrappers[this.id]?.querySelector(".mt-panel");
      if (!w) return;

      if (extra.ynButtons) {
        Object.entries(extra.ynButtons).forEach(([name, ans]) => {
          if (!ans) return;
          const btn = w.querySelector(`[data-yn="${name}"] .mt-yn-btn[data-ans="${ans}"]`);
          if (btn) btn.click();
        });
      }

      if (extra.ratingTouched && extra.ratingVal) {
        const slider = w.querySelector("#wu_service_rating");
        if (slider) {
          slider.value = extra.ratingVal;
          slider.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }


      if (extra.referralRows && extra.referralRows.length > 0) {
        const refRows = w.querySelector("#wu_ref_rows");
        if (refRows) {
          const rows = refRows.querySelectorAll(".mt-secondary");
          extra.referralRows.forEach((cols, ri) => {
            const row = rows[ri];
            if (!row) return;
            row.querySelectorAll("input").forEach((inp, ci) => { if (cols[ci] !== undefined) inp.value = cols[ci]; });
          });
        }
      }
    },
  });
})();
