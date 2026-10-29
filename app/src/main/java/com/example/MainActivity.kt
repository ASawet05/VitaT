package com.example

import android.annotation.SuppressLint
import android.content.Context
import android.graphics.Color as AndroidColor
import android.net.Uri
import android.os.Bundle
import android.print.PrintAttributes
import android.print.PrintManager
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.MimeTypeMap
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Analytics
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.CloudDone
import androidx.compose.material.icons.filled.CloudQueue
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Medication
import androidx.compose.material.icons.filled.MonitorHeart
import androidx.compose.material.icons.outlined.Analytics
import androidx.compose.material.icons.outlined.Dashboard
import androidx.compose.material.icons.outlined.Medication
import androidx.compose.material.icons.outlined.MonitorHeart
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationRail
import androidx.compose.material3.NavigationRailItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.credentials.CredentialManager
import androidx.lifecycle.ViewModelProvider.AndroidViewModelFactory.Companion.APPLICATION_KEY
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import com.example.data.model.Supplement
import com.example.data.model.VitalLog
import com.example.data.repository.VitaRepository
import com.example.ui.auth.authStateFlow
import com.example.ui.auth.onGoogleSignInClicked
import com.example.ui.auth.signOutUser
import com.example.ui.screens.AddSupplementDialog
import com.example.ui.screens.AddVitalLogDialog
import com.example.ui.screens.VitaAnalyticsScreen
import com.example.ui.screens.VitaDashboardScreen
import com.example.ui.screens.VitaSupplementsScreen
import com.example.ui.screens.VitaVitalsScreen
import com.example.ui.theme.MyApplicationTheme
import com.example.ui.viewmodel.UiState
import com.example.ui.viewmodel.VitaViewModel
import com.google.firebase.Firebase
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.auth
import com.google.firebase.firestore.FirebaseFirestore

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            MyApplicationTheme {
                AppNavigation()
            }
        }
    }
}

enum class VitaTab(
    val routeId: String,
    val titleRes: Int,
    val selectedIcon: ImageVector,
    val unselectedIcon: ImageVector
) {
    OVERVIEW("overview", R.string.tab_overview, Icons.Filled.Dashboard, Icons.Outlined.Dashboard),
    SUPPLEMENTS("supplements", R.string.tab_supplements, Icons.Filled.Medication, Icons.Outlined.Medication),
    VITALS("vitals", R.string.tab_vitals, Icons.Filled.MonitorHeart, Icons.Outlined.MonitorHeart),
    ANALYTICS("analytics", R.string.tab_analytics, Icons.Filled.Analytics, Icons.Outlined.Analytics)
}

@Composable
fun AppNavigation(auth: FirebaseAuth = Firebase.auth) {
    val currentUser by auth.authStateFlow().collectAsStateWithLifecycle(initialValue = auth.currentUser)
    var showCloudNativePanel by rememberSaveable { mutableStateOf(false) }

    if (showCloudNativePanel && currentUser != null) {
        BackHandler {
            showCloudNativePanel = false
        }
        VitaMainShell(
            user = currentUser!!,
            onBackToWebPortal = { showCloudNativePanel = false }
        )
    } else {
        VitaTakipWebPortalScreen(
            currentUser = currentUser,
            onOpenCloudNativePanel = { showCloudNativePanel = true }
        )
    }
}

private class AndroidVitaBridge(
    private val context: Context,
    private val webViewProvider: () -> WebView?,
    private val onOpenCloudSyncDialog: () -> Unit
) {
    @JavascriptInterface
    fun printPage() {
        printPageWithTitle("VitaTakip_Klinik_Rapor")
    }

    @JavascriptInterface
    fun printPageWithTitle(jobTitle: String?) {
        val webView = webViewProvider() ?: return
        val safeTitle = jobTitle?.takeIf { it.isNotBlank() } ?: "VitaTakip_Klinik_Rapor"
        webView.post {
            try {
                val printManager = context.getSystemService(Context.PRINT_SERVICE) as? PrintManager
                val printAdapter = webView.createPrintDocumentAdapter(safeTitle)
                printManager?.print(safeTitle, printAdapter, PrintAttributes.Builder().build())
            } catch (e: Exception) {
                Toast.makeText(context, "PDF / Yazdırma başlatılamadı: ${e.localizedMessage}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    @JavascriptInterface
    fun openGoogleCloudSync() {
        val webView = webViewProvider() ?: return
        webView.post {
            onOpenCloudSyncDialog()
        }
    }
}

private fun resolveAssetMimeType(path: String): String {
    val lower = path.lowercase()
    return when {
        lower.endsWith(".html") || lower.endsWith(".htm") -> "text/html"
        lower.endsWith(".css") -> "text/css"
        lower.endsWith(".js") || lower.endsWith(".mjs") -> "application/javascript"
        lower.endsWith(".json") || lower.endsWith(".webmanifest") -> "application/json"
        lower.endsWith(".png") -> "image/png"
        lower.endsWith(".jpg") || lower.endsWith(".jpeg") -> "image/jpeg"
        lower.endsWith(".webp") -> "image/webp"
        lower.endsWith(".svg") -> "image/svg+xml"
        lower.endsWith(".woff2") -> "font/woff2"
        lower.endsWith(".woff") -> "font/woff"
        lower.endsWith(".ttf") -> "font/ttf"
        else -> {
            val ext = MimeTypeMap.getFileExtensionFromUrl(path)
            MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext) ?: "application/octet-stream"
        }
    }
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun VitaTakipWebPortalScreen(
    currentUser: FirebaseUser?,
    onOpenCloudNativePanel: () -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val credentialManager = remember { CredentialManager.create(context) }

    var webViewRef by remember { mutableStateOf<WebView?>(null) }
    var filePathCallback by remember { mutableStateOf<ValueCallback<Array<Uri>>?>(null) }
    var showCloudSyncDialog by rememberSaveable { mutableStateOf(false) }
    var isSigningIn by remember { mutableStateOf(false) }
    var authError by remember { mutableStateOf<String?>(null) }

    val filePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenMultipleDocuments()
    ) { uris: List<Uri> ->
        val callback = filePathCallback
        filePathCallback = null
        if (uris.isNotEmpty()) {
            callback?.onReceiveValue(uris.toTypedArray())
        } else {
            callback?.onReceiveValue(null)
        }
    }

    BackHandler {
        val wv = webViewRef
        if (wv != null) {
            wv.evaluateJavascript(
                """
                (function() {
                    var activeModals = document.querySelectorAll('.modal-overlay.active, .wizard-overlay.active, #visualRefModal.active');
                    if (activeModals && activeModals.length > 0) {
                        var lastModal = activeModals[activeModals.length - 1];
                        lastModal.classList.remove('active');
                        lastModal.setAttribute('aria-hidden', 'true');
                        return 'CLOSED_MODAL';
                    }
                    var homeView = document.getElementById('view-home');
                    if (homeView && homeView.classList.contains('hidden') && typeof navigateToView === 'function') {
                        navigateToView('view-home');
                        return 'NAV_HOME';
                    }
                    return 'NONE';
                })();
                """.trimIndent()
            ) { result ->
                if (result == "\"NONE\"" && wv.canGoBack()) {
                    wv.goBack()
                }
            }
        }
    }

    Surface(
        modifier = Modifier
            .fillMaxSize()
            .windowInsetsPadding(WindowInsets.safeDrawing),
        color = MaterialTheme.colorScheme.background
    ) {
        AndroidView(
            modifier = Modifier
                .fillMaxSize()
                .testTag("vita_takip_webview"),
            factory = { ctx ->
                object : WebView(ctx) {
                    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
                        val widthSize = MeasureSpec.getSize(widthMeasureSpec)
                        val heightSize = MeasureSpec.getSize(heightMeasureSpec)
                        val exactWidth = if (widthSize > 0) {
                            MeasureSpec.makeMeasureSpec(widthSize, MeasureSpec.EXACTLY)
                        } else {
                            widthMeasureSpec
                        }
                        val exactHeight = if (heightSize > 0) {
                            MeasureSpec.makeMeasureSpec(heightSize, MeasureSpec.EXACTLY)
                        } else {
                            heightMeasureSpec
                        }
                        super.onMeasure(exactWidth, exactHeight)
                    }
                }.apply {
                    layoutParams = ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )
                    setBackgroundColor(AndroidColor.parseColor("#F8FAFC"))
                    isVerticalScrollBarEnabled = true
                    isHorizontalScrollBarEnabled = false
                    webViewRef = this

                    settings.apply {
                        javaScriptEnabled = true
                        domStorageEnabled = true
                        @Suppress("DEPRECATION")
                        databaseEnabled = true
                        allowFileAccess = true
                        allowContentAccess = true
                        @Suppress("DEPRECATION")
                        allowFileAccessFromFileURLs = true
                        @Suppress("DEPRECATION")
                        allowUniversalAccessFromFileURLs = true
                        mediaPlaybackRequiresUserGesture = false
                        loadWithOverviewMode = false
                        useWideViewPort = false
                        builtInZoomControls = false
                        displayZoomControls = false
                        cacheMode = WebSettings.LOAD_NO_CACHE
                        mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
                    }
                    clearCache(true)

                    addJavascriptInterface(
                        AndroidVitaBridge(
                            context = ctx,
                            webViewProvider = { webViewRef },
                            onOpenCloudSyncDialog = { showCloudSyncDialog = true }
                        ),
                        "AndroidVitaBridge"
                    )

                    webViewClient = object : WebViewClient() {
                        override fun shouldInterceptRequest(
                            view: WebView?,
                            request: WebResourceRequest?
                        ): WebResourceResponse? {
                            val url = request?.url ?: return super.shouldInterceptRequest(view, request)
                            if (url.host == "appassets.androidplatform.net") {
                                val rawPath = (url.path ?: "").removePrefix("/")
                                val assetPath = when {
                                    rawPath.startsWith("assets/") -> rawPath.removePrefix("assets/")
                                    rawPath.isEmpty() -> "vita_web/index.html"
                                    else -> "vita_web/$rawPath"
                                }
                                return try {
                                    val inputStream = ctx.assets.open(assetPath)
                                    val mime = resolveAssetMimeType(assetPath)
                                    val encoding = if (
                                        mime.startsWith("text/") ||
                                        mime == "application/javascript" ||
                                        mime == "application/json" ||
                                        mime == "image/svg+xml"
                                    ) "UTF-8" else null
                                    WebResourceResponse(mime, encoding, inputStream)
                                } catch (e: Exception) {
                                    null
                                }
                            }
                            return super.shouldInterceptRequest(view, request)
                        }

                        override fun onPageFinished(view: WebView?, url: String?) {
                            super.onPageFinished(view, url)
                            view?.evaluateJavascript(
                                """
                                (function() {
                                    if (window.AndroidVitaBridge) {
                                        window.print = function() {
                                            window.AndroidVitaBridge.printPage();
                                        };
                                    }
                                })();
                                """.trimIndent(),
                                null
                            )
                        }
                    }

                    webChromeClient = object : WebChromeClient() {
                        override fun onShowFileChooser(
                            webView: WebView?,
                            filePathCallbackParam: ValueCallback<Array<Uri>>?,
                            fileChooserParams: FileChooserParams?
                        ): Boolean {
                            filePathCallback?.onReceiveValue(null)
                            filePathCallback = filePathCallbackParam
                            try {
                                filePickerLauncher.launch(
                                    arrayOf(
                                        "application/pdf",
                                        "application/json",
                                        "text/*",
                                        "image/*"
                                    )
                                )
                            } catch (e: Exception) {
                                filePathCallback?.onReceiveValue(null)
                                filePathCallback = null
                                return false
                            }
                            return true
                        }

                        override fun onPermissionRequest(request: PermissionRequest?) {
                            request?.grant(request.resources)
                        }
                    }

                    loadUrl("file:///android_asset/vita_web/index.html")
                }
            },
            update = { webView ->
                if (webView.layoutParams?.width != ViewGroup.LayoutParams.MATCH_PARENT ||
                    webView.layoutParams?.height != ViewGroup.LayoutParams.MATCH_PARENT
                ) {
                    webView.layoutParams = ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )
                }
                webViewRef = webView
            }
        )
    }

    if (showCloudSyncDialog) {
        AlertDialog(
            onDismissRequest = { showCloudSyncDialog = false },
            icon = {
                Icon(
                    imageVector = if (currentUser != null) Icons.Default.CloudDone else Icons.Default.CloudQueue,
                    contentDescription = "Bulut Yedekleme"
                )
            },
            title = {
                Text(
                    text = if (currentUser != null) "Google Bulut Hesabı Bağlı" else "İsteğe Bağlı Google Girişi",
                    fontWeight = FontWeight.Bold
                )
            },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    if (currentUser != null) {
                        Text(
                            text = "Aktif Google Hesabı: ${currentUser.email ?: currentUser.displayName ?: "Kullanıcı"}"
                        )
                        Text(
                            text = "Uygulamayı Google hesabınızla veya yerel profilinizle kullanmaya devam edebilirsiniz."
                        )
                    } else {
                        Text(
                            text = "VitaTakip Pro'yu Google hesabı olmadan doğrudan kullanabilirsiniz. İsterseniz Google hesabınızla bağlanarak bulut panelini de açabilirsiniz."
                        )
                        if (authError != null) {
                            Text(
                                text = authError ?: "",
                                color = MaterialTheme.colorScheme.error,
                                style = MaterialTheme.typography.bodySmall
                            )
                        }
                    }
                }
            },
            confirmButton = {
                if (currentUser != null) {
                    Button(
                        onClick = {
                            showCloudSyncDialog = false
                            onOpenCloudNativePanel()
                        }
                    ) {
                        Text("Bulut Paneline Geç")
                    }
                } else {
                    Button(
                        onClick = {
                            authError = null
                            isSigningIn = true
                            onGoogleSignInClicked(
                                context = context,
                                credentialManager = credentialManager,
                                onAuthSuccess = {
                                    isSigningIn = false
                                    showCloudSyncDialog = false
                                },
                                onAuthError = { msg ->
                                    isSigningIn = false
                                    authError = msg
                                },
                                scope = scope,
                                onAuthCancelled = {
                                    isSigningIn = false
                                }
                            )
                        },
                        enabled = !isSigningIn,
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        if (isSigningIn) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(18.dp),
                                strokeWidth = 2.dp
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                        } else {
                            Icon(
                                imageVector = Icons.Default.CheckCircle,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                        }
                        Text("Google ile Giriş Yap")
                    }
                }
            },
            dismissButton = {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (currentUser != null) {
                        OutlinedButton(
                            onClick = {
                                signOutUser(
                                    credentialManager = credentialManager,
                                    onSignOutComplete = {
                                        showCloudSyncDialog = false
                                    },
                                    scope = scope
                                )
                            }
                        ) {
                            Text("Çıkış Yap")
                        }
                    }
                    TextButton(onClick = { showCloudSyncDialog = false }) {
                        Text("Kapat")
                    }
                }
            }
        )
    }
}

@Composable
fun VitaMainShell(
    user: FirebaseUser,
    onBackToWebPortal: () -> Unit = {}
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val credentialManager = remember { CredentialManager.create(context) }

    val viewModel: VitaViewModel = viewModel(
        key = user.uid,
        factory = viewModelFactory {
            initializer {
                val app = checkNotNull(this[APPLICATION_KEY]) {
                    "APPLICATION_KEY missing from CreationExtras"
                }
                val databaseId = app.getString(R.string.firestore_database_id)
                val db = FirebaseFirestore.getInstance(databaseId)
                VitaViewModel(VitaRepository(db), user.uid)
            }
        }
    )

    val supplementsState by viewModel.supplementsState.collectAsStateWithLifecycle()
    val vitalLogsState by viewModel.vitalLogsState.collectAsStateWithLifecycle()
    val waterGoalMl by viewModel.waterGoalMl.collectAsStateWithLifecycle()
    val bannerMessage by viewModel.bannerMessage.collectAsStateWithLifecycle()

    val snackbarHostState = remember { SnackbarHostState() }
    LaunchedEffect(bannerMessage) {
        val msg = bannerMessage
        if (!msg.isNullOrBlank()) {
            snackbarHostState.showSnackbar(msg)
            viewModel.clearBannerMessage()
        }
    }

    var currentTab by rememberSaveable { mutableStateOf(VitaTab.OVERVIEW) }
    var showAddSupplementDialog by rememberSaveable { mutableStateOf(false) }
    var showAddVitalDialog by rememberSaveable { mutableStateOf(false) }

    if (currentTab != VitaTab.OVERVIEW) {
        BackHandler {
            currentTab = VitaTab.OVERVIEW
        }
    }

    val configuration = LocalConfiguration.current
    val isExpandedScreen = configuration.screenWidthDp >= 600

    val supplements: List<Supplement> = when (val s = supplementsState) {
        is UiState.Success -> s.data
        else -> emptyList()
    }
    val vitalLogs: List<VitalLog> = when (val v = vitalLogsState) {
        is UiState.Success -> v.data
        else -> emptyList()
    }

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        contentWindowInsets = WindowInsets.safeDrawing,
        snackbarHost = { SnackbarHost(hostState = snackbarHostState) },
        bottomBar = {
            if (!isExpandedScreen) {
                NavigationBar(
                    modifier = Modifier
                        .windowInsetsPadding(WindowInsets.navigationBars)
                        .testTag("bottom_navigation_bar")
                ) {
                    VitaTab.entries.forEach { tab ->
                        val selected = currentTab == tab
                        NavigationBarItem(
                            selected = selected,
                            onClick = { currentTab = tab },
                            icon = {
                                Icon(
                                    imageVector = if (selected) tab.selectedIcon else tab.unselectedIcon,
                                    contentDescription = stringResource(tab.titleRes)
                                )
                            },
                            label = { Text(stringResource(tab.titleRes)) },
                            modifier = Modifier.testTag("nav_tab_${tab.routeId}")
                        )
                    }
                }
            }
        }
    ) { innerPadding ->
        Row(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            if (isExpandedScreen) {
                NavigationRail(
                    modifier = Modifier.testTag("side_navigation_rail")
                ) {
                    VitaTab.entries.forEach { tab ->
                        val selected = currentTab == tab
                        NavigationRailItem(
                            selected = selected,
                            onClick = { currentTab = tab },
                            icon = {
                                Icon(
                                    imageVector = if (selected) tab.selectedIcon else tab.unselectedIcon,
                                    contentDescription = stringResource(tab.titleRes)
                                )
                            },
                            label = { Text(stringResource(tab.titleRes)) },
                            modifier = Modifier.testTag("rail_tab_${tab.routeId}")
                        )
                    }
                }
            }

            Column(modifier = Modifier.fillMaxSize()) {
                Surface(
                    color = MaterialTheme.colorScheme.secondaryContainer,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 8.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "VitaTakip Pro Tam Ekran Moduna Dön",
                            style = MaterialTheme.typography.labelLarge,
                            color = MaterialTheme.colorScheme.onSecondaryContainer
                        )
                        TextButton(onClick = onBackToWebPortal) {
                            Text("VitaTakip Pro'yu Aç")
                        }
                    }
                }

                val errorText = (supplementsState as? UiState.Error)?.message
                    ?: (vitalLogsState as? UiState.Error)?.message
                if (errorText != null) {
                    Surface(
                        color = MaterialTheme.colorScheme.errorContainer,
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(
                            text = errorText,
                            color = MaterialTheme.colorScheme.onErrorContainer,
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.Medium,
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp)
                        )
                    }
                }

                if (supplementsState is UiState.Loading && vitalLogsState is UiState.Loading) {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator()
                    }
                } else {
                    when (currentTab) {
                        VitaTab.OVERVIEW -> VitaDashboardScreen(
                            supplements = supplements,
                            vitalLogs = vitalLogs,
                            waterGoalMl = waterGoalMl,
                            onQuickAddWater = { viewModel.quickAddWater(it) },
                            onToggleSupplement = { viewModel.toggleSupplement(it) },
                            onOpenAddSupplement = { showAddSupplementDialog = true },
                            onOpenAddVital = { showAddVitalDialog = true },
                            onSeedStarterPack = { viewModel.seedStarterRoutinePack() },
                            onResetDailyRoutine = { viewModel.resetDailyRoutine(supplements) }
                        )

                        VitaTab.SUPPLEMENTS -> VitaSupplementsScreen(
                            supplements = supplements,
                            onToggleSupplement = { viewModel.toggleSupplement(it) },
                            onRestockSupplement = { viewModel.restockSupplement(it) },
                            onDeleteSupplement = { viewModel.deleteSupplement(it) },
                            onOpenAddDialog = { showAddSupplementDialog = true }
                        )

                        VitaTab.VITALS -> VitaVitalsScreen(
                            vitalLogs = vitalLogs,
                            onDeleteVitalLog = { viewModel.deleteVitalLog(it) },
                            onOpenAddVitalDialog = { showAddVitalDialog = true }
                        )

                        VitaTab.ANALYTICS -> VitaAnalyticsScreen(
                            userEmail = user.email,
                            userName = user.displayName,
                            supplements = supplements,
                            vitalLogs = vitalLogs,
                            waterGoalMl = waterGoalMl,
                            onUpdateWaterGoal = { viewModel.updateWaterGoal(it) },
                            onResetDailyRoutine = { viewModel.resetDailyRoutine(supplements) },
                            onSignOut = {
                                signOutUser(
                                    credentialManager = credentialManager,
                                    onSignOutComplete = onBackToWebPortal,
                                    scope = scope
                                )
                            }
                        )
                    }
                }
            }
        }
    }

    if (showAddSupplementDialog) {
        AddSupplementDialog(
            onDismiss = { showAddSupplementDialog = false },
            onConfirm = { name, dosage, category, timeOfDay, stockCount, notes ->
                showAddSupplementDialog = false
                viewModel.addSupplement(name, dosage, category, timeOfDay, stockCount, notes)
            }
        )
    }

    if (showAddVitalDialog) {
        AddVitalLogDialog(
            onDismiss = { showAddVitalDialog = false },
            onConfirm = { type, title, primaryValue, secondaryValue, unit, note ->
                showAddVitalDialog = false
                viewModel.addVitalLog(type, title, primaryValue, secondaryValue, unit, note)
            }
        )
    }
}
