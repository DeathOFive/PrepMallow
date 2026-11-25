/* Copyright (C) 2026 Saaim Sohail
 * SPDX-License-Identifier: GPL-3.0-only
 */
package com.saaimsohail.prepmallow;

import android.content.Context;
import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

class LocalWorkspace extends WebViewClient {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String ENTRY = "/workspace/index.html";
    static final String HOME = "https://" + HOST + ENTRY;

    private final Context context;
    private final FileImports imports;

    LocalWorkspace(Context context, FileImports imports) {
        this.context = context;
        this.imports = imports;
    }

    @Override
    public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
        return !request.isForMainFrame() || !trusted(request.getUrl()) || !ENTRY.equals(request.getUrl().getPath());
    }

    @Override
    public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
        Uri url = request.getUrl();
        String path = url.getPath();
        if (!trusted(url) || !"GET".equals(request.getMethod()) || path == null) return missing(403, "Forbidden");
        try {
            if (path.matches("/import/[a-f0-9-]{36}") && !request.isForMainFrame()) {
                InputStream stream = imports.open(path.substring("/import/".length()));
                if (stream != null) return response("application/octet-stream", null, 200, "OK", stream);
            }
            if (validAssetPath(path) && (!request.isForMainFrame() || ENTRY.equals(path))) {
                String type = mime(path);
                String encoding = type.startsWith("text/") ? "UTF-8" : null;
                return response(type, encoding, 200, "OK", context.getAssets().open(path.substring(1)));
            }
        } catch (IOException | RuntimeException unavailable) {
            return missing(404, "Not Found");
        }
        return missing(404, "Not Found");
    }

    private static boolean trusted(Uri uri) {
        return "https".equals(uri.getScheme()) && HOST.equals(uri.getEncodedAuthority()) && uri.getEncodedQuery() == null;
    }

    private static boolean validAssetPath(String path) {
        if (!path.startsWith("/workspace/") || !path.matches("[a-zA-Z0-9_./-]+")) return false;
        for (String part : path.substring(1).split("/", -1)) {
            if (part.isEmpty() || part.equals(".") || part.equals("..")) return false;
        }
        return true;
    }

    private static String mime(String path) {
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".js") || path.endsWith(".mjs")) return "text/javascript";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".png")) return "image/png";
        if (path.endsWith(".woff2")) return "font/woff2";
        if (path.endsWith(".wasm")) return "application/wasm";
        if (path.endsWith(".ttf")) return "font/ttf";
        if (path.endsWith(".txt")) return "text/plain";
        return "application/octet-stream";
    }

    private static WebResourceResponse missing(int status, String reason) {
        return response("text/plain", "UTF-8", status, reason, new ByteArrayInputStream(new byte[0]));
    }

    private static WebResourceResponse response(String mime, String encoding, int status, String reason, InputStream stream) {
        Map<String, String> headers = new HashMap<>();
        headers.put("Cache-Control", "no-store");
        headers.put("X-Content-Type-Options", "nosniff");
        return new WebResourceResponse(mime, encoding, status, reason, headers, stream);
    }
}
