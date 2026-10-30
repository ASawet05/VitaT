function applyParsedPdfValues() {
      const keys = Object.keys(temporarilyParsedLabResults);
      if (keys.length === 0) return;

      if (!state.labValues) {
        state.labValues = { d3: null, b12: null, ferritin: null, mg: null, ca: null, zinc: null, creatinine: null, folate: null, alt: null, hb: null, mcv: null, crp: null };
      }

      const pdfDateEl = document.getElementById("pdfParsedDateInput");
      const chosenPdfDate = (pdfDateEl && pdfDateEl.value) ? pdfDateEl.value.trim() : (temporarilyParsedPdfDate || "");
      const mainDateInput = document.getElementById("inputLabDate");
      if (chosenPdfDate && mainDateInput) {
        mainDateInput.value = chosenPdfDate;
      }

      keys.forEach(k => {
        const item = temporarilyParsedLabResults[k];
        const inputEl = document.getElementById(item.inputId);
        if (inputEl) inputEl.value = item.value;
        const numericVal = (item.value === null || item.value === undefined || item.value === "") ? null : parseFloat(item.value);
        state.labValues[k] = (numericVal !== null && !isNaN(numericVal)) ? numericVal : item.value;
        if (!state.labReferences) state.labReferences = {};
        const cleanRef = String(item.reference || "").trim();
        if (cleanRef) state.labReferences[k] = cleanRef;
        else delete state.labReferences[k];
        const refInput = document.getElementById(`inputLabRef-${k}`);
        if (refInput) refInput.value = cleanRef;
        updateVitaLabLiveFeedback(item.inputId, k);
      });

      if (state.labValues.creatinine !== null && state.labValues.creatinine !== undefined) {
        const egfrCrInput = document.getElementById("vitaEgfrCreatinine") || document.getElementById("vitaEgfrCr");
        if (egfrCrInput) egfrCrInput.value = String(state.labValues.creatinine);
      }

      if (typeof parseKidneyFunctionAndCompareMedications === "function") {
        try {
          parseKidneyFunctionAndCompareMedications(temporarilyParsedLabResults, { triggerSource: "pdf_apply", renderUI: true });
        } catch (kidneyParseErr) {
          console.warn("Böbrek fonksiyonu ve ilaç güvenliği analizi çalıştırılamadı:", kidneyParseErr);
        }
      }

      closeENabizModal();
      saveCurrentLabRecordWithDate();
    }

    function openOnboardingModal() {
      const modal = document.getElementById("onboardingModal");
      if (modal) { modal.classList.remove("hidden"); modal.style.display = "flex"; }
    }

    function closeOnboardingModal() {
      const modal = document.getElementById("onboardingModal");
      if (modal) { modal.classList.add("hidden"); modal.style.display = "none"; }
    }

    /* =========================================================================
       KLİNİK İLAÇ–BESİN VE TAKVİYE ETKİLEŞİM VERİTABANI (NIH ODS / Lexicomp / TİTCK)
       ========================================================================= */
    const VITA_CLINICAL_DRUG_NUTRIENT_DB = {
      quickMedicationClasses: [
        { code: "levothyroxine", label: "Tiroid (Levotiroksin / Euthyrox)", icon: "fa-🦋", faIcon: "fa-staff-snake", keywords: ["levotiroksin", "levothyroxine", "euthyrox", "levotiron", "tiroid", "tefor", "tiromel"] },
        { code: "blood_thinner", label: "Kan Sulandırıcı (Coumadin / Aspirin / Eliquis)", faIcon: "fa-droplet", keywords: ["coumadin", "varfarin", "warfarin", "aspirin", "coraspin", "ecopirin", "plavix", "klopidogrel", "eliquis", "apiksaban", "xarelto", "rivaroksaban", "pradaxa", "kan sulandırıcı", "antikoagülan"] },
        { code: "ppi", label: "Mide Koruyucu PPI (Pantpas / Nexium / Lansor)", faIcon: "fa-capsules", keywords: ["omeprazol", "lansoprazol", "pantoprazol", "esomeprazol", "rabeprazol", "pantpas", "nexium", "lansor", "pulcet", "gaviscon", "rennnie", "antiasit", "mide koruyucu", "ppi"] },
        { code: "metformin", label: "Metformin (Glucophage / Matofin / Diaformin)", faIcon: "fa-pills", keywords: ["metformin", "glucophage", "matofin", "diaformin", "glifor", "glifor"] },
        { code: "antibiotic", label: "Antibiyotik (Cipro / Monodoks / Tetrasiklin)", faIcon: "fa-bacterium", keywords: ["siprofloksasin", "cipro", "ciprofloxacin", "levofloksasin", "tavanic", "moksifloksasin", "avelox", "doksisiklin", "monodoks", "tetrasiklin", "tetracycline", "kinolon", "antibiyotik"] },
        { code: "diuretic", label: "Tansiyon Diüretik (Fludex / Lasix / Hidroklortiyazid)", faIcon: "fa-heart-pulse", keywords: ["diüretik", "idrar söktürücü", "indapamid", "fludex", "hidroklorotiyazid", "furosemid", "lasix", "spironolakton", "aldactone"] },
        { code: "bisphosphonate", label: "Kemik Erimesi (Fosamax / Alendronat / Bonviva)", faIcon: "fa-bone", keywords: ["alendronat", "fosamax", "risedronat", "actonel", "ibandronat", "bonviva", "bisfosfonat", "osteoporoz"] },
        { code: "kidney", label: "Kronik Böbrek / Düşük GFR", faIcon: "fa-kit-medical", keywords: ["böbrek", "gfr", "diyaliz", "nefropati"] }
      ],

      drugNutrientRules: [
        {
          id: "DN_LEVO_CATIONS",
          drugCode: "levothyroxine",
          drugName: "Levotiroksin (Tiroid İlacı - Euthyrox/Levotiron)",
          nutrientMatchers: ["demir", "iron", "fe", "kalsiyum", "calcium", "magnezyum", "magnesium", "çinko", "cinko", "zinc"],
          severity: "danger",
          severityLabel: "Majör Emilim Blokajı (Şelasyon)",
          separationHours: 4,
          recommendedTiming: "Öğle",
          mechanism: "Gastrointestinal lümende iki/üç değerlikli metal katyonları (Fe²⁺, Ca²⁺, Mg²⁺, Zn²⁺) levotiroksin molekülü ile çözünmeyen şelat kompleksleri oluşturarak tiroid hormonunun bağırsak emilimini %40–70 oranında düşürür ve hipotiroidi kontrolünü bozar.",
          actionText: "Levotiroksin sabah aç karnına alınıyorsa Demir, Kalsiyum, Magnezyum ve Çinko takviyelerini en az 4 saat ara ile (Öğle veya Akşam) alınız.",
          source: "NIH ODS / ATA Thyroid Guidelines / Lexicomp"
        },
        {
          id: "DN_WARFARIN_K2",
          drugCode: "blood_thinner",
          drugName: "Kan Sulandırıcı / Antikoagülan (Coumadin, Varfarin vb.)",
          nutrientMatchers: ["k2", "d3_k2", "menakinon", "mk-7", "k vitamini"],
          excludeMatchers: ["k2'siz", "k2siz", "saf d3"],
          severity: "danger",
          severityLabel: "Kontrendike / Kritik Pıhtılaşma Riski",
          separationHours: null,
          recommendedForm: "Saf_D3_Damla_K2siz",
          mechanism: "K2 vitamini (Menakinon-7), karaciğerde VKORC1 enzimini aktive ederek pıhtılaşma faktörlerini (II, VII, IX, X) sentezler ve Varfarin/Coumadin'in antikoagülan etkisini doğrudan antagonize ederek INR düşüşüne ve tromboz riskine yol açar.",
          actionText: "K2 içeren D3+K2 kombinasyonu yerine hekiminizle görüşerek 'K2'siz Saf D3' formuna geçiniz veya INR takibi olmadan K2 kullanmayınız.",
          source: "FDA Boxed Warning / Lexicomp / TİTCK"
        },
        {
          id: "DN_BLOOD_THINNER_OMEGA3",
          drugCode: "blood_thinner",
          drugName: "Kan Sulandırıcı / Antiagregan (Coumadin, Aspirin, Plavix, Eliquis)",
          nutrientMatchers: ["omega", "balık yağı", "balik yagi", "epa", "dha", "krill"],
          severity: "warning",
          severityLabel: "Orta–Yüksek Kanama Süresi Etkileşimi",
          separationHours: 2,
          mechanism: "Yüksek doz EPA/DHA tromboksan A2 sentezini baskılayarak trombosit agregasyonunu azaltır; antikoagülan veya antiagregan ilaçlarla birlikte kanama süresini uzatabilir.",
          actionText: "Günlük Omega-3 dozunu hekiminize danışmadan artırmayınız ve olağandışı morarma/kanama açısından izlem yapınız.",
          source: "NIH ODS Omega-3 Fact Sheet / EFSA"
        },
        {
          id: "DN_PPI_IRON",
          drugCode: "ppi",
          drugName: "Mide Koruyucu PPI / Antiasit (Omeprazol, Pantoprazol, Lansoprazol)",
          nutrientMatchers: ["demir", "iron", "ferro", "ferröz"],
          unsafeFormMatchers: ["tablet", "kapsul", "kapsül"],
          recommendedForm: "Lipozomal_Sase",
          severity: "warning",
          severityLabel: "Biyoyararlanım Kaybı & İlaç Kaynaklı Eksiklik",
          separationHours: 2,
          mechanism: "Proton pompa inhibitörleri (PPI) gastrik HCl salgısını baskılar. Non-hem demirin (Fe³⁺) emilebilir Fe²⁺ formuna indirgenmesi için asidik mide pH'ı şarttır; klasik demir tabletlerinin emilimi %50'den fazla düşer.",
          actionText: "Hekim onayıyla mide asidine ihtiyaç duymadan M-hücrelerinden emilen 'Lipozomal Saşe' demir formuna geçiniz.",
          source: "Gastroenterology / NIH ODS Iron Clinical Guide"
        },
        {
          id: "DN_PPI_B12",
          drugCode: "ppi",
          drugName: "Mide Koruyucu PPI (Omeprazol, Pantoprazol, Esomeprazol)",
          nutrientMatchers: ["b12", "kobalamin", "cobalamin"],
          unsafeFormMatchers: ["kapsul", "kapsül", "tablet_standart"],
          recommendedForm: "Dilalti_Tablet",
          severity: "warning",
          severityLabel: "İntrinsik Faktör & Gastrik Asit Emilim Kaybı",
          separationHours: null,
          mechanism: "PPI kullanımı gastrik asit ve pepsin salınımını azaltarak kobalaminin besin/kapsül matrisinden ayrışmasını ve İntrinsik Faktör aracılı ileal emilimini bozar.",
          actionText: "Mide-bağırsak emilim yolunu baypas eden 'Dilaltı (Sublingual) Metilkobalamin Tablet veya Sprey' formunu tercih ediniz.",
          source: "JAMA / NIH ODS Vitamin B12 Fact Sheet"
        },
        {
          id: "DN_METFORMIN_B12",
          drugCode: "metformin",
          drugName: "Metformin (Glucophage, Matofin, Diaformin)",
          nutrientMatchers: ["b12", "kobalamin", "folat", "folik"],
          severity: "warning",
          severityLabel: "İlaç Kaynaklı Besin Tükenmesi (Kalsiyum Bağımlı İleal Blokaj)",
          separationHours: 2,
          recommendedForm: "Dilalti_Tablet",
          mechanism: "Metformin, terminal ileumda kalsiyum bağımlı İntrinsik Faktör-B12 kompleksinin hücre zarından alımını bloke eder; uzun süreli kullanımda B12 eksikliği ve periferik nöropati riskini artırır.",
          actionText: "Metformin kullanan bireylerde yıllık B12/Homosistein takibi ve hekim önerisiyle Dilaltı Aktif B12 (Metilkobalamin) desteği önerilir.",
          source: "ADA Diabetes Care / MHRA Drug Safety Update"
        },
        {
          id: "DN_ANTIBIOTIC_CATIONS",
          drugCode: "antibiotic",
          drugName: "Kinolon / Tetrasiklin Grubu Antibiyotik (Siprofloksasin, Doksisiklin vb.)",
          nutrientMatchers: ["magnezyum", "magnesium", "demir", "iron", "kalsiyum", "calcium", "çinko", "cinko", "zinc"],
          severity: "danger",
          severityLabel: "Kritik Antibiyotik Tedavi Başarısızlığı Riski (Şelasyon)",
          separationHours: 4,
          recommendedTiming: "Öğle",
          mechanism: "İki ve üç değerlikli metal iyonları (Mg²⁺, Fe²⁺, Ca²⁺, Zn²⁺) florokinolon ve tetrasiklin antibiyotiklerle bağırsakta çözünmeyen şelat oluşturarak antibiyotiğin kan düzeyini %50–90 oranında düşürür ve enfeksiyon tedavisini etkisizleştirebilir.",
          actionText: "Mineral takviyesini antibiyotik dozundan en az 2 saat önce veya 4–6 saat sonra alınız; aynı zaman diliminde kesinlikle birleştirmeyiniz.",
          source: "FDA Drug Interactions / Lexicomp / TİTCK"
        },
        {
          id: "DN_BISPHOSPHONATE_CATIONS",
          drugCode: "bisphosphonate",
          drugName: "Bisfosfonat Kemik İlacı (Alendronat / Fosamax / Risedronat)",
          nutrientMatchers: ["kalsiyum", "calcium", "magnezyum", "magnesium", "demir", "iron"],
          severity: "danger",
          severityLabel: "Bisfosfonat Emilim Sıfırlanması",
          separationHours: 2,
          recommendedTiming: "Öğle",
          mechanism: "Bisfosfonatların oral biyoyararlanımı çok düşüktür (%1-2); Kalsiyum, Magnezyum veya Demir ile yakın saatte alındığında ilaç tamamen bağlanarak emilimi sıfırlanır.",
          actionText: "Bisfosfonat sabah aç karnına sadece suyla alındıktan sonra Kalsiyum/Magnezyum/Demir için en az 2 saat (tercihen Öğle/Akşam) bekleyiniz.",
          source: "Endocrine Society / Lexicomp"
        },
        {
          id: "DN_DIURETIC_MG_D3",
          drugCode: "diuretic",
          drugName: "Tansiyon Diüretiği (Tiyazid / Loop İdrar Söktürücü)",
          nutrientMatchers: ["magnezyum", "magnesium", "d3", "kalsiyum", "calcium", "çinko", "cinko"],
          severity: "warning",
          severityLabel: "Elektrolit & Kalsiyum Dengesi Etkileşimi",
          separationHours: 2,
          mechanism: "Loop ve tiyazid diüretikler böbrek tübüllerinden Magnezyum ve Çinko atılımını artırırken; tiyazid diüretikler (İndapamid, Hidroklorotiyazid) yüksek doz D3/Kalsiyum ile birlikte alındığında böbrekten kalsiyum tutulumunu artırarak hiperkalsemi riski oluşturabilir.",
          actionText: "Diüretik kullanırken serum Kalsiyum ve Magnezyum düzeylerinizi düzenli kontrol ettiriniz.",
          source: "NIH ODS / ESC Hypertension Guidelines"
        },
        {
          id: "DN_KIDNEY_CREATINE_MG",
          drugCode: "kidney",
          drugName: "Kronik Böbrek Rahatsızlığı / Düşük GFR",
          nutrientMatchers: ["kreatin", "creatine", "magnezyum", "magnesium"],
          severity: "danger",
          severityLabel: "Nefrolojik Kontrendikasyon / Birikim Riski",
          separationHours: null,
          mechanism: "Azalmış glomerüler filtrasyon hızında (eGFR) dışarıdan alınan Kreatin ve yüksek doz Magnezyum böbrek yükünü artırır ve hipermagnezemi / serum kreatinin yükselmesine neden olabilir.",
          actionText: "Böbrek fonksiyon düşüklüğünde Kreatin takviyesinden kaçınınız ve Magnezyum dozunu nefroloji/dahiliye hekiminize danışınız.",
          source: "KDIGO CKD Guidelines"
        }
      ],

      supplementPairRules: [
        {
          id: "SS_IRON_CALCIUM",
          itemAMatchers: ["demir", "iron", "ferro"],
          itemBMatchers: ["kalsiyum", "calcium"],
          sameTimingOnly: true,
          severity: "danger",
          severityLabel: "DMT1 & Ferroportin Taşıyıcı Blokajı",
          separationHours: 3,
          recommendedTimingForA: "Öğle",
          recommendedTimingForB: "Akşam",
          title: "DMT1 Antagonizması: Demir & Kalsiyum Aynı Zaman Diliminde",
          mechanism: "Demir ve Kalsiyum enterosit apikal zarındaki DMT1 (Divalent Metal Transporter 1) ve bazolateral Ferroportin taşıyıcıları için doğrudan rekabet eder; birlikte alımda demir emilimi %60–80 oranında baskılanır.",
          actionText: "Demir ve Kalsiyumu farklı öğünlere (en az 3–4 saat ara ile) ayırınız.",
          source: "AJCN / NIH ODS Iron & Calcium"
        },
        {
          id: "SS_IRON_ZINC",
          itemAMatchers: ["demir", "iron", "ferro"],
          itemBMatchers: ["çinko", "cinko", "zinc"],
          sameTimingOnly: true,
          severity: "warning",
          severityLabel: "Divalan Katyon Emilim Rekabeti",
          separationHours: 3,
          recommendedTimingForA: "Sabah",
          recommendedTimingForB: "Öğle",
          title: "Metal İyon Rekabeti: Demir & Çinko Aynı Zaman Diliminde",
          mechanism: "25 mg üzeri kombine elementel Demir ve Çinko aynı öğünde alındığında bağırsak ZIP/DMT1 taşıyıcılarında kompetitif inhibisyon oluşturur.",
          actionText: "Demir ve Çinko takviyelerini günün farklı saatlerine (Sabah / Öğle) dağıtınız.",
          source: "NIH ODS Zinc Fact Sheet"
        },
        {
          id: "SS_IRON_MAGNESIUM",
          itemAMatchers: ["demir", "iron", "ferro"],
          itemBMatchers: ["magnezyum", "magnesium"],
          sameTimingOnly: true,
          severity: "warning",
          severityLabel: "Gastrointestinal Emilim & Tolerans Çakışması",
          separationHours: 3,
          recommendedTimingForA: "Sabah",
          recommendedTimingForB: "Akşam",
          title: "Demir & Magnezyum Aynı Saat Diliminde",
          mechanism: "Magnezyum tuzları lokal mide-bağırsak pH'ını yükselterek ve divalan katyon rekabeti yaratarak demir biyoyararlanımını düşürür.",
          actionText: "Demiri Sabah/Öğle, Magnezyumu ise uyku ve kas onarımı için Akşam saatine ayırınız.",
          source: "Clinical Pharmacokinetics"
        },
        {
          id: "SS_CALCIUM_MAGNESIUM",
          itemAMatchers: ["kalsiyum", "calcium"],
          itemBMatchers: ["magnezyum", "magnesium"],
          sameTimingOnly: true,
          severity: "warning",
          severityLabel: "Yüksek Doz Kalsiyum–Magnezyum Rekabeti",
          separationHours: 2,
          recommendedTimingForA: "Öğle",
          recommendedTimingForB: "Akşam",
          title: "Kalsiyum & Magnezyum Aynı Öğünde Emilim Rekabeti",
          mechanism: "Yüksek doz kalsiyum (>500 mg) ile magnezyum aynı anda alındığında bağırsak pasif parazellüler emilim kanalında doygunluk oluşur.",
          actionText: "Kalsiyumu Öğle, Magnezyumu Akşam saatinde almanız emilimi optimize eder.",
          source: "NIH ODS"
        }
      ]
    };

    function getActiveUserMedicationCodesAndLabels() {
      const chronicList = Array.isArray(state.user?.chronic) ? [...state.user.chronic] : [];
      const customMeds = Array.isArray(state.user?.medications) ? [...state.user.medications] : [];

      // Ayrıca takip listesine "İlaç" veya ilaç adıyla eklenmiş öğeleri de gerçek zamanlı tara
      const supplementText = (state.supplements || []).map(s => `${s.name || ""} ${s.subText || ""}`).join(" ").toLowerCase();
      const customMedText = customMeds.join(" ").toLowerCase();
      const combinedText = `${supplementText} ${customMedText}`;

      const activeCodes = new Set(chronicList);
      const matchedLabelsByCode = {};

      VITA_CLINICAL_DRUG_NUTRIENT_DB.quickMedicationClasses.forEach(cls => {
        if (activeCodes.has(cls.code)) {
          matchedLabelsByCode[cls.code] = cls.label;
        } else if (cls.keywords.some(kw => combinedText.includes(kw))) {
          activeCodes.add(cls.code);
          const matchedCustom = customMeds.find(m => cls.keywords.some(kw => m.toLowerCase().includes(kw)));
          matchedLabelsByCode[cls.code] = matchedCustom ? `${cls.label} (${matchedCustom})` : cls.label;
        }
      });

      return {
        activeCodes: Array.from(activeCodes),
        customMeds,
        matchedLabelsByCode
      };
    }

    function itemMatchesNutrientKeywords(sup, matchers, excludeMatchers = []) {
      const haystack = `${sup.name || ""} ${sup.formKey || ""} ${sup.selectedForm || ""} ${sup.doseText || ""}`.toLowerCase();
      if (excludeMatchers && excludeMatchers.some(ex => haystack.includes(ex.toLowerCase()))) {
        return false;
      }
      return matchers.some(m => {
        const kw = m.toLowerCase();
        if (kw === "fe" || kw === "zn") {
          return new RegExp(`\\b${kw}\\b`, "i").test(haystack);
        }
        return haystack.includes(kw);
      });
    }

    function evaluateClinicalDrugNutrientInteractions(candidateSupplement = null) {
      const supplementsList = Array.isArray(state.supplements) ? [...state.supplements] : [];
      if (candidateSupplement) {
        supplementsList.push(candidateSupplement);
      }

      const { activeCodes, customMeds, matchedLabelsByCode } = getActiveUserMedicationCodesAndLabels();

      // Eğer candidateSupplement kendisi bir reçeteli ilaç adı içeriyorsa onu da aktif ilaç kodlarına dahil et
      if (candidateSupplement) {
        const candText = `${candidateSupplement.name || ""} ${candidateSupplement.doseText || ""}`.toLowerCase();
        VITA_CLINICAL_DRUG_NUTRIENT_DB.quickMedicationClasses.forEach(cls => {
          if (cls.keywords.some(kw => candText.includes(kw)) && !activeCodes.includes(cls.code)) {
            activeCodes.push(cls.code);
            matchedLabelsByCode[cls.code] = `${cls.label} (${candidateSupplement.name})`;
          }
        });
      }

      const interactions = [];
      const seenIds = new Set();

      // 1. İlaç - Besin / Takviye Etkileşimlerini Denetle
      VITA_CLINICAL_DRUG_NUTRIENT_DB.drugNutrientRules.forEach(rule => {
        if (!activeCodes.includes(rule.drugCode)) return;

        supplementsList.forEach(sup => {
          if (!itemMatchesNutrientKeywords(sup, rule.nutrientMatchers, rule.excludeMatchers)) return;

          if (rule.unsafeFormMatchers && rule.unsafeFormMatchers.length > 0) {
            const formStr = `${sup.selectedForm || ""} ${sup.name || ""} ${sup.doseText || ""}`.toLowerCase();
            const isSafeBypass = formStr.includes("lipozomal") || formStr.includes("dilalti") || formStr.includes("dilaltı") || formStr.includes("sublingual") || formStr.includes("sprey");
            const matchesUnsafe = rule.unsafeFormMatchers.some(uf => formStr.includes(uf.toLowerCase()));
            if (isSafeBypass && !matchesUnsafe) return;
          }

          // Eğer zamanlama ayrımı kuralı varsa ve ilaç genelde Sabah alınıyorsa (örn. Levotiroksin, Bisfosfonat),
          // takviye Öğle/Akşam ise uyarının derecesini bilgi/hatırlatma düzeyine çek veya zamanlama uyarısı göster
          const isSameMorningSlot = (sup.timing || "Sabah") === "Sabah";
          const uniqueKey = `${rule.id}_${sup.id || sup.name}`;
          if (seenIds.has(uniqueKey)) return;
          seenIds.add(uniqueKey);

          let effectiveSeverity = rule.severity;
          let timingStatusNote = "";
          if (rule.separationHours && (rule.drugCode === "levothyroxine" || rule.drugCode === "bisphosphonate")) {
            if (isSameMorningSlot) {
              timingStatusNote = `⚡ Şu an "${sup.timing || 'Sabah'}" diliminde kayıtlı — Sabah aç karnına alınan ${rule.drugName} ile doğrudan çakışıyor!`;
            } else {
              effectiveSeverity = "warning";
              timingStatusNote = `✓ "${sup.timing}" diliminde kayıtlı (en az ${rule.separationHours} saat ara kuralına dikkat ediniz).`;
            }
          }

          interactions.push({
            id: uniqueKey,
            ruleId: rule.id,
            category: "drug-nutrient",
            severity: effectiveSeverity,
            severityLabel: rule.severityLabel,
            title: `${effectiveSeverity === "danger" ? "⛔" : "⚠️"} İlaç–Besin Etkileşimi: ${matchedLabelsByCode[rule.drugCode] || rule.drugName} × ${sup.name}`,
            desc: `${rule.mechanism} ${timingStatusNote ? " " + timingStatusNote : ""}`,
            actionText: rule.actionText,
            source: rule.source,
            separationHours: rule.separationHours,
            supplementId: sup.id || null,
            supplementName: sup.name,
            currentTiming: sup.timing || "Sabah",
            recommendedTiming: (rule.recommendedTiming && (sup.timing || "Sabah") === "Sabah") ? rule.recommendedTiming : null,
            recommendedForm: (rule.recommendedForm && sup.formKey && FORM_DOSAGE_CONFIG[sup.formKey]?.forms?.[rule.recommendedForm] && sup.selectedForm !== rule.recommendedForm) ? rule.recommendedForm : null
          });
        });
      });

      // 2. Aynı Zaman Dilimindeki Takviye–Takviye / Mineral–Mineral Çakışmalarını Denetle
      VITA_CLINICAL_DRUG_NUTRIENT_DB.supplementPairRules.forEach(pairRule => {
        const groupA = supplementsList.filter(s => itemMatchesNutrientKeywords(s, pairRule.itemAMatchers));
        const groupB = supplementsList.filter(s => itemMatchesNutrientKeywords(s, pairRule.itemBMatchers));

        groupA.forEach(itemA => {
          groupB.forEach(itemB => {
            if ((itemA.id && itemB.id && itemA.id === itemB.id) || itemA.name === itemB.name) return;
            const sameSlot = (itemA.timing || "Sabah").toLowerCase() === (itemB.timing || "Sabah").toLowerCase();
            if (pairRule.sameTimingOnly && !sameSlot) return;

            const pairKey = [itemA.id || itemA.name, itemB.id || itemB.name].sort().join("__") + "_" + pairRule.id;
            if (seenIds.has(pairKey)) return;
            seenIds.add(pairKey);

            const targetSupForMove = itemB.id ? itemB : itemA;
            const targetRecommendedTiming = (targetSupForMove.timing === "Sabah") ? (pairRule.recommendedTimingForB || "Akşam") : "Öğle";

            interactions.push({
              id: pairKey,
              ruleId: pairRule.id,
              category: "supplement-supplement",
              severity: pairRule.severity,
              severityLabel: pairRule.severityLabel,
              title: `${pairRule.severity === "danger" ? "⛔" : "⚠️"} ${pairRule.title} (${itemA.timing || "Sabah"})`,
              desc: `${itemA.name} ve ${itemB.name} aynı zaman diliminde (${itemA.timing || "Sabah"}) bulunuyor. ${pairRule.mechanism}`,
              actionText: pairRule.actionText,
              source: pairRule.source,
              separationHours: pairRule.separationHours,
              supplementId: targetSupForMove.id || null,
              supplementName: targetSupForMove.name,
              currentTiming: targetSupForMove.timing || "Sabah",
              recommendedTiming: targetRecommendedTiming,
              recommendedForm: null
            });
          });
        });
      });

      // 3. İlaç Kaynaklı Besin Tükenmesi (Depletion) Uyarıları — Takviye Henüz Eklenmemiş Olsa Bile Bilgilendir
      if (activeCodes.includes("metformin") && !supplementsList.some(s => itemMatchesNutrientKeywords(s, ["b12", "kobalamin"]))) {
        interactions.push({
          id: "DEPLETION_METFORMIN_B12",
          ruleId: "DN_METFORMIN_B12",
          category: "drug-depletion",
          severity: "warning",
          severityLabel: "İlaç Kaynaklı Mikrobesin Eksikliği Riski",
          title: "💊 Metformin Kullanımı & B12 Vitamini Tükenme Uyarısı",
          desc: "Aktif ilaçlarınız arasında Metformin bulunuyor ancak Günlük Protokolünüzde B12 desteği görünmüyor. Uzun süreli Metformin kullanımı ileal B12 emilimini azaltabilir.",
          actionText: "Son B12 tahlilinizi kontrol ediniz ve hekiminize danışarak Dilaltı B12 ihtiyacınızı değerlendiriniz.",
          source: "ADA Diabetes Care / NIH ODS",
          separationHours: null,
          supplementId: null,
          supplementName: "B12 Vitamini",
          recommendedTiming: null,
          recommendedForm: null
        });
      }

      if (activeCodes.includes("ppi") && supplementsList.length === 0) {
        interactions.push({
          id: "DEPLETION_PPI_GENERAL",
          ruleId: "DN_PPI_IRON",
          category: "drug-depletion",
          severity: "warning",
          severityLabel: "Mide Asidi Baskılanması (PPI) Uyarısı",
          title: "💊 Mide Koruyucu (PPI) & Mikrobesin Emilim Uyarısı",
          desc: "Düzenli PPI kullanımı mide asidini baskılayarak B12, Demir, Magnezyum ve Kalsiyum emilimini azaltabilir.",
          actionText: "Takviye ekleyeceğiniz zaman hekim onayıyla Dilaltı (Sublingual) veya Lipozomal formları tercih ediniz.",
          source: "FDA / Gastroenterology",
          separationHours: null,
          supplementId: null,
          supplementName: null,
          recommendedTiming: null,
          recommendedForm: null
        });
      }

      return {
        interactions,
        activeCodes,
        customMeds,
        matchedLabelsByCode
      };
    }

    function getSupplementItemInteractions(supplementItem) {
      if (!supplementItem) return [];
      const evalResult = evaluateClinicalDrugNutrientInteractions(null);
      return evalResult.interactions.filter(ix =>
        (ix.supplementId && supplementItem.id && ix.supplementId === supplementItem.id) ||
        (ix.supplementName && supplementItem.name && ix.supplementName === supplementItem.name)
      );
    }

    function autoResolveSupplementTimingConflict(supId, newTiming) {
      const item = (state.supplements || []).find(s => s.id === supId);
      if (!item || !newTiming) return;
      const oldTiming = item.timing;
      item.timing = newTiming;
      saveState();
      renderDailyTab();
      detectSupplementConflicts();
      showToast("Zamanlama Ayrıldı", `${item.name} çakışmayı önlemek için ${oldTiming} diliminden ${newTiming} dilimine taşındı.`, "success");
    }

    function autoResolveSupplementFormConflict(supId, newFormKey) {
      if (!supId || !newFormKey) return;
      changeDailySupplementForm(supId, newFormKey);
    }

    function toggleQuickMedication(medCode) {
      if (!state.user) return;
      if (!Array.isArray(state.user.chronic)) state.user.chronic = [];
      const idx = state.user.chronic.indexOf(medCode);
      if (idx >= 0) {
        state.user.chronic.splice(idx, 1);
      } else {
        state.user.chronic.push(medCode);
      }
      saveState();
      renderDailyTab();
      detectSupplementConflicts();
      const cls = VITA_CLINICAL_DRUG_NUTRIENT_DB.quickMedicationClasses.find(c => c.code === medCode);
      const label = cls ? cls.label : medCode;
      showToast(
        idx >= 0 ? "İlaç Kaydı Kaldırıldı" : "İlaç Kalkanı Aktif",
        idx >= 0 ? `${label} etkileşim denetiminden çıkarıldı.` : `${label} gerçek zamanlı etkileşim denetimine eklendi.`,
        idx >= 0 ? "info" : "warning"
      );
    }

    function addQuickMedicationFromInput() {
      const inputEl = document.getElementById("quickAddMedInput");
      if (!inputEl || !state.user) return;
      const rawVal = inputEl.value.trim();
      if (!rawVal) {
        showToast("İlaç Adı Girin", "Lütfen denetlemek istediğiniz reçeteli ilacın adını yazınız.", "warning");
        return;
      }

      if (!Array.isArray(state.user.medications)) state.user.medications = [];
      if (!Array.isArray(state.user.chronic)) state.user.chronic = [];

      const lower = rawVal.toLowerCase();
      let matchedClass = null;
      VITA_CLINICAL_DRUG_NUTRIENT_DB.quickMedicationClasses.forEach(cls => {
        if (cls.keywords.some(kw => lower.includes(kw))) {
          matchedClass = cls;
          if (!state.user.chronic.includes(cls.code)) {
            state.user.chronic.push(cls.code);
          }
        }
      });

      if (!state.user.medications.some(m => m.toLowerCase() === lower)) {
        state.user.medications.push(rawVal);
      }

      inputEl.value = "";
      saveState();
      renderDailyTab();
      detectSupplementConflicts();

      if (matchedClass) {
        showToast("Klinik Eşleşme Bulundu", `"${rawVal}" (${matchedClass.label}) veritabanında eşleşti ve Günlük Protokol denetlendi.`, "warning");
      } else {
        showToast("İlaç Kaydedildi", `"${rawVal}" aktif ilaç listenize eklendi ve etkileşim taraması güncellendi.`, "info");
      }
    }

    function removeCustomMedication(medName) {
      if (!state.user || !Array.isArray(state.user.medications)) return;
      state.user.medications = state.user.medications.filter(m => m !== medName);
      saveState();
      renderDailyTab();
      detectSupplementConflicts();
      showToast("İlaç Silindi", `"${medName}" ilaç listesinden kaldırıldı.`, "info");
    }

    function toggleMedShieldDrawer(scrollToDrawer = true) {
      const drawer = document.getElementById("dailyProtocolMedicationsDrawer");
      if (!drawer) return;
      drawer.open = !drawer.open;
      if (drawer.open && scrollToDrawer) {
        setTimeout(() => {
          try {
            drawer.scrollIntoView({ behavior: "smooth", block: "nearest" });
            const inputEl = document.getElementById("quickAddMedInput");
            if (inputEl) inputEl.focus({ preventScroll: true });
          } catch (e) {}
        }, 60);
      }
    }

    function renderDailyProtocolMedicationsBar() {
      const chipsContainer = document.getElementById("dailyProtocolQuickMedChips");
      const statusBadge = document.getElementById("dailyProtocolDbStatusBadge");
      const headerCountBadge = document.getElementById("headerMedShieldCountBadge");
      const summarySubtext = document.getElementById("medShieldDrawerSummarySubtext");
      if (!chipsContainer || !state.user) return;

      const chronicList = Array.isArray(state.user.chronic) ? state.user.chronic : [];
      const customMeds = Array.isArray(state.user.medications) ? state.user.medications : [];

      const quickHtml = VITA_CLINICAL_DRUG_NUTRIENT_DB.quickMedicationClasses.map(cls => {
        const isActive = chronicList.includes(cls.code);
        return `
          <button type="button" onclick="if(window.SoundEffects) SoundEffects.playClick(); toggleQuickMedication(${safeJsStringAttribute(cls.code)})" class="px-2.5 py-1 rounded-xl text-[10px] font-bold transition flex items-center gap-1.5 cursor-pointer ${
            isActive
              ? "bg-rose-600 text-white shadow-sm ring-1 ring-rose-700"
              : "bg-white hover:bg-slate-100 text-slate-700 border border-slate-200"
          }">
            <i class="fa-solid ${cls.faIcon} ${isActive ? 'text-rose-100' : 'text-slate-400'}"></i>
            <span>${escapeHtmlText(cls.label)}</span>
            ${isActive ? '<i class="fa-solid fa-check text-[9px] ml-0.5"></i>' : ''}
          </button>
        `;
      }).join("");

      const customHtml = customMeds.map(med => `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-bold bg-navy-900 text-teal-200 border border-navy-800">
          <i class="fa-solid fa-prescription-bottle text-teal-400"></i>
          <span>${escapeHtmlText(med)}</span>
          <button type="button" onclick="if(window.SoundEffects) SoundEffects.playClick(); removeCustomMedication(${safeJsStringAttribute(med)})" class="hover:text-rose-300 ml-0.5 cursor-pointer" title="Kaldır">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </span>
      `).join("");

      chipsContainer.innerHTML = quickHtml + customHtml;

      const activeCount = chronicList.length + customMeds.length;
      if (headerCountBadge) {
        headerCountBadge.textContent = String(activeCount);
        headerCountBadge.className = activeCount > 0
          ? "px-1.5 py-0.2 rounded-full bg-rose-600 text-[10px] font-black text-white border border-rose-700"
          : "px-1.5 py-0.2 rounded-full bg-white text-[10px] font-black text-slate-600 border border-amber-200";
      }
      if (summarySubtext) {
        summarySubtext.textContent = activeCount > 0
          ? `${activeCount} kayıtlı ilaç/kronik durum aktif olarak takviyelerinizle karşılaştırılıyor. Düzenlemek için dokunun.`
          : "Kullandığınız reçeteli ilaçları seçmek veya denetlemek için dokunun (Kayıt/Profil bilgilerinizle senkronizedir).";
      }

      if (statusBadge) {
        statusBadge.textContent = activeCount > 0
          ? `${activeCount} Aktif İlaç/Durum İzleniyor`
          : "NIH ODS • Lexicomp • TİTCK Aktif";
        statusBadge.className = activeCount > 0
          ? "text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200"
          : "text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200";
      }
    }

    function updateModalLiveInteractionPreview() {
      const previewEl = document.getElementById("modalLiveInteractionWarning");
      const catalogSelect = document.getElementById("modalCatalogSelect");
      if (!previewEl || !catalogSelect) return;

      const catalogKey = catalogSelect.value;
      let candidate = null;

      if (catalogKey === "custom") {
        const name = (document.getElementById("manualSupName")?.value || "").trim();
        const timing = document.getElementById("manualSupTiming")?.value || "Sabah";
        const dose = (document.getElementById("manualSupDose")?.value || "").trim();
        if (!name) {
          previewEl.classList.add("hidden");
          previewEl.innerHTML = "";
          return;
        }
        candidate = {
          id: "candidate_preview",
          name,
          formKey: null,
          selectedForm: null,
          timing,
          doseText: dose
        };
      } else {
        const cfg = FORM_DOSAGE_CONFIG[catalogKey];
        const chosenForm = document.getElementById("modalFormSelect")?.value || cfg?.defaultForm;
        if (!cfg || !chosenForm || !cfg.forms[chosenForm]) {
          previewEl.classList.add("hidden");
          previewEl.innerHTML = "";
          return;
        }
        const w = state.user ? state.user.weight : 70;
        const evaluated = cfg.forms[chosenForm](w);
        candidate = {
          id: "candidate_preview",
          name: cfg.name,
          formKey: catalogKey,
          selectedForm: chosenForm,
          timing: evaluated.timing,
          doseText: evaluated.doseText
        };
      }

      const evalResult = evaluateClinicalDrugNutrientInteractions(candidate);
      const relevant = evalResult.interactions.filter(ix =>
        ix.supplementId === "candidate_preview" ||
        ix.supplementName === candidate.name ||
        (catalogKey === "custom" && ix.title.toLowerCase().includes(candidate.name.toLowerCase()))
      );

      previewEl.classList.remove("hidden");
      if (relevant.length === 0) {
        previewEl.className = "rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-950 flex items-start gap-2.5";
        previewEl.innerHTML = `
          <i class="fa-solid fa-shield-check text-emerald-600 text-base mt-0.5"></i>
          <div>
            <strong class="font-black block text-[11px] text-emerald-900">Klinik Veritabanı Kontrolü: Çakışma Saptanmadı</strong>
            <p class="text-[10px] text-emerald-800 mt-0.5 leading-relaxed">
              "${escapeHtmlText(candidate.name)}" (${escapeHtmlText(candidate.timing)}) için kayıtlı ilaçlarınız ve mevcut protokolünüzle majör bir etkileşim görünmüyor.
            </p>
          </div>
        `;
      } else {
        const hasDanger = relevant.some(r => r.severity === "danger");
        previewEl.className = `rounded-2xl border-2 p-3.5 space-y-2 text-xs ${
          hasDanger
            ? "border-rose-400 bg-rose-50 text-rose-950"
            : "border-amber-400 bg-amber-50 text-amber-950"
        }`;
        previewEl.innerHTML = `
          <div class="flex items-center justify-between gap-2">
            <strong class="font-black text-[11px] flex items-center gap-1.5">
              <i class="fa-solid fa-triangle-exclamation ${hasDanger ? 'text-rose-600' : 'text-amber-600'}"></i>
              <span>Gerçek Zamanlı İlaç–Besin Etkileşim Uyarısı (${relevant.length})</span>
            </strong>
            <span class="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-white/80 border ${hasDanger ? 'border-rose-300 text-rose-800' : 'border-amber-300 text-amber-800'}">Ekleme Öncesi Kontrol</span>
          </div>
          <div class="space-y-1.5">
            ${relevant.map(r => `
              <div class="p-2 rounded-xl bg-white/85 border ${r.severity === 'danger' ? 'border-rose-200' : 'border-amber-200'}">
                <div class="font-bold text-[11px]">${escapeHtmlText(r.title)}</div>
                <p class="text-[10px] mt-0.5 leading-relaxed opacity-90">${escapeHtmlText(r.desc)}</p>
                <p class="text-[10px] mt-1 font-bold text-teal-900">💡 Öneri: ${escapeHtmlText(r.actionText)}</p>
              </div>
            `).join("")}
          </div>
        `;
      }
    }

    /* ÇAKIŞMA & BİYOYARARLANIM EMNİYET KALKANI (GÜNLÜK PROTOKOL + ÜST BANNER) */
    function detectSupplementConflicts() {
      renderDailyProtocolMedicationsBar();

      const banner = document.getElementById("conflictShieldAlertBanner");
      const dailyAlert = document.getElementById("dailyProtocolInteractionAlert");

      const evalResult = evaluateClinicalDrugNutrientInteractions(null);
      const conflicts = evalResult.interactions;

      if (conflicts.length === 0) {
        if (banner) {
          banner.classList.add("hidden");
          banner.style.display = "none";
          banner.innerHTML = "";
        }
        if (dailyAlert) {
          dailyAlert.classList.add("hidden");
          dailyAlert.innerHTML = "";
        }
        return;
      }

      const dangerCount = conflicts.filter(c => c.severity === "danger").length;

      // 1. Üst Küresel Kalkan Bannerı
      if (banner) {
        banner.classList.remove("hidden");
        banner.style.display = "block";
        banner.innerHTML = `
          <div class="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-rose-950 via-rose-900 to-navy-950 border-2 border-rose-500 text-white shadow-xl space-y-3 pulse-danger">
            <div class="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-rose-700/60">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center font-black text-sm flex-shrink-0 shadow-md">
                  <i class="fa-solid fa-shield-virus"></i>
                </div>
                <div>
                  <h4 class="text-xs sm:text-sm font-black text-white tracking-wide">
                    🛡️ Gerçek Zamanlı İlaç–Besin &amp; Biyoyararlanım Emniyet Kalkanı Devrede!
                  </h4>
                  <span class="text-[10px] text-rose-300 font-semibold">
                    Klinik Veritabanında ${conflicts.length} Adet Etkileşim / Zamanlama Uyarısı Tespit Edildi ${dangerCount > 0 ? `(${dangerCount} Kritik)` : ""}
                  </span>
                </div>
              </div>
              <span class="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-rose-500/30 text-rose-200 border border-rose-400/50">
                Hekim / Eczacı Danışmanlığı Şart
              </span>
            </div>

            <div class="space-y-2">
              ${conflicts.map(c => `
                <div class="p-3 rounded-xl ${c.severity === 'danger' ? 'bg-rose-900/60 border border-rose-400/80 text-rose-100' : 'bg-amber-900/40 border border-amber-400/70 text-amber-100'} text-xs">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <strong class="font-bold block text-xs ${c.severity === 'danger' ? 'text-rose-200' : 'text-amber-200'}">
                      ${escapeHtmlText(c.title)}
                    </strong>
                    <span class="text-[9px] font-bold px-2 py-0.5 rounded bg-black/30 text-white/90">${escapeHtmlText(c.severityLabel || "Klinik Uyarı")}</span>
                  </div>
                  <p class="text-[11px] leading-relaxed mt-1 opacity-95">
                    ${escapeHtmlText(c.desc)}
                  </p>
                  <div class="mt-2 pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                    <span class="text-[10px] font-bold text-teal-200">💡 Klinik Çözüm: ${escapeHtmlText(c.actionText)}</span>
                    <div class="flex flex-wrap items-center gap-1.5">
                      ${c.supplementId && c.recommendedTiming ? `
                        <button type="button" onclick="if(window.SoundEffects) SoundEffects.playClick(); autoResolveSupplementTimingConflict(${safeJsStringAttribute(c.supplementId)}, ${safeJsStringAttribute(c.recommendedTiming)})" class="px-2.5 py-1 rounded-lg bg-teal-500 hover:bg-teal-400 text-navy-950 font-black text-[10px] cursor-pointer transition">
                          <i class="fa-regular fa-clock mr-1"></i>${escapeHtmlText(c.recommendedTiming)} Saat Dilimine Taşı
                        </button>
                      ` : ''}
                      ${c.supplementId && c.recommendedForm ? `
                        <button type="button" onclick="if(window.SoundEffects) SoundEffects.playClick(); autoResolveSupplementFormConflict(${safeJsStringAttribute(c.supplementId)}, ${safeJsStringAttribute(c.recommendedForm)})" class="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-navy-950 font-black text-[10px] cursor-pointer transition">
                          <i class="fa-solid fa-flask mr-1"></i>Güvenli Forma Geç (${escapeHtmlText(c.recommendedForm.replace(/_/g, ' '))})
                        </button>
                      ` : ''}
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }

      // 2. Günlük Protokol Kartı İçi Doğrudan Uyarı Kutusu (#dailyProtocolInteractionAlert)
      if (dailyAlert) {
        dailyAlert.classList.remove("hidden");
        dailyAlert.innerHTML = `
          <div class="p-3.5 sm:p-4 rounded-2xl border-2 ${dangerCount > 0 ? 'border-rose-400 bg-rose-50/95 text-rose-950' : 'border-amber-400 bg-amber-50/95 text-amber-950'} space-y-2.5 shadow-sm">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="w-7 h-7 rounded-xl ${dangerCount > 0 ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'} flex items-center justify-center text-xs font-black">
                  <i class="fa-solid fa-triangle-exclamation"></i>
                </span>
                <div>
                  <h4 class="text-xs font-black">Günlük Protokol İlaç–Besin Etkileşim Uyarısı (${conflicts.length})</h4>
                  <p class="text-[10px] opacity-80">Aşağıdaki ilaç-takviye veya mineral-mineral etkileşimleri emilim kaybı ya da klinik risk oluşturabilir:</p>
                </div>
              </div>
              <span class="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-white border ${dangerCount > 0 ? 'border-rose-300 text-rose-800' : 'border-amber-300 text-amber-800'}">
                Canlı Klinik Denetim
              </span>
            </div>
            <div class="space-y-2">
              ${conflicts.map(c => `
                <div class="p-2.5 rounded-xl bg-white border ${c.severity === 'danger' ? 'border-rose-200' : 'border-amber-200'} text-xs space-y-1">
                  <div class="flex flex-wrap items-center justify-between gap-1.5">
                    <strong class="font-black text-[11px] ${c.severity === 'danger' ? 'text-rose-900' : 'text-amber-900'}">${escapeHtmlText(c.title)}</strong>
                    <span class="text-[9px] font-semibold text-slate-500">${escapeHtmlText(c.source || "Klinik Veritabanı")}</span>
                  </div>
                  <p class="text-[11px] text-slate-700 leading-relaxed">${escapeHtmlText(c.desc)}</p>
                  <div class="pt-1 flex flex-wrap items-center justify-between gap-2">
                    <span class="text-[10px] font-bold text-teal-800">👉 ${escapeHtmlText(c.actionText)}</span>
                    <div class="flex flex-wrap items-center gap-1.5">
                      ${c.supplementId && c.recommendedTiming ? `
                        <button type="button" onclick="if(window.SoundEffects) SoundEffects.playClick(); autoResolveSupplementTimingConflict(${safeJsStringAttribute(c.supplementId)}, ${safeJsStringAttribute(c.recommendedTiming)})" class="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-black text-[10px] cursor-pointer transition">
                          ⏱️ ${escapeHtmlText(c.recommendedTiming)} Dilimine Ayır
                        </button>
                      ` : ''}
                      ${c.supplementId && c.recommendedForm ? `
                        <button type="button" onclick="if(window.SoundEffects) SoundEffects.playClick(); autoResolveSupplementFormConflict(${safeJsStringAttribute(c.supplementId)}, ${safeJsStringAttribute(c.recommendedForm)})" class="px-2.5 py-1 rounded-lg bg-navy-900 hover:bg-slate-800 text-white font-black text-[10px] cursor-pointer transition">
                          💊 ${escapeHtmlText(c.recommendedForm.replace(/_/g, ' '))} Formuna Geç
                        </button>
                      ` : ''}
                    </div>
                  </div>
                </div>
              `).join("")}
            </div>
          </div>
        `;
      }

      if (typeof parseKidneyFunctionAndCompareMedications === "function") {
        try {
          parseKidneyFunctionAndCompareMedications(null, { triggerSource: "conflict_scan", renderUI: true });
        } catch (_) {}
      }
    }

    /* =========================================================================
       YAPAY ZEKA (AI) DESTEKLİ BÖBREK FONKSİYONU (KREATİNİN & GFR/eGFR) AYRIŞTIRICI
       VE AKTİF İLAÇ GÜVENLİĞİ (KIDNEY SAFETY) KARŞILAŞTIRMA MOTORU
       ========================================================================= */
    const VITA_KIDNEY_MEDICATION_SAFETY_RULES = [
      {
        id: "KIDNEY_MED_METFORMIN",
        drugCode: "metformin",
        drugLabel: "Metformin (Glucophage / Matofin / Diaformin / Glifor)",
        keywords: ["metformin", "glucophage", "matofin", "diaformin", "glifor"],
        evaluate: function (creatinine, egfr, gender) {
          const crHighThreshold = gender === "E" ? 1.35 : 1.15;
          if (egfr !== null && egfr < 30) {
            return {
              severity: "critical",
              badge: "Kontrendike • eGFR < 30",
              title: "⛔ Böbrek Güvenliği Uyarısı (Kidney Safety): Metformin & eGFR < 30 mL/dk/1.73m²",
              mechanism: `Böbrek filtrasyon hızınız (eGFR: ${egfr} mL/dk/1.73m²${creatinine !== null ? `, Kreatinin: ${creatinine} mg/dL` : ""}) kritik eşiğin (<30) altındadır. Metformin değişmeden böbreklerden atıldığından plazmada birikerek hayatı tehdit eden Metformin İlişkili Laktik Asidoz (MALA) riskini artırır.`,
              recommendation: "FDA ve KDIGO kılavuzlarına göre eGFR < 30 mL/dk/1.73m² düzeyinde Metformin kontrendikedir. İlacınızı kendi başınıza kesmeden derhal reçete eden dahiliye/endokrinoloji hekiminize başvurunuz.",
              source: "FDA Boxed Warning / KDIGO Diabetes in CKD Guideline"
            };
          }
          if ((egfr !== null && egfr < 45) || (creatinine !== null && creatinine >= 1.5)) {
            return {
              severity: "critical",
              badge: "Doz Gözden Geçirme • eGFR 30–44",
              title: "⚠️ Böbrek Güvenliği Uyarısı (Kidney Safety): Metformin & Azalmış GFR (Evre G3b)",
              mechanism: `Kayıtlı böbrek göstergeleriniz (eGFR: ${egfr !== null ? egfr + " mL/dk/1.73m²" : "—"}, Kreatinin: ${creatinine !== null ? creatinine + " mg/dL" : "—"}) renal klirensin belirgin azaldığını göstermektedir. Bu aralıkta Metformin birikimi ve laktik asidoz riski artar.`,
              recommendation: "KDIGO kılavuzuna göre eGFR 30–44 aralığında yeni Metformin başlanmamalı, mevcut kullanımda ise günlük maksimum doz hekim tarafından %50 azaltılarak (maks. 1000 mg/gün) yakın renal takip yapılmalıdır.",
              source: "KDIGO CKD Guideline / TİTCK"
            };
          }
          if ((egfr !== null && egfr < 60) || (creatinine !== null && creatinine > crHighThreshold)) {
            return {
              severity: "warning",
              badge: "Yakın Renal İzlem • eGFR 45–59",
              title: "⚠️ Böbrek Güvenliği Notu (Kidney Safety): Metformin & Sınırda Böbrek Filtrasyonu",
              mechanism: `Böbrek fonksiyon göstergeleriniz (eGFR: ${egfr !== null ? egfr + " mL/dk/1.73m²" : "—"}, Kreatinin: ${creatinine !== null ? creatinine + " mg/dL" : "—"}) hafif-orta düzeyde azalmış filtrasyona işaret etmektedir.`,
              recommendation: "Dehidratasyon (yetersiz sıvı alımı), kontrastlı görüntüleme (BT/MR anjiyo) veya akut enfeksiyon durumlarında böbrek fonksiyonu hızla değişebileceğinden 3–6 ayda bir Kreatinin/eGFR ve B12 kontrolü önerilir.",
              source: "ADA Standards of Care / KDIGO"
            };
          }
          return null;
        }
      },
      {
        id: "KIDNEY_MED_DIURETIC",
        drugCode: "diuretic",
        drugLabel: "Diüretik / İdrar Söktürücü (Lasix / Furosemid / Fludex / Hidroklorotiyazid / Aldactone)",
        keywords: ["diüretik", "idrar söktürücü", "furosemid", "lasix", "indapamid", "fludex", "hidroklorotiyazid", "spironolakton", "aldactone", "aldactazide", "desal"],
        evaluate: function (creatinine, egfr, gender) {
          const crHighThreshold = gender === "E" ? 1.25 : 1.10;
          if ((egfr !== null && egfr < 60) || (creatinine !== null && creatinine > crHighThreshold)) {
            return {
              severity: egfr !== null && egfr < 30 ? "critical" : "warning",
              badge: egfr !== null && egfr < 30 ? "Yüksek Elektrolit & Prerenal Risk" : "Renal & Elektrolit İzlemi",
              title: "⚠️ Böbrek Güvenliği Uyarısı (Kidney Safety): Diüretik Kullanımı & Böbrek Fonksiyonu",
              mechanism: `Diüretik tedavisi altında Kreatinin (${creatinine !== null ? creatinine + " mg/dL" : "—"}) yüksekliği veya düşük eGFR (${egfr !== null ? egfr + " mL/dk/1.73m²" : "—"}) saptanması; intravasküler hacim azalmasına (prerenal azotemi) veya kronik böbrek etkilenmesine işaret edebilir. Potasyum tutucu diüretiklerde (Spironolakton) hiperkalemi, kıvrım/tiyazid diüretiklerde hipomagnezemi ve hipokalemi riski artar.`,
              recommendation: "Sıvı alım hedefini ve diüretik dozunu kendi başınıza değiştirmeden hekiminizle Serum Potasyum (K⁺), Sodyum (Na⁺), Magnezyum ve Üre/Kreatinin kontrolü planlayınız.",
              source: "KDIGO Blood Pressure in CKD / Lexicomp"
            };
          }
          return null;
        }
      },
      {
        id: "KIDNEY_MED_BISPHOSPHONATE",
        drugCode: "bisphosphonate",
        drugLabel: "Bisfosfonat (Fosamax / Alendronat / Bonviva / Zoledronat)",
        keywords: ["alendronat", "fosamax", "risedronat", "actonel", "ibandronat", "bonviva", "zoledronat", "aclasta", "bisfosfonat"],
        evaluate: function (creatinine, egfr, gender) {
          const crHighThreshold = gender === "E" ? 1.30 : 1.10;
          if ((egfr !== null && egfr < 35) || (creatinine !== null && creatinine >= 1.6)) {
            return {
              severity: "critical",
              badge: "Renal Eşik Altı • eGFR < 35",
              title: "⛔ Böbrek Güvenliği Uyarısı (Kidney Safety): Bisfosfonat & Düşük GFR (<35 mL/dk)",
              mechanism: `Bisfosfonatlar böbreklerden glomerüler filtrasyon ve tübüler sekresyonla atılır. eGFR < 35 mL/dk/1.73m² (mevcut eGFR: ${egfr !== null ? egfr : "—"}, Kreatinin: ${creatinine !== null ? creatinine + " mg/dL" : "—"}) düzeyinde akut tübüler hasar ve adinamik kemik hastalığı riski artar.`,
              recommendation: "eGFR < 30–35 mL/dk/1.73m² durumunda bisfosfonatlar genellikle önerilmez; endokrinoloji/nefroloji hekiminizle Ca, Fosfor, PTH ve 25(OH)D düzeylerini birlikte değerlendiriniz.",
              source: "FDA / Endocrine Society Osteoporosis Guideline"
            };
          }
          if ((egfr !== null && egfr < 60) || (creatinine !== null && creatinine > crHighThreshold)) {
            return {
              severity: "warning",
              badge: "CKD-MBD İzlemi • eGFR < 60",
              title: "⚠️ Böbrek Güvenliği Notu (Kidney Safety): Kemik Erimesi İlacı & eGFR İzlemi",
              mechanism: `Azalmış eGFR (${egfr !== null ? egfr + " mL/dk/1.73m²" : "—"}) varlığında kemik-mineral metabolizması (CKD-MBD) etkilenebilir.`,
              recommendation: "Bisfosfonat alımı öncesi yeterli hidrasyon sağlanmalı ve her kontrol tahlilinde Kreatinin, eGFR ve Kalsiyum izlenmelidir.",
              source: "KDIGO CKD-MBD Guideline"
            };
          }
          return null;
        }
      },
      {
        id: "KIDNEY_MED_ANTIBIOTIC",
        drugCode: "antibiotic",
        drugLabel: "Antibiyotik (Siprofloksasin / Levofloksasin / Doksisiklin)",
        keywords: ["siprofloksasin", "cipro", "levofloksasin", "tavanic", "moksifloksasin", "doksisiklin", "monodoks", "tetrasiklin", "gentamisin", "amikasin", "vankomisin", "kinolon"],
        evaluate: function (creatinine, egfr, gender) {
          const crHighThreshold = gender === "E" ? 1.25 : 1.10;
          if ((egfr !== null && egfr < 50) || (creatinine !== null && creatinine > crHighThreshold)) {
            return {
              severity: egfr !== null && egfr < 30 ? "critical" : "warning",
              badge: "Renal Doz Ayarı Gerekli",
              title: "⚠️ Böbrek Güvenliği Uyarısı (Kidney Safety): Antibiyotik Renal Klirens Uyarısı",
              mechanism: `Florokinolon (Siprofloksasin, Levofloksasin) ve birçok antibiyotik ağırlıklı olarak böbrek yoluyla atılır. eGFR < 50 mL/dk/1.73m² (mevcut eGFR: ${egfr !== null ? egfr : "—"}, Kreatinin: ${creatinine !== null ? creatinine + " mg/dL" : "—"}) durumunda standart dozlarda ilaç birikimi, kristalüri ve nörotoksisite/tendon riski artar.`,
              recommendation: "Reçete eden hekiminize veya eczacınıza güncel eGFR/Kreatinin sonucunuzu bildirerek böbrek doz ayarlaması gerekip gerekmediğini teyit ediniz.",
              source: "Sanford Guide / Lexicomp Renal Dosing"
            };
          }
          return null;
        }
      },
      {
        id: "KIDNEY_MED_NSAID_OR_RAAS",
        drugCode: "nsaid_raas",
        drugLabel: "NSAİİ Ağrı Kesici veya ACEİ/ARB Tansiyon İlacı",
        keywords: ["ibuprofen", "naproksen", "diklofenak", "ketoprofen", "meloksikam", "deksketoprofen", "arveles", "majezik", "voltaren", "apranax", "brufen", "advil", "dolorex", "ramipril", "enalapril", "lisinopril", "perindopril", "valsartan", "losartan", "kandesartan", "telmisartan", "irbesartan", "delix", "cozaar", "atacand", "micardis"],
        evaluate: function (creatinine, egfr, gender) {
          const crHighThreshold = gender === "E" ? 1.25 : 1.10;
          if ((egfr !== null && egfr < 60) || (creatinine !== null && creatinine > crHighThreshold)) {
            return {
              severity: "critical",
              badge: "Nefrotoksisite / Hemodinamik Risk",
              title: "⛔ Böbrek Güvenliği Uyarısı (Kidney Safety): NSAİİ / RAAS İnhibitörü & Böbrek Perfüzyonu",
              mechanism: `Kayıtlı ilaçlarınız arasında bulunan NSAİİ ağrı kesiciler afferent arteriyolü daraltarak, ACEİ/ARB grubu ilaçlar ise efferent arteriyol tonusunu değiştirerek intraglomerüler basıncı etkiler. Mevcut Kreatinin (${creatinine !== null ? creatinine + " mg/dL" : "—"}) / eGFR (${egfr !== null ? egfr + " mL/dk/1.73m²" : "—"}) tablosunda özellikle NSAİİ kullanımı akut böbrek hasarı (ABH) ve hiperkalemi riskini ciddi ölçüde yükseltir.`,
              recommendation: "Düşük eGFR veya yüksek Kreatinin varlığında reçetesiz NSAİİ ağrı kesicilerden kaçınılmalı; tansiyon ilaçlarınız ise yalnızca hekim kontrolünde kreatinin ve potasyum takibiyle düzenlenmelidir.",
              source: "KDIGO AKI & CKD Guidelines"
            };
          }
          return null;
        }
      }
    ];

    /**
     * Extracts Creatinine (mg/dL or µmol/L) and GFR/eGFR (mL/min/1.73m²) from raw PDF text,
     * parsed lab preview objects, or current state.labValues.
     */
    function parseKidneyFunctionMarkersFromSource(rawSource) {
      const p = (typeof state !== "undefined" && state.user) ? state.user : { age: 28, gender: "K" };
      const age = Number(p.age) || 28;
      const gender = p.gender || "K";

      let extractedCr = null;
      let extractedGfr = null;
      let crUnitConverted = false;
      let rawMatchedLines = [];

      // 1. Eğer ham metin (PDF / OCR / e-Nabız metni) verildiyse gelişmiş regex + AI önişleme ile ayrıştır
      if (typeof rawSource === "string" && rawSource.trim().length > 0) {
        const text = rawSource.replace(/\r/g, "\n");
        const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

        const crRegex = /(?:serum\s*)?(?:kreatinin|creatinine|crea)\b[^0-9]*?(\d{1,3}(?:[.,]\d{1,3})?)\s*(mg\s*\/\s*dl|µmol\s*\/\s*l|umol\s*\/\s*l|mcmol\s*\/\s*l)?/i;
        const gfrRegex = /(?:egfr|gfr|glomer[üu]ler\s*filtrasyon\s*h[ıi]z[ıi]|ckd[-\s]*epi)\b[^0-9]*?>?\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:ml\s*\/\s*(?:dk|min))?/i;

        lines.forEach(line => {
          if (extractedCr === null && /kreatinin|creatinine|\bcrea\b/i.test(line) && !/klirens|clearance|idrar|urine|kreatin\s*kinaz|\bck\b/i.test(line)) {
            const m = line.match(crRegex);
            if (m && m[1]) {
              let val = parseFloat(m[1].replace(",", "."));
              const unit = String(m[2] || "").toLowerCase();
              if (Number.isFinite(val) && val > 0) {
                if (/mol/.test(unit) || (val > 25 && val < 1500)) {
                  val = Math.round((val / 88.4) * 100) / 100;
                  crUnitConverted = true;
                }
                if (val >= 0.1 && val <= 25) {
                  extractedCr = val;
                  rawMatchedLines.push(line);
                }
              }
            }
          }
          if (extractedGfr === null && /\begfr\b|\bgfr\b|filtrasyon\s*h[ıi]z[ıi]|ckd[-\s]*epi/i.test(line)) {
            const m = line.match(gfrRegex);
            if (m && m[1]) {
              const val = parseFloat(m[1].replace(",", "."));
              if (Number.isFinite(val) && val >= 2 && val <= 200) {
                extractedGfr = Math.round(val);
                rawMatchedLines.push(line);
              }
            }
          }
        });
      } else if (rawSource && typeof rawSource === "object") {
        // 2. temporarilyParsedLabResults veya özel lab nesnesi verildiyse
        if (rawSource.creatinine !== undefined && rawSource.creatinine !== null) {
          const rawCr = typeof rawSource.creatinine === "object" ? rawSource.creatinine.value : rawSource.creatinine;
          const numCr = parseFloat(String(rawCr).replace(",", "."));
          if (Number.isFinite(numCr) && numCr > 0) {
            extractedCr = numCr > 25 ? Math.round((numCr / 88.4) * 100) / 100 : numCr;
            if (numCr > 25) crUnitConverted = true;
          }
        }
        if (rawSource.gfr !== undefined || rawSource.egfr !== undefined) {
          const rawG = rawSource.gfr !== undefined ? rawSource.gfr : rawSource.egfr;
          const valG = typeof rawG === "object" ? rawG.value : rawG;
          const numG = parseFloat(String(valG).replace(",", "."));
          if (Number.isFinite(numG) && numG > 0) extractedGfr = Math.round(numG);
        }
      }

      // 3. Eksikse mevcut kayıtlı tahlil değerlerinden (VitaLabInsights / state.labValues) tamamla
      const labCtx = (typeof window !== "undefined" && window.VitaLabInsights && typeof window.VitaLabInsights.cdssInputs === "function")
        ? window.VitaLabInsights.cdssInputs()
        : null;
      const activeLabs = labCtx && labCtx.values ? labCtx.values : ((typeof state !== "undefined" && state.labValues) ? state.labValues : {});

      if (extractedCr === null && activeLabs && activeLabs.creatinine !== null && activeLabs.creatinine !== undefined && activeLabs.creatinine !== "") {
        const fallbackCr = parseFloat(String(activeLabs.creatinine).replace(",", "."));
        if (Number.isFinite(fallbackCr) && fallbackCr > 0) extractedCr = fallbackCr;
      }

      // 4. CKD-EPI (2021) eGFR Hesaplaması
      const ckdEpiResult = (extractedCr !== null && age >= 18 && typeof calculateCKDEPI_eGFR === "function")
        ? calculateCKDEPI_eGFR(extractedCr, age, gender)
        : null;
      const effectiveEgfr = extractedGfr !== null
        ? extractedGfr
        : (ckdEpiResult && Number.isFinite(ckdEpiResult.egfr) ? ckdEpiResult.egfr : null);

      const crUpperLimit = gender === "E" ? 1.25 : 1.10;
      const isCreatinineElevated = extractedCr !== null && extractedCr > crUpperLimit;
      const isEgfrReduced = effectiveEgfr !== null && effectiveEgfr < 60;
      const isMildlyReducedEgfr = effectiveEgfr !== null && effectiveEgfr >= 60 && effectiveEgfr < 90;

      let stageCode = ckdEpiResult ? ckdEpiResult.stage : null;
      let stageDesc = ckdEpiResult ? ckdEpiResult.desc : null;
      if (!stageCode && effectiveEgfr !== null) {
        if (effectiveEgfr >= 90) { stageCode = "G1"; stageDesc = "Normal veya Yüksek Filtrasyon (≥90)"; }
        else if (effectiveEgfr >= 60) { stageCode = "G2"; stageDesc = "Hafif Azalmış GFR (60–89)"; }
        else if (effectiveEgfr >= 45) { stageCode = "G3a"; stageDesc = "Hafif-Orta Azalmış GFR (45–59)"; }
        else if (effectiveEgfr >= 30) { stageCode = "G3b"; stageDesc = "Orta-Ağır Azalmış GFR (30–44)"; }
        else if (effectiveEgfr >= 15) { stageCode = "G4"; stageDesc = "Ağır Azalmış GFR (15–29)"; }
        else { stageCode = "G5"; stageDesc = "Böbrek Yetmezliği (<15)"; }
      }

      return {
        creatinine: extractedCr,
        creatinineUpperLimit: crUpperLimit,
        unitConvertedFromUmol: crUnitConverted,
        labReportedGfr: extractedGfr,
        calculatedEgfr: ckdEpiResult ? ckdEpiResult.egfr : null,
        effectiveEgfr: effectiveEgfr,
        stage: stageCode,
        stageDesc: stageDesc,
        isCreatinineElevated: isCreatinineElevated,
        isEgfrReduced: isEgfrReduced,
        isMildlyReducedEgfr: isMildlyReducedEgfr,
        rawMatchedLines: rawMatchedLines
      };
    }

    /**
     * Dedicated AI-driven & rule-verified Kidney Function (Creatinine, GFR/eGFR) parser
     * that compares extracted markers against recent Medication & Supplement entries
     * in the user profile and outputs a specific "Kidney Safety" warning for Klinik Analiz.
     */
    function parseKidneyFunctionAndCompareMedications(rawSource = null, options = {}) {
      const p = (typeof state !== "undefined" && state.user) ? state.user : { age: 28, gender: "K", chronic: [], medications: [] };
      const gender = p.gender || "K";
      const markers = parseKidneyFunctionMarkersFromSource(rawSource);
      const medProfile = (typeof getActiveUserMedicationCodesAndLabels === "function")
        ? getActiveUserMedicationCodesAndLabels()
        : { activeCodes: Array.isArray(p.chronic) ? p.chronic : [], customMeds: Array.isArray(p.medications) ? p.medications : [], matchedLabelsByCode: {} };

      const activeCodes = medProfile.activeCodes || [];
      const customMeds = medProfile.customMeds || [];
      const supplements = (typeof state !== "undefined" && Array.isArray(state.supplements)) ? state.supplements : [];
      const allMedStrings = [
        ...customMeds,
        ...activeCodes.map(code => {
          const cls = VITA_CLINICAL_DRUG_NUTRIENT_DB.quickMedicationClasses.find(c => c.code === code);
          return cls ? cls.label : code;
        })
      ];

      const warnings = [];
      const cr = markers.creatinine;
      const egfr = markers.effectiveEgfr;
      const hasKidneyHistory = activeCodes.includes("kidney");

      // 1. Reçeteli İlaçlar ile Kreatinin / eGFR Karşılaştırması
      VITA_KIDNEY_MEDICATION_SAFETY_RULES.forEach(rule => {
        const hasCode = activeCodes.includes(rule.drugCode);
        const matchedCustomMed = customMeds.find(m =>
          rule.keywords.some(kw => String(m).toLocaleLowerCase("tr-TR").includes(kw))
        );
        if (!hasCode && !matchedCustomMed) return;

        const matchedMedDisplay = matchedCustomMed || (medProfile.matchedLabelsByCode && medProfile.matchedLabelsByCode[rule.drugCode]) || rule.drugLabel;
        const evalOutcome = rule.evaluate(cr, egfr, gender);
        if (evalOutcome) {
          warnings.push({
            id: rule.id,
            medicationName: matchedMedDisplay,
            severity: evalOutcome.severity,
            badge: evalOutcome.badge,
            title: evalOutcome.title,
            mechanism: evalOutcome.mechanism,
            recommendation: evalOutcome.recommendation,
            source: evalOutcome.source
          });
        } else if (cr === null && egfr === null) {
          // İlaç aktif ama henüz Kreatinin/eGFR girilmemişse bazal böbrek güvenlik uyarısı üret
          warnings.push({
            id: `${rule.id}_MISSING_LAB`,
            medicationName: matchedMedDisplay,
            severity: "monitoring",
            badge: "Kreatinin / eGFR Ölçümü Önerilir",
            title: `ℹ️ Böbrek Güvenliği Kontrolü (Kidney Safety): ${matchedMedDisplay} İçin Bazal Kreatinin/eGFR Eksik`,
            mechanism: `Profilinizde "${matchedMedDisplay}" kullanımı kayıtlıdır. Bu ilacın güvenli doz aralığının doğrulanması için güncel Serum Kreatinin ve eGFR değerlerinin bilinmesi gerekir.`,
            recommendation: "Tahlillerim sekmesinden veya e-Nabız PDF yükleyici ile Kreatinin sonucunuzu ekleyerek ilaç-böbrek güvenlik taramasını tamamlayınız.",
            source: "KDIGO / Klinik İlaç Güvenliği"
          });
        }
      });

      // 2. Renal Yüklü / Nefrotoksik Riskli Takviyeler (Kreatin, Yüksek Doz Magnezyum/Kalsiyum) ile Karşılaştırma
      const hasKidneyImpairment = markers.isCreatinineElevated || markers.isEgfrReduced || hasKidneyHistory;
      if (hasKidneyImpairment) {
        supplements.forEach(sup => {
          const supText = `${sup.name || ""} ${sup.selectedForm || ""} ${sup.formKey || ""}`.toLocaleLowerCase("tr-TR");
          if (/kreatin|creatine/.test(supText)) {
            warnings.push({
              id: `KIDNEY_SUP_CREATINE_${sup.id || "1"}`,
              medicationName: sup.name,
              severity: "critical",
              badge: "Böbrek Emniyet Kilidi",
              title: `⛔ Böbrek Güvenliği Uyarısı (Kidney Safety): ${sup.name} & Kreatinin/eGFR Yüksekliği`,
              mechanism: `Kreatin takviyesi iskelet kasında kreatinine dönüşerek serum kreatinin ölçümünü yapay olarak yükseltebilir ve mevcut düşük eGFR (${egfr !== null ? egfr + " mL/dk/1.73m²" : "—"}) tablosunda renal değerlendirmeyi karıştırır.`,
              recommendation: "Böbrek fonksiyon bozukluğu veya yüksek kreatinin varlığında kreatin takviyesi durdurulmalı ve nefroloji/dahiliye hekimiyle görüşülmelidir (gerekirse Sistatin-C ile eGFR doğrulanır).",
              source: "KDIGO CKD Evaluation Guideline"
            });
          } else if (/magnezyum|magnesium/.test(supText) && ((egfr !== null && egfr < 45) || (cr !== null && cr >= 1.5))) {
            warnings.push({
              id: `KIDNEY_SUP_MG_${sup.id || "1"}`,
              medicationName: sup.name,
              severity: "warning",
              badge: "Hipermagnezemi Riski • eGFR < 45",
              title: `⚠️ Böbrek Güvenliği Uyarısı (Kidney Safety): ${sup.name} & Azalmış Renal Magnezyum Atılımı`,
              mechanism: `Magnezyumun ana atılım yolu böbreklerdir. eGFR < 45 mL/dk/1.73m² düzeyinde kontrolsüz magnezyum takviyesi serum magnezyum birikimine (hipermagnezemi, kas güçsüzlüğü, iletim yavaşlaması) yol açabilir.`,
              recommendation: "Magnezyum takviyesine yalnızca hekim kontrolünde ve serum magnezyum takibiyle devam edilmelidir.",
              source: "NIH ODS / KDIGO"
            });
          }
        });
      }

      // 3. Eğer ilaç kaydı olmasa bile Kreatinin veya eGFR tek başına anormal ise genel Kidney Safety uyarısı ekle
      if (warnings.length === 0 && (markers.isCreatinineElevated || markers.isEgfrReduced)) {
        warnings.push({
          id: "KIDNEY_GENERAL_ABNORMAL_MARKER",
          medicationName: allMedStrings.length > 0 ? allMedStrings.join(", ") : "Kayıtlı Reçeteli İlaç Yok",
          severity: (egfr !== null && egfr < 45) ? "critical" : "warning",
          badge: `Evre ${markers.stage || "Renal İzlem"} • eGFR ${egfr !== null ? egfr : "—"}`,
          title: `⚠️ Böbrek Fonksiyonu Güvenlik Uyarısı (Kidney Safety): Kreatinin ${cr !== null ? cr + " mg/dL" : "—"} | eGFR ${egfr !== null ? egfr + " mL/dk/1.73m²" : "—"}`,
          mechanism: `Böbrek fonksiyon göstergeleriniz referans eşiklerinin dışında saptanmıştır (${markers.stageDesc || "Azalmış renal filtrasyon"}). Yeni başlanacak tüm reçeteli ilaçlar (özellikle antibiyotikler, ağrı kesiciler/NSAİİ, kontrast maddeler) ve mineral takviyeleri böbrek klirensine göre değerlendirilmelidir.`,
          recommendation: "Hekim görüşmenizde bu Kreatinin/eGFR sonucunu paylaşınız; reçetesiz ağrı kesici (NSAİİ) ve yüksek doz mineral yüklemelerinden kaçınınız.",
          source: "KDIGO 2024 CKD Guideline"
        });
      }

      const hasCritical = warnings.some(w => w.severity === "critical");
      const hasWarning = warnings.some(w => w.severity === "warning");
      const overallStatus = hasCritical ? "critical" : (hasWarning ? "warning" : (warnings.length > 0 ? "monitoring" : "safe"));

      const resultPayload = {
        timestamp: new Date().toISOString(),
        triggerSource: options.triggerSource || "manual",
        markers: markers,
        medicationsChecked: allMedStrings,
        warnings: warnings,
        overallStatus: overallStatus,
        aiEnhancedNarrative: (typeof state !== "undefined" && state.lastKidneySafetyAnalysis && state.lastKidneySafetyAnalysis.aiEnhancedNarrative)
          ? state.lastKidneySafetyAnalysis.aiEnhancedNarrative
          : null
      };

      if (typeof state !== "undefined") {
        state.lastKidneySafetyAnalysis = resultPayload;
      }

      if (options.renderUI !== false && typeof renderClinicalKidneySafetyWarningUI === "function") {
        renderClinicalKidneySafetyWarningUI(resultPayload);
      }

      // İsteğe bağlı canlı AI zenginleştirmesi (kullanıcı AI onayı + Gemini anahtarı aktifse)
      if (options.requestAI === true && typeof runAIKidneyFunctionMedicationParse === "function") {
        runAIKidneyFunctionMedicationParse(rawSource, resultPayload);
      }

      return resultPayload;
    }

    /**
     * Uses VitaAIChat (Gemini API when configured, or structured clinical NLG fallback)
     * to parse unstructured lab text for Creatinine/GFR and synthesize a physician-grade
     * Kidney Safety medication cross-check paragraph.
     */
    async function runAIKidneyFunctionMedicationParse(rawTextOrSource = null, existingAnalysis = null) {
      const analysis = existingAnalysis || parseKidneyFunctionAndCompareMedications(rawTextOrSource, { renderUI: true });
      const btn = document.getElementById("btnRunAiKidneySafetyCheck");
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>AI Böbrek & İlaç Analizi...</span>`;
      }

      try {
        const cr = analysis.markers.creatinine;
        const egfr = analysis.markers.effectiveEgfr;
        const meds = analysis.medicationsChecked.length > 0 ? analysis.medicationsChecked.join(", ") : "Kayıtlı kronik ilaç yok";
        const sups = (typeof state !== "undefined" && Array.isArray(state.supplements) && state.supplements.length > 0)
          ? state.supplements.map(s => `${s.name} (${s.doseText || s.selectedForm || ""})`).join(", ")
          : "Kayıtlı takviye yok";

        let aiSummary = "";
        if (window.VitaAIChat && typeof window.VitaAIChat.isConfigured === "function" && window.VitaAIChat.isConfigured()) {
          const prompt = [
            "Sen bir İç Hastalıkları ve Nefroloji uzmanısın. Aşağıdaki hasta verilerinden Böbrek Fonksiyonu (Kreatinin, GFR/eGFR) göstergelerini değerlendir ve hastanın aktif ilaç/takviye listesiyle karşılaştırarak Türkçe, 3-4 cümlelik net bir 'Böbrek Güvenliği (Kidney Safety)' klinik uyarısı yaz.",
            `Kreatinin: ${cr !== null ? cr + " mg/dL" : "Girilmedi"}, eGFR (CKD-EPI 2021): ${egfr !== null ? egfr + " mL/dk/1.73m² (" + (analysis.markers.stage || "") + ")" : "Hesaplanamadı"}.`,
            `Kayıtlı İlaçlar: ${meds}.`,
            `Kayıtlı Takviyeler: ${sups}.`,
            typeof rawTextOrSource === "string" && rawTextOrSource.trim() ? `Ham Tahlil Metni Özeti: ${rawTextOrSource.slice(0, 600)}` : "",
            "Kesin tanı koyma veya ilacı kesme emri verme; hangi ilacın neden hekimle gözden geçirilmesi gerektiğini açıkla."
          ].filter(Boolean).join("\n");

          aiSummary = await window.VitaAIChat.callSelectedAI(prompt);
        }

        if (!aiSummary || !String(aiSummary).trim()) {
          // Deterministik uzman nefroloji/dahiliye NLG sentezi (AI anahtarı olmasa da her zaman çalışır)
          if (cr === null && egfr === null) {
            aiSummary = `Böbrek Güvenliği (Kidney Safety) Ön Değerlendirmesi: Profilinizde kayıtlı ilaçlar (${meds}) incelendi; ancak karşılaştırma için güncel Serum Kreatinin veya eGFR sonucu henüz girilmemiştir. Özellikle böbrek yoluyla atılan ilaçların güvenlik doğrulaması için son biyokimya tahlilinizdeki Kreatinin değerini giriniz.`;
          } else if (analysis.warnings.length > 0) {
            aiSummary = `Böbrek Güvenliği (Kidney Safety) Klinik Sentezi: Ölçülen Serum Kreatinin (${cr !== null ? cr + " mg/dL" : "—"}) ve hesaplanan CKD-EPI 2021 eGFR (${egfr !== null ? egfr + " mL/dk/1.73m², Evre " + (analysis.markers.stage || "—") : "—"}) değerleriniz, profilinizdeki aktif ilaç/takviye kayıtlarıyla (${meds}) çapraz denetlenmiştir. Toplam ${analysis.warnings.length} adet böbrek güvenliği uyarısı (${analysis.warnings.map(w => w.medicationName).join(", ")}) saptanmış olup renal klirens ve doz güvenliği açısından hekim konsültasyonu önerilir.`;
          } else {
            aiSummary = `Böbrek Güvenliği (Kidney Safety) Klinik Sentezi: Serum Kreatinin (${cr !== null ? cr + " mg/dL" : "—"}) ve eGFR (${egfr !== null ? egfr + " mL/dk/1.73m², Evre " + (analysis.markers.stage || "G1") : "—"}) göstergeleriniz referans sınırları içerisinde olup aktif ilaç profilinizle (${meds}) akut bir renal kontrendikasyon saptanmamıştır. Yeterli günlük hidrasyonun sürdürülmesi ve rutin hekim kontrolleri önerilir.`;
          }
        }

        analysis.aiEnhancedNarrative = String(aiSummary).trim();
        if (typeof state !== "undefined") {
          state.lastKidneySafetyAnalysis = analysis;
        }
        renderClinicalKidneySafetyWarningUI(analysis);
        if (typeof showToast === "function") {
          showToast("Böbrek Güvenliği Denetlendi", "Kreatinin/eGFR ve ilaç etkileşimi analizi Klinik Analiz modülüne işlendi.", "info");
        }
      } catch (err) {
        console.warn("AI Kidney Safety analizi hatası:", err);
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles"></i> <span>AI Böbrek & İlaç Taramasını Yenile</span>`;
        }
      }
      return analysis;
    }

    /**
     * Renders the dedicated "Kidney Safety (Böbrek Güvenliği & İlaç Karşılaştırması)"
     * warning card inside the Klinik Analiz module (#cdssKidneySafetyWarningContainer).
     */
    function renderClinicalKidneySafetyWarningUI(analysisInput = null) {
      let container = document.getElementById("cdssKidneySafetyWarningContainer");
      if (!container) {
        const contraEl = document.getElementById("contraindicationAlertContainer");
        if (contraEl && contraEl.parentElement) {
          container = document.createElement("div");
          container.id = "cdssKidneySafetyWarningContainer";
          container.className = "hidden";
          contraEl.parentElement.insertBefore(container, contraEl.nextSibling);
        }
      }
      if (!container) return;

      const analysis = analysisInput || (typeof state !== "undefined" ? state.lastKidneySafetyAnalysis : null) || parseKidneyFunctionAndCompareMedications(null, { renderUI: false });
      const markers = analysis.markers || {};
      const warnings = Array.isArray(analysis.warnings) ? analysis.warnings : [];
      const hasKidneyData = markers.creatinine !== null || markers.effectiveEgfr !== null;
      const hasMedications = Array.isArray(analysis.medicationsChecked) && analysis.medicationsChecked.length > 0;

      if (!hasKidneyData && warnings.length === 0) {
        container.classList.add("hidden");
        container.innerHTML = "";
        return;
      }

      const isCritical = analysis.overallStatus === "critical";
      const isWarning = analysis.overallStatus === "warning";
      const borderTheme = isCritical
        ? "border-rose-400 bg-rose-50/90 text-rose-950"
        : isWarning
          ? "border-amber-400 bg-amber-50/90 text-amber-950"
          : "border-teal-300 bg-teal-50/70 text-slate-900";

      const badgeTheme = isCritical
        ? "bg-rose-600 text-white"
        : isWarning
          ? "bg-amber-600 text-white"
          : "bg-teal-700 text-white";

      const statusLabel = isCritical
        ? "Kritik Böbrek–İlaç Güvenlik Uyarısı"
        : isWarning
          ? "Böbrek Fonksiyonu & İlaç İzlem Uyarısı"
          : warnings.length > 0
            ? "Böbrek Güvenliği Ön Kontrolü"
            : "Böbrek Fonksiyonu & İlaç Uyumu Dengeli";

      container.classList.remove("hidden");
      container.innerHTML = `
        <div class="rounded-2xl border-2 ${borderTheme} p-4 sm:p-5 shadow-sm space-y-3" data-testid="kidney-safety-warning-card">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-200/80 pb-3">
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 rounded-xl ${badgeTheme} flex items-center justify-center text-base font-black shrink-0 shadow-xs">
                <i class="fa-solid fa-kit-medical"></i>
              </div>
              <div>
                <div class="flex flex-wrap items-center gap-1.5">
                  <span class="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded ${badgeTheme}">
                    Kidney Safety • Böbrek Güvenliği Kalkanı
                  </span>
                  ${markers.stage ? `<span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-white border border-slate-300 text-navy-900">CKD-EPI Evre ${escapeHtmlText(markers.stage)}</span>` : ""}
                </div>
                <h4 class="text-xs sm:text-sm font-black text-navy-900 mt-1">
                  ${escapeHtmlText(statusLabel)}
                </h4>
                <p class="text-[11px] text-slate-600 mt-0.5">
                  Kreatinin: <strong>${markers.creatinine !== null ? escapeHtmlText(String(markers.creatinine)) + " mg/dL" : "Girilmedi"}</strong>
                  • GFR / eGFR: <strong>${markers.effectiveEgfr !== null ? escapeHtmlText(String(markers.effectiveEgfr)) + " mL/dk/1.73m²" : "Hesaplanamadı"}</strong>
                  • Denetlenen İlaçlar: <strong>${hasMedications ? escapeHtmlText(analysis.medicationsChecked.join(", ")) : "Kayıtlı kronik ilaç yok"}</strong>
                </p>
              </div>
            </div>
            <button type="button" id="btnRunAiKidneySafetyCheck" onclick="if(window.SoundEffects) SoundEffects.playClick(); runAIKidneyFunctionMedicationParse(null)" class="px-3 py-2 rounded-xl bg-navy-900 hover:bg-slate-800 text-teal-300 font-bold text-[11px] transition flex items-center gap-1.5 cursor-pointer self-start sm:self-center shrink-0">
              <i class="fa-solid fa-wand-magic-sparkles"></i>
              <span>AI Böbrek &amp; İlaç Taramasını Yenile</span>
            </button>
          </div>

          ${analysis.aiEnhancedNarrative ? `
            <div class="p-3 rounded-xl bg-white/90 border border-teal-200 text-xs text-slate-800 leading-relaxed">
              <strong class="text-navy-900 block text-[11px] mb-0.5"><i class="fa-solid fa-robot text-teal-600 mr-1"></i>AI Böbrek Güvenliği Sentezi:</strong>
              ${escapeHtmlText(analysis.aiEnhancedNarrative)}
            </div>
          ` : ""}

          ${warnings.length > 0 ? `
            <div class="space-y-2">
              ${warnings.map(w => `
                <div class="p-3 rounded-xl bg-white border ${w.severity === "critical" ? "border-rose-300" : "border-amber-200"} text-xs space-y-1">
                  <div class="flex flex-wrap items-center justify-between gap-1.5">
                    <strong class="font-black ${w.severity === "critical" ? "text-rose-900" : "text-navy-900"}">${escapeHtmlText(w.title)}</strong>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${w.severity === "critical" ? "bg-rose-100 text-rose-900 border border-rose-300" : "bg-amber-100 text-amber-900 border border-amber-300"}">${escapeHtmlText(w.badge)}</span>
                  </div>
                  <p class="text-[11px] text-slate-700 leading-relaxed">${escapeHtmlText(w.mechanism)}</p>
                  <div class="pt-1 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <span class="font-bold text-teal-800"><i class="fa-solid fa-user-doctor mr-1"></i>${escapeHtmlText(w.recommendation)}</span>
                    <span class="text-[10px] text-slate-400 font-semibold">${escapeHtmlText(w.source)}</span>
                  </div>
                </div>
              `).join("")}
            </div>
          ` : `
            <div class="p-2.5 rounded-xl bg-white/80 border border-teal-200 text-xs text-teal-950 flex items-center gap-2">
              <i class="fa-solid fa-circle-check text-teal-600"></i>
              <span>Mevcut Kreatinin ve eGFR değerlerinizle kayıtlı ilaç profiliniz arasında spesifik bir böbrek güvenliği çakışması saptanmadı.</span>
            </div>
          `}
        </div>
      `;
    }

    window.parseKidneyFunctionMarkersFromSource = parseKidneyFunctionMarkersFromSource;
    window.parseKidneyFunctionAndCompareMedications = parseKidneyFunctionAndCompareMedications;
    window.analyzeKidneyFunctionMedicationSafety = parseKidneyFunctionAndCompareMedications;
    window.runAIKidneyFunctionMedicationParse = runAIKidneyFunctionMedicationParse;
    window.renderClinicalKidneySafetyWarningUI = renderClinicalKidneySafetyWarningUI;

    /* BOYLAMSAL BİYOLOJİK YANIT SÜRESİ KONTROLÜ */