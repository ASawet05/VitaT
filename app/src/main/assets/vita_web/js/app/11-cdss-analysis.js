function runCDSSAnalysis() {
      const btn = document.getElementById("btnRunCDSS");
      if (btn) btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> <span>Anamnez Triyajı & eGFR Analiz Ediliyor...</span>`;

      setTimeout(() => {
        executeCDSSRules();
        navigateToView("view-clinical-results");
        if (btn) btn.innerHTML = `<i class="fa-solid fa-microchip"></i> <span>Ön değerlendirmeyi başlat</span>`;
        if (window.SoundEffects) SoundEffects.playSuccess();
        showToast("Analiz Tamamlandı", "Bulgular doktor değerlendirme raporu için düzenlendi; otomatik doz veya tedavi kararı verilmedi.", "success");
      }, 300);
    }

    function executeCDSSRules() {
      const p = state.user || defaultUserProfile;
      const weight = p.weight || 68;
      const age = p.age || 28;
      const gender = p.gender || 'K';
      const lifeStage = getLifeStageProfile(age);

      const chronicSelected = Array.isArray(p.chronic) ? [...p.chronic] : [];
      const hasKidneyChronic = chronicSelected.includes("kidney");
      const hasBloodThinner = chronicSelected.includes("blood_thinner");
      const hasPPI = chronicSelected.includes("ppi");
      const hasMetformin = chronicSelected.includes("metformin");
      const hasDiuretic = chronicSelected.includes("diuretic");
      const activity = p.activity || "sedentary";

      // Farklı tarihlerde girilen göstergeler birleştirilir (her gösterge için en güncel ölçüm + kendi referansı).
      // 90 günden eski ölçümler analize sokulmaz; aşağıda "güncel değil" olarak ayrıca listelenir.
      const labCtx = window.VitaLabInsights ? VitaLabInsights.cdssInputs() : null;
      const labs = labCtx ? labCtx.values : (state.labValues || {});
      const effRefs = labCtx ? labCtx.references : (state.labReferences || {});
      const d3 = labs.d3, b12 = labs.b12, ferritin = labs.ferritin, mg = labs.mg, ca = labs.ca, zinc = labs.zinc, creatinine = labs.creatinine, folate = labs.folate, alt = labs.alt, hb = labs.hb, mcv = labs.mcv, crp = labs.crp;

      const findings = [];
      const lifestyleKnown = [p.dietPattern, p.fishPerWeek, p.redMeatPerWeek, p.sunExposureDaily].some(v => v && v !== "unspecified");
      if (lifestyleKnown) {
        const dietLabel = ({ omnivore: "karışık beslenme", vegetarian: "vejetaryen", vegan: "vegan" })[p.dietPattern] || "belirtilmemiş beslenme biçimi";
        const fishLabel = ({ "0": "balık tüketimi yok", "1": "haftada 1 kez balık", "2-3": "haftada 2–3 kez balık", "4+": "haftada 4+ kez balık" })[p.fishPerWeek] || "balık sıklığı belirtilmemiş";
        const meatLabel = ({ "0": "kırmızı et tüketimi yok", "1": "haftada 1 kez kırmızı et", "2-3": "haftada 2–3 kez kırmızı et", "4+": "haftada 4+ kez kırmızı et" })[p.redMeatPerWeek] || "kırmızı et sıklığı belirtilmemiş";
        const sunLabel = ({ lt10: "günde 10 dakikadan az", "10-20": "günde 10–20 dakika", "20-30": "günde 20–30 dakika", gt30: "günde 30 dakikadan fazla" })[p.sunExposureDaily] || "güneşlenme süresi belirtilmemiş";
        findings.push({ title: "Yaşam tarzı ve beslenme", detail: `${dietLabel}; ${fishLabel}; ${meatLabel}; ${sunLabel}.` });
      }
      const contraindications = [];
      const protocol = [];
      const triageLabRequests = [];

      const evalKey = (key, value) => KDSSRuleEngine.evaluate(key, value, gender, effRefs[key] || '');
      const d3EvalResult = evalKey('d3', d3);
      const b12EvalResult = evalKey('b12', b12);
      const ferEvalResult = evalKey('ferritin', ferritin);
      const mgEvalResult = evalKey('mg', mg);
      const caEvalResult = evalKey('ca', ca);
      const znEvalResult = evalKey('zinc', zinc);
      const folEvalResult = evalKey('folate', folate);
      const hbEvalResult = evalKey('hb', hb);
      const mcvEvalResult = evalKey('mcv', mcv);
      const crpEvalResult = evalKey('crp', crp);

      const egfrResult = age >= 18 ? calculateCKDEPI_eGFR(creatinine, age, gender) : null;
      const hasEgfrRisk = egfrResult && (egfrResult.riskLevel === 'high' || egfrResult.riskLevel === 'severe');
      const isPediatric = age < 18;
      const enteredLabKeys = Object.keys(labs).filter(key => labs[key] !== null && labs[key] !== undefined && labs[key] !== "" && Number.isFinite(Number(labs[key])));
      const missingLabReferences = enteredLabKeys.filter(key => {
        const ref = effRefs[key] || "";
        if (window.VitaLabEvidence && VitaLabEvidence.handles(key)) { const parsed = VitaLabEvidence.parseReference(key, ref); return !(parsed && parsed.compatible); }
        return !isVitaLabReferenceCompatible(key, ref) || !parseVitaLabReferenceRange(ref);
      });
      if (missingLabReferences.length) {
        const labLabels = { d3: "D3", b12: "B12", ferritin: "Ferritin", mg: "Magnezyum", ca: "Kalsiyum", zinc: "Çinko", creatinine: "Kreatinin", folate: "Folat", alt: "ALT", hb: "Hemoglobin", mcv: "MCV", crp: "CRP" };
        findings.push({ title: "Referans aralığı kaydı yok", detail: `Laboratuvar aralığı girilmeyen veya birimi doğrulanamayan ölçümler (${missingLabReferences.length}): ${missingLabReferences.map(key => labLabels[key] || key).join(", ")}. Bunlar için genel aralık kullanıldı; takviye adayı yalnızca laboratuvar referansının altında olan veya kaynaklı klinik eşiği karşılayan değerlerde oluşur.` });
      }
      // Durumlar: Referans aralığında / Referans altı / Referans üstü / Sınırda-ek değerlendirme / Değerlendirilemedi / Acil klinik değerlendirme.
      // Referans dışı, klinik eksiklik, takviye gereksinimi ve toksisite ayrı kavramlardır (bkz. docs/LAB_THRESHOLDS.md).
      [["D vitamini", d3, d3EvalResult], ["B12", b12, b12EvalResult], ["Ferritin", ferritin, ferEvalResult], ["Magnezyum", mg, mgEvalResult],
        ["Kalsiyum", ca, caEvalResult], ["Çinko", zinc, znEvalResult], ["Folat", folate, folEvalResult],
        ["Hemoglobin", hb, hbEvalResult], ["MCV", mcv, mcvEvalResult], ["CRP", crp, crpEvalResult]].forEach(([label, value, ev]) => {
        if (value === null || value === undefined || !ev || !ev.status) return;
        const note = ev.notes && ev.notes.length ? ` ${ev.notes.join(" ")}` : "";
        if (ev.status === "urgent") contraindications.push({ title: `⚠️ ${label}: acil klinik değerlendirme gerekli`, detail: `${label} ${value}: ${ev.message}` });
        else if (ev.status === "not_assessable") findings.push({ title: `${label}: değerlendirilemedi`, detail: ev.message + note });
        else if (ev.status !== "in_ref") findings.push({ title: `${label}: ${ev.statusText}`, detail: `${label} ${value}: ${ev.message}${note}` });
      });
      (labCtx?.stale || []).forEach(item => {
        findings.push({ title: `${item.label}: ölçüm güncel değil`, detail: `${item.label} ${item.value} ${item.unit} değeri ${item.ageDays} gün önce (${item.date}) ölçülmüş. 90 günden eski ölçümler takviye adayı üretmek için kullanılmaz; güncel değerlendirme için tekrar ölçüm gerekebilir.` });
      });
      if (labCtx?.multiDate) {
        findings.push({ title: "Farklı tarihli tahliller birlikte değerlendirildi", detail: `Analiz, her gösterge için en güncel ölçümü kullanır: ${labCtx.used.map(u => `${u.label}${u.date ? ` (${u.date})` : ""}`).join(", ")}. Farklı günlerde ölçülen değerler yan yana yorumlanırken zaman farkı göz önünde bulundurulmalıdır.` });
      }

      const hasHeadacheAndTremor = state.selectedSymptoms.has("headache") && state.selectedSymptoms.has("hand_tremor");
      const hasNeurologicSymptom = state.selectedSymptoms.has("hand_tremor") || state.selectedSymptoms.has("headache") || state.selectedSymptoms.has("numbness");
      if (isPediatric) {
        findings.push({ title: "Yaş grubu nedeniyle uzman değerlendirmesi", detail: "18 yaş altı kullanıcılar için yetişkin eGFR denklemi ve yetişkin takviye protokolleri kullanılmadı. Yaşa özgü klinik değerlendirme ve doz kararı çocuk/ergen sağlığı uzmanı tarafından yapılmalıdır." });
      }
      if (hasHeadacheAndTremor) {
        contraindications.push({ title: "Baş ağrısı + el titremesi birlikte bildirildi", detail: "Bu belirti birlikteliği tek başına vitamin eksikliğini göstermez. Başlangıç zamanı, şiddet, ilaçlar ve eşlik eden belirtiler doktor tarafından değerlendirilmelidir. Ani/çok şiddetli baş ağrısı, güçsüzlük, konuşma bozukluğu, bilinç değişikliği veya nöbet varsa acil tıbbi yardım alın." });
      } else if (hasNeurologicSymptom) {
        findings.push({ title: "Nörolojik belirti kaydı", detail: "Belirti tek başına vitamin eksikliği tanısı değildir. Başlangıç, süre, şiddet, ilaçlar ve eşlik eden belirtiler doktor görüşmesinde değerlendirilmelidir. Ani yeni güçsüzlük, konuşma bozukluğu, bilinç değişikliği veya çok şiddetli baş ağrısı varsa acil yardım alın." });
      }

      if (state.selectedSymptoms.has("dark_nail_change")) {
        contraindications.push({
          title: "⚠️ Tırnakta Yeni Koyu Çizgi / Pigmente Lezyon (Dermatoloji Ayırıcı Tanı Uyarısı)",
          detail: "Tırnakta yeni beliren, genişleyen veya tırnak etine yayılan (Hutchinson belirtisi) koyu/kahverengi-siyah çizgi vitamin eksikliği ile açıklanamaz; subungual melanom veya melanositik lezyonların dışlanması için dermatoskopik dermatoloji muayenesi gerektirir."
        });
      }
      if (state.selectedSymptoms.has("balance_difficulty")) {
        contraindications.push({
          title: "⚠️ Denge ve Yürüme Güçlüğü (Ataksi / Nörolojik Değerlendirme Uyarısı)",
          detail: "Yürüme dengesizliği; ağır B12 eksikliğine bağlı omurilik arka kordon etkilenmesi (Subakut Kombine Dejenerasyon), serebellar veya vestibüler nedenlerle ilişkili olabilir. Tek başına vitamin takviyesiyle izlenmemeli; dahiliye/nöroloji muayenesi yapılmalıdır."
        });
      }
      if (state.selectedSymptoms.has("unexplained_swelling")) {
        contraindications.push({
          title: "⚠️ Bacak / Ayak Bileğinde Açıklanamayan Şişlik (Pretibial Ödem Uyarısı)",
          detail: "Alt ekstremite ödemi vitamin eksikliği bulgusu değildir; böbrek fonksiyonu (Kreatinin, eGFR, idrarda protein), karaciğer sentez işlevi (Albümin, ALT), kalp yetmezliği, tiroid veya venöz yetmezlik açısından dahiliye hekimi tarafından değerlendirilmelidir."
        });
      }
      if (state.selectedSymptoms.has("easy_bruising")) {
        contraindications.push({
          title: "⚠️ Kolay Morarma / Ekimoz (Koagülasyon & Trombosit Uyarısı)",
          detail: `Sebepsiz veya hafif travmayla oluşan geniş morluklar${hasBloodThinner ? " (özellikle kan sulandırıcı/antikoagülan kullanımı varlığında)" : ""} C vitamini eksikliğinden önce Tam Kan Sayımı (Trombosit) ve pıhtılaşma testleri (PT/INR, aPTT) ile dahiliye hekimince değerlendirilmelidir.`
        });
      }

      const hasHypercalcemiaRisk = ca !== null && ca !== undefined && (ca > 10.2 || caEvalResult.isHigh);
      if (hasHypercalcemiaRisk) {
        contraindications.push({
          title: `⛔ HİPERKALSEMİ GÜVENLİK KİLİDİ AKTİF (Serum Kalsiyum: ${ca} mg/dL)`,
          detail: "Serum kalsiyum düzeyiniz referans üst sınırının (>10,2 mg/dL) üzerindedir. Hiperkalsemi varlığında D vitamini (25-OH D3 düşük olsa bile) ve Kalsiyum takviyesi kesin kontrendikedir; primer hiperparatiroidizm veya diğer hiperkalsemi nedenleri açısından PTH, fosfor ve albümin ile dahiliye/endokrinoloji değerlendirmesi gerekir."
        });
      }
      const hasKidneyRisk = hasKidneyChronic || (creatinine !== null && creatinine > (gender === 'E' ? 1.25 : 1.10)) || hasEgfrRisk;
      const hasHepaticRisk = (alt !== null && alt !== undefined && alt > 50);

      if (creatinine !== null && egfrResult) {
        findings.push({
          title: `Renal Fonksiyon & CKD-EPI (2021) eGFR: ${egfrResult.egfr} mL/dk/1.73m² (Evre ${egfrResult.stage})`,
          detail: `Serum kreatinin düzeyiniz (${creatinine} mg/dL) ve profil verilerinize göre glomerüler filtrasyon hızınız ${egfrResult.egfr} mL/dk/1.73m² (${egfrResult.desc}) olarak hesaplanmıştır.`
        });
      }

      if (hasHepaticRisk) {
        contraindications.push({
          title: "⚠️ Hepatik Güvenlik Uyarısı (Hekim Kontrolü Gerekli) - ALT > 50 U/L",
          detail: `Serum ALT (Alanin Aminotransferaz) düzeyiniz ${alt} U/L olarak saptanmıştır. Karaciğer metabolik yükünü korumak adına yağda çözünen vitamin (A, D, E, K) yüklemeleri ve yüksek doz takviyeler yalnızca uzman hekim kontrolünde değerlendirilmelidir.`
        });
        findings.push({
          title: `⚠️ Hepatik Güvenlik Uyarısı (Hekim Kontrolü Gerekli): ALT (${alt} U/L)`,
          detail: `ALT enziminiz 50 U/L referans eşiğinin üzerindedir; karaciğerde metabolize olan ve depolanan yağda çözünen vitaminlerin yüksek doz yüklemesinden kaçınılmalı ve gastroenteroloji/dahiliye hekimine danışılmalıdır.`
        });
      }

      if (hasKidneyRisk) {
        contraindications.push({
          title: "⛔ BÖBREK EMNİYET KİLİDİ AKTİF (RENAL RİSK & eGFR FİLTRESİ)",
          detail: "Böbrek hastalığı veya böbrek işleviyle ilgili risk bildirildi. Bu nedenle sistem kreatin/magnezyum/mineral dozu önermez; ürün ve testler doktor tarafından birlikte değerlendirilmelidir."
        });
      }

      if (typeof parseKidneyFunctionAndCompareMedications === "function") {
        const kidneyMedSafety = parseKidneyFunctionAndCompareMedications(
          { creatinine: creatinine, egfr: egfrResult ? egfrResult.egfr : null },
          { triggerSource: "cdss_execute", renderUI: false }
        );
        if (kidneyMedSafety && Array.isArray(kidneyMedSafety.warnings)) {
          kidneyMedSafety.warnings.forEach(w => {
            if (w.severity === "critical" || w.severity === "warning") {
              contraindications.push({
                title: w.title,
                detail: `${w.mechanism} ${w.recommendation}`
              });
            } else {
              findings.push({
                title: w.title,
                detail: `${w.mechanism} ${w.recommendation}`
              });
            }
          });
        }
      }

      if (hasBloodThinner) {
        contraindications.push({
          title: "⚠️ KAN SULANDIRICI (ANTİKOAGÜLAN) GÜVENLİK FİLTRESİ AKTİF",
          detail: "Kan sulandırıcı/antikoagülan kullanımı bildirildi. İlaçlar aynı etkileşime sahip olmadığından ürün adı ve etken madde doktor/eczacı tarafından kontrol edilmelidir; sistem D3/K2 formu veya doz seçmez."
        });
      }

      const isFerritinLow = ferEvalResult.isLow;
      const isB12Low = b12EvalResult.isLow;
      const isFolateLow = folEvalResult.isLow;

      const ironLowish = ferritin !== null && (ferEvalResult.isLow || ferEvalResult.isBorderline);
      const anemia = hb !== null && hbEvalResult.clinical?.level === "low_likely";
      if (anemia) {
        const mcvBelow = mcv !== null && mcvEvalResult.refStatus === "below";
        const mcvAbove = mcv !== null && mcvEvalResult.refStatus === "above";
        if (mcvBelow) findings.push({ title: "Düşük hemoglobin + düşük MCV (mikrositer örüntü)", detail: `${ironLowish ? "Ferritin de düşük/sınırda olduğundan demir eksikliği anemisi olasılığı güçlenir; " : "Ferritin düşük görünmüyor; "}talasemi taşıyıcılığı, kronik hastalık ve kan kaybı da olabilir. Hekim değerlendirmesi gerekir.` });
        else if (mcvAbove) findings.push({ title: "Düşük hemoglobin + yüksek MCV (makrositer örüntü)", detail: "B12 veya folat eksikliği, alkol, karaciğer, tiroid ve bazı ilaçlar akla gelir. Folat takviyesi B12 eksikliğini maskeleyebileceğinden B12 durumu önce hekimle değerlendirilmelidir." });
        else if (mcv !== null) findings.push({ title: "Düşük hemoglobin + normal MCV (normositer örüntü)", detail: `Kronik hastalık, kanama, böbrek hastalığı veya erken/karma eksiklikler akla gelir.${ironLowish ? " Ferritin düşük/sınırda: erken veya karma demir eksikliği olabilir." : ""} Hekim değerlendirmesi gerekir.` });
        else findings.push({ title: "Düşük hemoglobin, MCV girilmemiş", detail: "Kansızlığın türünü ayırt etmek için tam kan sayımındaki MCV değerini de ekleyin; hekim değerlendirmesi gerekir." });
      } else if (ironLowish && hb !== null) {
        findings.push({ title: "Ferritin düşük/sınırda, hemoglobin düşük değil", detail: "Anemi olmadan da demir depoları azalmış olabilir. Belirtiler, adet kanaması, beslenme ve emilimi etkileyen durumlar hekimle gözden geçirilmeli; takviye kararı hekime bırakılmalıdır." });
      } else if (ironLowish && hb === null) {
        findings.push({ title: "Ferritin düşük/sınırda, hemogram girilmemiş", detail: "Ferritin yorumu için hemoglobin ve MCV (tam kan sayımı) gerekir; bu değerler girilmeden demir takviyesi konusunda karar verilmemelidir." });
      }
      if (crp !== null && crpEvalResult.refStatus === "above" && ferritin !== null) {
        findings.push({ title: "CRP yüksek: ferritin yorumu", detail: "CRP yüksekken ferritin enflamasyonla yükselir; WHO bu durumda 70 ng/mL altını demir eksikliği açısından anlamlı sayar. Normal görünen ferritin demir eksikliğini dışlamayabilir." });
      }
      if (isFerritinLow && (isB12Low || isFolateLow)) {
        findings.push({ title: "Demir ile B12/folat birlikte düşük", detail: "Karma eksiklik olasılığı vardır; MCV tek başına yanıltıcı olabilir (normal görünebilir). Hemogram ve gerekirse periferik yayma hekimle konuşulmalıdır." });
      }
      if (b12EvalResult.isBorderline || isB12Low) {
        if (folate !== null && !isFolateLow) findings.push({ title: "B12 düşük/sınırda, folat düşük değil", detail: "Folat yüksek veya normal olduğunda B12 eksikliğinin kansızlık bulgusu maskelenebilir. Folat takviyesine başlamadan önce B12 durumu hekimle değerlendirilmelidir." });
      }
      if ((d3EvalResult.isLow || d3EvalResult.isBorderline) && (mgEvalResult.isLow || mgEvalResult.isBorderline)) {
        findings.push({
          title: "D vitamini ve Magnezyum birlikte düşük (Kofaktör İlişkisi)",
          detail: "D vitamininin karaciğerde 25(OH)D ve böbrekte aktif 1,25(OH)₂D formuna dönüşmesini sağlayan hidroksilaz enzimleri magnezyum bağımlıdır. Magnezyum eksikliği düzeltilmeden verilen D vitamini tedavisinde biyolojik yanıt yetersiz (D vitamini direnci) kalabilir."
        });
      }

      state.selectedSymptoms.forEach(symKey => {
        const meta = ANAMNESIS_DICTIONARY[symKey];
        if (!meta) return;
        let confirmed = false;

        if (meta.nutrients.includes("Demir") && isFerritinLow) {
          findings.push({ title: `Belirti ve ferritin kaydı: ${meta.medicalName}`, detail: `"${meta.question}" bildirimi ve düşük ferritin birlikte kayıtlı; bu veriler neden-sonuç ilişkisini göstermez.` });
          confirmed = true;
        }
        if (meta.nutrients.includes("B12") && isB12Low) {
          findings.push({ title: `Belirti ve B12 kaydı: ${meta.medicalName}`, detail: `"${meta.question}" bildirimi ve B12 sonucu birlikte kayıtlı; bu veriler neden-sonuç ilişkisini göstermez.` });
          confirmed = true;
        }
        if (meta.nutrients.includes("Magnezyum") && mgEvalResult.isLow) {
          findings.push({ title: `Belirti ve magnezyum kaydı: ${meta.medicalName}`, detail: `"${meta.question}" bildirimi ve magnezyum sonucu birlikte kayıtlı; bu veriler neden-sonuç ilişkisini göstermez.` });
          confirmed = true;
        }
        if (meta.nutrients.includes("D3_K2") && d3EvalResult.isLow) {
          findings.push({ title: `Belirti ve D vitamini kaydı: ${meta.medicalName}`, detail: `"${meta.question}" bildirimi ve D vitamini sonucu birlikte kayıtlı; bu veriler neden-sonuç ilişkisini göstermez.` });
          confirmed = true;
        }
        if (meta.nutrients.includes("Çinko") && znEvalResult.isLow) {
          findings.push({ title: `Belirti ve çinko kaydı: ${meta.medicalName}`, detail: `"${meta.question}" bildirimi ve düşük çinko sonucu birlikte kayıtlı; bu veriler neden-sonuç ilişkisini göstermez.` });
          confirmed = true;
        }
        if (!confirmed && meta.suggestedLab && !triageLabRequests.some(r => r.lab === meta.suggestedLab)) {
          triageLabRequests.push({ lab: meta.suggestedLab, medicalName: meta.medicalName });
        }
      });

      const hasD3Anamnesis = state.selectedSymptoms.has("bone_pain") || state.selectedSymptoms.has("muscle_weakness") || state.selectedSymptoms.has("frequent_infection");
      if (d3 !== null && d3EvalResult.isLow && !hasHypercalcemiaRisk) {
        const d3Config = FORM_DOSAGE_CONFIG["D3_K2"];
        const defaultForm = d3Config.defaultForm;
        const formEval = d3Config.forms[defaultForm](weight);

        let d3SafetyBadge = hasBloodThinner ? "⚠️ K2 Çıkarıldı" : "Hekim Onaylı Damla";
        if (hasHepaticRisk) {
          d3SafetyBadge = "⚠️ Hepatik Güvenlik Uyarısı (Hekim Kontrolü Gerekli)";
        }

        protocol.push({
          formKey: "D3_K2",
          name: hasBloodThinner ? "Saf D3 Vitamini (K2'siz Form)" : d3Config.name,
          selectedForm: defaultForm,
          doseText: formEval.doseText,
          timing: formEval.timing,
          instruction: formEval.instruction,
          safety: d3SafetyBadge
        });
      }

      if (isFerritinLow) {
        const ironConfig = FORM_DOSAGE_CONFIG["Demir"];
        const defaultForm = hasPPI ? "Saşe" : ironConfig.defaultForm;
        const formEval = ironConfig.forms[defaultForm](weight);
        protocol.push({
          formKey: "Demir",
          name: ironConfig.name,
          selectedForm: defaultForm,
          doseText: formEval.doseText,
          timing: formEval.timing,
          instruction: formEval.instruction,
          safety: (crp !== null && crp > 10) ? "⚠️ Aktif Enflamasyon / Enfeksiyon Kontrolü Şart" : "Lipozomal Form (Reçeteli)"
        });
      }

      if (isB12Low) {
        const b12Config = FORM_DOSAGE_CONFIG["B12"];
        const defaultForm = (hasPPI || hasMetformin || age >= 50) ? "Dilaltı_Tablet" : b12Config.defaultForm;
        const formEval = b12Config.forms[defaultForm](weight);
        protocol.push({
          formKey: "B12",
          name: b12Config.name,
          selectedForm: defaultForm,
          doseText: formEval.doseText,
          timing: formEval.timing,
          instruction: formEval.instruction,
          safety: "Dilaltı Aktif Form"
        });
      }

      if (isFolateLow) {
        const folConfig = FORM_DOSAGE_CONFIG["Folat"];
        const defaultForm = folConfig.defaultForm;
        const formEval = folConfig.forms[defaultForm](weight);
        protocol.push({
          formKey: "Folat",
          name: folConfig.name,
          selectedForm: defaultForm,
          doseText: formEval.doseText,
          timing: formEval.timing,
          instruction: formEval.instruction,
          safety: "Aktif 5-MTHF"
        });
      }

      if (mgEvalResult.isLow) {
        const mgConfig = FORM_DOSAGE_CONFIG["Magnezyum"];
        const defaultForm = mgConfig.defaultForm;
        const formEval = mgConfig.forms[defaultForm](weight);
        protocol.push({
          formKey: "Magnezyum",
          name: mgConfig.name,
          selectedForm: defaultForm,
          doseText: formEval.doseText,
          timing: formEval.timing,
          instruction: formEval.instruction,
          safety: hasKidneyRisk ? "⛔ Hekim İzni Şart" : "Organik Şelat"
        });
      }

      if (znEvalResult.isLow && FORM_DOSAGE_CONFIG["Çinko"]) {
        const znConfig = FORM_DOSAGE_CONFIG["Çinko"];
        const defaultForm = znConfig.defaultForm;
        const formEval = znConfig.forms[defaultForm](weight);
        protocol.push({
          formKey: "Çinko",
          name: znConfig.name,
          selectedForm: defaultForm,
          doseText: formEval.doseText,
          timing: formEval.timing,
          instruction: formEval.instruction,
          safety: "⚠️ Bakır (Cu) Dengesi Gözetilmeli"
        });
      }

      // The CDSS is a doctor-support report, not a supplement prescription engine.
      // Keep candidate rows for the report, but never generate an automatic dose or start instruction.
      if (isPediatric) protocol.length = 0;
      protocol.forEach(item => {
        item.selectedForm = "Hekimle belirlenir";
        item.doseText = "Otomatik doz belirlenmez";
        item.timing = "Hekim değerlendirmesi";
        const candidateCautions = {
          Demir: "Ferritin tek başına yeterli değildir: hemogram (Hb, MCV), CRP/transferrin satürasyonu ve nedenin (adet kanaması, beslenme, sindirim kaybı) değerlendirilmesi gerekir. Aktif enfeksiyon (yüksek CRP) sırasında demir başlanması ertelenebilir; gereksiz demir mide-bağırsak yan etkilerine ve organ birikimine yol açabilir.",
          B12: "B12 eksikliğinin doğrulanması (ör. MMA, Homosistein) ve nedenin (beslenme, atrofik gastrit/pernisiyöz anemi, PPI veya Metformin kullanımı) belirlenmesi hekim tarafından yapılmalıdır.",
          Magnezyum: "Serum magnezyum vücut depolarını tam yansıtmaz; tek sonuca dayanarak takviye başlanmamalıdır. İlaçlar (mide koruyucu, idrar söktürücü), ishal, alkol ve böbrek işlevi birlikte değerlendirilmelidir; böbrek hastalığında hipermagnezemi riski artar.",
          D3_K2: "Karar 25(OH)D düzeyi, kalsiyum/PTH durumu, magnezyum düzeyi ve ilaçlara göre hekimle verilmelidir; hiperkalsemi varlığında kontrendikedir.",
          Folat: "Folat takviyesinden önce B12 durumu mutlaka değerlendirilmelidir; tek başına folat verilmesi B12 eksikliğinin megaloblastik anemi bulgusunu maskelerken geri dönüşsüz nörolojik hasarı (subakut kombine dejenerasyon) ilerletebilir.",
          Çinko: "Uzun süreli veya yüksek doz (>40 mg/gün) çinko kullanımı bağırsakta metallotiyonein sentezini artırarak bakır (Cu) emilimini bloke eder ve bakır eksikliğine bağlı anemi/nötropeniye yol açabilir."
        };
        item.instruction = "Bu bulgu tek başına takviye ihtiyacını kanıtlamaz; sonucun klinik değerlendirmeyle doğrulanması gerekir. Yaş, tüm ilaçlar/takviyeler, klinik öykü ve laboratuvar raporu birlikte değerlendirilerek karar hekim tarafından verilmelidir." + (candidateCautions[item.formKey] ? " " + candidateCautions[item.formKey] : "");
        item.safety = "Doktorla değerlendirilecek aday";
      });
      if (findings.length === 0) {
        findings.push({
          title: "Girilen verilerde belirgin bir örüntü gösterilemedi",
          detail: "Bu sonuç eksiklik veya hastalık olmadığını kanıtlamaz. Eksik veri, laboratuvar referansı ve belirtiler doktor tarafından birlikte değerlendirilmelidir."
        });
      }

      const latestDate = (state.labHistory && state.labHistory.length > 0) ? state.labHistory[0].date : new Date().toISOString().split('T')[0];
      const recallInfo = calculateRecallDate(latestDate);

      // Besinle destek bölümü için: referansın altındaki tahliller, belirtiyle ilişkili bileşenler ve güvenlik bağlamı
      const lowLabNutrients = [];
      const borderlineLabNutrients = [];
      [["D3_K2", d3EvalResult], ["B12", b12EvalResult], ["Demir", ferEvalResult], ["Folat", folEvalResult], ["Magnezyum", mgEvalResult], ["Kalsiyum", caEvalResult], ["Çinko", znEvalResult]]
        .forEach(([nutrient, ev]) => { if ((ev.isBorderline || ev.status === "below_ref") && !ev.isLow) borderlineLabNutrients.push(nutrient); });
      if (d3EvalResult.isLow) lowLabNutrients.push("D3_K2");
      if (b12EvalResult.isLow) lowLabNutrients.push("B12");
      if (ferEvalResult.isLow) lowLabNutrients.push("Demir");
      if (folEvalResult.isLow) lowLabNutrients.push("Folat");
      if (mgEvalResult.isLow) lowLabNutrients.push("Magnezyum");
      if (caEvalResult.isLow) lowLabNutrients.push("Kalsiyum");
      if (znEvalResult.isLow) lowLabNutrients.push("Çinko");
      const symptomNutrientMap = {};
      state.selectedSymptoms.forEach(symKey => {
        const meta = ANAMNESIS_DICTIONARY[symKey];
        if (!meta || !Array.isArray(meta.nutrients)) return;
        meta.nutrients.forEach(n => { (symptomNutrientMap[n] = symptomNutrientMap[n] || []).push(meta.medicalName); });
      });
      const foodContext = {
        dietPattern: p.dietPattern || "unspecified",
        hasKidneyRisk: !!hasKidneyRisk, hasBloodThinner, hasHepaticRisk: !!hasHepaticRisk, hasPPI, hasMetformin, isPediatric
      };

      state.lastCDSS = {
        lifeStage, weight, bmi: p.bmi, bmiCategory: p.bmiCategory,
        findings, contraindications, protocol, recallInfo, egfrResult, triageLabRequests,
        lowLabNutrients, borderlineLabNutrients, symptomNutrientMap, foodContext,
        staleLabs: labCtx ? labCtx.stale : [], labSources: labCtx ? labCtx.used : [],
        date: new Date().toLocaleDateString("tr-TR")
      };

      saveState();
      renderCDSSResultsUI(false);
      renderTriageLabRecommendations();
      renderReportTab();
    }

    function renderTriageLabRecommendations() {
      const container = document.getElementById("triageLabRecommendationsContainer");
      if (!container) return;
      const triageList = state.lastCDSS?.triageLabRequests || [];
      if (triageList.length === 0) {
        container.classList.add("hidden");
        container.innerHTML = "";
        return;
      }
      container.classList.remove("hidden");
      container.style.display = "block";
      container.innerHTML = `
        <div class="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs space-y-2 shadow-sm">
          <strong class="font-bold flex items-center gap-1.5"><i class="fa-solid fa-clipboard-list text-amber-600"></i> Doktorla görüşmede değerlendirilebilecek test ve incelemeler:</strong>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
            ${triageList.map(t => `<div class="p-2.5 bg-white rounded-xl border border-amber-200"><strong>${t.lab}</strong> <span class="text-slate-500">(${t.medicalName})</span></div>`).join('')}
          </div>
        </div>
      `;
    }

    function renderCDSSResultsUI(isSilent = false) {
      ensureCDSSResultsView();
      const container = document.getElementById("cdssResultContainer");
      if (!container || !state.lastCDSS) return;

      container.classList.remove("hidden");
      container.style.display = "block";

      const lifeCard = document.getElementById("lifeStageCard");
      if (lifeCard) {
        const egfr = state.lastCDSS.egfrResult;
        lifeCard.innerHTML = `
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span class="text-[10px] font-black uppercase text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">${escapeHtmlText(state.lastCDSS.lifeStage?.stage || 'G1')}</span>
              <h3 class="text-sm sm:text-base font-black text-navy-900 mt-1">Klinik Evre, VKİ (${escapeHtmlText(state.lastCDSS.bmi || '-')}) & Renal eGFR Analizi</h3>
              <p class="text-xs text-slate-500 mt-0.5">${escapeHtmlText(state.lastCDSS.lifeStage?.desc || '')}</p>
            </div>
            ${egfr && egfr.badgeHtml ? egfr.badgeHtml : '<span class="text-xs text-slate-400 font-semibold">eGFR (Kreatinin) Girilmedi</span>'}
          </div>
        `;
      }

      const contraContainer = document.getElementById("contraindicationAlertContainer");
      if (contraContainer) {
        const contras = state.lastCDSS.contraindications || [];
        if (contras.length > 0) {
          contraContainer.classList.remove("hidden");
          contraContainer.innerHTML = `
            <div class="p-4 rounded-2xl bg-rose-50 border-2 border-rose-400 text-rose-950 text-xs space-y-2 shadow-sm">
              ${contras.map(c => `
                <div>
                  <strong class="font-black text-rose-900 block">${escapeHtmlText(c.title)}</strong>
                  <p class="text-[11px] text-rose-800 mt-0.5 leading-relaxed">${escapeHtmlText(c.detail)}</p>
                </div>
              `).join('')}
            </div>
          `;
        } else {
          contraContainer.classList.add("hidden");
          contraContainer.innerHTML = "";
        }
      }

      if (typeof renderClinicalKidneySafetyWarningUI === "function") {
        renderClinicalKidneySafetyWarningUI(state.lastKidneySafetyAnalysis || null);
      }

      const recallContainer = document.getElementById("cdssRecallContainer");
      if (recallContainer && state.lastCDSS.recallInfo) {
        const r = state.lastCDSS.recallInfo;
        recallContainer.classList.remove("hidden");
        recallContainer.innerHTML = `
          <details class="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <summary class="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 text-xs font-bold text-slate-700">
              <span class="flex items-center gap-2"><i class="fa-solid ${r.icon} text-teal-700"></i>Hatırlatma tarihi: <strong class="text-teal-800">${escapeHtmlText(r.dateFormatted)}</strong></span>
              <span class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-amber-300 bg-amber-50 text-xs font-black text-amber-800" aria-label="Hatırlatma tarihi uyarısını aç" title="Hatırlatma tarihi açıklaması">!</span>
            </summary>
            <p class="px-4 pb-3 text-[11px] leading-relaxed text-slate-500">Bu tarih yalnızca uygulama içi hatırlatma amaçlıdır; tekrar tahlil zamanı bu hesapla belirlenmez. Doktorunuzun önerdiği kontrol tarihini esas alın.</p>
          </details>
        `;
      }

      const findingsList = document.getElementById("findingsList");
      const findingsBadge = document.getElementById("findingsCountBadge");
      if (findingsList && state.lastCDSS.findings) {
        findingsList.innerHTML = state.lastCDSS.findings.map((f, index) => `
          <div class="p-3 bg-white rounded-xl border border-slate-200 text-xs">
            <div class="flex items-start gap-2">
              <span class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600 text-[10px] font-black">${index + 1}</span>
              <div class="min-w-0 flex-1">
                <strong class="font-bold text-navy-900 block leading-relaxed">${escapeHtmlText(f.title)}</strong>
                <details class="mt-1.5">
                  <summary class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-bold text-teal-800 bg-teal-50 hover:bg-teal-100">Açıklamayı göster <i class="fa-solid fa-chevron-down text-[9px]"></i></summary>
                  <p class="text-slate-600 mt-2 leading-relaxed">${escapeHtmlText(f.detail)}</p>
                </details>
              </div>
            </div>
          </div>
        `).join('');
      }
      if (findingsBadge && state.lastCDSS.findings) {
        findingsBadge.textContent = `${state.lastCDSS.findings.length} bulgu`;
      }

      const tbody = document.getElementById("protocolTableBody");
      if (tbody && state.lastCDSS.protocol) {
        if (state.lastCDSS.protocol.length === 0) {
          tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400 italic">Bu analiz otomatik takviye gereksinimi belirlemez; bulgular doktorla değerlendirilmelidir.</td></tr>`;
        } else {
          tbody.innerHTML = state.lastCDSS.protocol.map(p => {
            const isWarn = (p.safety || "").includes("⚠️") || (p.safety || "").includes("⛔");
            const protocolIndex = state.lastCDSS.protocol.indexOf(p);
            const formConfig = FORM_DOSAGE_CONFIG[p.formKey];
            const availableForms = formConfig ? Object.keys(formConfig.forms) : [];
            const formOptionsHtml = availableForms.length
              ? `<div class="relative mt-1.5">
                  <select class="form-selector min-h-10 w-full appearance-none rounded-xl border border-teal-200 bg-gradient-to-br from-white to-teal-50 px-3 py-2 pr-9 text-xs font-black text-teal-950 shadow-sm transition hover:border-teal-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100"
                    aria-label="${escapeHtmlText(p.name)} için farmasötik form"
                    onchange="if(window.SoundEffects) SoundEffects.playClick(); changeCDSSProtocolForm(${protocolIndex}, this.value)">
                    ${availableForms.map(form => `<option value="${escapeHtmlText(form)}" ${p.selectedForm === form ? "selected" : ""}>${escapeHtmlText(form.replace(/_/g, " "))}</option>`).join("")}
                  </select>
                  <i aria-hidden="true" class="fa-solid fa-chevron-down pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-teal-700"></i>
                </div>
                <span class="mt-1 block text-[9px] text-slate-500">Hekim/eczacı ve ürün etiketiyle doğrulayın.</span>`
              : `<span class="text-[10px] text-slate-500">Hekimle belirlenir</span>`;
            return `
              <tr class="hover:bg-slate-50">
                <td class="py-2.5 px-3 font-bold text-navy-900">${escapeHtmlText(p.name)}</td>
                <td class="py-2.5 px-3">${formOptionsHtml}</td>
                <td class="py-2.5 px-3"><span class="px-2 py-0.5 rounded text-[10px] font-bold border ${isWarn ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-teal-50 text-teal-800 border-teal-200'}">${escapeHtmlText(p.safety)}</span></td>
                <td class="py-2.5 px-3"><label class="inline-flex items-center gap-1.5 cursor-pointer"><input type="checkbox" class="cdssProtocolSelect h-4 w-4 rounded border-slate-300 text-teal-600" data-index="${protocolIndex}" aria-label="${escapeHtmlText(p.name)} seç"><span class="text-[10px] font-bold">Seç</span></label></td>
              </tr>
            `;
          }).join('');
        }
      }

      if (typeof renderFoodAlternatives === "function") renderFoodAlternatives();

      if (!isSilent) container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function changeCDSSProtocolForm(index, form) {
      const candidate = state.lastCDSS?.protocol?.[Number(index)];
      const config = candidate && FORM_DOSAGE_CONFIG[candidate.formKey];
      if (!candidate || !config || !Object.prototype.hasOwnProperty.call(config.forms, form)) {
        showToast("Form seçilemedi", "Bu bileşen için geçerli bir farmasötik form bulunamadı.", "warning");
        return;
      }
      candidate.selectedForm = form;
      saveState();
      renderCDSSResultsUI(true);
      renderReportTab();
      showToast("Form tercihi güncellendi", "Bu tercih yalnızca hekimle görüşmek içindir; doz veya kullanım talimatı oluşturulmadı.", "info");
    }

    function copyAiSummaryToClipboard() {
      const text = document.getElementById("aiSummaryTextContainer")?.innerText;
      if (text) {
        navigator.clipboard.writeText(text);
        showToast("Kopyalandı", "Sentez panoya kopyalandı.", "info");
      }
    }

    function setCDSSScheduleDays(selectAll) {
      document.querySelectorAll('input[name="cdssScheduleDay"]').forEach(el => { el.checked = Boolean(selectAll); });
    }

    function getCDSSReminderPlan(name) {
      const n = String(name || "").toLocaleLowerCase("tr-TR");
      // Bu saatler yalnızca çizelge hatırlatıcısı için taslak yerleşimdir; tedavi, emilim veya doğru kullanım zamanı önerisi değildir.
      // Kullanıcı, ürün etiketi ve hekim/eczacı talimatına göre kaydetmeden önce saati doğrulamalıdır.
      if (/magnezyum|magnesium/.test(n)) return { time: "21:30", timing: "Akşam" };
      if (/demir|iron|ferritin/.test(n)) return { time: "13:00", timing: "Öğle" };
      if (/d3|d vitamini|vitamin d|b12|kobalamin|folat|folik asit/.test(n)) return { time: "08:00", timing: "Sabah" };
      return { time: "08:00", timing: "Sabah" };
    }

    function commitCDSSProtocolToDailyTracker() {
      if (!state.user || !activeUserId) { showToast("Giriş gerekli", "Önce kendi hesabınızda oturum açın.", "warning"); return; }
      if (!document.getElementById("cdssDoctorApprovalCheckbox")?.checked) { showToast("Hekim onayı gerekli", "Toplu aktarım için hekim onayı kutusunu işaretleyin.", "warning"); return; }
      const dayValues = Array.from(document.querySelectorAll('input[name="cdssScheduleDay"]:checked')).map(el => Number(el.value));
      if (!dayValues.length) { showToast("Gün seçilmedi", "Talimatınıza göre bir veya daha fazla hatırlatma günü seçin.", "warning"); return; }
      const protocol = Array.isArray(state.lastCDSS?.protocol) ? state.lastCDSS.protocol : [];
      const selectedIndexes = Array.from(document.querySelectorAll('.cdssProtocolSelect:checked')).map(el => Number(el.dataset.index)).filter(i => Number.isInteger(i) && i >= 0 && i < protocol.length);
      if (!selectedIndexes.length) { showToast("Ürün seçilmedi", "Önce tabloda çizelgeye eklemek istediğiniz adayları işaretleyin.", "warning"); return; }
      let added = 0, duplicates = 0;
      selectedIndexes.forEach(index => {
        const candidate = protocol[index];
        if (!candidate || !String(candidate.name || "").trim()) return;
        const name = String(candidate.name).trim();
        if (state.supplements.some(item => String(item.name || "").trim().toLocaleLowerCase("tr-TR") === name.toLocaleLowerCase("tr-TR"))) { duplicates++; return; }
        const plan = getCDSSReminderPlan(name);
        state.supplements.push({
          id: `sup_cdss_approved_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          name,
          formKey: null,
          selectedForm: candidate.selectedForm || "Hekimle belirlenecek",
          timing: plan.timing,
          scheduleTime: plan.time,
          scheduleDays: dayValues.slice(),
          doseText: "Doz otomatik belirlenmedi — hekim/etiket talimatına göre girilmeli",
          subText: "KDS adayından hekim onayıyla takip kaydı",
          instruction: `Hatırlatma: ${plan.time}. Bu saat yalnızca çizelge başlangıcıdır; klinik kullanım zamanı/dozu değildir. Aday bulgu: ${String(candidate.instruction || "").slice(0, 500)} Doz, ürün formu, etkileşim ve saat hekim/eczacı ve ürün talimatıyla doğrulanmalıdır.`,
          addedDate: Date.now(), taken: false,
          scheduleSource: "cdss_doctor_approved",
          doctorApprovalAttested: true
        });
        added++;
      });
      if (!added) { showToast("Yeni kayıt eklenmedi", duplicates ? `${duplicates} öğe zaten çizelgede bulunuyor.` : "Seçilen adaylarda aktarılabilir kayıt yok.", "info"); return; }
      const saved = saveState();
      if (typeof renderAllAppViews === "function") renderAllAppViews(); else renderDailyTab();
      if (typeof detectSupplementConflicts === "function") detectSupplementConflicts();
      showToast("Çizelge güncellendi", `${added} öğe yalnızca hatırlatma kaydı olarak eklendi${duplicates ? `; ${duplicates} tekrar atlandı` : ""}. Doz ve klinik kullanım önerilmedi.${saved === false ? " Bu oturumda kaydedildi ancak kalıcı depolama doğrulanamadı." : ""}`, saved === false ? "warning" : "success");
    }

    function transferToDoctorReport() {
      navigateToView("view-report");
      showToast("Rapor Hazırlandı", "Hekim konsültasyon raporuna geçildi.", "info");
    }

    /* HEKİM KONSÜLTASYON RAPORU RENDER MOTORU */
    