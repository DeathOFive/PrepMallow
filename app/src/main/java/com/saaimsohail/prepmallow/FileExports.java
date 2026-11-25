/* Copyright (C) 2026 Saaim Sohail
 * SPDX-License-Identifier: GPL-3.0-only
 */
package com.saaimsohail.prepmallow;

import android.content.Context;
import android.net.Uri;
import android.util.Base64;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.UUID;

final class FileExports {
    private static final long MAX_OUTPUT_BYTES = 256_000_000L;
    private static final int MAX_CHUNK_BYTES = 256 * 1024;
    private static final long CACHE_TTL_MS = 24L * 60 * 60 * 1000;

    private final Context context;
    private Transfer active;

    FileExports(Context context) { this.context = context; }

    static final class Output {
        final String id;
        final String name;
        final String mime;
        final boolean share;

        Output(String id, String name, String mime, boolean share) {
            this.id = id;
            this.name = name;
            this.mime = mime;
            this.share = share;
        }

        Uri uri(String packageName) {
            return new Uri.Builder().scheme("content").authority(packageName + ".exports")
                .appendPath(id).appendPath(name).build();
        }
    }

    private static final class Transfer {
        final Output output;
        final FileOutputStream stream;
        final long total;
        long written;

        Transfer(Output output, FileOutputStream stream, long total) {
            this.output = output;
            this.stream = stream;
            this.total = total;
        }
    }

    synchronized String begin(String action, String name, String mime, long total) {
        if (active != null || total < 0 || total > MAX_OUTPUT_BYTES || (!"save".equals(action) && !"share".equals(action))) return "";
        String id = UUID.randomUUID().toString().replace("-", "");
        Output output = new Output(id, safeName(name), safeMime(mime), "share".equals(action));
        File file = file(context, id);
        if (!file.getParentFile().mkdirs()) return "";
        try {
            active = new Transfer(output, new FileOutputStream(file), total);
            return id;
        } catch (IOException problem) {
            remove(context, id);
            return "";
        }
    }

    synchronized boolean append(String id, String base64) {
        if (active == null || !active.output.id.equals(id) || base64 == null || base64.length() > (MAX_CHUNK_BYTES + 2) / 3 * 4) return false;
        try {
            byte[] bytes = Base64.decode(base64, Base64.NO_WRAP);
            if (bytes.length > MAX_CHUNK_BYTES || bytes.length > active.total - active.written) return false;
            active.stream.write(bytes);
            active.written += bytes.length;
            return true;
        } catch (IOException | IllegalArgumentException problem) {
            cancel(id);
            return false;
        }
    }

    synchronized Output finish(String id) {
        if (active == null || !active.output.id.equals(id)) return null;
        Transfer finished = active;
        active = null;
        try {
            finished.stream.close();
            if (finished.written == finished.total) return finished.output;
        } catch (IOException ignored) { }
        remove(context, id);
        return null;
    }

    synchronized void cancel(String id) {
        if (active == null || !active.output.id.equals(id)) return;
        try { active.stream.close(); }
        catch (IOException ignored) { }
        active = null;
        remove(context, id);
    }

    synchronized void close() {
        if (active != null) cancel(active.output.id);
    }

    void prune(String keepId) {
        File[] dirs = root(context).listFiles();
        if (dirs == null) return;
        long cutoff = System.currentTimeMillis() - CACHE_TTL_MS;
        for (File dir : dirs) {
            String id = dir.getName();
            if (validId(id) && !id.equals(keepId) && dir.lastModified() < cutoff) remove(context, id);
        }
    }

    private static File root(Context context) { return new File(context.getCacheDir(), "exports"); }

    static boolean validId(String id) { return id != null && id.matches("[a-f0-9]{32}"); }

    static File file(Context context, String id) { return new File(new File(root(context), id), "payload"); }

    static void remove(Context context, String id) {
        if (!validId(id)) return;
        File file = file(context, id);
        file.delete();
        file.getParentFile().delete();
    }

    static String safeName(String input) {
        if (input == null) return "PrepMallow-file";
        String name = input.replace('/', '_').replace((char) 92, '_').replace(':', '_')
            .replaceAll("\\p{Cntrl}", "_").trim();
        if (name.isEmpty() || name.equals(".") || name.equals("..")) return "PrepMallow-file";
        int length = name.codePointCount(0, name.length());
        return length > 140 ? name.substring(0, name.offsetByCodePoints(0, 140)) : name;
    }

    private static String safeMime(String input) {
        return input != null && input.length() < 100 && input.matches("[a-zA-Z0-9.+-]+/[a-zA-Z0-9.+-]+")
            ? input : "application/octet-stream";
    }
}
