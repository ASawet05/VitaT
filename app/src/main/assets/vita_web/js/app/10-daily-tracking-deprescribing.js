function renderDailyTab() {
      if (!state.user) return;
      updateLabApplicationReferenceHints();
      const p = state.user;

      document.getElementById("profileCardName").textContent = p.name || "Kullanıcı";
      document.getElementById("profileCardAgeGender").textContent = `${p.age} Yaş / ${p.gender === 'E' ? 'Erkek' : 'Kadın'}`;
      document.getElementById("profileCardHeightWeight").textContent = `${p.height} cm / ${p.weight} kg`;
      
      const bmiEl = document.getElementById("profileCardBmi");
      bmiEl.className = `font-black px-2 py-0.5 rounded text-[11px] ${p.bmiBadgeColor}`;
      bmiEl.textContent = `${p.bmi} - ${p.bmiCategory}`;

      document.getElementById("profileCardActivity").textContent = p.activity === "fitness" ? "Fitness" : (p.activity === "moderate" ? "Orta Düzey" : "Masa Başı");
      const chronicDisplayList = [
        ...(Array.isArray(p.chronic) ? p.chronic : []),
        ...(Array.isArray(p.medications) ? p.medications : [])
      ];
      document.getElementById("profileCardChronic").textContent = chronicDisplayList.length ? chronicDisplayList.join(", ") : "Yok";

      updateDynamicTargetHydration();
      document.getElementById("homeHydrationText").textContent = `${state.hydration.current} / ${state.hydration.target} ml tamamlandı`;
      const ratio = Math.min(100, Math.round((state.hydration.current / state.hydration.target) * 100));
      document.getElementById("homeHydrationBar").style.width = `${ratio}%`;

      const todaySupplements = state.supplements.filter(s => isSupplementScheduledToday(s));
      const morningItems = todaySupplements.filter(s => s.timing === "Sabah");
      const noonItems = todaySupplements.filter(s => s.timing === "Öğle");
      const eveningItems = todaySupplements.filter(s => s.timing === "Akşam");

      document.getElementById("dashMorningCount").textContent = `${morningItems.filter(i => i.taken).length}/${morningItems.length}`;
      document.getElementById("dashNoonCount").textContent = `${noonItems.filter(i => i.taken).length}/${noonItems.length}`;
      document.getElementById("dashEveningCount").textContent = `${eveningItems.filter(i => i.taken).length}/${eveningItems.length}`;

      const total = todaySupplements.length;
      const taken = todaySupplements.filter(i => i.taken).length;
      const vitaScore = total > 0 ? Math.round((taken / total) * 70 + Math.min(1, state.hydration.current / state.hydration.target) * 30) : Math.round(Math.min(1, state.hydration.current / state.hydration.target) * 100);

      document.getElementById("headerVitaSkor").textContent = `${vitaScore}%`;
      document.getElementById("dashVitaSkor").textContent = `${vitaScore}%`;

      const checklistContainer = document.getElementById("supplementChecklistContainer");
      if (!checklistContainer) return;
      checklistContainer.innerHTML = "";

      if (total === 0) {
        checklistContainer.innerHTML = `
          <div class="text-center py-10 px-4 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
            <div class="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-2 text-xl shadow-sm">
              <i class="fa-solid fa-pills"></i>
            </div>
            <h4 class="text-sm font-bold text-navy-900">Henüz Kayıtlı Bir Takviyeniz Bulunmuyor</h4>
            <p class="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
              Günlük listenizde henüz ürün yok. Hekiminizin önerdiği ve takip etmek istediğiniz ürünü "Takviye Ekle" düğmesiyle kaydedebilirsiniz.
            </p>
          </div>
        `;
      } else {
        const groups = [
          { timing: "Sabah", label: "Sabah protokolü", icon: "fa-sun text-amber-500", items: morningItems },
          { timing: "Öğle", label: "Öğle protokolü", icon: "fa-utensils text-sky-500", items: noonItems },
          { timing: "Akşam", label: "Akşam protokolü", icon: "fa-moon text-indigo-500", items: eveningItems }
        ];

        groups.forEach(g => {
          if (g.items.length === 0) return;

          const groupEl = document.createElement("div");
          groupEl.className = "space-y-2.5";
          groupEl.innerHTML = `
            <div class="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-700">
              <i class="fa-solid ${g.icon}"></i>
              <span>${g.label}</span>
              <span class="text-[10px] text-slate-400 font-normal">(${g.items.filter(i=>i.taken).length}/${g.items.length} alındı)</span>
              <button type="button" onclick="if(window.SoundEffects) SoundEffects.playClick(); markTimingTaken(${safeJsStringAttribute(g.timing)})" class="ml-auto min-h-9 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-black text-emerald-800 hover:bg-emerald-100" title="Bu zaman dilimindeki tüm takviyeleri alındı olarak işaretler">Tümünü Alındı İşaretle</button>
            </div>
          `;

          g.items.forEach(item => {
            const card = document.createElement("div");
            card.className = `p-3.5 sm:p-4 rounded-2xl border transition-all ${
              item.taken 
                ? "bg-teal-50/70 border-teal-200" 
                : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"
            }`;

            const bioStatus = getSupplementBiomarkerStatus(item);
            let deprescribingBadgeHtml = "";
            let criticalWarningIconHtml = "";

            if (bioStatus) {
              const isCreatine = (bioStatus.key === 'creatinine');
              const hasKidneyChronic = (state.user.chronic || []).includes("kidney");
              const hasEgfrRisk = state.lastCDSS?.egfrResult && (state.lastCDSS.egfrResult.riskLevel === 'high' || state.lastCDSS.egfrResult.riskLevel === 'severe');

              if (isCreatine && (bioStatus.val > 1.25 || hasKidneyChronic || hasEgfrRisk)) {
                deprescribingBadgeHtml = `
                  <div class="mt-2.5 p-2.5 rounded-xl bg-rose-50 border-2 border-rose-400 text-rose-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-sm animate-bounce-short">
                    <span class="font-black text-[11px] text-rose-900">⛔ Yüksek Kreatinin Nedeniyle Yasaklı (${bioStatus.val} mg/dL)</span>
                    <button type="button" onclick="deleteSupplementItem(${safeJsStringAttribute(item.id)})" class="px-2.5 py-1 rounded bg-rose-600 text-white text-[10px] font-black cursor-pointer">Listeden Çıkar</button>
                  </div>
                `;
              } else if (bioStatus.evalResult.isToxic) {
                criticalWarningIconHtml = `
                  <details class="relative shrink-0">
                    <summary class="flex h-7 w-7 cursor-pointer list-none items-center justify-center rounded-lg text-base hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-300 [&::-webkit-details-marker]:hidden" aria-label="Kritik laboratuvar uyarısı ayrıntılarını aç" title="Kritik sonuç uyarısı">⚠️</summary>
                    <div class="absolute right-0 top-full z-30 mt-1 w-72 max-w-[80vw] rounded-xl border border-rose-300 bg-rose-50 p-3 text-rose-950 shadow-lg">
                      <p class="text-[11px] font-bold leading-relaxed">Kritik yüksek sonuç olasılığı (${escapeHtmlText(bioStatus.val)}): Sonucu hekiminizle gecikmeden değerlendirin. Kullanımı kendi kararınızla değiştirmeyin.</p>
                      <button type="button" onclick="deleteSupplementItem(${safeJsStringAttribute(item.id)})" class="mt-2 rounded bg-rose-600 px-2.5 py-1.5 text-[10px] font-black text-white cursor-pointer">Takip listesinden çıkar</button>
                    </div>
                  </details>
                `;
              } else if (bioStatus.evalResult.tier === 'optimal') {
                criticalWarningIconHtml = `
                  <details class="relative shrink-0">
                    <summary class="flex h-7 w-7 cursor-pointer list-none items-center justify-center rounded-lg text-base hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-300 [&::-webkit-details-marker]:hidden" aria-label="Tahlil değeri optimal uyarısı ayrıntılarını aç" title="Tahlil değeri optimal">✅</summary>
                    <div class="absolute right-0 top-full z-30 mt-1 w-72 max-w-[80vw] rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-emerald-950 shadow-lg">
                      <p class="text-[11px] font-bold leading-relaxed">Tahlil değeri referans aralığında (${escapeHtmlText(bioStatus.val)}) – takviyeye devam veya ara verme kararı hekimle verilmelidir.</p>
                      <button type="button" onclick="deleteSupplementItem(${safeJsStringAttribute(item.id)})" class="mt-2 rounded border border-emerald-400 bg-white px-2.5 py-1.5 text-[10px] font-black text-emerald-900 cursor-pointer">Takip listesinden çıkar</button>
                    </div>
                  </details>
                `;
              }
            }

            let formSelectorHtml = "";
            if (item.formKey && FORM_DOSAGE_CONFIG[item.formKey]) {
              const cfg = FORM_DOSAGE_CONFIG[item.formKey];
              const formKeys = Object.keys(cfg.forms);

              const getFormIcon = (f) => {
                if (f === "Damla") return "💧";
                if (f.includes("Kapsul") || f.includes("Kapsül")) return "💊";
                if (f.includes("Sprey")) return "💨";
                if (f.includes("Saşe")) return "✉️";
                if (f.includes("Toz")) return "🥄";
                if (f.includes("Sıvı")) return "🧪";
                return "🔘";
              };

              formSelectorHtml = `
                <div class="mt-3 p-2.5 bg-gradient-to-r from-teal-50/90 to-emerald-50/60 border border-teal-200/90 rounded-xl">
                  <div class="flex flex-wrap items-center justify-between gap-1.5 mb-2">
                    <label class="text-[11px] font-black text-teal-950 flex items-center gap-1.5">
                      <i class="fa-solid fa-shapes text-teal-600"></i>
                      <span>Farmasötik Form Seçici:</span>
                    </label>
                    <span class="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-300">
                      Aktif: ${escapeHtmlText(item.selectedForm ? item.selectedForm.replace('_', ' ') : 'Standart')}
                    </span>
                  </div>

                  <div class="flex flex-wrap gap-1 mt-1">
                    ${formKeys.map(f => `
                      <button type="button" onclick="if(window.SoundEffects) SoundEffects.playClick(); changeDailySupplementForm(${safeJsStringAttribute(item.id)}, ${safeJsStringAttribute(f)})" class="px-2.5 py-1 rounded-lg text-[10px] font-black transition flex items-center gap-1 cursor-pointer ${
                        item.selectedForm === f 
                          ? 'bg-teal-600 text-white shadow-sm ring-1 ring-teal-700' 
                          : 'bg-white hover:bg-teal-100 text-teal-900 border border-teal-200'
                      }">
                        <span>${getFormIcon(f)}</span>
                        <span>${escapeHtmlText(f.replace('_', ' '))}</span>
                      </button>
                    `).join('')}
                  </div>
                </div>
              `;
            }

            const itemInteractions = (typeof getSupplementItemInteractions === "function")
              ? getSupplementItemInteractions(item)
              : [];
            const itemInteractionHtml = itemInteractions.length > 0 ? `
              <div class="mt-2.5 space-y-1.5">
                ${itemInteractions.map(ix => `
                  <div class="p-2.5 rounded-xl border ${ix.severity === 'danger' ? 'bg-rose-50 border-rose-300 text-rose-950' : 'bg-amber-50 border-amber-300 text-amber-950'} text-[11px]">
                    <div class="flex flex-wrap items-center justify-between gap-1">
                      <strong class="font-black">${escapeHtmlText(ix.title)}</strong>
                      <span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/80 border ${ix.severity === 'danger' ? 'border-rose-200 text-rose-800' : 'border-amber-200 text-amber-800'}">${escapeHtmlText(ix.severityLabel || 'Etkileşim')}</span>
                    </div>
                    <p class="text-[10px] mt-0.5 leading-relaxed opacity-90">${escapeHtmlText(ix.actionText)}</p>
                  </div>
                `).join("")}
              </div>
            ` : "";

            card.innerHTML = `
              <div class="flex items-start justify-between gap-2 sm:gap-3">
                <div class="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
                  <input type="checkbox" ${item.taken ? "checked" : ""} onchange="if(window.SoundEffects) SoundEffects.playClick(); toggleSupplementStatus(${safeJsStringAttribute(item.id)})" class="mt-1 h-4 w-4 rounded text-teal-600 focus:ring-teal-500 cursor-pointer flex-shrink-0">
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center justify-between gap-2">
                      <h5 class="min-w-0 flex-1 break-words text-xs font-black sm:text-sm ${item.taken ? 'line-through text-slate-400' : 'text-navy-900'}">${escapeHtmlText(item.name)}</h5>
                      ${criticalWarningIconHtml}
                    </div>
                    <div class="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-1">
                      <span class="text-[10px] text-sky-800 font-bold bg-sky-50 px-2 py-0.5 rounded border border-sky-200"><i class="fa-regular fa-clock mr-1"></i>${escapeHtmlText(getSupplementTimeLabel(item))}</span>
                      <span class="text-[10px] text-slate-600 bg-slate-50 px-2 py-0.5 rounded border border-slate-200"><i class="fa-regular fa-calendar mr-1"></i>${escapeHtmlText(getSupplementScheduleDaysLabel(item))}</span>
                    </div>
                    ${item.instruction ? `
                      <div class="mt-2">
                        <button type="button" aria-expanded="false" onclick="if(window.SoundEffects) SoundEffects.playClick(); const info=this.nextElementSibling; const opening=info.classList.contains('hidden'); info.classList.toggle('hidden'); this.setAttribute('aria-expanded', String(opening));" class="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-300">
                          <i class="fa-solid fa-circle-exclamation text-amber-600" aria-hidden="true"></i>
                          Kullanım bilgisi
                        </button>
                        <div class="hidden mt-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-sm leading-relaxed text-slate-700">
                          ${escapeHtmlText(item.instruction)}
                        </div>
                      </div>` : ''}
                    ${itemInteractionHtml}
                    ${deprescribingBadgeHtml}
                    ${formSelectorHtml}
                  </div>
                </div>
                <button onclick="if(window.SoundEffects) SoundEffects.playClick(); deleteSupplementItem(${safeJsStringAttribute(item.id)})" title="Listeden Çıkar" class="text-slate-400 hover:text-rose-500 p-1.5 rounded-lg text-xs transition cursor-pointer">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              </div>
            `;
            groupEl.appendChild(card);
          });
          checklistContainer.appendChild(groupEl);
        });
      }

      renderDynamicAbsorptionPanel();
      renderChrononutritionTimeline();
      detectSupplementConflicts();
      if (window.VitaRechartsDashboard && typeof window.VitaRechartsDashboard.renderAll === "function") {
        window.VitaRechartsDashboard.renderAll();
      }
    }

    function changeDailySupplementForm(itemId, newForm) {
      const item = state.supplements.find(s => s.id === itemId);
      if (!item || !item.formKey || !FORM_DOSAGE_CONFIG[item.formKey]) return;

      const cfg = FORM_DOSAGE_CONFIG[item.formKey];
      const formFn = cfg.forms[newForm];
      if (!formFn) return;

      const w = state.user ? state.user.weight : 70;
      const evaluated = formFn(w);

      item.selectedForm = newForm;
      item.doseText = evaluated.doseText;
      item.subText = evaluated.subText;
      item.timing = evaluated.timing;
      item.instruction = evaluated.instruction;

      saveState();
      renderDailyTab();
      detectSupplementConflicts();
      showToast("Form Güncellendi", `${item.name} formu "${newForm.replace('_', ' ')}" olarak seçildi.`, "success");
    }

    function markTimingTaken(timing) {
      const validTimings = ["Sabah", "Öğle", "Akşam"];
      if (!validTimings.includes(timing)) return;
      const items = (state.supplements || []).filter(item => item.timing === timing && isSupplementScheduledToday(item));
      if (!items.length) { showToast("Takviye Bulunamadı", "Bu zaman diliminde işaretlenecek takviye yok.", "info"); return; }
      items.forEach(item => { item.taken = true; });
      const saved = saveState();
      renderDailyTab();
      if (window.SoundEffects) SoundEffects.playSuccess();
      showToast("Zaman Dilimi Güncellendi", `${timing} grubundaki ${items.length} takviye alındı olarak işaretlendi.${saved === false ? " Ancak tarayıcı kayıt işlemi başarısız olmuş olabilir." : ""}`, saved === false ? "warning" : "success");
    }

    function toggleSupplementStatus(id) {
      const item = state.supplements.find(s => s.id === id);
      if (item) {
        item.taken = !item.taken;
        saveState();
        renderDailyTab();
        showToast(item.taken ? "Takviye Alındı" : "İşaret Kaldırıldı", `${item.name} durumu güncellendi.`, item.taken ? "success" : "info");
      }
    }

    function deleteSupplementItem(id) {
      state.supplements = state.supplements.filter(s => s.id !== id);
      saveState();
      renderDailyTab();
      checkPendingSymptomReviews();
      detectSupplementConflicts();
      showToast("Takviye Kaldırıldı", "Takviye listenizden çıkarıldı.", "info");
    }

    function addWater(amount) {
      state.hydration.current += amount;
      saveState();
      renderDailyTab();
      showToast("Su Tüketimi Eklendi", `+${amount} ml su kaydedildi.`, "success");
    }

    function openAddSupplementModal() {
      const modal = document.getElementById("addSupplementModal");
      if (!modal) return;
      modal.classList.remove("hidden");
      modal.style.display = "flex";
      const catalogSelect = document.getElementById("modalCatalogSelect");
      if (catalogSelect) {
        catalogSelect.value = "D3_K2";
        onCatalogSelectChange("D3_K2");
      }
    }

    function closeAddSupplementModal() {
      const modal = document.getElementById("addSupplementModal");
      if (modal) { modal.classList.add("hidden"); modal.style.display = "none"; }
    }

    function onCatalogSelectChange(catalogKey) {
      const customNameBox = document.getElementById("modalCustomNameContainer");
      const formBox = document.getElementById("modalFormSelectorContainer");
      const customDoseBox = document.getElementById("modalCustomDoseContainer");
      const formSelect = document.getElementById("modalFormSelect");
      const quickPills = document.getElementById("modalFormQuickPills");

      if (catalogKey === "custom") {
        if (customNameBox) customNameBox.classList.remove("hidden");
        if (formBox) formBox.classList.add("hidden");
        if (customDoseBox) customDoseBox.classList.remove("hidden");
        if (typeof updateModalLiveInteractionPreview === "function") updateModalLiveInteractionPreview();
        return;
      }

      if (customNameBox) customNameBox.classList.add("hidden");
      if (formBox) formBox.classList.remove("hidden");
      if (customDoseBox) customDoseBox.classList.add("hidden");

      const cfg = FORM_DOSAGE_CONFIG[catalogKey];
      if (!cfg) return;

      const availableForms = Object.keys(cfg.forms);
      const defaultForm = cfg.defaultForm || availableForms[0];

      if (formSelect) {
        formSelect.innerHTML = availableForms.map(f => `<option value="${f}" ${f === defaultForm ? 'selected' : ''}>${f.replace('_', ' ')}</option>`).join('');
      }

      if (quickPills) {
        quickPills.innerHTML = availableForms.map(f => `
          <button type="button" onclick="if(window.SoundEffects) SoundEffects.playClick(); onModalFormOptionChange('${f}')" class="px-2.5 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer ${
            f === defaultForm ? 'bg-teal-600 text-white shadow-sm ring-1 ring-teal-700' : 'bg-white hover:bg-teal-100 text-teal-900 border border-teal-200'
          }">
            <span>${f.replace('_', ' ')}</span>
          </button>
        `).join('');
      }

      onModalFormOptionChange(defaultForm);
    }

    function onModalFormOptionChange(chosenForm) {
      const catalogKey = document.getElementById("modalCatalogSelect").value;
      const cfg = FORM_DOSAGE_CONFIG[catalogKey];
      if (!cfg) return;

      const formSelect = document.getElementById("modalFormSelect");
      if (formSelect) formSelect.value = chosenForm;

      const quickPills = document.getElementById("modalFormQuickPills");
      if (quickPills) {
        const availableForms = Object.keys(cfg.forms);
        quickPills.innerHTML = availableForms.map(f => `
          <button type="button" onclick="if(window.SoundEffects) SoundEffects.playClick(); onModalFormOptionChange('${f}')" class="px-2.5 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer ${
            f === chosenForm ? 'bg-teal-600 text-white shadow-sm ring-1 ring-teal-700' : 'bg-white hover:bg-teal-100 text-teal-900 border border-teal-200'
          }">
            <span>${f.replace('_', ' ')}</span>
          </button>
        `).join('');
      }

      const w = state.user ? state.user.weight : 70;
      const evaluated = cfg.forms[chosenForm](w);

      const dosePrev = document.getElementById("modalDosePreview");
      if (dosePrev) dosePrev.textContent = `${evaluated.doseText} (${evaluated.timing})`;
      const instPrev = document.getElementById("modalInstructionPreview");
      if (instPrev) instPrev.textContent = evaluated.instruction;
      if (typeof updateModalLiveInteractionPreview === "function") updateModalLiveInteractionPreview();
    }

    function commitManualSupplement() {
      const catalogKey = document.getElementById("modalCatalogSelect").value;

      if (catalogKey === "custom") {
        const name = document.getElementById("manualSupName").value.trim();
        const timing = document.getElementById("manualSupTiming").value;
        const dose = document.getElementById("manualSupDose").value.trim() || "Etiket / hekim planındaki miktarı girin";
        if (!name) { showToast("Eksik Ad", "Lütfen takviye adını giriniz.", "warning"); return; }

        state.supplements.push({
          id: `sup_man_${Date.now()}`,
          name, formKey: null, selectedForm: null, timing, doseText: dose,
          subText: "Hekim Tavsiyeli Tanımlama", instruction: "Hekiminizin belirttiği talimatlara uygun alınız.",
          addedDate: Date.now(), taken: false
        });
      } else {
        const cfg = FORM_DOSAGE_CONFIG[catalogKey];
        const chosenForm = document.getElementById("modalFormSelect").value;
        // This prototype uses an explicit daily schedule default; the user can edit the plan afterward.
        const scheduleDays = [1, 2, 3, 4, 5, 6, 0];
        const w = state.user ? state.user.weight : 70;
        const evaluated = cfg.forms[chosenForm](w);

        const existing = state.supplements.find(s => s.formKey === catalogKey);
        if (existing) {
          existing.selectedForm = chosenForm;
          existing.doseText = evaluated.doseText;
          existing.subText = evaluated.subText;
          existing.timing = evaluated.timing;
          existing.instruction = evaluated.instruction;
        } else {
          state.supplements.push({
            id: `sup_cat_${Date.now()}`,
            name: cfg.name, formKey: catalogKey, selectedForm: chosenForm,
            timing: evaluated.timing, doseText: evaluated.doseText,
            subText: evaluated.subText, instruction: evaluated.instruction,
            addedDate: Date.now(), taken: false, scheduleDays
          });
        }
      }

      saveState();
      closeAddSupplementModal();
      renderDailyTab();
      checkPendingSymptomReviews();
      detectSupplementConflicts();
      showToast("Takviye Eklendi", "Takip listenize kaydedildi.", "success");
    }
/* CDSS DEMOGRAFİ VE CANLI ÖZET SENKRONİZASYONU */
    function syncCDSSDemographics() {
      if (!state.user) return;
      const p = state.user;

      const patientBadge = document.getElementById("neyimPatientBadge");
      if (patientBadge) patientBadge.textContent = p.name || "Kullanıcı";
      const ageBadge = document.getElementById("neyimAgeBadge");
      if (ageBadge) ageBadge.innerHTML = `<i class="fa-solid fa-cake-candles text-amber-400 mr-1"></i> Yaş: <strong>${escapeHtmlText(p.age)}</strong>`;
      const weightBadge = document.getElementById("neyimWeightBadge");
      if (weightBadge) weightBadge.innerHTML = `<i class="fa-solid fa-weight-scale text-emerald-400 mr-1"></i> Kilo: <strong>${escapeHtmlText(p.weight)} kg</strong>`;
      const bmiBadge = document.getElementById("neyimBmiBadge");
      if (bmiBadge) bmiBadge.innerHTML = `<i class="fa-solid fa-calculator text-sky-400 mr-1"></i> VKİ: <strong>${escapeHtmlText(p.bmi)}</strong>`;
      const genderBadge = document.getElementById("neyimGenderBadge");
      if (genderBadge) genderBadge.innerHTML = `<i class="fa-solid fa-venus-mars text-rose-400 mr-1"></i> Cinsiyet: <strong>${p.gender === 'E' ? 'Erkek' : 'Kadın'}</strong>`;

      const actBadge = document.getElementById("neyimAutoActivityBadge");
      const profSum = document.getElementById("neyimAutoProfileSummary");
      let activityText = p.activity === "fitness" ? "Fitness / Ağırlık" : (p.activity === "moderate" ? "Orta Düzey" : "Masa Başı");

      if (actBadge) actBadge.textContent = activityText;
      if (profSum) {
        profSum.innerHTML = `
          <p><strong>Biyolojik Durum:</strong> ${escapeHtmlText(p.age)} Yaş, ${escapeHtmlText(p.weight)} kg (VKİ: ${escapeHtmlText(p.bmi)})</p>
          <p><strong>Kayıtlı İlaçlar / Kronik:</strong> ${escapeHtmlText(p.chronic && p.chronic.length ? p.chronic.join(', ') : 'Bilinen yok')}</p>
        `;
      }

      const labDateBadge = document.getElementById("neyimAutoLabDateBadge");
      const labSum = document.getElementById("neyimAutoLabSummary");
      const latestSaved = (state.labHistory && state.labHistory.length > 0) ? state.labHistory[0] : null;
      const labs = state.labValues || {};

      const filledLabs = [];
      if (labs.d3 !== null && labs.d3 !== undefined) filledLabs.push(`D3: ${labs.d3}`);
      if (labs.b12 !== null && labs.b12 !== undefined) filledLabs.push(`B12: ${labs.b12}`);
      if (labs.ferritin !== null && labs.ferritin !== undefined) filledLabs.push(`Ferritin: ${labs.ferritin}`);
      if (labs.mg !== null && labs.mg !== undefined) filledLabs.push(`Mg: ${labs.mg}`);
      if (labs.ca !== null && labs.ca !== undefined) filledLabs.push(`Ca: ${labs.ca}`);
      if (labs.zinc !== null && labs.zinc !== undefined) filledLabs.push(`Çinko: ${labs.zinc}`);
      if (labs.creatinine !== null && labs.creatinine !== undefined) filledLabs.push(`Kreatinin: ${labs.creatinine}`);
      if (labs.folate !== null && labs.folate !== undefined) filledLabs.push(`Folat: ${labs.folate}`);
      if (labs.alt !== null && labs.alt !== undefined) filledLabs.push(`ALT: ${labs.alt}`);
      if (labs.hb !== null && labs.hb !== undefined) filledLabs.push(`Hb: ${labs.hb}`);
      if (labs.mcv !== null && labs.mcv !== undefined) filledLabs.push(`MCV: ${labs.mcv}`);
      if (labs.crp !== null && labs.crp !== undefined) filledLabs.push(`CRP: ${labs.crp}`);

      if (filledLabs.length > 0) {
        if (labDateBadge) labDateBadge.textContent = latestSaved ? `Son Tahlil: ${latestSaved.date}` : "Güncel Kayıt";
        if (labSum) labSum.innerHTML = `<p class="font-mono text-xs text-navy-900">${filledLabs.map(escapeHtmlText).join(' • ')}</p>`;
      } else {
        if (labDateBadge) labDateBadge.textContent = "Tahlil Yok";
        if (labSum) labSum.innerHTML = `<p class="italic text-slate-400">Henüz tahlil girilmedi - Semptom bazlı ön triyaj yapılacak</p>`;
      }


    }

    const VITATAKIP_LAB_DRAFT_FIELDS = [
      ["inputLabD3", "d3"], ["inputLabB12", "b12"], ["inputLabFerritin", "ferritin"],
      ["inputLabMg", "mg"], ["inputLabCalcium", "ca"], ["inputLabZinc", "zinc"],
      ["inputLabCreatinine", "creatinine"], ["inputLabFolate", "folate"], ["inputLabAlt", "alt"],
      ["inputLabHb", "hb"], ["inputLabMcv", "mcv"], ["inputLabCrp", "crp"]
    ];
    const VITA_LAB_REFERENCE_FIELDS = [
      ["inputLabRef-d3", "d3"], ["inputLabRef-b12", "b12"], ["inputLabRef-ferritin", "ferritin"],
      ["inputLabRef-mg", "mg"], ["inputLabRef-ca", "ca"], ["inputLabRef-zinc", "zinc"],
      ["inputLabRef-creatinine", "creatinine"], ["inputLabRef-folate", "folate"], ["inputLabRef-alt", "alt"],
      ["inputLabRef-hb", "hb"], ["inputLabRef-mcv", "mcv"], ["inputLabRef-crp", "crp"]
    ];

    function saveLabDraft() {
      if (!activeUserId) return;
      const values = {};
      let hasValue = false;
      VITATAKIP_LAB_DRAFT_FIELDS.forEach(([id, key]) => {
        const input = document.getElementById(id);
        const value = input ? input.value : "";
        values[key] = value;
        if (String(value).trim() !== "") hasValue = true;
      });
      const references = {};
      VITA_LAB_REFERENCE_FIELDS.forEach(([id, key]) => {
        const input = document.getElementById(id);
        const value = input ? String(input.value || "") : "";
        references[key] = value;
        if (value.trim()) hasValue = true;
      });
      const dateInput = document.getElementById("inputLabDate");
      try {
        const key = `vitatakip_labdraft_${activeUserId}`;
        if (!hasValue) {
          safeLocalStorageRemoveItem(key);
          return;
        }
        safeLocalStorageSetItem(key, JSON.stringify({ values, references, date: dateInput ? dateInput.value : "", savedAt: Date.now() }));
      } catch (e) {
        console.warn("Tahlil taslağı tarayıcı belleğine kaydedilemedi.", e);
      }
    }

    function restoreLabDraft() {
      if (!activeUserId) return;
      let draft = null;
      try { draft = JSON.parse(safeLocalStorageGetItem(`vitatakip_labdraft_${activeUserId}`) || "null"); }
      catch (e) { draft = null; }
      if (!draft || !draft.values) return;
      VITATAKIP_LAB_DRAFT_FIELDS.forEach(([id, key]) => {
        const input = document.getElementById(id);
        if (input && (input.value === "" || input.value === null) && draft.values[key] !== undefined) {
          input.value = draft.values[key] === null ? "" : String(draft.values[key]);
        }
      });
      VITA_LAB_REFERENCE_FIELDS.forEach(([id, key]) => {
        const input = document.getElementById(id);
        const value = draft.references?.[key];
        if (input && input.value.trim() === "" && value !== undefined && String(value).trim() !== "") input.value = String(value);
        if (value !== undefined && String(value).trim()) state.labReferences[key] = String(value).trim();
      });
      const dateInput = document.getElementById("inputLabDate");
      if (dateInput && draft.date) dateInput.value = draft.date;
      // Taslak değerleri DOM'a programatik yazıldığında input olayı tetiklenmez; renkli geri bildirimi yenile.
      if (Array.isArray(VITA_LAB_INPUTS)) VITA_LAB_INPUTS.forEach(([inputId, key]) => updateVitaLabLiveFeedback(inputId, key));
    }

    function clearLabDraft() {
      if (!activeUserId) return;
      try { safeLocalStorageRemoveItem(`vitatakip_labdraft_${activeUserId}`); } catch (e) {}
    }

    function getParsedLabInput(inputId) {
      const el = document.getElementById(inputId);
      if (!el || String(el.value ?? "").trim() === "") return null;
      return parseVitaLabDecimal(el.value);
    }

    let pendingLabRecordConflict = null;

    function saveCurrentLabRecordWithDate() {
      const dateInput = document.getElementById("inputLabDate");
      const dateVal = (dateInput && dateInput.value) || new Date().toISOString().split('T')[0];
      const values = {
        d3: getParsedLabInput("inputLabD3"),
        b12: getParsedLabInput("inputLabB12"),
        ferritin: getParsedLabInput("inputLabFerritin"),
        mg: getParsedLabInput("inputLabMg"),
        ca: getParsedLabInput("inputLabCalcium"),
        zinc: getParsedLabInput("inputLabZinc"),
        creatinine: getParsedLabInput("inputLabCreatinine"),
        folate: getParsedLabInput("inputLabFolate"),
        alt: getParsedLabInput("inputLabAlt"),
        hb: getParsedLabInput("inputLabHb"),
        mcv: getParsedLabInput("inputLabMcv"),
        crp: getParsedLabInput("inputLabCrp")
      };
      if (Object.values(values).every(value => value === null)) {
        showToast("Boş Sonuç", "Lütfen en az bir tahlil değeri giriniz.", "warning");
        return;
      }

      const recordReferences = {};
      VITA_LAB_REFERENCE_FIELDS.forEach(([id, key]) => {
        const entered = String(document.getElementById(id)?.value || "").trim();
        if (entered) recordReferences[key] = entered;
      });
      const genderAtTest = state.user?.gender || "K";
      const record = {
        id: `lab_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        date: dateVal,
        ...values,
        references: recordReferences,
        applicationReferences: getVitaAppLabReferenceMap(genderAtTest),
        genderAtTest,
        timestamp: new Date(`${dateVal}T${new Date().toTimeString().slice(0, 8)}`).getTime() || Date.now(),
        timeLabel: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
      };
      const existing = state.labHistory.find(item => item.date === dateVal);
      if (existing) {
        pendingLabRecordConflict = record;
        const modal = document.getElementById("labDateConflictModal");
        const existingLabel = document.getElementById("labConflictExistingSummary");
        if (existingLabel) existingLabel.textContent = `${dateVal}${existing.timeLabel ? ` · ${existing.timeLabel}` : ""} tarihli kayıt zaten var. Ne yapmak istersiniz?`;
        if (modal) { modal.classList.remove("hidden"); modal.style.display = "flex"; }
        else {
          const choice = window.confirm("Bu tarihte tahlil kaydı zaten var. Tamam: üzerine yaz; İptal: yeni saat olarak ekle.");
          resolveLabDateConflict(choice ? "update" : "add");
        }
        return;
      }
      commitLabRecord(record, "new");
    }

    function resolveLabDateConflict(action) {
      const modal = document.getElementById("labDateConflictModal");
      if (modal) { modal.classList.add("hidden"); modal.style.display = "none"; }
      if (!pendingLabRecordConflict) return;
      const incoming = pendingLabRecordConflict;
      pendingLabRecordConflict = null;
      if (action === "cancel") return;
      commitLabRecord(incoming, action === "update" ? "update" : "add");
    }

    function commitLabRecord(record, mode) {
      if (mode === "update") {
        const existingIndex = state.labHistory.findIndex(item => item.date === record.date);
        if (existingIndex >= 0) {
          record.id = state.labHistory[existingIndex].id;
          state.labHistory[existingIndex] = record;
        } else state.labHistory.push(record);
      } else {
        if (mode === "add") {
          // Aynı takvim gününde ayrı bir örnek olarak sakla; saat etiketi/timestamp ayrıştırır.
          record.id = `lab_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          record.timeLabel = new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
          record.timestamp = new Date(`${record.date}T${new Date().toTimeString().slice(0, 8)}`).getTime() || Date.now();
        }
        state.labHistory.push(record);
      }
      state.labHistory.sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0));
      state.labValues = { d3: record.d3, b12: record.b12, ferritin: record.ferritin, mg: record.mg, ca: record.ca, zinc: record.zinc, creatinine: record.creatinine, folate: record.folate, alt: record.alt, hb: record.hb ?? null, mcv: record.mcv ?? null, crp: record.crp ?? null };
      state.labReferences = { ...(record.references || {}) };
      VITA_LAB_REFERENCE_FIELDS.forEach(([id, key]) => { const input = document.getElementById(id); if (input) input.value = String(record.references?.[key] || ""); });

      saveState();
      syncCDSSDemographics();
      renderLabHistoryUI();
      renderBiomarkerTrendChart();
      evaluateTrendAndDecisionSupport(true);
      checkDeprescribingOpportunities();
      renderDailyTab();
      renderReportTab();
      clearLabDraft();
      VITATAKIP_LAB_DRAFT_FIELDS.forEach(([id]) => {
        const input = document.getElementById(id);
        if (input) input.value = "";
      });
      VITA_LAB_REFERENCE_FIELDS.forEach(([id]) => {
        const input = document.getElementById(id);
        if (input) input.value = "";
      });
      if (Array.isArray(VITA_LAB_INPUTS)) VITA_LAB_INPUTS.forEach(([inputId, key]) => updateVitaLabLiveFeedback(inputId, key));
      const rangeModal = document.getElementById("vitaLabRangesModal");
      if (rangeModal) rangeModal.classList.remove("is-open");
      const label = mode === "update" ? "Tahlil Güncellendi" : mode === "add" ? "Aynı Tarihe Yeni Kayıt Eklendi" : "Tahlil Kaydedildi";
      showToast(label, `${record.date}${record.timeLabel ? ` ${record.timeLabel}` : ""} tarihli tahlil arşive kaydedildi.`, "success");
    }

    let labHistoryFilterMode = "all";
    let labHistoryRestorePending = false;
    let labHistoryShowAll = false;

    function setLabHistoryFilter(mode) {
      labHistoryFilterMode = ["all", "normal", "out"].includes(mode) ? mode : "all";
      labHistoryShowAll = false;
      renderLabHistoryUI();
    }

    function toggleLabHistoryShowAll() {
      labHistoryShowAll = !labHistoryShowAll;
      renderLabHistoryUI();
    }

    function toggleLabHistoryRecord(detailsId, toggle) {
      const details = document.getElementById(detailsId);
      if (!details || !toggle) return;
      const isOpening = details.classList.contains("hidden");
      details.classList.toggle("hidden", !isOpening);
      toggle.setAttribute("aria-expanded", isOpening ? "true" : "false");
      const icon = toggle.querySelector("[data-lab-record-chevron]");
      if (icon) {
        icon.classList.toggle("fa-chevron-down", !isOpening);
        icon.classList.toggle("fa-chevron-up", isOpening);
      }
    }

    function parseLabReferenceRange(reference) {
      const text = String(reference || "").trim().replace(/[–—−]/g, "-").replace(/,/g, ".");
      if (!text) return null;
      const nums = text.match(/\d+(?:\.\d+)?/g)?.map(Number).filter(Number.isFinite) || [];
      if ((/<=|≤|<|less than|under/i.test(text)) && nums.length === 1) return { min: null, max: nums[0], comparator: "lt" };
      if ((/>=|≥|>|greater than|over/i.test(text)) && nums.length === 1) return { min: nums[0], max: null, comparator: "gt" };
      if (nums.length === 2 && /-|to|ile|arası|arasi/i.test(text)) return { min: Math.min(nums[0], nums[1]), max: Math.max(nums[0], nums[1]), comparator: "range" };
      return null;
    }

    function getProvidedLabRangeStatus(value, reference, key) {
      if (value === null || value === undefined || value === "" || !Number.isFinite(Number(value))) return null;
      if (key && !isVitaLabReferenceCompatible(key, reference)) return null;
      const range = parseLabReferenceRange(reference);
      if (!range) return null;
      const num = Number(value);
      if (range.comparator === "lt") return num <= range.max ? "within" : "outside";
      if (range.comparator === "gt") return num >= range.min ? "within" : "outside";
      return num < range.min || num > range.max ? "outside" : "within";
    }

    function getProvidedLabRangeBadge(value, reference, key) {
      const status = getProvidedLabRangeStatus(value, reference, key);
      if (!status) return "";
      const label = status === "within" ? "Lab/PDF aralığında" : "Lab/PDF aralığı dışında";
      const classes = status === "within" ? "border-sky-200 bg-sky-50 text-sky-800" : "border-amber-300 bg-amber-50 text-amber-900";
      return `<span class="inline-flex rounded-lg border ${classes} px-1.5 py-0.5 text-[9px] font-bold" title="Girilen laboratuvar referans aralığıyla sayısal karşılaştırma; tanı değildir">${label}</span>`;
    }

    function parseLabNumericValue(value) {
      if (value === null || value === undefined || value === "") return null;
      const normalized = String(value).trim().replace(",", ".");
      const match = normalized.match(/[+-]?(?:\d+(?:\.\d*)?|\.\d+)/);
      if (!match) return null;
      const parsed = Number(match[0]);
      return Number.isFinite(parsed) ? parsed : null;
    }

    const LAB_HISTORY_METRICS = [
      { key: "d3", label: "D vitamini (25-OH)", unit: "ng/mL" },
      { key: "b12", label: "B12 vitamini", unit: "pg/mL" },
      { key: "ferritin", label: "Ferritin", unit: "ng/mL" },
      { key: "mg", label: "Magnezyum", unit: "mg/dL" },
      { key: "ca", label: "Kalsiyum", unit: "mg/dL" },
      { key: "zinc", label: "Çinko", unit: "µg/dL" },
      { key: "creatinine", label: "Kreatinin", unit: "mg/dL" },
      { key: "folate", label: "Folat (B9)", unit: "ng/mL" },
      { key: "alt", label: "ALT", unit: "U/L" },
      { key: "hb", label: "Hemoglobin", unit: "g/dL" },
      { key: "mcv", label: "MCV", unit: "fL" },
      { key: "crp", label: "CRP", unit: "mg/L" }
    ];

    function getLabHistoryMetric(record, metric) {
      const rawValue = record?.[metric.key];
      const numericValue = parseLabNumericValue(rawValue);
      if (numericValue === null) return null;

      const facilityReference = String(record?.references?.[metric.key] || "").trim();
      const facilityStatus = facilityReference
        ? getProvidedLabRangeStatus(numericValue, facilityReference, metric.key)
        : null;
      const reference = facilityStatus
        ? facilityReference
        : String(record?.applicationReferences?.[metric.key] || getVitaAppLabReference(metric.key, record?.genderAtTest || state.user?.gender || "K"));
      const status = facilityStatus || getProvidedLabRangeStatus(numericValue, reference, metric.key);
      return {
        ...metric,
        value: rawValue,
        status,
        reference,
        referenceSource: facilityStatus ? "lab" : "app"
      };
    }

    function labRecordExceedsHepaticSafety(record) {
      const value = parseLabNumericValue(record?.alt);
      return value !== null && value > 50;
    }

    function labRecordHasPortalOutOfRange(record) {
      return LAB_HISTORY_METRICS.some(metric => getLabHistoryMetric(record, metric)?.status === "outside");
    }

    function updateLabHistoryFilterButtons() {
      const definitions = [
        ["all", "labHistoryFilterAll"], ["normal", "labHistoryFilterNormal"], ["out", "labHistoryFilterOut"]
      ];
      definitions.forEach(([mode, id]) => {
        const button = document.getElementById(id);
        if (!button) return;
        const active = labHistoryFilterMode === mode;
        button.className = active
          ? "min-h-9 rounded-xl border border-teal-300 bg-teal-50 px-3 py-2 text-[11px] font-bold text-teal-900"
          : "min-h-9 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50";
        button.setAttribute("aria-pressed", active ? "true" : "false");
      });
    }

    function renderLabHistoryUI() {
      const displayLocale = "tr-TR";
      const container = document.getElementById("labHistoryListContainer");
      const badge = document.getElementById("labHistoryCountBadge");
      const showAllButton = document.getElementById("labHistoryShowAllButton");
      const showAllWrap = document.getElementById("labHistoryShowAllWrap");
      const dateFilter = document.getElementById("labHistoryDateFilter");
      if (!container) return;
      updateLabHistoryFilterButtons();

      if (badge) badge.textContent = `${state.labHistory.length} Tahlil${labHistoryRestorePending ? " · Eşitleniyor" : " Kayıtlı"}`;
      const selectedDate = dateFilter?.value || "all";
      if (dateFilter) {
        const dates = [...new Set(state.labHistory.map(item => item.date).filter(Boolean))]
          .sort((a, b) => b.localeCompare(a));
        if (selectedDate !== "all" && !dates.includes(selectedDate)) dateFilter.value = "all";
        const activeDate = dates.includes(selectedDate) ? selectedDate : "all";
        dateFilter.innerHTML = `<option value="all">Tüm tarihler</option>${dates.map(date => {
          const parsedDate = new Date(`${date}T00:00:00`);
          const label = Number.isNaN(parsedDate.getTime()) ? date : parsedDate.toLocaleDateString(displayLocale, { day: "numeric", month: "long", year: "numeric" });
          return `<option value="${escapeHtmlText(date)}">${escapeHtmlText(label)}</option>`;
        }).join("")}`;
        dateFilter.value = activeDate;
      }
      if (showAllButton) {
        showAllButton.classList.add("hidden");
        showAllButton.classList.remove("inline-flex");
        showAllButton.setAttribute("aria-expanded", "false");
      }
      if (showAllWrap) showAllWrap.classList.add("hidden");
      if (!labHistoryShowAll) {
        container.classList.add("max-h-72", "overflow-y-auto");
      }

      if (state.labHistory.length === 0) {
        labHistoryShowAll = false;
        const pendingCopy = labHistoryRestorePending ? `<p class="mt-1 text-xs font-semibold text-teal-700" role="status">Yerel arşiv kontrol ediliyor; kayıtlar birazdan güncellenecek.</p>` : "";
        container.innerHTML = `<div class="m-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center vita-feedback-enter"><div class="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-700"><i class="fa-solid fa-flask-vial text-lg"></i></div><p class="text-sm font-bold text-slate-700">Henüz kayıtlı tahlil yok</p><p class="mt-1 text-xs text-slate-500">Tarih seçip kan tahlili değerlerinizi girin. İsterseniz e-Nabız PDF dosyanızı da yükleyebilirsiniz.</p>${pendingCopy}<button type="button" onclick="document.getElementById('inputLabD3')?.focus();" class="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-teal-200 bg-white px-4 py-2 text-xs font-bold text-teal-800 hover:bg-teal-50"><i class="fa-solid fa-plus"></i> İlk tahlilimi gir</button></div>`;
        return;
      }

      const searchInput = document.getElementById("labHistorySearchInput");
      const query = String(searchInput?.value || "").trim().toLocaleLowerCase("tr-TR");
      const activeDate = dateFilter?.value || "all";
      const filteredRecords = state.labHistory.map(record => {
        const dateMatches = activeDate === "all" || record.date === activeDate;
        const dateSearch = [record.date, record.timeLabel].some(value => String(value || "").toLocaleLowerCase("tr-TR").includes(query));
        const metrics = LAB_HISTORY_METRICS.map(metric => getLabHistoryMetric(record, metric)).filter(Boolean);
        const searchMatches = !query || dateSearch
          ? metrics
          : metrics.filter(metric => [metric.label, metric.value, metric.reference].some(value => String(value || "").toLocaleLowerCase("tr-TR").includes(query)));
        const statusMatches = searchMatches.filter(metric => labHistoryFilterMode === "all"
          || (labHistoryFilterMode === "normal" && metric.status === "within")
          || (labHistoryFilterMode === "out" && metric.status === "outside"));
        return { record, metrics, statusMatches, dateMatches };
      }).filter(item => item.dateMatches && item.statusMatches.length > 0);
      const normalCount = filteredRecords.reduce((count, item) => count + item.metrics.filter(metric => metric.status === "within").length, 0);
      const outCount = filteredRecords.reduce((count, item) => count + item.metrics.filter(metric => metric.status === "outside").length, 0);
      const recordCount = filteredRecords.length;
      const visibleRecordCount = labHistoryShowAll ? recordCount : Math.min(recordCount, 2);
      const visibleEntries = filteredRecords.slice(0, visibleRecordCount);
      const summary = document.getElementById("labHistoryFilterSummary");
      if (summary) {
        const statusLabel = labHistoryFilterMode === "all" ? "Tüm sonuçlar" : labHistoryFilterMode === "normal" ? "Normal sonuçlar" : "Referans dışı sonuçlar";
        const dateLabel = activeDate === "all" ? "Tüm tarihler" : new Date(`${activeDate}T00:00:00`).toLocaleDateString(displayLocale);
        const restoreStatus = labHistoryRestorePending ? " · Yerel arşiv eşitleniyor…" : "";
        summary.textContent = `${recordCount} kayıt · ${normalCount} normal · ${outCount} referans dışı ölçüm · ${statusLabel} · ${dateLabel}${restoreStatus}`;
      }
      if (!filteredRecords.length) {
        labHistoryShowAll = false;
        container.classList.add("max-h-72", "overflow-y-auto");
        const pendingCopy = labHistoryRestorePending ? `<p class="mt-1 text-[11px] text-teal-700" role="status">Yerel arşiv kontrol ediliyor; kayıtlar birazdan güncellenecek.</p>` : "";
        container.innerHTML = `<div class="m-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center"><p class="text-xs font-bold text-slate-700">Bu ölçütlerde kayıt bulunamadı</p><p class="mt-1 text-[11px] text-slate-500">Tarih, arama metni veya sonuç durumunu değiştirin.</p>${pendingCopy}<button type="button" onclick="document.getElementById('labHistorySearchInput').value=''; document.getElementById('labHistoryDateFilter').value='all'; setLabHistoryFilter('all')" class="mt-2 min-h-9 rounded-lg border border-teal-200 bg-white px-3 py-1.5 text-[11px] font-bold text-teal-800">Filtreleri temizle</button></div>`;
        return;
      }

      container.classList.toggle("max-h-72", !labHistoryShowAll);
      container.classList.toggle("overflow-y-auto", !labHistoryShowAll);
      if (showAllButton && recordCount > 2) {
        if (showAllWrap) showAllWrap.classList.remove("hidden");
        showAllButton.classList.remove("hidden");
        showAllButton.classList.add("inline-flex");
        showAllButton.setAttribute("aria-expanded", labHistoryShowAll ? "true" : "false");
        const label = document.getElementById("labHistoryShowAllLabel");
        const icon = document.getElementById("labHistoryShowAllIcon");
        if (label) label.textContent = labHistoryShowAll ? "Daha az göster" : `Tümünü gör (${recordCount})`;
        if (icon) {
          icon.classList.toggle("fa-chevron-down", !labHistoryShowAll);
          icon.classList.toggle("fa-chevron-up", labHistoryShowAll);
        }
      }

      const statusPill = (status, compact = false) => {
        const styles = status === "within"
          ? ["bg-sky-50 text-sky-700", "Normal"]
          : status === "outside"
            ? ["bg-rose-50 text-rose-700", "Referans dışı"]
            : ["bg-slate-100 text-slate-600", "Aralık yok"];
        return `<span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${compact ? "text-[9px]" : "text-[10px]"} font-bold ${styles[0]}"><i class="fa-solid ${status === "within" ? "fa-circle-check" : status === "outside" ? "fa-circle-exclamation" : "fa-circle-question"}" aria-hidden="true"></i>${styles[1]}</span>`;
      };
      const formatRecordDate = date => {
        const parsed = new Date(`${date}T00:00:00`);
        if (Number.isNaN(parsed.getTime())) return escapeHtmlText(date || "Tarih yok");
        return `<span class="block text-xl font-black leading-none">${parsed.toLocaleDateString(displayLocale, { day: "numeric" })}</span><span class="mt-1 block text-[10px] font-bold">${parsed.toLocaleDateString(displayLocale, { month: "long" })}</span><span class="mt-0.5 block text-[10px]">${parsed.toLocaleDateString(displayLocale, { year: "numeric" })}</span>`;
      };
      const renderMetric = metric => {
        const isOut = metric.status === "outside";
        const isNormal = metric.status === "within";
        const cardClass = isOut ? "border-rose-200 bg-rose-50/70" : isNormal ? "border-teal-100 bg-teal-50/50" : "border-slate-200 bg-slate-50";
        const valueClass = isOut ? "text-rose-700" : isNormal ? "text-slate-900" : "text-slate-700";
        const rangeLabel = metric.referenceSource === "lab" ? "Referans" : "Yaklaşık karşılaştırma aralığı";
        const referenceNote = metric.referenceSource === "lab" ? "" : `<span class="block text-[9px] text-slate-400">Genel uygulama aralığı; laboratuvar referansı değildir</span>`;
        return `<div class="rounded-xl border p-3 ${cardClass}">
          <div class="flex items-start justify-between gap-2"><span class="text-[11px] font-bold text-slate-700">${escapeHtmlText(metric.label)}</span>${statusPill(metric.status, true)}</div>
          <div class="mt-1.5 flex items-baseline gap-1.5"><span class="text-base font-black ${valueClass}">${escapeHtmlText(metric.value)}</span><span class="text-[10px] text-slate-500">${escapeHtmlText(metric.unit)}</span></div>
          <div class="mt-1.5 border-t border-slate-200/70 pt-1.5 text-[10px] text-slate-600"><strong>${rangeLabel}:</strong> ${escapeHtmlText(metric.reference || "Belirtilmemiş")}${referenceNote}</div>
        </div>`;
      };
      container.innerHTML = `
        <div class="space-y-3 border-0 p-0">
          ${visibleEntries.map(({ record, metrics, statusMatches }, index) => {
            const normalResults = metrics.filter(metric => metric.status === "within").length;
            const outResults = metrics.filter(metric => metric.status === "outside").length;
            const visibleKeys = new Set(statusMatches.map(metric => metric.key));
            const visibleMetrics = metrics.filter(metric => visibleKeys.has(metric.key));
            const expanded = labHistoryFilterMode !== "all" || activeDate !== "all" || Boolean(query);
            const detailsId = `lab-history-details-${index}`;
            return `<article class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div class="flex items-center gap-3 border-b border-slate-100 p-3 sm:p-4">
                <button aria-controls="${detailsId}" aria-expanded="${expanded ? "true" : "false"}" class="flex min-w-0 flex-1 items-center gap-3 text-left" onclick="toggleLabHistoryRecord('${detailsId}', this)" type="button">
                <span class="flex h-[68px] w-[68px] shrink-0 flex-col items-center justify-center rounded-xl bg-navy-900 text-white text-center">${formatRecordDate(record.date)}</span>
                <span class="min-w-0 flex-1">
                  <span class="block text-xs font-black text-navy-900">Tahlil sonuçları</span>
                  <span class="mt-0.5 block text-[10px] text-slate-500">${record.timeLabel ? `Kayıt saati: ${escapeHtmlText(record.timeLabel)}` : "Kayıtlı laboratuvar ölçümleri"}</span>
                  <span class="mt-2 flex flex-wrap gap-1.5">${statusPill("within", true).replace("Normal", `${normalResults} Normal`)}${statusPill("outside", true).replace("Referans dışı", `${outResults} Referans dışı`)}</span>
                </span>
                <i aria-hidden="true" class="fa-solid ${expanded ? "fa-chevron-up" : "fa-chevron-down"} text-slate-500 text-xs" data-lab-record-chevron></i>
                </button>
                <button aria-label="Bu tarihli tahlil kaydını sil" class="inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600" onclick="deleteLabRecord(${safeJsStringAttribute(record.id)})" title="Kaydı sil" type="button"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button>
              </div>
              <div class="${expanded ? "" : "hidden"} grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 sm:p-4" id="${detailsId}">${visibleMetrics.map(renderMetric).join("")}</div>
            </article>`;
          }).join("")}
        </div>`;
    }

    function deleteLabRecord(id) {
      state.labHistory = state.labHistory.filter(r => r.id !== id);
      if (state.labHistory.length > 0) {
        const latest = state.labHistory[0];
        state.labValues = { d3: latest.d3, b12: latest.b12, ferritin: latest.ferritin, mg: latest.mg, ca: latest.ca, zinc: latest.zinc, creatinine: latest.creatinine, folate: latest.folate, alt: latest.alt ?? null, hb: latest.hb ?? null, mcv: latest.mcv ?? null, crp: latest.crp ?? null };
        state.labReferences = { ...(latest.references || {}) };
      } else {
        state.labValues = { d3: null, b12: null, ferritin: null, mg: null, ca: null, zinc: null, creatinine: null, folate: null, alt: null, hb: null, mcv: null, crp: null };
        state.labReferences = {};
      }
      VITA_LAB_REFERENCE_FIELDS.forEach(([inputId, key]) => {
        const input = document.getElementById(inputId);
        if (input) input.value = String(state.labReferences?.[key] || "");
      });
      saveState();
      syncCDSSDemographics();
      renderLabHistoryUI();
      renderBiomarkerTrendChart();
      evaluateTrendAndDecisionSupport(false);
      renderDailyTab();
      renderReportTab();
      showToast("Tahlil Silindi", "Kayıt arşivden çıkarıldı.", "info");
    }

    function renderBiomarkerTrendChart() {
      if (window.VitaRechartsDashboard && typeof window.VitaRechartsDashboard.renderAll === "function") {
        window.VitaRechartsDashboard.renderAll();
      }
      const card = document.getElementById("biomarkerChartCard");
      const canvas = document.getElementById("labTrendChart");
      const select = document.getElementById("labTrendMetricSelect");
      const rangeText = document.getElementById("labTrendRangeText");
      if (!card || !canvas) return;

      card.classList.remove("hidden");
      if (!Array.isArray(state.labHistory) || state.labHistory.length < 2) {
        if (labTrendChartInstance) { labTrendChartInstance.destroy(); labTrendChartInstance = null; }
        if (rangeText) rangeText.textContent = "Tekil Chart.js grafiği için en az iki farklı tarihte kayıtlı tahlil gerekir; üstteki Recharts çoklu çizgi panelinden örnek veya kayıtlı trendleri inceleyebilirsiniz.";
        return;
      }
      const metricMap = {
        d3: { label: "D vitamini (25-OH D3)", unit: "ng/mL", color: "#14b8a6" },
        b12: { label: "B12 vitamini", unit: "pg/mL", color: "#6366f1" },
        ferritin: { label: "Ferritin", unit: "ng/mL", color: "#e11d48" },
        mg: { label: "Magnezyum", unit: "mg/dL", color: "#f59e0b" },
        ca: { label: "Kalsiyum", unit: "mg/dL", color: "#0284c7" },
        zinc: { label: "Çinko", unit: "μg/dL", color: "#7c3aed" },
        creatinine: { label: "Kreatinin", unit: "mg/dL", color: "#ea580c" },
        folate: { label: "Folat (B9)", unit: "ng/mL", color: "#0f766e" },
        alt: { label: "ALT", unit: "U/L", color: "#be123c" },
        hb: { label: "Hemoglobin", unit: "g/dL", color: "#dc2626" },
        mcv: { label: "MCV", unit: "fL", color: "#9333ea" },
        crp: { label: "CRP", unit: "mg/L", color: "#475569" }
      };
      const metricKey = metricMap[select?.value] ? select.value : "d3";
      const metric = metricMap[metricKey];
      const chronological = [...state.labHistory].sort((a, b) => {
        const ta = Number(a.timestamp || (a.date ? new Date(a.date + "T00:00:00").getTime() : 0));
        const tb = Number(b.timestamp || (b.date ? new Date(b.date + "T00:00:00").getTime() : 0));
        return ta - tb;
      }).filter(r => r && r.date && r[metricKey] !== null && r[metricKey] !== undefined && Number.isFinite(Number(r[metricKey])));

      if (labTrendChartInstance) { labTrendChartInstance.destroy(); labTrendChartInstance = null; }
      if (document.getElementById("acc-labtrend")?.classList.contains("hidden")) return;
      if (chronological.length < 2) {
        if (rangeText) rangeText.textContent = `${metric.label} için en az iki tarihli, sayısal ölçüm gerekli.`;
        card.classList.remove("hidden");
        return;
      }

      if (!window.Chart) {
        if (rangeText) rangeText.textContent = "Trend grafiği bileşeni yükleniyor… VitaTakip'in diğer bölümleri kullanılabilir.";
        if (!window.__vitaChartLoadingPromise) {
          window.__vitaChartLoadingPromise = loadVitaOptionalScript("https://cdn.jsdelivr.net/npm/chart.js", "Chart", 12000)
            .then(() => { window.__vitaChartLoadingPromise = null; renderBiomarkerTrendChart(); })
            .catch(error => {
              console.warn("Trend grafiği kitaplığı yüklenemedi; uygulamanın diğer bölümleri kullanılmaya devam edebilir.", error);
              if (rangeText) rangeText.textContent = "Trend grafiği yüklenemedi. İnternet bağlantınızı kontrol edin; tahlil kaydı ve uygulamanın diğer bölümleri kullanılabilir.";
            });
        }
        return;
      }

      const prettyDate = dateText => {
        const parts = String(dateText).split("-");
        return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : String(dateText);
      };
      const ctx = canvas.getContext("2d");
      labTrendChartInstance = new Chart(ctx, {
        type: "line",
        data: {
          labels: chronological.map(r => prettyDate(r.date)),
          datasets: [{
            label: `${metric.label} (${metric.unit})`,
            data: chronological.map(r => Number(r[metricKey])),
            borderColor: metric.color,
            backgroundColor: metric.color,
            pointBackgroundColor: metric.color,
            pointBorderColor: "#ffffff",
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 7,
            borderWidth: 3,
            tension: 0.32,
            cubicInterpolationMode: "monotone",
            fill: false,
            spanGaps: false
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { intersect: false, mode: "index" },
          plugins: {
            legend: { position: "top", labels: { boxWidth: 12, font: { size: 11, weight: "bold" } } },
            tooltip: { callbacks: { label: context => `${context.dataset.label}: ${context.parsed.y} ${metric.unit}` } }
          },
          scales: {
            y: { title: { display: true, text: metric.unit }, ticks: { maxTicksLimit: 6 } },
            x: { title: { display: true, text: "Tahlil tarihi (eskiden yeniye)" }, ticks: { maxRotation: 0, autoSkip: true } }
          }
        }
      });

      const first = chronological[0];
      const latest = chronological[chronological.length - 1];
      const monthSpan = Math.max(0, Math.round((new Date(latest.date + "T00:00:00").getTime() - new Date(first.date + "T00:00:00").getTime()) / (1000 * 60 * 60 * 24 * 30.4375)));
      if (rangeText) rangeText.textContent = `${chronological.length} ölçüm · ${prettyDate(first.date)} – ${prettyDate(latest.date)} · yaklaşık ${monthSpan} aylık zaman aralığı. Noktalar kaydedilen ölçümleri temsil eder; aradaki çizgi ölçüm yapılmayan günlerdeki gerçek sonucu göstermez.`;
    }

        /* BOYLAMSAL TREND KARŞILAŞTIRMASI VE NORMALİTE POPUP TETİKLEYİCİSİ */
    function evaluateTrendAndDecisionSupport(triggerPopup = false) {
      const alertSection = document.getElementById("trendAlertSection");
      if (!alertSection) return;

      if (!state.labHistory || state.labHistory.length < 2) {
        alertSection.classList.add("hidden");
        alertSection.innerHTML = "";
        return;
      }

      const curr = state.labHistory[0];
      const prev = state.labHistory[1];
      const gender = state.user ? state.user.gender : 'K';

      const params = [
        { key: 'd3', name: 'D Vitamini (25-OH D3)', unit: 'ng/mL' },
        { key: 'b12', name: 'B12 Vitamini', unit: 'pg/mL' },
        { key: 'ferritin', name: 'Ferritin (Demir Deposu)', unit: 'ng/mL' },
        { key: 'mg', name: 'Magnezyum', unit: 'mg/dL' },
        { key: 'ca', name: 'Total Kalsiyum', unit: 'mg/dL' },
        { key: 'zinc', name: 'Serum Çinko', unit: 'µg/dL' },
        { key: 'creatinine', name: 'Serum Kreatinin', unit: 'mg/dL', inverseMarker: true },
        { key: 'folate', name: 'Folat (B9)', unit: 'ng/mL' },
        { key: 'alt', name: 'ALT (Karaciğer Enzimi)', unit: 'U/L', inverseMarker: true },
        { key: 'hb', name: 'Hemoglobin', unit: 'g/dL' },
        { key: 'mcv', name: 'MCV', unit: 'fL' },
        { key: 'crp', name: 'CRP', unit: 'mg/L', inverseMarker: true }
      ];

      const trendMessages = [];
      const popupAlerts = [];

      params.forEach(p => {
        const cVal = curr[p.key];
        const pVal = prev[p.key];
        if (cVal !== null && cVal !== undefined && pVal !== null && pVal !== undefined) {
          const cEval = KDSSRuleEngine.evaluate(p.key, cVal, gender);
          const pEval = KDSSRuleEngine.evaluate(p.key, pVal, gender);

          if (pEval.isLow && cEval.tier === 'optimal') {
            const msg = `🎉 ${p.name} değeriniz ${pVal} ${p.unit} seviyesinden ${cVal} ${p.unit} referans aralığına yükseldi. Takviyeyi sürdürme, azaltma veya bırakma kararını hekiminizle verin.`;
            trendMessages.push({ type: 'optimal', text: msg });
            popupAlerts.push({ message: msg });
          } else if (p.inverseMarker && pEval.isHigh && cEval.tier === 'optimal') {
            const msg = `🎉 ${p.name} değeriniz ${pVal} ${p.unit} seviyesinden ${cVal} ${p.unit} normal referans aralığına geriledi.`;
            trendMessages.push({ type: 'optimal', text: msg });
          } else if (cEval.isToxic) {
            const msg = `⛔ ${p.name} değeriniz ${cVal} ${p.unit} ile kritik yüksek aralıkta olabilir. Sonucu gecikmeden hekiminizle görüşün; reçeteli tedavinizi veya takviyelerinizi kendi kendinize kesmeyin ya da değiştirmeyin.`;
            trendMessages.push({ type: 'toxic', text: msg });
            popupAlerts.push({ message: msg });
          } else if (p.inverseMarker && !pEval.isHigh && cEval.isHigh) {
            const msg = `⚠️ ${p.name} değeriniz ${pVal} ➔ ${cVal} ${p.unit} yönünde yükselerek referans üst sınırını aştı; hekiminizle değerlendirmeniz önerilir.`;
            trendMessages.push({ type: 'toxic', text: msg });
          } else if (!p.inverseMarker && cVal > pVal && cEval.isLow) {
            trendMessages.push({
              type: 'improving',
              text: `📈 ${p.name} değeriniz ${pVal} ➔ ${cVal} ${p.unit} yönünde artış gösteriyor ancak henüz referans aralığına ulaşmadı; devam veya değişiklik kararı için hekiminize danışın.`
            });
          }
        }
      });

      alertSection.classList.remove("hidden");
      if (trendMessages.length > 0) {
        alertSection.innerHTML = trendMessages.map(m => `
          <div class="p-3.5 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
            m.type === 'toxic' ? 'bg-rose-50 border-rose-300 text-rose-950' :
            (m.type === 'optimal' ? 'bg-emerald-50 border-emerald-300 text-emerald-950' : 'bg-teal-50 border-teal-200 text-teal-900')
          }">
            <span class="font-bold leading-relaxed">${escapeHtmlText(m.text)}</span>
            <span class="px-2 py-0.5 rounded font-black bg-white border text-[10px] whitespace-nowrap">Hekim Danışmanlığı</span>
          </div>
        `).join('');
      } else {
        alertSection.innerHTML = `
          <div class="p-3.5 bg-teal-50 border border-teal-200 rounded-2xl text-xs text-teal-900 flex items-center justify-between">
            <span class="flex items-center gap-2"><i class="fa-solid fa-chart-line text-teal-600"></i> Birden fazla tahlil kaydedildi (${prev.date} ➔ ${curr.date}); karşılaştırmalı trend analizi aktif.</span>
            <span class="px-2 py-0.5 rounded font-black bg-teal-600 text-white text-[10px]">Aktif Trend</span>
          </div>
        `;
      }

      if (triggerPopup && popupAlerts.length > 0) {
        openNormalityPopup(popupAlerts);
      }
    }

    function openNormalityPopup(alerts) {
      const modal = document.getElementById("normalityPopupModal");
      const content = document.getElementById("normalityPopupContent");
      if (!modal || !content) return;
      content.innerHTML = alerts.map(a => `<div class="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950 font-bold leading-relaxed">${escapeHtmlText(a.message)}</div>`).join('');
      modal.classList.remove("hidden");
      modal.style.display = "flex";
    }

    function closeNormalityPopup() {
      const modal = document.getElementById("normalityPopupModal");
      if (modal) { modal.classList.add("hidden"); modal.style.display = "none"; }
    }

    /* AKILLI DEPRESCRIBING MOTORU */
    function checkDeprescribingOpportunities() {
      if (!state.supplements || state.supplements.length === 0) return;
      pendingDeprescribingItems = [];

      state.supplements.forEach(sup => {
        const bio = getSupplementBiomarkerStatus(sup);
        if (bio) {
          const isCreatine = (bio.key === 'creatinine');
          const hasKidneyChronic = (state.user?.chronic || []).includes("kidney");
          if (isCreatine && (bio.val > 1.25 || hasKidneyChronic)) {
            pendingDeprescribingItems.push({
              id: sup.id,
              name: sup.name,
              reason: `Kreatinin (${bio.val} mg/dL) veya böbrek öyküsü nedeniyle bu takviyenin uygunluğu hekimle gecikmeden değerlendirilmelidir. Kullanımı kendi kararınızla başlatmayın, kesmeyin veya değiştirmeyin.`,
              badge: "Renal Güvenlik Kilidi",
              isDanger: true
            });
          } else if (bio.evalResult.isToxic) {
            pendingDeprescribingItems.push({
              id: sup.id,
              name: sup.name,
              reason: `Son tahlil değeri (${bio.val}) kritik yüksek olabilir. Sonucu hekimle gecikmeden değerlendirin; tedaviyi veya takviyeyi kendi kararınızla kesmeyin ya da dozunu değiştirmeyin.`,
              badge: "Toksisite Uyarısı",
              isDanger: true
            });
          } else if (bio.evalResult.tier === 'optimal') {
            pendingDeprescribingItems.push({
              id: sup.id,
              name: sup.name,
              reason: `Son tahlil değeri (${bio.val}) hedef aralığa ulaşmış olabilir. Yükleme/idame planı hekimle gözden geçirilmelidir; bu uyarı tek başına bırakma önerisi değildir.`,
              badge: "Hedefe Ulaşıldı",
              isDanger: false
            });
          }
        }
      });

      if (pendingDeprescribingItems.length > 0) {
        const modal = document.getElementById("deprescribingModal");
        const content = document.getElementById("deprescribingModalContent");
        if (modal && content) {
          content.innerHTML = pendingDeprescribingItems.map(item => `
            <div class="p-3.5 rounded-2xl border ${item.isDanger ? 'bg-rose-50 border-rose-300 text-rose-950' : 'bg-emerald-50 border-emerald-300 text-emerald-950'} text-xs space-y-1">
              <div class="flex items-center justify-between">
                <strong class="font-black text-xs">${escapeHtmlText(item.name)}</strong>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-black ${item.isDanger ? 'bg-rose-200 text-rose-900' : 'bg-emerald-200 text-emerald-900'}">${escapeHtmlText(item.badge)}</span>
              </div>
              <p class="text-[11px] leading-relaxed">${escapeHtmlText(item.reason)}</p>
            </div>
          `).join('');
          modal.classList.remove("hidden");
          modal.style.display = "flex";
        }
      }
    }

    function resolveDeprescribingSync(shouldRemove) {
      const modal = document.getElementById("deprescribingModal");
      if (shouldRemove && pendingDeprescribingItems.length > 0) {
        const removeIds = new Set(pendingDeprescribingItems.map(i => i.id));
        state.supplements = state.supplements.filter(s => !removeIds.has(s.id));
        saveState();
        renderDailyTab();
        renderReportTab();
        if (window.SoundEffects) SoundEffects.playSuccess();
        showToast("Liste Eşzamanlandı", `${removeIds.size} adet takviye günlük takip listenizden çıkarıldı.`, "success");
      }
      pendingDeprescribingItems = [];
      if (modal) {
        modal.classList.add("hidden");
        modal.style.display = "none";
      }
    }

    /* CDSS ÇALIŞTIRMA & TÜM ANEMİ / eGFR / HEPATİK / İLAÇ KURALLARI */
    