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
        const egfrCrInput = document.getElementById("vitaEgfrCr");
        if (egfrCrInput) egfrCrInput.value = String(state.labValues.creatinine);
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
    }

    /* BOYLAMSAL BİYOLOJİK YANIT SÜRESİ KONTROLÜ */

    