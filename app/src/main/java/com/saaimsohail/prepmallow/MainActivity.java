/* Copyright (C) 2026 Saaim Sohail
 * SPDX-License-Identifier: GPL-3.0-only
 */
package com.saaimsohail.prepmallow;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipDescription;
import android.content.ClipboardManager;
import android.content.ContentResolver;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.PersistableBundle;
import android.provider.DocumentsContract;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;
import org.json.JSONObject;

import java.io.FileInputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class MainActivity extends Activity {
    private static final int BACKGROUND = Color.rgb(249, 248, 244);
    private static final int PICK_FILES = 11;
    private static final int PICK_FOLDER = 12;
    private static final int SAVE_FILE = 13;
    private static final int MIN_WEBVIEW_MAJOR = 110;

    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private FrameLayout frame;
    private WebView web;
    private FileImports imports;
    private FileExports exports;
    private boolean ready;
    private Intent pendingShare;
    private volatile boolean systemDialogOpen;
    private volatile boolean finishingExport;
    private FileExports.Output pendingSave;
    private OnBackInvokedCallback backCallback;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        imports = new FileImports(getContentResolver(), getPackageName() + ".exports");
        exports = new FileExports(this);
        if (state != null && FileExports.validId(state.getString("save-id"))) {
            pendingSave = new FileExports.Output(state.getString("save-id"), state.getString("save-name"), state.getString("save-mime"), false);
            systemDialogOpen = true;
        }
        String keepId = pendingSave == null ? null : pendingSave.id;
        io.execute(() -> exports.prune(keepId));

        frame = new FrameLayout(this);
        frame.setBackgroundColor(BACKGROUND);
        setContentView(frame);
        applySystemBars();
        if (Build.VERSION.SDK_INT >= 33) {
            backCallback = this::handleBack;
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, backCallback);
        }
        if (state == null) rememberShare(getIntent());

        if (!modernWebView()) {
            showMessage("Update Android System WebView", "PrepMallow requires Android System WebView version 110 or later. Update it on this device, then reopen PrepMallow.");
            return;
        }
        try {
            openWorkspace(state);
        } catch (RuntimeException unavailable) {
            showMessage("Could not open PrepMallow", "Check that Android System WebView is enabled, then reopen PrepMallow.");
        }
    }

    private void openWorkspace(Bundle state) {
        WebView.setWebContentsDebuggingEnabled((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0);
        web = new WebView(this);
        web.setBackgroundColor(BACKGROUND);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setVerticalScrollBarEnabled(false);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setBlockNetworkLoads(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        web.setWebViewClient(new LocalWorkspace(this, imports) {
            @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                if (view == web) {
                    closeWorkspace();
                    showMessage("PrepMallow needs to reopen", "The workspace stopped. Reopen it and try processing fewer or smaller files.");
                }
                return true;
            }
        });
        web.addJavascriptInterface(new AndroidBridge(), "PrepMallowAndroid");
        frame.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        String route = state == null ? null : state.getString("route");
        web.loadUrl(LocalWorkspace.HOME + (route == null ? "" : route));
    }

    private boolean modernWebView() {
        PackageInfo provider = WebView.getCurrentWebViewPackage();
        if (provider == null || provider.versionName == null) return false;
        String major = provider.versionName.split("\\.", 2)[0];
        try { return Integer.parseInt(major) >= MIN_WEBVIEW_MAJOR; }
        catch (NumberFormatException unknownVersion) { return true; }
    }

    private void applySystemBars() {
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                int appearance = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                controller.setSystemBarsAppearance(appearance, appearance);
            }
            frame.setOnApplyWindowInsetsListener((view, insets) -> {
                Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                Insets keyboard = insets.getInsets(WindowInsets.Type.ime());
                view.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, keyboard.bottom));
                return WindowInsets.CONSUMED;
            });
            frame.requestApplyInsets();
        } else {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        }
    }

    private void showMessage(String title, String message) {
        frame.removeAllViews();
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setGravity(Gravity.CENTER);
        int padding = (int) (24 * getResources().getDisplayMetrics().density);
        content.setPadding(padding, padding, padding, padding);
        TextView heading = new TextView(this);
        heading.setText(title);
        heading.setTextSize(22);
        heading.setGravity(Gravity.CENTER);
        TextView body = new TextView(this);
        body.setText(message);
        body.setTextSize(16);
        body.setGravity(Gravity.CENTER);
        body.setPadding(0, padding / 2, 0, padding);
        Button retry = new Button(this);
        retry.setText("Reopen");
        retry.setOnClickListener(view -> recreate());
        content.addView(heading);
        content.addView(body);
        content.addView(retry);
        frame.addView(content, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        rememberShare(intent);
        processShare();
    }

    private void rememberShare(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (Intent.ACTION_SEND.equals(action) || Intent.ACTION_SEND_MULTIPLE.equals(action)) pendingShare = intent;
    }

    private void processShare() {
        if (!ready || pendingShare == null) return;
        Intent incoming = pendingShare;
        pendingShare = null;
        io.execute(() -> publishImport(imports.fromIntent("share", incoming)));
    }

    private void pickFiles(String kind, boolean multiple, boolean folder) {
        if (systemDialogOpen || finishingExport) {
            publishImport(FileImports.warning("picker", "Finish the current file action first."));
            return;
        }
        Intent intent;
        if (folder) {
            intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        } else {
            intent = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE);
            switch (kind) {
                case "image": intent.setType("image/*"); break;
                case "pdf": intent.setType("application/pdf"); break;
                case "visual":
                    intent.setType("*/*").putExtra(Intent.EXTRA_MIME_TYPES, new String[] { "image/*", "application/pdf" });
                    break;
                default: intent.setType("*/*");
            }
            intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, multiple);
        }
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        systemDialogOpen = true;
        try { startActivityForResult(intent, folder ? PICK_FOLDER : PICK_FILES); }
        catch (RuntimeException unavailable) {
            systemDialogOpen = false;
            publishImport(FileImports.warning("picker", "No Android file picker is available."));
        }
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == PICK_FILES || request == PICK_FOLDER) {
            systemDialogOpen = false;
            if (result != RESULT_OK || data == null) {
                publishImport(FileImports.warning("picker", null));
            } else {
                io.execute(() -> publishImport(request == PICK_FOLDER
                    ? imports.fromTree(data.getData()) : imports.fromIntent("picker", data)));
            }
        } else if (request == SAVE_FILE) {
            systemDialogOpen = false;
            FileExports.Output output = pendingSave;
            pendingSave = null;
            if (output == null) return;
            if (result == RESULT_OK && data != null && data.getData() != null) {
                io.execute(() -> saveToUri(output, data.getData()));
            } else {
                FileExports.remove(this, output.id);
                finishingExport = false;
            }
        }
    }

    private void publishImport(JSONObject notice) {
        runOnUiThread(() -> {
            if (web != null && ready) {
                web.evaluateJavascript("window.dispatchEvent(new CustomEvent('prepmallow-import',{detail:" + notice + "}))", null);
            }
        });
    }

    private void launchExport(FileExports.Output output) {
        if (isFinishing() || isDestroyed() || systemDialogOpen) {
            FileExports.remove(this, output.id);
            finishingExport = false;
            toast("Could not start the export. Try again.");
            return;
        }
        try {
            if (output.share) {
                Uri uri = output.uri(getPackageName());
                Intent send = new Intent(Intent.ACTION_SEND).setType(output.mime)
                    .putExtra(Intent.EXTRA_STREAM, uri)
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                send.setClipData(ClipData.newRawUri(output.name, uri));
                startActivity(Intent.createChooser(send, "Share file"));
                finishingExport = false;
            } else {
                Intent create = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                    .setType(output.mime).putExtra(Intent.EXTRA_TITLE, output.name)
                    .addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                pendingSave = output;
                systemDialogOpen = true;
                startActivityForResult(create, SAVE_FILE);
            }
        } catch (RuntimeException unavailable) {
            FileExports.remove(this, output.id);
            pendingSave = null;
            systemDialogOpen = false;
            finishingExport = false;
            toast("Android could not open the export.");
        }
    }

    private void saveToUri(FileExports.Output output, Uri uri) {
        try {
            if (!ContentResolver.SCHEME_CONTENT.equals(uri.getScheme())) throw new IOException("Invalid destination");
            try (FileInputStream source = new FileInputStream(FileExports.file(this, output.id));
                 OutputStream target = getContentResolver().openOutputStream(uri, "w")) {
                if (target == null) throw new IOException("Destination unavailable");
                byte[] buffer = new byte[64 * 1024];
                for (int count; (count = source.read(buffer)) != -1;) target.write(buffer, 0, count);
            }
            toast("File saved");
        } catch (IOException | RuntimeException error) {
            try { DocumentsContract.deleteDocument(getContentResolver(), uri); }
            catch (Exception ignored) { }
            toast("Could not save the file. Try another folder.");
        } finally {
            FileExports.remove(this, output.id);
            finishingExport = false;
        }
    }

    private void toast(String message) {
        runOnUiThread(() -> Toast.makeText(getApplicationContext(), message, Toast.LENGTH_SHORT).show());
    }

    private void handleBack() {
        if (web == null || !ready) { finish(); return; }
        web.evaluateJavascript("Boolean(window.prepmallowHandleBack && window.prepmallowHandleBack())",
            handled -> { if (!"true".equals(handled)) finish(); });
    }

    // Android 13+ uses the platform callback registered in onCreate; keep this
    // override only for Back navigation on Android 10-12.
    @android.annotation.SuppressLint("GestureBackNavigation")
    @SuppressWarnings("deprecation")
    @Override public void onBackPressed() { handleBack(); }

    @Override protected void onSaveInstanceState(Bundle state) {
        super.onSaveInstanceState(state);
        String url = web == null ? null : web.getUrl();
        if (url != null && url.startsWith(LocalWorkspace.HOME + "#")) {
            String route = url.substring(LocalWorkspace.HOME.length());
            if (route.matches("#/[a-z0-9/-]{0,70}")) state.putString("route", route);
        }
        if (pendingSave != null) {
            state.putString("save-id", pendingSave.id);
            state.putString("save-name", pendingSave.name);
            state.putString("save-mime", pendingSave.mime);
        }
    }

    private void closeWorkspace() {
        ready = false;
        if (web == null) return;
        web.removeJavascriptInterface("PrepMallowAndroid");
        frame.removeView(web);
        web.destroy();
        web = null;
        imports.clear();
        exports.close();
    }

    @Override protected void onDestroy() {
        if (Build.VERSION.SDK_INT >= 33 && backCallback != null) {
            getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback(backCallback);
        }
        closeWorkspace();
        io.shutdown();
        super.onDestroy();
    }

    public final class AndroidBridge {
        @JavascriptInterface public void ready() {
            runOnUiThread(() -> {
                if (web == null || isDestroyed()) return;
                ready = true;
                processShare();
            });
        }

        @JavascriptInterface public void pick(String kind, boolean multiple, boolean folder) {
            runOnUiThread(() -> pickFiles(kind == null ? "any" : kind, multiple, folder));
        }

        @JavascriptInterface public String beginExport(String action, String name, String mime, long size) {
            if (systemDialogOpen || finishingExport) return "";
            return exports.begin(action, name, mime, size);
        }

        @JavascriptInterface public boolean appendExport(String id, String chunk) { return exports.append(id, chunk); }

        @JavascriptInterface public boolean finishExport(String id) {
            FileExports.Output output = exports.finish(id);
            if (output == null) return false;
            finishingExport = true;
            runOnUiThread(() -> launchExport(output));
            return true;
        }

        @JavascriptInterface public void cancelExport(String id) { exports.cancel(id); }

        @JavascriptInterface public boolean copy(String text) {
            if (text == null || text.length() > 200_000) return false;
            runOnUiThread(() -> {
                ClipData clip = ClipData.newPlainText("PrepMallow text", text);
                if (Build.VERSION.SDK_INT >= 33) {
                    PersistableBundle options = new PersistableBundle();
                    options.putBoolean(ClipDescription.EXTRA_IS_SENSITIVE, true);
                    clip.getDescription().setExtras(options);
                }
                ClipboardManager clipboard = getSystemService(ClipboardManager.class);
                if (clipboard != null) clipboard.setPrimaryClip(clip);
            });
            return true;
        }
    }
}
