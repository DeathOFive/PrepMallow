/* Copyright (C) 2026 Saaim Sohail
 * SPDX-License-Identifier: GPL-3.0-only
 */
package com.saaimsohail.prepmallow;

import android.content.ClipData;
import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.SystemClock;
import android.provider.DocumentsContract;
import android.provider.OpenableColumns;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

final class FileImports {
    private static final int MAX_FILES = 40;
    private static final long MAX_FILE_BYTES = 80_000_000L;
    private static final long MAX_TOTAL_BYTES = 160_000_000L;
    private static final long SOURCE_TTL_MS = 10 * 60 * 1000;
    private static final String[] DETAILS = { OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE };

    private final ContentResolver resolver;
    private final String ownAuthority;
    private final ConcurrentHashMap<String, Source> sources = new ConcurrentHashMap<>();

    FileImports(ContentResolver resolver, String ownAuthority) {
        this.resolver = resolver;
        this.ownAuthority = ownAuthority;
    }

    private static final class Source {
        final Uri uri;
        final long expiresAt = SystemClock.elapsedRealtime() + SOURCE_TTL_MS;

        Source(Uri uri) { this.uri = uri; }
    }

    private static final class Selection {
        final JSONArray files = new JSONArray();
        final JSONArray warnings = new JSONArray();
        long bytes;
    }

    private static final class Folder {
        final String id;
        final String path;
        final int depth;

        Folder(String id, String path, int depth) {
            this.id = id;
            this.path = path;
            this.depth = depth;
        }
    }

    @SuppressWarnings("deprecation")
    JSONObject fromIntent(String source, Intent intent) {
        prune();
        Selection selection = new Selection();
        try {
            Set<Uri> uris = new LinkedHashSet<>();
            ClipData clip = intent.getClipData();
            if (clip != null) {
                int count = Math.min(clip.getItemCount(), MAX_FILES + 1);
                for (int i = 0; i < count; i++) {
                    Uri uri = clip.getItemAt(i).getUri();
                    if (uri != null) uris.add(uri);
                }
            }
            if (intent.getData() != null) uris.add(intent.getData());
            if (uris.isEmpty()) {
                if (Intent.ACTION_SEND_MULTIPLE.equals(intent.getAction())) {
                    List<Uri> extras = intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
                    if (extras != null) uris.addAll(extras.subList(0, Math.min(extras.size(), MAX_FILES + 1)));
                } else {
                    Uri extra = intent.getParcelableExtra(Intent.EXTRA_STREAM);
                    if (extra != null) uris.add(extra);
                }
            }
            int seen = 0;
            for (Uri uri : uris) {
                if (seen++ == MAX_FILES) {
                    selection.warnings.put("Choose up to 40 files at a time.");
                    break;
                }
                addDocument(selection, uri, "");
            }
            if (uris.isEmpty() && source.equals("share")) {
                selection.warnings.put("Share an image, PDF, ZIP or other file with PrepMallow.");
            }
        } catch (RuntimeException problem) {
            selection.warnings.put("Android could not open this selection.");
        }
        return notice(source, selection);
    }

    JSONObject fromTree(Uri tree) {
        prune();
        Selection selection = new Selection();
        if (!isReadableContentUri(tree)) return warning("picker", "This folder could not be opened.");
        try {
            String rootId = DocumentsContract.getTreeDocumentId(tree);
            Uri root = DocumentsContract.buildDocumentUriUsingTree(tree, rootId);
            String rootName = "Folder";
            try (Cursor cursor = resolver.query(root, DETAILS, null, null, null)) {
                if (cursor != null && cursor.moveToFirst()) rootName = nameOf(cursor.getString(0));
            }

            ArrayDeque<Folder> pending = new ArrayDeque<>();
            Set<String> visited = new LinkedHashSet<>();
            pending.add(new Folder(rootId, rootName, 0));
            String[] columns = {
                DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                DocumentsContract.Document.COLUMN_MIME_TYPE,
                DocumentsContract.Document.COLUMN_SIZE
            };
            int scanned = 0;
            boolean truncated = false;
            while (!pending.isEmpty() && scanned < 1200 && selection.files.length() < MAX_FILES) {
                Folder folder = pending.removeFirst();
                if (!visited.add(folder.id)) continue;
                Uri children = DocumentsContract.buildChildDocumentsUriUsingTree(tree, folder.id);
                try (Cursor cursor = resolver.query(children, columns, null, null, null)) {
                    if (cursor == null) continue;
                    while (cursor.moveToNext()) {
                        if (++scanned > 1200 || selection.files.length() == MAX_FILES) {
                            truncated = true;
                            break;
                        }
                        String id = cursor.getString(0);
                        String name = nameOf(cursor.getString(1));
                        String mime = cursor.getString(2);
                        String relativePath = folder.path + "/" + name;
                        if (DocumentsContract.Document.MIME_TYPE_DIR.equals(mime)) {
                            if (folder.depth < 12) pending.add(new Folder(id, relativePath, folder.depth + 1));
                            else truncated = true;
                        } else {
                            Uri document = DocumentsContract.buildDocumentUriUsingTree(tree, id);
                            add(selection, document, name, mime, cursor.isNull(3) ? -1L : cursor.getLong(3), relativePath);
                        }
                    }
                }
            }
            if (truncated || !pending.isEmpty()) selection.warnings.put("The folder exceeds the import limit. Choose a smaller folder for more files.");
            if (selection.files.length() == 0 && selection.warnings.length() == 0) selection.warnings.put("There are no files in this folder.");
        } catch (RuntimeException problem) {
            selection.warnings.put("Android could not read part of this folder.");
        }
        return notice("picker", selection);
    }

    private void addDocument(Selection selection, Uri uri, String relativePath) {
        if (!isReadableContentUri(uri)) {
            selection.warnings.put("One item did not provide an Android file.");
            return;
        }
        String name = "File";
        long size = -1;
        try (Cursor cursor = resolver.query(uri, DETAILS, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int nameColumn = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                int sizeColumn = cursor.getColumnIndex(OpenableColumns.SIZE);
                if (nameColumn >= 0) name = nameOf(cursor.getString(nameColumn));
                if (sizeColumn >= 0 && !cursor.isNull(sizeColumn)) size = cursor.getLong(sizeColumn);
            }
            add(selection, uri, name, resolver.getType(uri), size, relativePath);
        } catch (RuntimeException problem) {
            selection.warnings.put(name + " · Android could not read this file.");
        }
    }

    private void add(Selection selection, Uri uri, String name, String mime, long size, String relativePath) {
        if (size > MAX_FILE_BYTES || size > MAX_TOTAL_BYTES - selection.bytes) {
            selection.warnings.put(name + " · Exceeds the file size limit.");
            return;
        }
        String id = UUID.randomUUID().toString();
        try {
            JSONObject file = new JSONObject();
            file.put("id", id);
            file.put("name", name);
            file.put("mime", mime == null ? "application/octet-stream" : mime);
            if (!relativePath.isEmpty()) file.put("relativePath", relativePath);
            sources.put(id, new Source(uri));
            selection.files.put(file);
            selection.bytes += Math.max(0, size);
        } catch (JSONException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    InputStream open(String id) throws IOException {
        Source source = sources.remove(id);
        if (source == null || source.expiresAt < SystemClock.elapsedRealtime()) return null;
        return resolver.openInputStream(source.uri);
    }

    private void prune() {
        long now = SystemClock.elapsedRealtime();
        sources.entrySet().removeIf(entry -> entry.getValue().expiresAt < now);
    }

    void clear() { sources.clear(); }

    private boolean isReadableContentUri(Uri uri) {
        return uri != null && ContentResolver.SCHEME_CONTENT.equals(uri.getScheme())
            && uri.getAuthority() != null && !ownAuthority.equals(uri.getAuthority());
    }

    private static String nameOf(String displayName) {
        if (displayName == null) return "File";
        String name = displayName.replace('/', '_').replace((char) 92, '_').replaceAll("\\p{Cntrl}", "_").trim();
        if (name.isEmpty() || name.equals(".") || name.equals("..")) return "File";
        return name.length() > 200 ? name.substring(0, 200) : name;
    }

    static JSONObject warning(String source, String message) {
        Selection selection = new Selection();
        if (message != null) selection.warnings.put(message);
        return notice(source, selection);
    }

    private static JSONObject notice(String source, Selection selection) {
        try {
            JSONObject result = new JSONObject();
            result.put("source", source);
            result.put("files", selection.files);
            result.put("warnings", selection.warnings);
            return result;
        } catch (JSONException impossible) {
            throw new IllegalStateException(impossible);
        }
    }
}
