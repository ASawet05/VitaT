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

    /* Gerçek istemci taraflı barkod çözme ve isteğe bağlı ilaç kutusu fotoğraf analizi. Resmî İTS entegrasyonu değildir. */
    let vitaBarcodeStream = null;
    let vitaBarcodeDetector = null;
    let vitaBarcodeScanActive = false;
    let vitaBarcodeScanTimer = null;
    let vitaBarcodeZXingReader = null;
    let vitaBarcodeZXingControls = null;
    let vitaBarcodePhotoFile = null;
    let vitaBarcodePhotoObjectUrl = null;
    let vitaZXingLoadPromise = null;

    function setBarcodeCameraStatus(message, isError = false) {
      const el = document.getElementById("barcodeCameraStatus");
      if (el) {
        el.textContent = message;
        el.className = `mt-2 text-[10px] ${isError ? "text-rose-300" : "text-slate-300"}`;
      }
    }

    function openBarcodeScannerModal() {
      const modal = document.getElementById("barcodeScannerModal");
      if (!modal) return;
      stopBarcodeCameraScan(false);
      const codeInput = document.getElementById("barcodeManualValue");
      const nameInput = document.getElementById("barcodeSupplementName");
      const doseInput = document.getElementById("barcodeSupplementDose");
      const timeInput = document.getElementById("barcodeScheduleTime");
      const result = document.getElementById("barcodeDecodedResult");
      const panel = document.getElementById("barcodeAddSchedulePanel");
      if (codeInput) codeInput.value = "";
      if (nameInput) nameInput.value = "";
      if (doseInput) doseInput.value = "";
      if (timeInput) { timeInput.value = ""; timeInput.dataset.userEdited = ""; }
      const scheduleNote = document.getElementById("barcodeScheduleSuggestionNote");
      if (scheduleNote) scheduleNote.textContent = "Ürün adı girildiğinde uygun bir hatırlatma saati taslak olarak önerilebilir. Etiket/hekim/eczacı talimatı önceliklidir.";
      if (result) { result.classList.add("hidden"); result.textContent = ""; }
      if (panel) panel.classList.add("hidden");
      document.querySelectorAll('input[name="barcodeScheduleDay"]').forEach(input => { input.checked = false; });
      modal.classList.remove("hidden"); modal.style.display = "flex"; modal.setAttribute("aria-hidden", "false");
      setBarcodeCameraStatus("Kamera başlatılmadı. Tarama için kamera izni vermeniz gerekir.");
    }

    function closeBarcodeScannerModal() {
      stopBarcodeCameraScan(false);
      const modal = document.getElementById("barcodeScannerModal");
      if (modal) { modal.classList.add("hidden"); modal.style.display = "none"; modal.setAttribute("aria-hidden", "true"); }
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
      const placeholder = document.getElementById("barcodeCameraPlaceholder");
      const aim = document.getElementById("barcodeCameraAim");
      const startButton = document.getElementById("barcodeStartCameraBtn");
      const stopButton = document.getElementById("barcodeStopCameraBtn");
      if (!video) return;
      if (!navigator.mediaDevices?.getUserMedia) {
        setBarcodeCameraStatus("Bu ortam kamera erişimini desteklemiyor. HTTPS/localhost üzerinden açın veya fotoğraf/kod seçeneğini kullanın.", true);
        showToast("Kamera erişilemiyor", "Tarayıcı kamera API'si yok veya sayfa güvenli bağlamda değil. HTTPS/localhost kullanın.", "warning");
        return;
      }

      try {
        if (startButton) startButton.disabled = true;
        setBarcodeCameraStatus("Kamera izni bekleniyor…");
        video.classList.remove("hidden");
        if (placeholder) placeholder.classList.add("hidden");
        if (aim) aim.classList.remove("hidden");

        // Önce yerleşik tarayıcı algılayıcısını dene; desteklenmiyorsa ZXing'e geç.
        vitaBarcodeDetector = await createVitaBarcodeDetector();
        if (vitaBarcodeDetector) {
          vitaBarcodeStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
          video.srcObject = vitaBarcodeStream;
          await video.play();
          vitaBarcodeScanActive = true;
          if (stopButton) stopButton.classList.remove("hidden");
          setBarcodeCameraStatus("Kamera açık. Barkodu çerçevenin içine yerleştirin…");
          let detecting = false;
          const scanFrame = async () => {
            if (!vitaBarcodeScanActive || detecting) return;
            detecting = true;
            try {
              if (video.readyState >= 2) {
                const codes = await vitaBarcodeDetector.detect(video);
                if (codes && codes.length && codes[0].rawValue) {
                  handleBarcodeDetected(codes[0].rawValue, codes[0].format || "bilinmiyor");
                  stopBarcodeCameraScan(false);
                  detecting = false;
                  return;
                }
              }
            } catch (_) { /* her karedeki algılama hatası taramayı sonlandırmamalı */ }
            detecting = false;
            if (vitaBarcodeScanActive) vitaBarcodeScanTimer = window.setTimeout(scanFrame, 240);
          };
          scanFrame();
        } else {
          const zxing = await loadZXingBrowser();
          vitaBarcodeZXingReader = new zxing.BrowserMultiFormatReader();
          vitaBarcodeScanActive = true;
          if (stopButton) stopButton.classList.remove("hidden");
          setBarcodeCameraStatus("Uyumluluk okuyucusu yükleniyor; kamera iznini onaylayın…");
          vitaBarcodeZXingControls = await vitaBarcodeZXingReader.decodeFromVideoDevice(undefined, video, (result, error) => {
            if (result && result.getText && vitaBarcodeScanActive) {
              handleBarcodeDetected(result.getText(), result.getBarcodeFormat ? result.getBarcodeFormat() : "ZXing");
              stopBarcodeCameraScan(false);
            }
          });
          setBarcodeCameraStatus("Kamera açık. Barkodu çerçevenin içine yerleştirin…");
        }
      } catch (error) {
        stopBarcodeCameraScan(false);
        const message = error?.name === "NotAllowedError" ? "Kamera izni reddedildi. Tarayıcı izinlerinden kamerayı açın." : (error?.message || "Kamera başlatılamadı.");
        setBarcodeCameraStatus(message, true);
        showToast("Barkod taraması başlatılamadı", message, "warning");
      } finally {
        if (startButton) startButton.disabled = false;
      }
    }

    function stopBarcodeCameraScan(updateStatus = true) {
      const wasScanning = vitaBarcodeScanActive || Boolean(vitaBarcodeStream) || Boolean(vitaBarcodeZXingControls);
      vitaBarcodeScanActive = false;
      if (vitaBarcodeScanTimer !== null) { clearTimeout(vitaBarcodeScanTimer); vitaBarcodeScanTimer = null; }
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
      // GS1 QR'de AI (01) + 14 haneli GTIN yer alabilir. Serbest QR metninden belirsiz kod uydurulmaz.
      const gs1 = String(value || "").match(/(?:^|\D)01(\d{14})(?:\D|$)/);
      const candidate = gs1 ? gs1[1] : digits;
      if (![8, 12, 13, 14].includes(candidate.length)) return "";
      return candidate.replace(/^0+/, "") || "0";
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

    async function lookupBarcodeProduct(rawValue) {
      const code = String(rawValue || "").trim();
      const norm = normalizeBarcodeForMatch(code);
      const panel = document.getElementById("barcodeAddSchedulePanel");
      if (panel) panel.classList.add("hidden");
      const nameField = document.getElementById("barcodeSupplementName");
      if (nameField) nameField.value = "";
      if (!norm) {
        setBarcodeLookupStatus(`<strong>Barkod metni okundu, ama GTIN olarak tanınmadı.</strong><p class="mt-1">Karekod metni ürün numarası dışında bilgi içerebilir. Kutu fotoğrafını Gemini ile inceleyerek görünen ürün adını doldurmayı deneyin.</p>`, "warning");
        return null;
      }
      setBarcodeLookupStatus(`<span class="inline-flex items-center gap-2"><i class="fa-solid fa-circle-notch fa-spin"></i><strong>${escapeHtmlText(code)}</strong> barkodu halka açık ürün kataloglarında aranıyor…</span>`);
      const timeoutFetch = async (url, ms = 6500) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), ms);
        try { const response = await fetch(url, { method: "GET", headers: { "Accept": "application/json" }, signal: controller.signal, cache: "no-store" }); if (!response.ok) throw new Error(`HTTP ${response.status}`); return await response.json(); }
        finally { clearTimeout(timer); }
      };
      let networkError = false;
      // NIH DSLD is supplement-label focused; it is not a Turkish medicine registry.
      try {
        const digits = code.replace(/\D/g, "");
        const q = encodeURIComponent(`"${digits}"`);
        const data = await timeoutFetch(`https://api.ods.od.nih.gov/dsld/v9/search-filter?q=${q}&size=10`);
        const product = findExactCatalogueProduct(data, code);
        if (product) { product.source = "NIH Dietary Supplement Label Database"; applyBarcodeCatalogueMatch(product, code); return product; }
      } catch (e) { networkError = true; console.warn("NIH DSLD barkod sorgusu başarısız/erişilemez:", e?.message || e); }
      // Open Food Facts is crowd-sourced and may include products outside the supplement category. Match only the exact code.
      try {
        const digits = code.replace(/\D/g, "");
        const data = await timeoutFetch(`https://world.openfoodfacts.org/api/v3/product/${encodeURIComponent(digits)}.json?product_type=all&cc=tr&lc=tr&fields=code,product_name,product_name_tr,brands,quantity,categories,categories_tags,ingredients_text,product_type`);
        const product = data?.product;
        if (product && normalizeBarcodeForMatch(product.code) === normalizeBarcodeForMatch(code)) {
          const name = String(product.product_name_tr || product.product_name || "").trim();
          if (name) {
            const found = { name, brand: String(product.brands || "").trim(), ingredients: String(product.ingredients_text || ""), productType: String(product.product_type || "") + " " + (Array.isArray(product.categories_tags) ? product.categories_tags.join(", ") : String(product.categories || "")), source: "Open Food Facts" };
            applyBarcodeCatalogueMatch(found, code); return found;
          }
        }
      } catch (e) { networkError = true; console.warn("Open Food Facts barkod sorgusu başarısız/erişilemez:", e?.message || e); }
      setBarcodeLookupStatus(`<strong>Bu barkod için doğrulanmış bir ürün adı bulunamadı.</strong><p class="mt-1">Bu tek başına ürünün olmadığı anlamına gelmez: açık kataloglar bütün Türkiye ilaçlarını ve takviyelerini kapsamaz. Ürün adını otomatik uydurmadım.</p><p class="mt-1">${networkError ? "Tarayıcı/API erişimi engellenmiş olabilir. HTML dosyası doğrudan açıldıysa katalog erişimi CORS nedeniyle çalışmayabilir; HTTPS/localhost üzerinden deneyin." : "Katalogda tam barkod eşleşmesi bulunamadı."}</p><button type="button" onclick="document.getElementById('barcodePhotoFile')?.click()" class="mt-2 rounded-lg bg-indigo-700 px-3 py-2 text-[11px] font-bold text-white"><i class="fa-solid fa-camera mr-1"></i> Kutu fotoğrafını Gemini ile incele</button>`, "warning");
      return null;
    }

    function applyBarcodeCatalogueMatch(product, barcode) {
      const nameField = document.getElementById("barcodeSupplementName");
      const noteField = document.getElementById("barcodeSupplementDose");
      const timeField = document.getElementById("barcodeScheduleTime");
      if (nameField) { nameField.value = product.name.slice(0, 120); nameField.dataset.catalogueMatch = "true"; }
      if (timeField) delete timeField.dataset.userEdited;
      const infoParts = [product.brand ? `Marka: ${escapeHtmlText(product.brand)}` : "", product.ingredients ? `İçerik/etiket bilgisi: ${escapeHtmlText(product.ingredients).slice(0, 320)}` : "", product.productType ? `Katalog kategorisi: ${escapeHtmlText(product.productType).slice(0, 160)}` : ""].filter(Boolean);
      const typeNote = /medicine|medicinal|drug|pharmaceutical|cream|ointment|topical|ilaç|eczacılık|farmasötik/i.test(`${product.name} ${product.productType}`)
        ? `<p class="mt-1 font-bold text-amber-800">Bu kayıt ilaç/harici ürün olabilir; takviye olarak yorumlamayın. Kullanım sıklığını ve uygulama yolunu prospektüs veya eczacıyla doğrulayın.</p>`
        : `<p class="mt-1">Katalog eşleşmesi yalnızca ürün etiketi adına yardımcı olur; içerik, orijinallik ve size uygunluk kanıtı değildir.</p>`;
      setBarcodeLookupStatus(`<div class="flex items-start gap-2"><i class="fa-solid fa-circle-check text-lg text-teal-700 mt-0.5"></i><div><strong>Ürün eşleşmesi bulundu</strong><div class="mt-1 text-sm font-black">${escapeHtmlText(product.name)}</div><div class="mt-1 text-[10px] text-slate-600">Kaynak: ${escapeHtmlText(product.source)} · Barkod: ${escapeHtmlText(barcode)}</div>${infoParts.length ? `<div class="mt-2 space-y-1 text-[10px]">${infoParts.map(x=>`<div>${x}</div>`).join("")}</div>` : ""}${typeNote}<p class="mt-2">Ürün adı forma aktarıldı. Kayıt etmeden önce kontrol edin, uygun hatırlatma saatini/günlerini seçin ve aşağıdaki düğmeye basın.</p></div></div>`, "success");
      suggestBarcodeScheduleFromName();
      const panel = document.getElementById("barcodeAddSchedulePanel"); if (panel) panel.classList.remove("hidden");
      panel?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      setBarcodeCameraStatus("Tam barkod eşleşmesi bulundu; ürün adı çizelge formuna aktarıldı.");
      showToast("Ürün bulundu", `${product.name} ürün adı forma aktarıldı. Kayıt etmeden önce kontrol edin.`, "success");
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
        result.innerHTML = `<div class="font-black text-sky-900"><i class="fa-solid fa-circle-check mr-1 text-teal-700"></i>Barkod çözüldü (${escapeHtmlText(format)})</div><code class="mt-1 block break-all rounded-lg bg-white p-2 font-mono text-[11px]">${escapeHtmlText(value)}</code><p class="mt-2 text-[10px] leading-relaxed">Şimdi bu kod, açık ürün kataloglarında tam eşleşmeyle aranacak. Eşleşme bulunamazsa kutu fotoğrafını Gemini ile okuyabilirsiniz.</p>`;
      }
      const addPanel = document.getElementById("barcodeAddSchedulePanel"); if (addPanel) addPanel.classList.add("hidden");
      if (window.SoundEffects) SoundEffects.playSuccess();
      lookupBarcodeProduct(value).catch(error => {
        console.warn("Barkod sorgu akışında beklenmeyen hata:", error);
        setBarcodeLookupStatus(`<strong>Ürün kataloğu sorgulanamadı.</strong><p class="mt-1">Ürün adını uydurmadım. Kutu fotoğrafını Gemini ile inceleyebilir veya daha sonra HTTPS/localhost üzerinden yeniden deneyebilirsiniz.</p><button type="button" onclick="document.getElementById('barcodePhotoFile')?.click()" class="mt-2 rounded-lg bg-indigo-700 px-3 py-2 text-[11px] font-bold text-white">Kutu fotoğrafını Gemini ile incele</button>`, "warning");
      });
    }

    function useManualBarcodeValue() {
      if (window.SoundEffects) SoundEffects.playClick();
      const value = String(document.getElementById("barcodeManualValue")?.value || "").trim();
      if (!value) { showToast("Barkod girilmedi", "Lütfen okunan barkod veya karekod metnini girin.", "warning"); return; }
      handleBarcodeDetected(value, "elle girildi");
    }

    function handleBarcodePhotoSelected(event) {
      const file = event?.target?.files?.[0];
      if (!file) return;
      if (!file.type || !file.type.startsWith("image/")) { showToast("Dosya türü desteklenmiyor", "Lütfen bir kutu fotoğrafı seçin.", "warning"); return; }
      if (file.size > 15 * 1024 * 1024) { showToast("Fotoğraf çok büyük", "Lütfen 15 MB altında bir fotoğraf seçin.", "warning"); event.target.value = ""; return; }
      vitaBarcodePhotoFile = file;
      if (vitaBarcodePhotoObjectUrl) URL.revokeObjectURL(vitaBarcodePhotoObjectUrl);
      vitaBarcodePhotoObjectUrl = URL.createObjectURL(file);
      const preview = document.getElementById("barcodePhotoPreview");
      if (preview) { preview.src = vitaBarcodePhotoObjectUrl; preview.classList.remove("hidden"); }
      const addPanel = document.getElementById("barcodeAddSchedulePanel");
      if (addPanel) addPanel.classList.remove("hidden");
      const aiResult = document.getElementById("barcodeAiResult");
      if (aiResult) aiResult.classList.add("hidden");
      const priorLookup = document.getElementById("barcodeProductLookupStatus"); if (priorLookup) priorLookup.classList.add("hidden");
      const priorName = document.getElementById("barcodeSupplementName"); if (priorName) { priorName.value = ""; delete priorName.dataset.catalogueMatch; }
      const priorPanel = document.getElementById("barcodeAddSchedulePanel"); if (priorPanel) priorPanel.classList.add("hidden");
      const consent = document.getElementById("barcodePhotoConsent");
      if (consent) consent.checked = false;
      showToast("Fotoğraf hazır", "Fotoğraf cihazda önizleniyor. AI incelemesi için ayrı paylaşım onayı gerekir.", "info");
    }

    async function decodeBarcodeFromPhoto() {
      if (window.SoundEffects) SoundEffects.playClick();
      const preview = document.getElementById("barcodePhotoPreview");
      if (!vitaBarcodePhotoFile || !preview || !preview.src) { showToast("Fotoğraf seçilmedi", "Önce ilaç kutusu fotoğrafı çekin veya seçin.", "warning"); return; }
      try {
        await preview.decode();
        const detector = await createVitaBarcodeDetector();
        if (detector) {
          const codes = await detector.detect(preview);
          if (codes?.length && codes[0].rawValue) { handleBarcodeDetected(codes[0].rawValue, codes[0].format || "fotoğraf"); return; }
        }
        const zxing = await loadZXingBrowser();
        const reader = new zxing.BrowserMultiFormatReader();
        const decoded = await reader.decodeFromImageElement(preview);
        if (decoded?.getText) handleBarcodeDetected(decoded.getText(), decoded.getBarcodeFormat ? decoded.getBarcodeFormat() : "fotoğraf");
        else throw new Error("Fotoğrafta desteklenen bir barkod bulunamadı. Daha net ve yakın çekim deneyin.");
      } catch (error) {
        const message = error?.message || "Fotoğraftaki barkod okunamadı. Daha net bir fotoğraf deneyin.";
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
      if (!vitaBarcodePhotoFile) { showToast("Fotoğraf seçilmedi", "Önce ilaç kutusunun fotoğrafını çekin veya seçin.", "warning"); return; }
      const consent = document.getElementById("barcodePhotoConsent");
      if (!consent?.checked) { showToast("Fotoğraf onayı gerekiyor", "Fotoğraf Gemini'ye gönderilmeden önce onay kutusunu işaretleyin.", "warning"); consent?.focus(); return; }
      if (!getGeminiApiKey()) { showToast("Gemini API anahtarı yok", "Fotoğrafı AI ile incelemek için sol menüde Gemini API anahtarı tanımlayın. Barkod çözme cihazda çalışabilir.", "warning"); return; }
      const button = document.getElementById("barcodeAnalyzePhotoBtn");
      const resultBox = document.getElementById("barcodeAiResult");
      const resultText = document.getElementById("barcodeAiResultText");
      const original = button ? button.innerHTML : "";
      try {
        if (button) { button.disabled = true; button.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin mr-1"></i> Fotoğraf inceleniyor…'; }
        if (resultBox) resultBox.classList.remove("hidden");
        if (resultText) resultText.textContent = "Fotoğraf küçültülüp Gemini'ye gönderiliyor. Bu istek profil veya tahlil verilerinizi içermez.";
        const image = await imageFileToJpegBase64(vitaBarcodePhotoFile);
        const responseText = await VitaAIChat.analyzeMedicationImage(image.base64, image.mimeType);
        if (resultText) resultText.textContent = responseText;
        const nameField = document.getElementById("barcodeSupplementName");
        const namedLine = responseText.match(/Görünen ürün adı\s*\/\s*marka\s*[:：]\s*([^\r\n]+)/i)
          || responseText.match(/Görünen ürün adı(?:\s*\/\s*marka)?\s*[:：]\s*([^\r\n]+)/i);
        if (nameField && namedLine && namedLine[1]) {
          const candidate = namedLine[1].trim().replace(/^[-*•\s]+/, "");
          if (!/fotoğraftan doğrulanamadı|okunamadı|belirsiz|[\[\]]/i.test(candidate)) {
            nameField.value = candidate.slice(0, 120);
            nameField.dataset.catalogueMatch = "false";
            const time = document.getElementById("barcodeScheduleTime"); if (time) delete time.dataset.userEdited;
            suggestBarcodeScheduleFromName();
            const panel = document.getElementById("barcodeAddSchedulePanel"); if (panel) panel.classList.remove("hidden");
            const resultStatus = document.getElementById("barcodeProductLookupStatus");
            setBarcodeLookupStatus(`<strong>Gemini fotoğraftan ürün adı okudu:</strong><div class="mt-1 text-sm font-black">${escapeHtmlText(candidate)}</div><p class="mt-1">Bu katalog doğrulaması değildir. Lütfen kutuyla karşılaştırın; ürün türü ilaç/harici ürünse takviye olarak işaretlemeyin. Hatırlatma gün ve saatini kendiniz doğrulayın.</p>`, "success");
            panel?.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }
        }
        showToast("Görsel incelemesi tamamlandı", "Okunabilen ürün adı forma aktarıldıysa kontrol edin. Gün ve saat bilgilerini doğrulayıp tek düğmeyle çizelgeye ekleyebilirsiniz.", "success");
      } catch (error) {
        if (resultText) resultText.textContent = `Görsel analizi tamamlanamadı: ${error?.message || "Bilinmeyen hata"}\n\nBarkod metnini elle kullanabilir veya fotoğrafı daha net çekebilirsiniz.`;
        if (resultBox) resultBox.classList.remove("hidden");
        showToast("Fotoğraf analiz edilemedi", error?.message || "Gemini görsel analizi başarısız oldu.", "warning");
      } finally {
        if (button) { button.disabled = false; button.innerHTML = original; }
      }
    }

    // Demo/sample product catalogue removed. The scanner only reads user-supplied real packaging data.

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
    