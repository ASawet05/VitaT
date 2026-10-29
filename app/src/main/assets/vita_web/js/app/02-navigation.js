function openAppDrawer() {
      const drawer = document.getElementById("appDrawer");
      const backdrop = document.getElementById("drawerBackdrop");
      if (drawer && backdrop) {
        drawer.classList.remove("-translate-x-full");
        backdrop.classList.remove("opacity-0", "pointer-events-none");
        backdrop.classList.add("opacity-100");
      }
    }

    function closeAppDrawer() {
      const drawer = document.getElementById("appDrawer");
      const backdrop = document.getElementById("drawerBackdrop");
      if (drawer && backdrop) {
        drawer.classList.add("-translate-x-full");
        backdrop.classList.remove("opacity-100");
        backdrop.classList.add("opacity-0", "pointer-events-none");
      }
    }

    function navigateToView(viewId) {
      if (window.TTSVoice) TTSVoice.stop();
      if (window.SoundEffects) SoundEffects.playNavigate();
      closeAppDrawer();
      state.activeTab = viewId;

      const allViews = ["view-home", "view-labs", "view-neyim", "view-clinical-results", "view-report"];
      allViews.forEach(v => {
        const el = document.getElementById(v);
        if (el) el.classList.add("hidden");
      });

      const target = document.getElementById(viewId);
      if (target) {
        target.classList.remove("hidden", "vita-view-enter");
        void target.offsetWidth;
        target.classList.add("vita-view-enter");
        target.addEventListener("animationend", () => target.classList.remove("vita-view-enter"), { once: true });
      }

      allViews.forEach(v => {
        const btn = document.getElementById(`drawer-nav-${v}`);
        if (btn) {
          if (v === viewId) {
            btn.className = "w-full flex items-center gap-3 px-3.5 py-3 rounded-xl bg-teal-600 text-white font-bold transition text-left cursor-pointer shadow-md";
          } else {
            btn.className = "w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-slate-200 hover:text-white hover:bg-navy-800 transition text-left cursor-pointer";
          }
        }
      });
      updateMobileNavigation(viewId);

      const headerBar = document.getElementById("viewHeaderBar");
      const titleEl = document.getElementById("currentViewTitle");

      if (viewId === "view-home") {
        if (headerBar) headerBar.classList.add("hidden");
        renderDailyTab();
        checkPendingSymptomReviews();
        detectSupplementConflicts();
      } else {
        if (headerBar) headerBar.classList.remove("hidden");
        const titles = {
          "view-labs": "Laboratuvar Tahlillerim & e-Nabız PDF Arşivi",
          "view-neyim": "NeyimVar? Belirti değerlendirmesi",
          "view-clinical-results": "Klinik Karar Analizi Sonuçları",
          "view-report": "Doktor Görüşmesi İçin Hasta Özeti"
        };
        if (titleEl) titleEl.textContent = titles[viewId] || "Modül";

        if (viewId === "view-labs") {
          restoreLabDraft();
          syncCDSSDemographics();
          renderLabHistoryUI();
          evaluateTrendAndDecisionSupport(false);
          renderBiomarkerTrendChart();
        } else if (viewId === "view-neyim") {
          syncCDSSDemographics();
          syncAnamnesisCardsUI();
          ensureCDSSResultsView();
        } else if (viewId === "view-clinical-results") {
          ensureCDSSResultsView();
          if (state.lastCDSS) renderCDSSResultsUI(true);
        } else if (viewId === "view-report") {
          renderReportTab();
        }
      }

      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function updateMobileNavigation(viewId) {
      ["view-home", "view-labs", "view-neyim", "view-clinical-results", "view-report"].forEach(id => {
        const button = document.getElementById(`mobile-nav-${id}`);
        if (!button) return;
        if (id === viewId) button.setAttribute("aria-current", "page");
        else button.removeAttribute("aria-current");
      });
    }

    function ensureCDSSResultsView() {
      const container = document.getElementById("cdssResultContainer");
      const resultsView = document.getElementById("view-clinical-results");
      if (container && resultsView && container.parentElement !== resultsView) resultsView.appendChild(container);
      if (container) {
        ["lifeStageCard", "contraindicationAlertContainer", "cdssFindingsSection", "protocolRecommendationSection", "foodAlternativesSection", "cdssRecallContainer", "triageLabRecommendationsContainer", "specificityPredictionContainer"].forEach(id => {
          const section = document.getElementById(id);
          if (section && section.parentElement === container) container.appendChild(section);
        });
      }
      const synthesisCard = document.getElementById("aiClinicalSynthesisCardShell");
      const synthesisSlot = document.getElementById("aiClinicalSynthesisSlot");
      if (synthesisCard && synthesisSlot && synthesisCard.parentElement !== synthesisSlot) {
        synthesisSlot.appendChild(synthesisCard);
      }
      const synthesisButton = document.getElementById("btnGenerateAiSummary");
      const synthesisHint = document.getElementById("aiClinicalSynthesisHint");
      if (synthesisButton) synthesisButton.disabled = !state.lastCDSS;
      if (synthesisHint) synthesisHint.classList.toggle("hidden", Boolean(state.lastCDSS));
      const emptyState = document.getElementById("cdssResultsEmptyState");
      const overview = document.getElementById("cdssResultsOverview");
      if (emptyState) emptyState.classList.toggle("hidden", Boolean(state.lastCDSS));
      if (overview) overview.classList.toggle("hidden", !state.lastCDSS);
      const findingCount = document.getElementById("cdssOverviewFindingCount");
      if (findingCount && state.lastCDSS) {
        const findings = Array.isArray(state.lastCDSS.findings) ? state.lastCDSS.findings.length : 0;
        const warnings = Array.isArray(state.lastCDSS.contraindications) ? state.lastCDSS.contraindications.length : 0;
        findingCount.textContent = warnings
          ? `${findings} değerlendirme notu · ${warnings} önemli uyarı`
          : `${findings} değerlendirme notu`;
      }
    }

    function switchTab(tabId) {
      const map = {
        "tab-daily": "view-home",
        "tab-labs": "view-labs",
        "tab-neyim": "view-neyim",
        "tab-report": "view-report"
      };
      navigateToView(map[tabId] || tabId);
    }

    /* GLOBAL ARAMA MOTORU */
    