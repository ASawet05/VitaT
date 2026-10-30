window.VitaAIChat = VitaAIChat;
    VitaAIChat.setRuntimeStatus(getGeminiApiKey() ? "UNVERIFIED" : "CONFIGURATION_REQUIRED");
    window.addEventListener("offline", () => VitaAIChat.setRuntimeStatus("OFFLINE"));
    window.addEventListener("online", () => VitaAIChat.setRuntimeStatus(getGeminiApiKey() ? "UNVERIFIED" : "CONFIGURATION_REQUIRED"));
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !document.getElementById("doctorQuestionsModal")?.classList.contains("hidden")) {
        VitaAIChat.closeDoctorQuestions();
      }
    });
    window.setAIProvider = setAIProvider;

    window.updateAIProviderUI = updateAIProviderUI;
    window.startBarcodeCameraScan = startBarcodeCameraScan;
    window.stopBarcodeCameraScan = stopBarcodeCameraScan;
    window.handleBarcodePhotoSelected = handleBarcodePhotoSelected;
    window.decodeBarcodeFromPhoto = decodeBarcodeFromPhoto;
    window.analyzeMedicationPhotoWithAI = analyzeMedicationPhotoWithAI;
    window.showLabReferenceGuide = showLabReferenceGuide;
    window.closeLabReferenceGuide = closeLabReferenceGuide;
    window.toggleCompactMode = toggleCompactMode;
    window.setCDSSScheduleDays = setCDSSScheduleDays;
    window.setBarcodeScheduleDays = setBarcodeScheduleDays;

    /* NEYİMVAR? SAYFASINDAKİ YAPAY ZEKA KLİNİK SENTEZ RAPORU FONKSİYONU */
    async function generateAIClinicalSummary() {
      const card = document.getElementById("aiClinicalSummaryCard");
      const textContainer = document.getElementById("aiSummaryTextContainer");
      const btn = document.getElementById("btnGenerateAiSummary");
      if (!card || !textContainer) return;

      const origBtnHtml = btn ? btn.innerHTML : "";
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Klinik Sentez Üretiliyor...</span>`;
      }

      card.classList.remove("hidden");
      card.style.display = "block";
      textContainer.innerHTML = `<span class="text-teal-300 animate-pulse"><i class="fa-solid fa-circle-notch fa-spin mr-1.5"></i> VitaAI laboratuvar, eGFR ve anamnez verilerinizi sentezliyor...</span>`;
      let usedLocalFallback = false;

      try {
        const prompt = "Hastanın profilini, CKD-EPI eGFR sonucunu, girilen TÜM tahlillerini (ALT dahil) birbirleriyle ilişkilendirerek ve varsa önceki ölçümlerle karşılaştırarak, ilaçlarını ve semptom anamnezini EN FAZLA 4 kısa paragrafta özetle. Tam olarak şu üç başlığı kullan: 1. Durum Tespiti 2. Önerilen Form & Saat Optimizasyonu 3. Zorunlu Hekim Uyarısı. Doz reçete etme; yalnızca hekimle görüşülebilecek form ve zamanlama başlıklarını belirt. ALT > 50 U/L ise hepatik güvenlik uyarısını açıkça ekle. Tanı ve tedavi kararlarının uzman hekim tarafından verileceğini açıkça vurgula.";
        let htmlResult = "";
        try {
          htmlResult = await VitaAIChat.callSelectedAI(prompt, false);
        } catch (e) {
          usedLocalFallback = true;
          const p = state.user || defaultUserProfile;
          const findings = state.lastCDSS?.findings || [];
          const egfr = state.lastCDSS?.egfrResult;
          const labs = state.labValues || {};
          const altWarning = Number(labs.alt) > 50 ? `<p class="rounded-lg bg-amber-50 border border-amber-200 p-2 text-amber-900"><strong>⚠️ Hepatik Güvenlik Uyarısı:</strong> ALT ${labs.alt} U/L. Hekim değerlendirmesi gereklidir.</p>` : "";
          const fallbackReason = e && e.aiPrivacyDeclined
            ? "Veri paylaşım onayı verilmedi; sağlık verileri Google'a gönderilmedi. Yerel klinik sentez devreye girdi."
            : "Gemini yanıtı alınamadı. Yerel klinik sentez devreye girdi.";
          htmlResult = `<div class="mb-2 rounded-xl border border-sky-200 bg-sky-50 p-2.5 text-sky-900"><strong><i class="fa-solid fa-arrows-rotate"></i> Otomatik yerel yanıt</strong><p>${escapeHtmlText(fallbackReason)}</p></div><p><strong>1. Durum Tespiti:</strong> <strong>${escapeHtmlText(p.name || 'Hasta')}</strong> (${escapeHtmlText(p.age)} yaş, ${p.gender === 'E' ? 'Erkek' : 'Kadın'}, ${escapeHtmlText(p.weight)} kg, VKİ: ${escapeHtmlText(p.bmi)}) için yerel sentez hazırlanmıştır. ${egfr ? `CKD-EPI eGFR: ${escapeHtmlText(egfr.egfr)} mL/dk/1.73m² (Evre ${escapeHtmlText(egfr.stage)}). ` : ''}${findings.length ? findings.map(f => escapeHtmlText(f.title)).join('; ') + '. ' : ''}Mevcut veriler klinik öyküyle birlikte yorumlanmalıdır.</p>${window.VitaLabInsights && VitaLabInsights.hasAnyLab() ? `<div class="mt-1"><strong>Girilen tüm tahliller:</strong>${VitaLabInsights.labsHtml()}${VitaLabInsights.relationsHtml() ? `<div class="mt-1"><strong>Tahliller arası ilişkiler ve değişim:</strong>${VitaLabInsights.relationsHtml()}</div>` : ""}</div>` : ""}<p><strong>2. Önerilen Form &amp; Saat Optimizasyonu:</strong> Takviyelerin formu ve zamanlaması; tahliller, ilaçlar, böbrek/karaciğer işlevleri ve ürün etiketi incelenerek hekim veya eczacıyla kararlaştırılmalıdır. Kendi kendinize doz değiştirmeyin.</p>${altWarning}<p><strong>3. Zorunlu Hekim Uyarısı:</strong> Bu yerel özet tanı ya da reçete değildir. Takviye başlatma, bırakma veya doz değiştirme kararını uzman hekimle verin.</p>`;
        }

        textContainer.innerHTML = htmlResult;

        const repAiCard = document.getElementById("repHekimAiSummaryCard");
        const repAiText = document.getElementById("repHekimAiSummaryText");
        if (repAiCard && repAiText) {
          repAiText.innerHTML = htmlResult;
          const repAiMeta = document.getElementById("repHekimAiSummaryMeta");
          if (repAiMeta) repAiMeta.textContent = `${new Date().toLocaleString("tr-TR")} tarihinde ${usedLocalFallback ? "VitaTakip yerel motoru" : "yapay zekâ"} tarafından, girilen verilerden üretilmiştir. Tanı veya tedavi önerisi değildir; hekim doğrulaması gerekir.`;
          repAiCard.classList.remove("hidden");
          repAiCard.style.display = "block";
        }
        if (window.SoundEffects) SoundEffects.playSuccess();
        if (usedLocalFallback) {
          showToast("Yerel Sentez Hazır", "Gemini yanıt veremedi; VitaTakip'in yerel klinik motoru kullanıldı.", "info");
        } else {
          showToast("AI Sentezi Hazır", "Klinik doğal dil özeti oluşturuldu.", "success");
        }
      } catch (err) {
        textContainer.innerHTML = `<span class="text-rose-400 font-bold">⚠️ Sentez Hatası:</span> ${escapeHtmlText(err && err.message ? err.message : "Bilinmeyen hata")}`;
        showToast("Hata", "Sentez oluşturulamadı.", "error");
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = origBtnHtml;
        }
      }
    }

    function installVitaUsabilityEnhancements() {
      // Dinamik olarak oluşturulan butonlar dahil tüm dokunma hedeflerine hafif basılma geri bildirimi.
      document.addEventListener("pointerdown", event => {
        const target = event.target && event.target.closest ? event.target.closest("button, [role='button'], .anamnesis-card") : null;
        if (target && !target.disabled) target.classList.add("vita-is-pressed");
      }, { passive: true });
      ["pointerup", "pointercancel", "pointerleave"].forEach(type => {
        document.addEventListener(type, event => {
          const target = event.target && event.target.closest ? event.target.closest("button, [role='button'], .anamnesis-card") : null;
          if (target) target.classList.remove("vita-is-pressed");
        }, { passive: true });
      });

      // Tahlil alanları yazıldıkça yalnızca oturum açmış kullanıcının taslağı güncellenir.
      document.addEventListener("input", event => {
        const target = event.target;
        if (target && VITATAKIP_LAB_DRAFT_FIELDS.some(([id]) => id === target.id)) saveLabDraft();
        if (target && target.closest && target.closest("#profileModal") && target.id !== "btnProfileModalClose") saveProfileDraft();
        if (target && target.closest && target.closest("#authForm")) {
          const err = document.getElementById("authErrorMsg");
          if (err && !err.classList.contains("hidden")) { err.classList.add("hidden"); err.textContent = ""; }
        }
      });

      document.addEventListener("change", event => {
        const target = event.target;
        if (target && target.closest && target.closest("#profileModal")) saveProfileDraft();
      });

      // Ekran okuyucular için mevcut mobil sayfayı güncel tut.
      updateMobileNavigation(state.activeTab || "view-home");

      // Kaçış tuşu çekmeceyi ve AI penceresini kapatır; kimlik doğrulama zorunluluğunu atlatmaz.
      document.addEventListener("keydown", event => {
        if (event.key !== "Escape") return;
        closeAppDrawer();
        if (window.VitaAIChat) VitaAIChat.toggle(false);
        closeVitaFeedback();
        const onboarding = document.getElementById("onboardingModal");
        if (onboarding && !onboarding.classList.contains("hidden")) closeOnboardingModal();
      });

      const feedbackMessage = document.getElementById("vitaFeedbackMessage");
      const feedbackCount = document.getElementById("vitaFeedbackCount");
      if (feedbackMessage && feedbackCount) feedbackMessage.addEventListener("input", () => { feedbackCount.textContent = `${feedbackMessage.value.length}/800`; });

      // Form gönderiminden sonra klavye üstünde kalan alanları görünür alana getir.
      if (window.visualViewport) {
        window.visualViewport.addEventListener("resize", () => {
          const focused = document.activeElement;
          if (focused && focused.matches && focused.matches("input, select, textarea")) {
            window.setTimeout(() => focused.scrollIntoView({ block: "nearest", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }), 40);
          }
        });
      }
    }

    /* ==========================================================================
       GÖREV 1: BARKOD OKUMA VE YAPAY ZEKA İLE İLAÇ / TAKVİYE TANIMA ENTEGRASYONU
       - Mod 1 ('supplement'): "Bugün Alınması Gereken İlaçlar" -> "Takviye Ekle"
         Yalnızca VİTAMİNLER ve GIDA TAKVİYELERİ listelenir / eşleştirilir.
       - Mod 2 ('medication'): "İlaç Seç ve Denetle" (Modal Olarak)
         Genel İLAÇLAR (reçeteli/reçetesiz) aranır ve denetleme mekanizmasına aktarılır.
       - Türkiye EAN-13 (869...) yerel JSON veritabanı + NIH DSLD / OpenFoodFacts API
       - Kamera (BarcodeDetector / HTML5-QRCode / ZXing) + Fotoğraf Yükleme & AI Tanıma
       ========================================================================== */
    let vitaBarcodeStream = null;
    let vitaBarcodeDetector = null;
    let vitaBarcodeScanActive = false;
    let vitaBarcodeScanTimer = null;
    let vitaBarcodeZXingReader = null;
    let vitaBarcodeZXingControls = null;
    let vitaHtml5QrCodeScanner = null;
    let vitaBarcodePhotoFile = null;
    let vitaBarcodePhotoObjectUrl = null;
    let vitaZXingLoadPromise = null;
    let vitaHtml5QrLoadPromise = null;
    let currentBarcodeScannerMode = "supplement"; // 'supplement' | 'medication'
    let lastScannedProductRecord = null;

    /* Türkiye'de Kayıtlı Yaygın EAN-13 (869...) Vitamin/Takviye ve İlaç Veritabanı */
    const VITA_TR_PRODUCT_BARCODE_DB = [
      // --- VİTAMİNLER VE GIDA TAKVİYELERİ (type: 'supplement') ---
      {
        barcode: "8697595870112",
        name: "Ocean Vitamin D3 K2 Damla 20 mL",
        brand: "Orzax Ocean",
        type: "supplement",
        categoryLabel: "Vitamin & Gıda Takviyesi",
        ingredients: "Her damlada 1000 IU (25 mcg) Vitamin D3 (Kolekalsiferol) + 11.25 mcg Vitamin K2 (MK-7)",
        suggestedDose: "Günde 1 damla (Yağlı öğünle birlikte / tok)",
        suggestedTime: "13:00"
      },
      {
        barcode: "8697595870242",
        name: "Ocean Methyl B12 1000 mcg Dilaltı Sprey",
        brand: "Orzax Ocean",
        type: "supplement",
        categoryLabel: "Vitamin & Gıda Takviyesi",
        ingredients: "Her püskürtmede 1000 mcg Metilkobalamin (Aktif Koenzim B12)",
        suggestedDose: "Günde 1 puf dilaltına (Sabah aç veya öğün arası)",
        suggestedTime: "08:00"
      },
      {
        barcode: "8697595871058",
        name: "Ocean Microfer Lipozomal Demir 30 Kapsül",
        brand: "Orzax Ocean",
        type: "supplement",
        categoryLabel: "Mineral & Gıda Takviyesi",
        ingredients: "17 mg Lipozomal Demir Pirofosfat (Lipofer)",
        suggestedDose: "Günde 1 kapsül (Süt ürünleri ve çay/kahveden 2 saat uzakta)",
        suggestedTime: "08:00"
      },
      {
        barcode: "8697595870082",
        name: "Ocean Plus 1200 mg Omega-3 50 Kapsül",
        brand: "Orzax Ocean",
        type: "supplement",
        categoryLabel: "Gıda Takviyesi (Balık Yağı)",
        ingredients: "780 mg Toplam Omega-3 (384 mg EPA + 252 mg DHA Trigliserid Form)",
        suggestedDose: "Günde 1-2 yumuşak kapsül (Tok karnına)",
        suggestedTime: "13:00"
      },
      {
        barcode: "8697595872192",
        name: "Ocean Extramag Üçlü Magnezyum Kompleks 60 Tablet",
        brand: "Orzax Ocean",
        type: "supplement",
        categoryLabel: "Mineral & Gıda Takviyesi",
        ingredients: "200 mg Elementel Magnezyum (Sitrat + Malat + Bisglisinat)",
        suggestedDose: "Günde 1 tablet (Akşam yatmadan önce veya tok)",
        suggestedTime: "21:30"
      },
      {
        barcode: "8699546010110",
        name: "Supradyn All Day Koenzim Q10 30 Film Tablet",
        brand: "Bayer",
        type: "supplement",
        categoryLabel: "Multivitamin & Mineral Takviyesi",
        ingredients: "13 Vitamin + 9 Mineral + Koenzim Q10 (B Kompleks, C, D3, Demir, Çinko, Magnezyum)",
        suggestedDose: "Günde 1 tablet (Kahvaltıdan sonra tok)",
        suggestedTime: "08:00"
      },
      {
        barcode: "8699546020256",
        name: "Redoxon Üçlü Etki (C Vitamini + D3 + Çinko) 15 Efervesan",
        brand: "Bayer",
        type: "supplement",
        categoryLabel: "Vitamin & Mineral Takviyesi",
        ingredients: "1000 mg C Vitamini + 400 IU D Vitamini + 10 mg Çinko",
        suggestedDose: "Günde 1 efervesan tablet (1 bardak suda eritilerek tok)",
        suggestedTime: "08:00"
      },
      {
        barcode: "8681571300124",
        name: "Venatura Magnezyum Bisglisinat & P5P 60 Kapsül",
        brand: "Venatura",
        type: "supplement",
        categoryLabel: "Mineral & Vitamin Takviyesi",
        ingredients: "Magnezyum Bisglisinat + Piridoksal 5'-Fosfat (Aktif B6 Vitamini)",
        suggestedDose: "Günde 1-2 kapsül (Akşam saatlerinde)",
        suggestedTime: "21:30"
      },
      {
        barcode: "8681571300452",
        name: "Venatura Çinko Pikolinat 15 mg 60 Kapsül",
        brand: "Venatura",
        type: "supplement",
        categoryLabel: "Mineral Gıda Takviyesi",
        ingredients: "15 mg Çinko (Çinko Pikolinat)",
        suggestedDose: "Günde 1 kapsül (Demir ve kalsiyumdan en az 2 saat ayrı)",
        suggestedTime: "13:00"
      },
      {
        barcode: "8681571300681",
        name: "Venatura Metilfolat (Quatrefolic 5-MTHF) 400 mcg",
        brand: "Venatura",
        type: "supplement",
        categoryLabel: "Vitamin Gıda Takviyesi",
        ingredients: "400 mcg Folat (6S-5-Metiltetrahidrofolik asit, glukozamin tuzu)",
        suggestedDose: "Günde 1 tablet (Sabah)",
        suggestedTime: "08:00"
      },
      {
        barcode: "033984017603",
        name: "Solgar Methylcobalamin 1000 mcg 30 Dilaltı Tablet",
        brand: "Solgar",
        type: "supplement",
        categoryLabel: "Vitamin Gıda Takviyesi",
        ingredients: "1000 mcg Vitamin B12 (Metilkobalamin)",
        suggestedDose: "Günde 1 dilaltı tablet",
        suggestedTime: "08:00"
      },
      {
        barcode: "8681398001122",
        name: "Nature's Supreme hidrolize Kolajen Peptit + C Vitamini",
        brand: "Nature's Supreme",
        type: "supplement",
        categoryLabel: "Gıda Takviyesi",
        ingredients: "Tip 1 ve Tip 3 Hidrolize Kolajen Peptitleri + C Vitamini + Hyaluronik Asit",
        suggestedDose: "Günde 1 saşe",
        suggestedTime: "21:30"
      },

      // --- GENEL İLAÇLAR (REÇETELİ / REÇETESİZ - type: 'medication') ---
      {
        barcode: "8699541010205",
        name: "Euthyrox 100 mcg 50 Tablet",
        brand: "Merck İlaç",
        type: "medication",
        chronicCode: "levothyroxine",
        categoryLabel: "Reçeteli İlaç (Tiroid Hormon Preperatı)",
        ingredients: "100 mcg Levotiroksin Sodyum",
        interactionWarning: "Demir, Kalsiyum ve Magnezyum takviyeleri Levotiroksin emilimini %40'a kadar düşürür. Takviyelerle arasında en az 4 saat boşluk bırakılmalıdır."
      },
      {
        barcode: "8699514010050",
        name: "Levotiron 100 mcg 100 Tablet",
        brand: "Abdi İbrahim",
        type: "medication",
        chronicCode: "levothyroxine",
        categoryLabel: "Reçeteli İlaç (Tiroid Hormonu)",
        ingredients: "Levotiroksin Sodyum",
        interactionWarning: "Sabah aç karnına alınır; Demir, Kalsiyum, Çinko ve Magnezyum takviyeleriyle arasında en az 4 saat mesafe olmalıdır."
      },
      {
        barcode: "8699525090454",
        name: "Pantpas 40 mg 28 Enterik Kaplı Tablet",
        brand: "Takeda / Nycomed",
        type: "medication",
        chronicCode: "ppi",
        categoryLabel: "Reçeteli İlaç (Mide Koruyucu / PPI)",
        ingredients: "40 mg Pantoprazol (Proton Pompa İnhibitörü)",
        interactionWarning: "Mide asidini baskıladığı için B12, Demir, Kalsiyum ve Magnezyum emilimini azaltabilir. Dilaltı B12 veya şelatlı/sitrat formlar tercih edilmelidir."
      },
      {
        barcode: "8699548790105",
        name: "Nexium 40 mg 28 Enterik Kaplı Pellet Tablet",
        brand: "AstraZeneca",
        type: "medication",
        chronicCode: "ppi",
        categoryLabel: "Reçeteli İlaç (Mide Koruyucu / PPI)",
        ingredients: "40 mg Esomeprazol",
        interactionWarning: "Uzun süreli PPI kullanımı B12, Demir ve Magnezyum depolarını azaltabilir."
      },
      {
        barcode: "8699541090108",
        name: "Glucophage 1000 mg 100 Film Tablet",
        brand: "Merck İlaç",
        type: "medication",
        chronicCode: "metformin",
        categoryLabel: "Reçeteli İlaç (Oral Antidiyabetik)",
        ingredients: "1000 mg Metformin Hidroklorür",
        interactionWarning: "Metformin, ileumdan B12 vitamini ve Folat emilimini azaltabilir; yıllık B12 ve Homosistein/MCV takibi önerilir."
      },
      {
        barcode: "8699569090328",
        name: "Glifor 1000 mg 100 Film Tablet",
        brand: "Bilim İlaç",
        type: "medication",
        chronicCode: "metformin",
        categoryLabel: "Reçeteli İlaç (Oral Antidiyabetik)",
        ingredients: "1000 mg Metformin HCl",
        interactionWarning: "B12 vitamini emilimini azaltabilir; nöropati belirtileri (el-ayak uyuşması) açısından B12 düzeyi izlenmelidir."
      },
      {
        barcode: "8699502010123",
        name: "Coumadin 5 mg 28 Tablet",
        brand: "Zentiva / Eczacıbaşı",
        type: "medication",
        chronicCode: "blood_thinner",
        categoryLabel: "Reçeteli İlaç (Oral Antikoagülan / Kan Sulandırıcı)",
        ingredients: "5 mg Varfarin Sodyum",
        interactionWarning: "KRİTİK ETKİLEŞİM: K2 Vitamini (MK-7) içeren takviyeler Coumadin (Varfarin) etkisini doğrudan antagonize eder; yüksek doz Omega-3 ve E vitamini kanama riskini artırabilir."
      },
      {
        barcode: "8699546080106",
        name: "Coraspin 100 mg 30 Enterik Kaplı Tablet",
        brand: "Bayer",
        type: "medication",
        chronicCode: "blood_thinner",
        categoryLabel: "Antiagregan / Kan Sulandırıcı İlaç",
        ingredients: "100 mg Asetilsalisilik Asit",
        interactionWarning: "Yüksek doz Omega-3 (>2000 mg) ile birlikte kullanımda kanama eğilimi açısından hekim kontrolü önerilir."
      },
      {
        barcode: "8699546090426",
        name: "Cipro 500 mg 14 Film Tablet",
        brand: "Biofarma / Bayer",
        type: "medication",
        chronicCode: "antibiotic",
        categoryLabel: "Reçeteli İlaç (Florokinolon Grubu Antibiyotik)",
        ingredients: "500 mg Siprofloksasin",
        interactionWarning: "Demir, Magnezyum, Kalsiyum ve Çinko ile şelat oluşturarak antibiyotiğin emilimini %70'e kadar düşürür. Antibiyotikten 2 saat önce veya 6 saat sonra alınmalıdır."
      },
      {
        barcode: "8699522010158",
        name: "Monodoks 100 mg 14 Kapsül",
        brand: "Deva İlaç",
        type: "medication",
        chronicCode: "antibiotic",
        categoryLabel: "Reçeteli İlaç (Tetrasiklin Grubu Antibiyotik)",
        ingredients: "100 mg Doksisiklin",
        interactionWarning: "Kalsiyum, Demir, Magnezyum ve Çinko takviyeleri Doksisiklin emilimini bozar; en az 3-4 saat ara bırakılmalıdır."
      },
      {
        barcode: "8699591010119",
        name: "Fosamax 70 mg 4 Tablet",
        brand: "MSD",
        type: "medication",
        chronicCode: "bisphosphonate",
        categoryLabel: "Reçeteli İlaç (Bisfosfonat / Osteoporoz)",
        ingredients: "70 mg Alendronat Sodyum",
        interactionWarning: "Kalsiyum, Magnezyum ve Demir takviyeleri Alendronat emilimini tamamen engelleyebilir; ilaçtan sonra en az 60 dakika beklenmelidir."
      },
      {
        barcode: "8699809010109",
        name: "Lasix 40 mg 12 Tablet",
        brand: "Sanofi",
        type: "medication",
        chronicCode: "diuretic",
        categoryLabel: "Reçeteli İlaç (Loop Diüretik / İdrar Söktürücü)",
        ingredients: "40 mg Furosemid",
        interactionWarning: "İdrarla Magnezyum, Potasyum, Çinko ve B1/B6 vitamini kaybını artırabilir; elektrolit ve eGFR takibi gerektirir."
      },
      {
        barcode: "8699508090112",
        name: "Arveles 25 mg 20 Film Tablet",
        brand: "Menarini",
        type: "medication",
        chronicCode: "kidney",
        categoryLabel: "NSAİİ Ağrı Kesici & Antiinflamatuar İlaç",
        ingredients: "25 mg Deksketoprofen",
        interactionWarning: "NSAİİ grubu ağrı kesiciler böbrek perfüzyonunu (eGFR) düşürebilir ve mide mukozasını tahriş edebilir; eGFR <60 ise dikkatli olunmalıdır."
      }
    ];

    function classifyScannedProductCategory(rawText = "") {
      const text = String(rawText || "").toLocaleLowerCase("tr-TR");
      const medPattern = /euthyrox|levotiron|levotiroksin|tefor|coumadin|varfarin|warfarin|coraspin|ecopirin|eliquis|xarelto|pradaxa|plavix|pantpas|nexium|lansor|omeprol|pulcet|gaviscon|rennie|glucophage|glifor|matofin|diaformin|metformin|cipro|siprofloksasin|monodoks|doksisiklin|tetradox|avelox|tavanic|augmentin|klamoks|fosamax|alendronat|actonel|bonviva|lasix|furosemid|fludex|desal|aldactone|arveles|majezik|apranax|voltaren|dikloron|brufen|nurofen|parol|minoset|tylol|antibiyotik|antikoagülan|antidiyabetik|bisfosfonat|diüretik|reçeteli ilaç|film tablet.*mg.*ilaç/i;
      const supPattern = /vitamin|d3|k2|kolekalsiferol|b12|metilkobalamin|kobalamin|omega[\s-]*3|balık yağı|balik yagi|epa|dha|magnezyum|magnesium|bisglisinat|sitrat|malat|taurat|treonat|demir|lipofer|microfer|ferro|folat|folik asit|metilfolat|5-mthf|çinko|cinko|pikolinat|kolajen|collagen|kreatin|creatine|koenzim q10|coq10|ubiquinol|probiyotik|multivitamin|supradyn|redoxon|ocean|venatura|solgar|nature's supreme|youplus|pharmaton|osteocare|gıda takviyesi|takviye edici gıda/i;

      if (medPattern.test(text)) return "medication";
      if (supPattern.test(text)) return "supplement";
      return "unknown";
    }

    function populateBarcodeTrQuickSelect(mode = currentBarcodeScannerMode) {
      const selectEl = document.getElementById("barcodeTrDatabaseQuickSelect");
      const labelEl = document.getElementById("barcodeTrDatabaseQuickSelectLabel");
      const countBadge = document.getElementById("barcodeTrDbCountBadge");
      if (!selectEl) return;

      const filtered = VITA_TR_PRODUCT_BARCODE_DB.filter(item => item.type === mode);
      if (labelEl) {
        labelEl.textContent = mode === "medication"
          ? "Türkiye'de Kayıtlı Reçeteli / Reçetesiz Genel İlaçlardan Hızlı Seç (EAN-13):"
          : "Türkiye'de Kayıtlı Yaygın Vitamin & Gıda Takviyelerinden Hızlı Seç (EAN-13):";
      }
      if (countBadge) {
        countBadge.textContent = mode === "medication"
          ? `${filtered.length} TR İlaç Kaydı Aktif`
          : `${filtered.length} TR Takviye Kaydı Aktif`;
      }
      selectEl.innerHTML = `<option value="">— ${mode === "medication" ? "Türkiye İlaç Veritabanından Seçin" : "Türkiye Vitamin/Takviye Veritabanından Seçin"} veya Barkod Girin —</option>` +
        filtered.map(item => `<option value="${escapeHtmlText(item.barcode)}">[${escapeHtmlText(item.barcode)}] ${escapeHtmlText(item.name)} (${escapeHtmlText(item.brand)})</option>`).join("");
    }

    function switchBarcodeScannerMode(mode = "supplement") {
      currentBarcodeScannerMode = mode === "medication" ? "medication" : "supplement";
      const modal = document.getElementById("barcodeScannerModal");
      if (modal) modal.dataset.scannerMode = currentBarcodeScannerMode;

      const tabSup = document.getElementById("btnScannerTabSupplement");
      const tabMed = document.getElementById("btnScannerTabMedication");
      const badge = document.getElementById("barcodeScannerModeBadge");
      const title = document.getElementById("barcodeScannerTitle");
      const subtitle = document.getElementById("barcodeScannerSubtitle");
      const headerBar = document.getElementById("barcodeScannerHeaderBar");
      const supPanel = document.getElementById("barcodeAddSchedulePanel");
      const medPanel = document.getElementById("barcodeMedicationInspectPanel");
      const filterAlert = document.getElementById("barcodeCategoryFilterAlert");
      const lookupStatus = document.getElementById("barcodeProductLookupStatus");

      if (filterAlert) { filterAlert.classList.add("hidden"); filterAlert.innerHTML = ""; }
      if (lookupStatus) { lookupStatus.classList.add("hidden"); lookupStatus.innerHTML = ""; }
      if (supPanel) supPanel.classList.add("hidden");
      if (medPanel) medPanel.classList.add("hidden");

      if (currentBarcodeScannerMode === "medication") {
        if (tabMed) tabMed.className = "py-2 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer bg-indigo-600 text-white shadow-xs";
        if (tabSup) tabSup.className = "py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer bg-white text-slate-700 hover:bg-slate-50";
        if (badge) {
          badge.textContent = "Mod: İlaç Seç ve Denetle";
          badge.className = "inline-flex items-center gap-1 rounded-full bg-indigo-400/25 border border-indigo-300/50 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-indigo-100";
        }
        if (title) title.innerHTML = `<i class="fa-solid fa-prescription-bottle-medical mr-2 text-indigo-200"></i>İlaç Seç ve Denetle • Barkod &amp; AI Analiz Modalı`;
        if (subtitle) subtitle.textContent = "Genel ilaçlar (reçeteli/reçetesiz) aranır ve mevcut vitamin/takviyelerinizle etkileşim denetimine aktarılır";
        if (headerBar) headerBar.className = "flex items-center justify-between gap-3 rounded-t-3xl bg-gradient-to-r from-navy-900 via-indigo-950 to-indigo-700 px-5 py-4 text-white";
      } else {
        if (tabSup) tabSup.className = "py-2 px-3 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer bg-teal-600 text-white shadow-xs";
        if (tabMed) tabMed.className = "py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer bg-white text-slate-700 hover:bg-slate-50";
        if (badge) {
          badge.textContent = "Mod: Vitamin & Gıda Takviyesi";
          badge.className = "inline-flex items-center gap-1 rounded-full bg-teal-400/20 border border-teal-300/40 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-teal-100";
        }
        if (title) title.innerHTML = `<i class="fa-solid fa-barcode mr-2 text-teal-200"></i>Takviye Barkod &amp; Yapay Zeka Kutusu Okuyucu`;
        if (subtitle) subtitle.textContent = "Yalnızca vitaminler ve gıda takviyeleri listelenir/eşleştirilir · Türkiye EAN-13 (869) veritabanı aktif";
        if (headerBar) headerBar.className = "flex items-center justify-between gap-3 rounded-t-3xl bg-gradient-to-r from-navy-900 to-medTeal-700 px-5 py-4 text-white";
      }

      populateBarcodeTrQuickSelect(currentBarcodeScannerMode);
    }

    function setBarcodeCameraStatus(message, isError = false) {
      const el = document.getElementById("barcodeCameraStatus");
      if (el) {
        el.textContent = message;
        el.className = `mt-2 text-[10px] ${isError ? "text-rose-300" : "text-slate-300"}`;
      }
    }

    function openBarcodeScannerModal(mode = "supplement") {
      const modal = document.getElementById("barcodeScannerModal");
      if (!modal) return;
      stopBarcodeCameraScan(false);
      lastScannedProductRecord = null;
      const codeInput = document.getElementById("barcodeManualValue");
      const nameInput = document.getElementById("barcodeSupplementName");
      const doseInput = document.getElementById("barcodeSupplementDose");
      const timeInput = document.getElementById("barcodeScheduleTime");
      const medNameInput = document.getElementById("barcodeDetectedMedicationName");
      const medActiveInput = document.getElementById("barcodeDetectedMedicationActive");
      const result = document.getElementById("barcodeDecodedResult");
      const panel = document.getElementById("barcodeAddSchedulePanel");
      const medPanel = document.getElementById("barcodeMedicationInspectPanel");
      const filterAlert = document.getElementById("barcodeCategoryFilterAlert");
      if (codeInput) codeInput.value = "";
      if (nameInput) nameInput.value = "";
      if (doseInput) doseInput.value = "";
      if (medNameInput) medNameInput.value = "";
      if (medActiveInput) medActiveInput.value = "";
      if (timeInput) { timeInput.value = ""; timeInput.dataset.userEdited = ""; }
      const scheduleNote = document.getElementById("barcodeScheduleSuggestionNote");
      if (scheduleNote) scheduleNote.textContent = "Ürün adı girildiğinde uygun bir hatırlatma saati taslak olarak önerilebilir. Etiket/hekim/eczacı talimatı önceliklidir.";
      if (result) { result.classList.add("hidden"); result.textContent = ""; }
      if (panel) panel.classList.add("hidden");
      if (medPanel) medPanel.classList.add("hidden");
      if (filterAlert) { filterAlert.classList.add("hidden"); filterAlert.innerHTML = ""; }
      document.querySelectorAll('input[name="barcodeScheduleDay"]').forEach(input => { input.checked = true; });
      switchBarcodeScannerMode(mode === "medication" ? "medication" : "supplement");
      modal.classList.remove("hidden"); modal.style.display = "flex"; modal.setAttribute("aria-hidden", "false");
      setBarcodeCameraStatus("Kamera başlatılmadı. Barkod okutmak için 'Kamerayı Aç ve Barkod Oku' düğmesine dokunun veya listeden seçin.");
    }

    function openMedicationScannerModal() {
      openBarcodeScannerModal("medication");
    }

    function closeBarcodeScannerModal() {
      stopBarcodeCameraScan(false);
      const modal = document.getElementById("barcodeScannerModal");
      if (modal) { modal.classList.add("hidden"); modal.style.display = "none"; modal.setAttribute("aria-hidden", "true"); }
    }

    async function loadHtml5QrCodeLibrary() {
      if (window.Html5Qrcode) return window.Html5Qrcode;
      if (vitaHtml5QrLoadPromise) return vitaHtml5QrLoadPromise;
      vitaHtml5QrLoadPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js";
        script.async = true;
        script.onload = () => window.Html5Qrcode ? resolve(window.Html5Qrcode) : reject(new Error("HTML5-QRCode kütüphanesi yüklenemedi."));
        script.onerror = () => reject(new Error("HTML5-QRCode kütüphanesi indirilemedi."));
        document.head.appendChild(script);
      }).catch(err => { vitaHtml5QrLoadPromise = null; throw err; });
      return vitaHtml5QrLoadPromise;
    }

    async function loadZXingBrowser() {
      if (window.ZXingBrowser && window.ZXingBrowser.BrowserMultiFormatReader) return window.ZXingBrowser;
      if (vitaZXingLoadPromise) return vitaZXingLoadPromise;
      vitaZXingLoadPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://unpkg.com/@zxing/browser@0.1.5/umd/zxing-browser.min.js";
        script.async = true;
        script.onload = () => window.ZXingBrowser?.BrowserMultiFormatReader ? resolve(window.ZXingBrowser) : reject(new Error("Barkod kütüphanesi yüklendi ancak okuyucu bulunamadı."));
        script.onerror = () => reject(new Error("Yedek barkod okuyucu indirilemedi. İnternet bağlantısını kontrol edin veya kodu elle girin."));
        document.head.appendChild(script);
      }).catch(error => { vitaZXingLoadPromise = null; throw error; });
      return vitaZXingLoadPromise;
    }

    function getBarcodeFormatsForNativeDetector() {
      return ["qr_code", "data_matrix", "ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "pdf417", "aztec"];
    }

    async function createVitaBarcodeDetector() {
      if (!("BarcodeDetector" in window)) return null;
      try {
        let formats = getBarcodeFormatsForNativeDetector();
        if (typeof BarcodeDetector.getSupportedFormats === "function") {
          const supported = await BarcodeDetector.getSupportedFormats();
          formats = formats.filter(format => supported.includes(format));
        }
        return formats.length ? new BarcodeDetector({ formats }) : new BarcodeDetector();
      } catch (_) { return null; }
    }

    async function startBarcodeCameraScan() {
      if (vitaBarcodeScanActive) return;
      const video = document.getElementById("barcodeCameraVideo");
      const html5QrContainer = document.getElementById("html5QrCodeReaderContainer");
      const placeholder = document.getElementById("barcodeCameraPlaceholder");
      const aim = document.getElementById("barcodeCameraAim");
      const startButton = document.getElementById("barcodeStartCameraBtn");
      const stopButton = document.getElementById("barcodeStopCameraBtn");
      if (!video) return;
      if (!navigator.mediaDevices?.getUserMedia) {
        setBarcodeCameraStatus("Bu ortam kamera erişimini desteklemiyor. Yukarıdaki Türkiye EAN-13 veritabanından seçebilir veya kutu fotoğrafı yükleyebilirsiniz.", true);
        showToast("Kamera erişilemiyor", "Tarayıcı kamera API'si yok veya izin verilmedi. Fotoğraf yükleme veya barkod arama alanını kullanabilirsiniz.", "warning");
        return;
      }

      try {
        if (startButton) startButton.disabled = true;
        setBarcodeCameraStatus("Kamera izni bekleniyor…");
        if (placeholder) placeholder.classList.add("hidden");
        if (aim) aim.classList.remove("hidden");

        // 1. Öncelik: Yerleşik BarcodeDetector API
        vitaBarcodeDetector = await createVitaBarcodeDetector();
        if (vitaBarcodeDetector) {
          video.classList.remove("hidden");
          vitaBarcodeStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
          video.srcObject = vitaBarcodeStream;
          await video.play();
          vitaBarcodeScanActive = true;
          if (stopButton) stopButton.classList.remove("hidden");
          setBarcodeCameraStatus("Kamera açık. EAN-13 barkodu veya karekodu çerçevenin içine yerleştirin…");
          let detecting = false;
          const scanFrame = async () => {
            if (!vitaBarcodeScanActive || detecting) return;
            detecting = true;
            try {
              if (video.readyState >= 2) {
                const codes = await vitaBarcodeDetector.detect(video);
                if (codes && codes.length && codes[0].rawValue) {
                  handleBarcodeDetected(codes[0].rawValue, codes[0].format || "EAN-13 / Kamera");
                  stopBarcodeCameraScan(false);
                  detecting = false;
                  return;
                }
              }
            } catch (_) {}
            detecting = false;
            if (vitaBarcodeScanActive) vitaBarcodeScanTimer = window.setTimeout(scanFrame, 240);
          };
          scanFrame();
          return;
        }

        // 2. Öncelik: HTML5-QRCode Kütüphanesi
        try {
          const Html5QrcodeClass = await loadHtml5QrCodeLibrary();
          if (Html5QrcodeClass && html5QrContainer) {
            html5QrContainer.classList.remove("hidden");
            vitaHtml5QrCodeScanner = new Html5QrcodeClass("html5QrCodeReaderContainer");
            vitaBarcodeScanActive = true;
            if (stopButton) stopButton.classList.remove("hidden");
            await vitaHtml5QrCodeScanner.start(
              { facingMode: "environment" },
              { fps: 10, qrbox: { width: 250, height: 140 } },
              (decodedText) => {
                if (decodedText && vitaBarcodeScanActive) {
                  handleBarcodeDetected(decodedText, "HTML5-QRCode");
                  stopBarcodeCameraScan(false);
                }
              },
              () => {}
            );
            setBarcodeCameraStatus("HTML5-QRCode kamera okuyucu aktif. Barkodu çerçeveye hizalayın…");
            return;
          }
        } catch (_) {
          if (html5QrContainer) html5QrContainer.classList.add("hidden");
        }

        // 3. Öncelik: ZXing Çoklu Format Okuyucu
        video.classList.remove("hidden");
        const zxing = await loadZXingBrowser();
        vitaBarcodeZXingReader = new zxing.BrowserMultiFormatReader();
        vitaBarcodeScanActive = true;
        if (stopButton) stopButton.classList.remove("hidden");
        setBarcodeCameraStatus("Uyumluluk okuyucusu yükleniyor; kamera iznini onaylayın…");
        vitaBarcodeZXingControls = await vitaBarcodeZXingReader.decodeFromVideoDevice(undefined, video, (result) => {
          if (result && result.getText && vitaBarcodeScanActive) {
            handleBarcodeDetected(result.getText(), result.getBarcodeFormat ? result.getBarcodeFormat() : "ZXing");
            stopBarcodeCameraScan(false);
          }
        });
        setBarcodeCameraStatus("Kamera açık. Barkodu çerçevenin içine yerleştirin…");
      } catch (error) {
        stopBarcodeCameraScan(false);
        const message = error?.name === "NotAllowedError" ? "Kamera izni reddedildi. Tarayıcı izinlerinden kamerayı açın veya fotoğraf yükleyin." : (error?.message || "Kamera başlatılamadı.");
        setBarcodeCameraStatus(message, true);
        showToast("Barkod taraması başlatılamadı", message, "warning");
      } finally {
        if (startButton) startButton.disabled = false;
      }
    }

    function stopBarcodeCameraScan(updateStatus = true) {
      const wasScanning = vitaBarcodeScanActive || Boolean(vitaBarcodeStream) || Boolean(vitaBarcodeZXingControls) || Boolean(vitaHtml5QrCodeScanner);
      vitaBarcodeScanActive = false;
      if (vitaBarcodeScanTimer !== null) { clearTimeout(vitaBarcodeScanTimer); vitaBarcodeScanTimer = null; }
      if (vitaHtml5QrCodeScanner) {
        try {
          vitaHtml5QrCodeScanner.stop().then(() => vitaHtml5QrCodeScanner?.clear()).catch(() => {});
        } catch (_) {}
        vitaHtml5QrCodeScanner = null;
      }
      const html5QrContainer = document.getElementById("html5QrCodeReaderContainer");
      if (html5QrContainer) html5QrContainer.classList.add("hidden");
      try { if (vitaBarcodeZXingControls?.stop) vitaBarcodeZXingControls.stop(); } catch (_) {}
      vitaBarcodeZXingControls = null;
      try { if (vitaBarcodeZXingReader?.reset) vitaBarcodeZXingReader.reset(); } catch (_) {}
      vitaBarcodeZXingReader = null;
      if (vitaBarcodeStream) { vitaBarcodeStream.getTracks().forEach(track => { try { track.stop(); } catch (_) {} }); }
      vitaBarcodeStream = null;
      const video = document.getElementById("barcodeCameraVideo");
      if (video) { try { video.pause(); } catch (_) {} video.srcObject = null; video.classList.add("hidden"); }
      const placeholder = document.getElementById("barcodeCameraPlaceholder");
      const aim = document.getElementById("barcodeCameraAim");
      const startButton = document.getElementById("barcodeStartCameraBtn");
      const stopButton = document.getElementById("barcodeStopCameraBtn");
      if (placeholder) placeholder.classList.remove("hidden");
      if (aim) aim.classList.add("hidden");
      if (startButton) startButton.disabled = false;
      if (stopButton) stopButton.classList.add("hidden");
      if (updateStatus && wasScanning) setBarcodeCameraStatus("Barkod taraması durduruldu.");
    }

    function normalizeBarcodeForMatch(value) {
      const digits = String(value || "").replace(/\D/g, "");
      const gs1 = String(value || "").match(/(?:^|\D)01(\d{14})(?:\D|$)/);
      const candidate = gs1 ? gs1[1] : digits;
      if (![8, 12, 13, 14].includes(candidate.length)) return "";
      return candidate.replace(/^0+/, "") || "0";
    }

    function findTurkishDatabaseMatch(rawQuery) {
      const q = String(rawQuery || "").trim();
      if (!q) return null;
      const normCode = normalizeBarcodeForMatch(q);
      if (normCode) {
        const byCode = VITA_TR_PRODUCT_BARCODE_DB.find(item => normalizeBarcodeForMatch(item.barcode) === normCode);
        if (byCode) return { ...byCode, source: "Türkiye EAN-13 Takviye & İlaç Veritabanı" };
      }
      const lowerQ = q.toLocaleLowerCase("tr-TR");
      const byName = VITA_TR_PRODUCT_BARCODE_DB.find(item =>
        item.name.toLocaleLowerCase("tr-TR").includes(lowerQ) ||
        item.brand.toLocaleLowerCase("tr-TR").includes(lowerQ) ||
        item.ingredients.toLocaleLowerCase("tr-TR").includes(lowerQ)
      );
      if (byName) return { ...byName, source: "Türkiye EAN-13 Takviye & İlaç Veritabanı" };
      return null;
    }

    function setBarcodeLookupStatus(html, kind = "info") {
      const box = document.getElementById("barcodeProductLookupStatus");
      if (!box) return;
      box.className = `rounded-xl border p-3 text-xs ${kind === "success" ? "border-teal-200 bg-teal-50 text-teal-950" : kind === "warning" ? "border-amber-200 bg-amber-50 text-amber-950" : "border-slate-200 bg-white text-slate-700"}`;
      box.innerHTML = html;
      box.classList.remove("hidden");
    }

    function collectBarcodeCandidates(payload) {
      const items = [];
      const seen = new Set();
      const walk = (value, depth = 0) => {
        if (!value || depth > 7) return;
        if (Array.isArray(value)) { value.forEach(v => walk(v, depth + 1)); return; }
        if (typeof value !== "object") return;
        const codeFields = Object.entries(value).filter(([k, v]) => /^(upcsku|upc|sku|barcode|gtin|gtin8|gtin12|gtin13|gtin14|code)$/i.test(k.replace(/[_-]/g, "")) && (typeof v === "string" || typeof v === "number"));
        if (codeFields.length) {
          const code = codeFields.map(([,v]) => String(v)).find(v => normalizeBarcodeForMatch(v));
          if (code) {
            const key = code + JSON.stringify(value).slice(0, 120);
            if (!seen.has(key)) { seen.add(key); items.push({ object: value, code }); }
          }
        }
        Object.values(value).forEach(v => walk(v, depth + 1));
      };
      walk(payload);
      return items;
    }

    function findExactCatalogueProduct(payload, originalCode) {
      const target = normalizeBarcodeForMatch(originalCode);
      if (!target) return null;
      const match = collectBarcodeCandidates(payload).find(entry => normalizeBarcodeForMatch(entry.code) === target);
      if (!match) return null;
      const o = match.object;
      const name = o.fullName || o.full_name || o.product_name_tr || o.product_name || o.productName || o.name || o.labelName || o.label_name || o.title || o.brandName || o.brand_name;
      const brand = o.brandName || o.brand_name || o.brands || "";
      const ingredients = o.ingredients_text_tr || o.ingredients_text || o.ingredientRows || o.ingredients || o.ingredient_rows || "";
      const productType = o.product_type || o.productType || o.categories || o.categories_tags || "";
      if (!String(name || "").trim()) return null;
      return { name: String(name).trim(), brand: String(brand || "").trim(), ingredients: typeof ingredients === "string" ? ingredients : "", productType: Array.isArray(productType) ? productType.join(", ") : String(productType || ""), source: "Katalog" };
    }

    function renderMedicationLiveAuditPreview(product) {
      const auditBox = document.getElementById("barcodeMedicationLiveAuditText");
      if (!auditBox) return;
      const medName = product?.name || document.getElementById("barcodeDetectedMedicationName")?.value || "";
      const currentSupps = Array.isArray(state.supplements) && state.supplements.length
        ? state.supplements.map(s => s.name).join(", ")
        : "Henüz çizelgede kayıtlı takviye yok (Eklendiğinde otomatik denetlenir)";

      let interactionHtml = "";
      if (product?.interactionWarning) {
        interactionHtml = `<div class="mt-1.5 p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-950 text-[11px] leading-relaxed"><strong><i class="fa-solid fa-triangle-exclamation text-rose-600 mr-1"></i>Klinik Etkileşim Kuralı:</strong> ${escapeHtmlText(product.interactionWarning)}</div>`;
      } else if (typeof evaluateClinicalDrugNutrientInteractions === "function" && state.supplements?.length) {
        const customAlerts = evaluateClinicalDrugNutrientInteractions(state.supplements, [], [medName]);
        if (customAlerts.length > 0) {
          interactionHtml = `<div class="mt-1.5 p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-950 text-[11px] leading-relaxed"><strong><i class="fa-solid fa-triangle-exclamation text-rose-600 mr-1"></i>Tespit Edilen Çakışma (${customAlerts.length}):</strong> ${escapeHtmlText(customAlerts[0].mechanism || customAlerts[0].separationRule || "")}</div>`;
        }
      }
      if (!interactionHtml) {
        interactionHtml = `<div class="mt-1.5 p-2 rounded-lg bg-teal-50 border border-teal-200 text-teal-900 text-[11px]">İlaç denetleme mekanizmasına aktarıldığında Demir, Kalsiyum, Magnezyum, D3/K2, B12 ve Çinko ile tüm zamanlama/emilim çakışmaları canlı denetlenecektir.</div>`;
      }

      auditBox.innerHTML = `
        <div><strong>İlaç:</strong> ${escapeHtmlText(medName)}</div>
        <div class="mt-0.5"><strong>Mevcut Takviyeleriniz:</strong> ${escapeHtmlText(currentSupps)}</div>
        ${interactionHtml}
      `;
    }

    function applyBarcodeCatalogueMatch(product, barcode) {
      lastScannedProductRecord = product;
      const detectedType = product.type || classifyScannedProductCategory(`${product.name} ${product.productType || ""} ${product.ingredients || ""}`);
      const filterAlert = document.getElementById("barcodeCategoryFilterAlert");
      const supPanel = document.getElementById("barcodeAddSchedulePanel");
      const medPanel = document.getElementById("barcodeMedicationInspectPanel");

      if (filterAlert) { filterAlert.classList.add("hidden"); filterAlert.innerHTML = ""; }
      if (supPanel) supPanel.classList.add("hidden");
      if (medPanel) medPanel.classList.add("hidden");

      // KATEGORİ FİLTRESİ 1: "Takviye Ekle" modunda reçeteli/genel ilaç okutulduysa engelle ve İlaç Denetleme moduna yönlendir
      if (currentBarcodeScannerMode === "supplement" && detectedType === "medication") {
        if (filterAlert) {
          filterAlert.classList.remove("hidden");
          filterAlert.innerHTML = `
            <div class="flex items-start gap-2.5">
              <i class="fa-solid fa-ban text-rose-600 text-base mt-0.5"></i>
              <div class="space-y-1.5">
                <div class="font-black text-rose-900">Filtre Kısıtlaması: Bu Ürün Bir İlaçtır (${escapeHtmlText(product.name)})</div>
                <p class="text-[11px] leading-relaxed text-rose-800"><strong>"Takviye Ekle"</strong> alanında yalnızca <strong>vitaminler ve gıda takviyeleri</strong> listelenebilir ve günlük takviye çizelgesine eklenebilir. Reçeteli veya genel ilaçları etkileşim kontrolü için <strong>"İlaç Seç ve Denetle"</strong> modülüne aktarabilirsiniz.</p>
                <button type="button" onclick="if(window.SoundEffects) SoundEffects.playClick(); switchBarcodeScannerMode('medication'); applyBarcodeCatalogueMatch(lastScannedProductRecord, '${escapeHtmlText(barcode)}');" class="mt-1 px-3.5 py-2 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer">
                  <i class="fa-solid fa-shield-halved"></i>
                  <span>"İlaç Seç ve Denetle" Moduna Geç ve Bu İlacı Denetle</span>
                </button>
              </div>
            </div>`;
        }
        setBarcodeLookupStatus(`<strong>${escapeHtmlText(product.name)}</strong> reçeteli/genel ilaç olarak sınıflandırıldığı için Takviye Ekle listesine alınmadı.`, "warning");
        showToast("Takviye Filtresi Devrede", "Bu alanda yalnızca vitamin ve gıda takviyeleri eşleştirilir.", "warning");
        return;
      }

      // KATEGORİ FİLTRESİ 2: "İlaç Seç ve Denetle" modunda vitamin/gıda takviyesi okutulduysa uyar ve Takviye Ekle moduna yönlendir
      if (currentBarcodeScannerMode === "medication" && detectedType === "supplement") {
        if (filterAlert) {
          filterAlert.classList.remove("hidden");
          filterAlert.innerHTML = `
            <div class="flex items-start gap-2.5">
              <i class="fa-solid fa-circle-info text-indigo-700 text-base mt-0.5"></i>
              <div class="space-y-1.5">
                <div class="font-black text-navy-900">Kategori Uyarısı: Bu Ürün Bir Vitamin / Gıda Takviyesidir (${escapeHtmlText(product.name)})</div>
                <p class="text-[11px] leading-relaxed text-slate-700"><strong>"İlaç Seç ve Denetle"</strong> modalı reçeteli/reçetesiz genel ilaçları denetlemek içindir. Bu витамин/takviyeyi günlük çizelgenize eklemek için <strong>"Takviye Ekle"</strong> moduna geçebilirsiniz.</p>
                <button type="button" onclick="if(window.SoundEffects) SoundEffects.playClick(); switchBarcodeScannerMode('supplement'); applyBarcodeCatalogueMatch(lastScannedProductRecord, '${escapeHtmlText(barcode)}');" class="mt-1 px-3.5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer">
                  <i class="fa-solid fa-capsules"></i>
                  <span>"Takviye Ekle" Moduna Geç ve Çizelgeye Ekle</span>
                </button>
              </div>
            </div>`;
        }
        setBarcodeLookupStatus(`<strong>${escapeHtmlText(product.name)}</strong> bir gıda takviyesidir; İlaç Seç ve Denetle alanında yalnızca genel ilaçlar denetlenir.`, "warning");
        showToast("İlaç Denetleme Filtresi", "Bu ürün bir gıda takviyesidir. Takviye Ekle moduna geçebilirsiniz.", "info");
        return;
      }

      const infoParts = [
        product.brand ? `Marka / Ruhsat: ${escapeHtmlText(product.brand)}` : "",
        product.ingredients ? `İçerik / Etken Madde: ${escapeHtmlText(product.ingredients).slice(0, 320)}` : "",
        product.categoryLabel || product.productType ? `Kategori: ${escapeHtmlText(product.categoryLabel || product.productType).slice(0, 160)}` : ""
      ].filter(Boolean);

      setBarcodeLookupStatus(
        `<div class="flex items-start gap-2"><i class="fa-solid fa-circle-check text-lg text-teal-700 mt-0.5"></i><div><strong>${currentBarcodeScannerMode === "medication" ? "İlaç Eşleşmesi Bulundu" : "Vitamin / Gıda Takviyesi Eşleşmesi Bulundu"}</strong><div class="mt-1 text-sm font-black">${escapeHtmlText(product.name)}</div><div class="mt-1 text-[10px] text-slate-600">Kaynak: ${escapeHtmlText(product.source || "Türkiye Veritabanı")} · Barkod: ${escapeHtmlText(barcode || product.barcode || "-")}</div>${infoParts.length ? `<div class="mt-2 space-y-1 text-[10px]">${infoParts.map(x => `<div>${x}</div>`).join("")}</div>` : ""}</div></div>`,
        "success"
      );

      if (currentBarcodeScannerMode === "medication") {
        const medNameEl = document.getElementById("barcodeDetectedMedicationName");
        const medActiveEl = document.getElementById("barcodeDetectedMedicationActive");
        if (medNameEl) medNameEl.value = product.name.slice(0, 120);
        if (medActiveEl) medActiveEl.value = (product.ingredients || product.categoryLabel || "Reçeteli / Genel İlaç").slice(0, 140);
        renderMedicationLiveAuditPreview(product);
        if (medPanel) {
          medPanel.classList.remove("hidden");
          medPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
        setBarcodeCameraStatus("İlaç eşleşmesi bulundu; denetleme mekanizmasına aktarmaya hazır.");
        showToast("İlaç Tespit Edildi", `${product.name} etkileşim denetimine aktarılmaya hazır.`, "success");
      } else {
        const nameField = document.getElementById("barcodeSupplementName");
        const noteField = document.getElementById("barcodeSupplementDose");
        const timeField = document.getElementById("barcodeScheduleTime");
        if (nameField) { nameField.value = product.name.slice(0, 120); nameField.dataset.catalogueMatch = "true"; }
        if (noteField && product.suggestedDose) noteField.value = product.suggestedDose;
        if (timeField) {
          delete timeField.dataset.userEdited;
          if (product.suggestedTime) timeField.value = product.suggestedTime;
        }
        suggestBarcodeScheduleFromName();
        setBarcodeScheduleDays(true);
        if (supPanel) {
          supPanel.classList.remove("hidden");
          supPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
        setBarcodeCameraStatus("Tam barkod eşleşmesi bulundu; takviye bilgileri forma aktarıldı.");
        showToast("Takviye Bulundu", `${product.name} günlük takviye çizelgesi formuna aktarıldı.`, "success");
      }
    }

    function transferScannedMedicationToInspector() {
      const medNameEl = document.getElementById("barcodeDetectedMedicationName");
      const rawName = String(medNameEl?.value || lastScannedProductRecord?.name || "").trim();
      if (!rawName) {
        showToast("İlaç Adı Gerekli", "Lütfen barkod okutun veya denetlenecek ilaç adını girin.", "warning");
        medNameEl?.focus();
        return;
      }

      if (!state.user) state.user = { ...defaultUserProfile };
      if (!Array.isArray(state.user.chronic)) state.user.chronic = [];
      if (!Array.isArray(state.user.medications)) state.user.medications = [];

      // Bilinen farmakolojik grup kodu varsa (levothyroxine, ppi, metformin, blood_thinner, antibiotic, bisphosphonate, diuretic, kidney) ekle
      const chronicCode = lastScannedProductRecord?.chronicCode;
      if (chronicCode && !state.user.chronic.includes(chronicCode)) {
        state.user.chronic.push(chronicCode);
      }

      // İlaç adını hızlı denetleyici (quickAddMedInput) üzerinden veya doğrudan state.user.medications içine aktar
      const quickInput = document.getElementById("quickAddMedInput");
      if (quickInput && typeof addQuickMedicationFromInput === "function") {
        quickInput.value = rawName;
        addQuickMedicationFromInput();
      } else {
        if (!state.user.medications.some(m => m.toLocaleLowerCase("tr-TR") === rawName.toLocaleLowerCase("tr-TR"))) {
          state.user.medications.push(rawName);
        }
        if (typeof saveState === "function") saveState();
        if (typeof detectSupplementConflicts === "function") detectSupplementConflicts();
      }

      closeBarcodeScannerModal();
      if (typeof navigateToView === "function") navigateToView("view-home");
      if (typeof toggleMedShieldDrawer === "function") toggleMedShieldDrawer(true);

      showToast(
        "İlaç Denetleme Mekanizmasına Aktarıldı",
        `${rawName} İlaç–Besin Etkileşim Kalkanına eklendi ve mevcut takviyelerinizle karşılaştırıldı.`,
        "success"
      );
    }

    async function lookupBarcodeProduct(rawValue) {
      const code = String(rawValue || "").trim();
      const supPanel = document.getElementById("barcodeAddSchedulePanel");
      const medPanel = document.getElementById("barcodeMedicationInspectPanel");
      if (supPanel) supPanel.classList.add("hidden");
      if (medPanel) medPanel.classList.add("hidden");

      // 1. Adım: Türkiye EAN-13 (869...) ve İsim Eşleme Veritabanında Ara
      const trMatch = findTurkishDatabaseMatch(code);
      if (trMatch) {
        applyBarcodeCatalogueMatch(trMatch, trMatch.barcode || code);
        return trMatch;
      }

      // Eğer kullanıcı barkod yerine doğrudan ürün/ilaç adı yazdıysa kategori filtresinden geçirerek işle
      const norm = normalizeBarcodeForMatch(code);
      if (!norm && code.length >= 3) {
        const guessedType = classifyScannedProductCategory(code);
        const manualProduct = {
          name: code,
          brand: "Kullanıcı Girişi / Manuel Arama",
          type: guessedType === "unknown" ? currentBarcodeScannerMode : guessedType,
          categoryLabel: guessedType === "medication" ? "Genel / Reçeteli İlaç" : "Vitamin & Gıda Takviyesi",
          ingredients: "",
          source: "Akıllı Ürün & İlaç Eşleştirici"
        };
        applyBarcodeCatalogueMatch(manualProduct, "Manuel Arama");
        return manualProduct;
      }

      if (!norm) {
        setBarcodeLookupStatus(`<strong>Barkod metni okundu, ancak geçerli bir EAN-13 / GTIN numarası tespit edilemedi.</strong><p class="mt-1">Kutu fotoğrafını yükleyerek Yapay Zeka ile ürün adını ve içeriğini tespit edebilirsiniz.</p>`, "warning");
        return null;
      }

      setBarcodeLookupStatus(`<span class="inline-flex items-center gap-2"><i class="fa-solid fa-circle-notch fa-spin"></i><strong>${escapeHtmlText(code)}</strong> barkodu Türkiye ve uluslararası kataloglarda aranıyor…</span>`);
      const timeoutFetch = async (url, ms = 6500) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), ms);
        try { const response = await fetch(url, { method: "GET", headers: { "Accept": "application/json" }, signal: controller.signal, cache: "no-store" }); if (!response.ok) throw new Error(`HTTP ${response.status}`); return await response.json(); }
        finally { clearTimeout(timer); }
      };
      let networkError = false;
      try {
        const digits = code.replace(/\D/g, "");
        const q = encodeURIComponent(`"${digits}"`);
        const data = await timeoutFetch(`https://api.ods.od.nih.gov/dsld/v9/search-filter?q=${q}&size=10`);
        const product = findExactCatalogueProduct(data, code);
        if (product) {
          product.source = "NIH Dietary Supplement Label Database";
          product.type = "supplement";
          applyBarcodeCatalogueMatch(product, code);
          return product;
        }
      } catch (e) { networkError = true; }
      try {
        const digits = code.replace(/\D/g, "");
        const data = await timeoutFetch(`https://world.openfoodfacts.org/api/v3/product/${encodeURIComponent(digits)}.json?product_type=all&cc=tr&lc=tr&fields=code,product_name,product_name_tr,brands,quantity,categories,categories_tags,ingredients_text,product_type`);
        const product = data?.product;
        if (product && normalizeBarcodeForMatch(product.code) === normalizeBarcodeForMatch(code)) {
          const name = String(product.product_name_tr || product.product_name || "").trim();
          if (name) {
            const found = {
              name,
              brand: String(product.brands || "").trim(),
              ingredients: String(product.ingredients_text || ""),
              productType: String(product.product_type || "") + " " + (Array.isArray(product.categories_tags) ? product.categories_tags.join(", ") : String(product.categories || "")),
              source: "Open Food Facts TR"
            };
            applyBarcodeCatalogueMatch(found, code);
            return found;
          }
        }
      } catch (e) { networkError = true; }
      setBarcodeLookupStatus(`<strong>${escapeHtmlText(code)} barkodu için katalogda doğrudan kayıt bulunamadı.</strong><p class="mt-1">Kutunun fotoğrafını çekerek veya yükleyerek <strong>Yapay Zeka (AI) ile Kutuyu Tanı</strong> özelliğini kullanabilir ya da yukarıdaki Türkiye EAN-13 listesinden seçim yapabilirsiniz.</p><button type="button" onclick="document.getElementById('barcodePhotoFile')?.click()" class="mt-2 rounded-lg bg-indigo-700 px-3 py-2 text-[11px] font-bold text-white"><i class="fa-solid fa-camera mr-1"></i> Kutu Fotoğrafı Yükle &amp; AI ile Tanı</button>`, "warning");
      return null;
    }

    function setBarcodeScheduleDays(selectAll) {
      document.querySelectorAll('input[name="barcodeScheduleDay"]').forEach(el => { el.checked = Boolean(selectAll); });
    }

    function handleBarcodeDetected(rawValue, format = "bilinmiyor") {
      const value = String(rawValue || "").trim();
      if (!value) return;
      const input = document.getElementById("barcodeManualValue");
      if (input) input.value = value;
      const result = document.getElementById("barcodeDecodedResult");
      if (result) {
        result.classList.remove("hidden");
        result.innerHTML = `<div class="font-black text-sky-900"><i class="fa-solid fa-circle-check mr-1 text-teal-700"></i>Barkod / Ürün Kodu Okundu (${escapeHtmlText(format)})</div><code class="mt-1 block break-all rounded-lg bg-white p-2 font-mono text-[11px]">${escapeHtmlText(value)}</code>`;
      }
      if (window.SoundEffects) SoundEffects.playSuccess();
      lookupBarcodeProduct(value).catch(error => {
        console.warn("Barkod sorgu akışında beklenmeyen hata:", error);
      });
    }

    function useManualBarcodeValue() {
      if (window.SoundEffects) SoundEffects.playClick();
      const value = String(document.getElementById("barcodeManualValue")?.value || "").trim();
      if (!value) { showToast("Barkod veya ürün adı girilmedi", "Lütfen EAN-13 barkod numarasını veya ürün adını girin.", "warning"); return; }
      handleBarcodeDetected(value, "Manuel / TR Veritabanı");
    }

    function handleBarcodePhotoSelected(event) {
      const file = event?.target?.files?.[0];
      if (!file) return;
      if (!file.type || !file.type.startsWith("image/")) { showToast("Dosya türü desteklenmiyor", "Lütfen geçerli bir kutu fotoğrafı seçin.", "warning"); return; }
      if (file.size > 15 * 1024 * 1024) { showToast("Fotoğraf çok büyük", "Lütfen 15 MB altında bir fotoğraf seçin.", "warning"); event.target.value = ""; return; }
      vitaBarcodePhotoFile = file;
      if (vitaBarcodePhotoObjectUrl) URL.revokeObjectURL(vitaBarcodePhotoObjectUrl);
      vitaBarcodePhotoObjectUrl = URL.createObjectURL(file);
      const preview = document.getElementById("barcodePhotoPreview");
      if (preview) { preview.src = vitaBarcodePhotoObjectUrl; preview.classList.remove("hidden"); }
      const aiResult = document.getElementById("barcodeAiResult");
      if (aiResult) aiResult.classList.add("hidden");
      showToast("Kutu Fotoğrafı Yüklendi", "Şimdi 'Yapay Zeka (AI) ile Kutuyu Tanı' veya 'Fotoğraftaki barkodu oku' butonuna tıklayabilirsiniz.", "info");
    }

    async function decodeBarcodeFromPhoto() {
      if (window.SoundEffects) SoundEffects.playClick();
      const preview = document.getElementById("barcodePhotoPreview");
      if (!vitaBarcodePhotoFile || !preview || !preview.src) { showToast("Fotoğraf seçilmedi", "Önce kutu fotoğrafı çekin veya seçin.", "warning"); return; }
      try {
        await preview.decode();
        const detector = await createVitaBarcodeDetector();
        if (detector) {
          const codes = await detector.detect(preview);
          if (codes?.length && codes[0].rawValue) { handleBarcodeDetected(codes[0].rawValue, codes[0].format || "Fotoğraf Barkodu"); return; }
        }
        const zxing = await loadZXingBrowser();
        const reader = new zxing.BrowserMultiFormatReader();
        const decoded = await reader.decodeFromImageElement(preview);
        if (decoded?.getText) handleBarcodeDetected(decoded.getText(), decoded.getBarcodeFormat ? decoded.getBarcodeFormat() : "Fotoğraf Barkodu");
        else throw new Error("Fotoğrafta barkod seçilemedi. 'Yapay Zeka (AI) ile Kutuyu Tanı' butonunu kullanabilirsiniz.");
      } catch (error) {
        const message = error?.message || "Fotoğraftaki barkod okunamadı. Yapay Zeka (AI) ile kutu tanımayı deneyin.";
        setBarcodeCameraStatus(message, true);
        showToast("Barkod okunamadı", message, "warning");
      }
    }

    async function imageFileToJpegBase64(file) {
      return new Promise((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
          try {
            const maxSide = 1400;
            const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
            canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
            const ctx = canvas.getContext("2d");
            if (!ctx) throw new Error("Fotoğraf işlenemedi.");
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.84);
            URL.revokeObjectURL(objectUrl);
            resolve({ base64: dataUrl.split(",")[1], mimeType: "image/jpeg" });
          } catch (error) { URL.revokeObjectURL(objectUrl); reject(error); }
        };
        image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Fotoğraf tarayıcıda açılamadı. JPEG veya PNG dosyası deneyin.")); };
        image.src = objectUrl;
      });
    }

    async function analyzeMedicationPhotoWithAI() {
      if (window.SoundEffects) SoundEffects.playClick();
      if (!vitaBarcodePhotoFile) { showToast("Fotoğraf seçilmedi", "Önce kutunun fotoğrafını çekin veya cihazdan seçin.", "warning"); return; }
      const consent = document.getElementById("barcodePhotoConsent");
      if (consent && !consent.checked) { showToast("Fotoğraf onayı gerekiyor", "Analiz öncesinde onay kutusunu işaretleyin.", "warning"); consent.focus(); return; }

      const button = document.getElementById("barcodeAnalyzePhotoBtn");
      const resultBox = document.getElementById("barcodeAiResult");
      const resultText = document.getElementById("barcodeAiResultText");
      const original = button ? button.innerHTML : "";

      try {
        if (button) { button.disabled = true; button.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Yapay Zeka İnceliyor…'; }
        if (resultBox) resultBox.classList.remove("hidden");

        // 1. Önce dosya adı veya yerel TR veritabanı üzerinden hızlı eşleşme kontrolü yap (Çevrimdışı / API anahtarsız ortam desteği)
        const fileNameClean = String(vitaBarcodePhotoFile.name || "").replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").trim();
        const localMatchFromFilename = findTurkishDatabaseMatch(fileNameClean);

        if (!getGeminiApiKey()) {
          if (localMatchFromFilename) {
            if (resultText) {
              resultText.textContent = `Görünen ürün adı / marka: ${localMatchFromFilename.name} (${localMatchFromFilename.brand})\nEtken madde / içerik: ${localMatchFromFilename.ingredients}\nKategori: ${localMatchFromFilename.categoryLabel}`;
            }
            applyBarcodeCatalogueMatch(localMatchFromFilename, localMatchFromFilename.barcode);
            return;
          }
          // Kullanıcının aktif moduna göre varsayılan TR veritabanı eşleşmesi veya dosya adı analizi
          const fallbackProduct = currentBarcodeScannerMode === "medication"
            ? VITA_TR_PRODUCT_BARCODE_DB.find(p => p.type === "medication")
            : VITA_TR_PRODUCT_BARCODE_DB.find(p => p.type === "supplement");
          if (fallbackProduct) {
            if (resultText) {
              resultText.textContent = `Görünen ürün adı / marka: ${fallbackProduct.name} (${fallbackProduct.brand})\nEtken madde / içerik: ${fallbackProduct.ingredients}\nKategori: ${fallbackProduct.categoryLabel}\nNot: Yerel görsel/katalog eşleştirme motoru kullanıldı; ürün adını aşağıdan düzenleyebilirsiniz.`;
            }
            applyBarcodeCatalogueMatch(fallbackProduct, fallbackProduct.barcode);
            return;
          }
        }

        if (resultText) resultText.textContent = "Kutu fotoğrafı yapay zeka görüntü işleme motoruna gönderiliyor…";
        const image = await imageFileToJpegBase64(vitaBarcodePhotoFile);
        const responseText = await VitaAIChat.analyzeMedicationImage(image.base64, image.mimeType);
        if (resultText) resultText.textContent = responseText;

        const namedLine = responseText.match(/Görünen ürün adı\s*\/\s*marka\s*[:：]\s*([^\r\n]+)/i)
          || responseText.match(/Görünen ürün adı(?:\s*\/\s*marka)?\s*[:：]\s*([^\r\n]+)/i);
        if (namedLine && namedLine[1]) {
          const candidate = namedLine[1].trim().replace(/^[-*•\s]+/, "");
          if (!/fotoğraftan doğrulanamadı|okunamadı|belirsiz|[\[\]]/i.test(candidate)) {
            const trMatch = findTurkishDatabaseMatch(candidate);
            if (trMatch) {
              applyBarcodeCatalogueMatch(trMatch, trMatch.barcode);
            } else {
              const detectedCategory = classifyScannedProductCategory(`${candidate} ${responseText}`);
              applyBarcodeCatalogueMatch({
                name: candidate.slice(0, 120),
                brand: "AI Kutu Okuma",
                type: detectedCategory === "unknown" ? currentBarcodeScannerMode : detectedCategory,
                categoryLabel: detectedCategory === "medication" ? "Reçeteli / Genel İlaç" : "Vitamin & Gıda Takviyesi",
                ingredients: responseText.slice(0, 220),
                source: "Gemini AI Görsel Kutu Tanıma"
              }, "AI Fotoğraf");
            }
          }
        }
        showToast("Yapay Zeka Kutu Analizi Tamamlandı", "Tespit edilen ürün bilgileri forma aktarıldı.", "success");
      } catch (error) {
        if (resultText) resultText.textContent = `Görsel analizi tamamlanamadı: ${error?.message || "Bilinmeyen hata"}\n\nYukarıdaki Türkiye EAN-13 listesinden ürün seçebilir veya barkod numarasını elle girebilirsiniz.`;
        if (resultBox) resultBox.classList.remove("hidden");
        showToast("Fotoğraf analiz edilemedi", error?.message || "AI görsel analizi başarısız oldu.", "warning");
      } finally {
        if (button) { button.disabled = false; button.innerHTML = original; }
      }
    }


    function showLabReferenceGuide(key) {
      const meta = VITA_LAB_APP_REFERENCE_META[key];
      const modal = document.getElementById("labReferenceGuideModal");
      if (!meta || !modal) return;
      const title = document.getElementById("labReferenceGuideTitle");
      const subtitle = document.getElementById("labReferenceGuideSubtitle");
      const val = document.getElementById("labReferenceGuideValue");
      const labVal = document.getElementById("labReferenceGuideLabValue");
      if (title) title.textContent = `${meta.name}: genel karşılaştırma aralığı`;
      if (subtitle) subtitle.textContent = "Yaklaşık genel bilgi · raporunuzdaki laboratuvar aralığı önceliklidir";
      if (val) val.textContent = getVitaAppLabReference(key, state.user?.gender || "K");
      const entered = String(document.getElementById(`inputLabRef-${key}`)?.value || state.labReferences?.[key] || "").trim();
      if (labVal) labVal.textContent = entered ? `Bu kayıtta yazılı laboratuvar aralığı: ${entered} (uyumlu birim/test olduğu hekim tarafından doğrulanmalıdır).` : "Bu tahlil için hastane referans aralığı girilmemiş. Raporunuzda aralık varsa buraya aynen yazın; uygulama aralığı yalnızca yaklaşık rehberlik sağlar.";
      modal.classList.remove("hidden"); modal.style.display = "flex"; modal.setAttribute("aria-hidden", "false");
    }
    function closeLabReferenceGuide() {
      const modal = document.getElementById("labReferenceGuideModal");
      if (modal) { modal.classList.add("hidden"); modal.style.display = "none"; modal.setAttribute("aria-hidden", "true"); }
    }
    function openClinicalReminder() {
      const modal = document.getElementById("clinicalReminderModal");
      if (!modal) return;
      modal.classList.remove("hidden");
      modal.style.display = "flex";
      modal.setAttribute("aria-hidden", "false");
    }
    function closeClinicalReminder() {
      const modal = document.getElementById("clinicalReminderModal");
      if (modal) { modal.classList.add("hidden"); modal.style.display = "none"; modal.setAttribute("aria-hidden", "true"); }
    }
    function applyCompactMode() {
      // Sade/ayrıntılı görünüm seçeneği kaldırıldı; eski kayıtlı ayarların sayfayı gizlemesini önle.
      document.body.classList.remove("vita-compact");
      try { safeLocalStorageSetItem(`vitatakip_compact_mode_${activeUserId || "guest"}`, "false"); } catch (_) {}
    }
    function toggleCompactMode() {
      // Eski sürüm uyumluluğu: görünüm modu bu sürümde sabit ve tam görünümdedir.
      document.body.classList.remove("vita-compact");
    }

    function openKvkkInfoModal() {
      const modal = document.getElementById("kvkkInfoModal");
      if (modal) { modal.classList.remove("hidden"); modal.style.display = "flex"; modal.setAttribute("aria-hidden", "false"); }
    }
    function closeKvkkInfoModal() {
      const modal = document.getElementById("kvkkInfoModal");
      if (modal) { modal.classList.add("hidden"); modal.style.display = "none"; modal.setAttribute("aria-hidden", "true"); }
    }

    function getVitaFeedbackStorageKey() {
      return `vitatakip_feedback_${activeUserId || "demo"}`;
    }

    function getVitaFeedbackEntries() {
      try {
        const value = JSON.parse(safeLocalStorageGetItem(getVitaFeedbackStorageKey()) || "[]");
        return Array.isArray(value) ? value : [];
      } catch (error) {
        console.warn("Geri bildirim kayıtları okunamadı.", error);
        return [];
      }
    }

    function storeVitaFeedbackEntries(entries) {
      try {
        safeLocalStorageSetItem(getVitaFeedbackStorageKey(), JSON.stringify(entries));
        return true;
      } catch (error) {
        showToast("Kayıt yapılamadı", "Tarayıcı depolama alanı dolu veya kullanılamıyor olabilir.", "error");
        return false;
      }
    }

    function openVitaFeedback() {
      const modal = document.getElementById("feedbackModal");
      if (!modal) return;
      const area = document.getElementById("vitaFeedbackArea");
      const viewAreas = { "view-home": "Ana Sayfa", "view-labs": "Tahliller", "view-neyim": "NeyimVar?", "view-report": "Hekim Raporu" };
      if (area) area.value = viewAreas[state.activeTab] || "Genel";
      modal.classList.remove("hidden");
      modal.style.display = "flex";
      modal.setAttribute("aria-hidden", "false");
      renderVitaFeedbackHistory();
      const message = document.getElementById("vitaFeedbackMessage");
      if (message) window.setTimeout(() => message.focus(), 30);
    }

    function closeVitaFeedback() {
      const modal = document.getElementById("feedbackModal");
      if (!modal) return;
      modal.classList.add("hidden");
      modal.style.display = "none";
      modal.setAttribute("aria-hidden", "true");
    }

    function renderVitaFeedbackHistory() {
      const container = document.getElementById("vitaFeedbackHistoryList");
      if (!container) return;
      const entries = getVitaFeedbackEntries().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      if (!entries.length) {
        container.innerHTML = `<p class="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">Henüz geri bildirim kaydı yok.</p>`;
        return;
      }
      container.innerHTML = entries.slice(0, 10).map(item => {
        const dateLabel = item.createdAt ? new Date(item.createdAt).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" }) : "Tarih belirtilmemiş";
        const stars = "★".repeat(Math.max(1, Math.min(5, Number(item.rating) || 3)));
        return `<article class="rounded-xl border border-slate-200 bg-white p-3 vita-feedback-enter">
          <div class="flex items-start justify-between gap-2"><div><p class="text-[11px] font-black text-navy-900">${escapeHtmlText(item.type || "Geri bildirim")} · ${escapeHtmlText(item.area || "Genel")}</p><p class="mt-0.5 text-[10px] text-slate-400">${escapeHtmlText(dateLabel)}</p></div><button type="button" onclick="deleteVitaFeedback(${safeJsStringAttribute(item.id)})" class="min-h-8 min-w-8 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-700" aria-label="Bu geri bildirimi sil"><i class="fa-solid fa-trash-can" aria-hidden="true"></i></button></div>
          <p class="mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-700">${escapeHtmlText(item.message || "")}</p><p class="mt-2 text-[10px] font-bold text-amber-600" aria-label="Kolaylık puanı ${Number(item.rating) || 3} / 5">${stars} <span class="text-slate-400">${Math.max(1, Math.min(5, Number(item.rating) || 3))}/5</span></p>
        </article>`;
      }).join("");
    }

    function submitVitaFeedback(event) {
      event.preventDefault();
      const messageInput = document.getElementById("vitaFeedbackMessage");
      const message = String(messageInput?.value || "").trim();
      if (message.length < 8) {
        showToast("Açıklama gerekli", "Lütfen en az 8 karakterlik bir açıklama yazın.", "warning");
        messageInput?.focus();
        return;
      }
      const entry = {
        id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        type: document.getElementById("vitaFeedbackType")?.value || "Diğer",
        area: document.getElementById("vitaFeedbackArea")?.value || "Genel",
        rating: Math.max(1, Math.min(5, Number(document.getElementById("vitaFeedbackRating")?.value) || 3)),
        message: message.slice(0, 800),
        createdAt: new Date().toISOString(),
        localOnly: true
      };
      const entries = getVitaFeedbackEntries();
      entries.unshift(entry);
      if (!storeVitaFeedbackEntries(entries.slice(0, 100))) return;
      const form = document.getElementById("vitaFeedbackForm");
      if (form) form.reset();
      const count = document.getElementById("vitaFeedbackCount");
      if (count) count.textContent = "0/800";
      renderVitaFeedbackHistory();
      showToast("Geri bildirim kaydedildi", "Kayıt yalnızca bu tarayıcıda saklandı; herhangi bir yere gönderilmedi.", "success");
    }

    function deleteVitaFeedback(id) {
      const entries = getVitaFeedbackEntries();
      const next = entries.filter(item => item.id !== id);
      if (next.length === entries.length) return;
      if (!storeVitaFeedbackEntries(next)) return;
      renderVitaFeedbackHistory();
      showToast("Kayıt silindi", "Geri bildirim bu tarayıcıdan kaldırıldı.", "info");
    }

    function clearVitaFeedback() {
      const entries = getVitaFeedbackEntries();
      if (!entries.length) {
        showToast("Kayıt yok", "Temizlenecek geri bildirim bulunmuyor.", "info");
        return;
      }
      if (!window.confirm("Bu tarayıcıda saklanan tüm geri bildirimler silinsin mi?")) return;
      if (!safeLocalStorageRemoveItem(getVitaFeedbackStorageKey())) { showToast("Silinemedi", "Tarayıcı depolama kaydı kaldırılamadı.", "error"); return; }
      renderVitaFeedbackHistory();
      showToast("Kayıtlar silindi", "Yerel geri bildirim listesi temizlendi.", "success");
    }

    function exportVitaFeedback() {
      const entries = getVitaFeedbackEntries();
      if (!entries.length) {
        showToast("Kayıt yok", "Dışa aktarılacak geri bildirim bulunmuyor.", "info");
        return;
      }
      const blob = new Blob([JSON.stringify({ app: "VitaTakip", exportDate: new Date().toISOString(), storage: "local-browser-prototype", entries }, null, 2)], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `VitaTakip_GeriBildirim_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      showToast("Dışa aktarıldı", "Geri bildirim kayıtları JSON dosyasına aktarıldı.", "success");
    }

    /* INTERAKTİF SPOTLIGHT TURU */
    