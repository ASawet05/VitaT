(function () {
  function dismissVitaSplash() {
    if (document.body) {
      document.body.classList.add("vita-initialized");
    }
    const splash = document.getElementById("vitaSplash");
    if (!splash) return;
    splash.classList.add("splash-leaving");
    splash.hidden = true;
    splash.setAttribute("aria-hidden", "true");
    splash.style.display = "none";
    splash.style.zIndex = "-1";
    if (splash.isConnected) {
      splash.remove();
    }
  }

  function bootVitaTakipApplication() {
    try {
      if (window.VitaAIChat) VitaAIChat.initializeConsent();
    } catch (consentStartupError) {
      console.warn("Gemini onay arayüzü başlatılamadı:", consentStartupError);
    }

    try {
      switchAuthMode("login");
      installVitaUsabilityEnhancements();
      installVitaLabLiveFeedback();
    } catch (uxStartupError) {
      console.warn("Bazı arayüz iyileştirmeleri başlatılamadı:", uxStartupError);
    }

    try {
      updateApiKeyUI();
      updateNotificationToggleUI();
      applyCompactMode();
      startNotificationScheduler();
      purgeLegacyDemoAccounts();
      if (typeof refreshCloudSyncUI === "function") refreshCloudSyncUI();

      const savedSessionId =
        safeSessionStorageGetItem("vitatakip_active_session_id") ||
        safeLocalStorageGetItem("vitatakip_active_session_id");
      const savedUsers = getUsersDb().filter(u => u && u.id !== "usr_guest_local");

      if (savedSessionId && savedSessionId !== "usr_guest_local" && savedUsers.some(user => user.id === savedSessionId)) {
        activeUserId = savedSessionId;
        loadUserSessionData(savedSessionId);
        closeAuthModal();
        renderAllAppViews();
        if (typeof navigateToView === "function") {
          navigateToView(state.activeTab || "view-home");
        }
      } else {
        safeLocalStorageRemoveItem("vitatakip_active_session_id");
        safeSessionStorageRemoveItem("vitatakip_active_session_id");
        activeUserId = null;
        resetApplicationDOMAndState();
        openAuthModal();
        switchAuthMode(savedUsers.length === 0 ? "register" : "login");
      }
    } catch (startupError) {
      console.error("VitaTakip başlangıç hazırlığında hata:", startupError);
      try {
        resetApplicationDOMAndState();
        openAuthModal();
        switchAuthMode("login");
      } catch (_) {}
    } finally {
      dismissVitaSplash();
    }
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", bootVitaTakipApplication, { once: true });
  } else {
    bootVitaTakipApplication();
  }
})();