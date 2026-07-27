package com.meterreader.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

@CapacitorPlugin(name = "Gallery")
public class GalleryPlugin extends Plugin {

    @PluginMethod
    public void saveImage(PluginCall call) {
        String base64 = call.getString("base64");
        String album = call.getString("album", "抄表照片");
        String fileName = call.getString("fileName", "photo_" + System.currentTimeMillis() + ".jpg");

        if (base64 == null || base64.isEmpty()) {
            call.reject("base64 data is empty");
            return;
        }

        byte[] imageBytes = null;
        try {
            imageBytes = Base64.decode(base64, Base64.DEFAULT);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // Android 10+: MediaStore with RELATIVE_PATH for custom albums
                saveViaMediaStore(imageBytes, album, fileName, call);
            } else {
                // Android 9 and below: write to external storage directly
                saveViaExternalStorage(imageBytes, album, fileName, call);
            }
        } catch (Exception e) {
            // Fallback: write to app external files as last resort
            if (imageBytes != null) {
                fallbackSave(imageBytes, album, fileName, call, e);
            } else {
                call.reject("Failed to decode base64: " + e.getMessage());
            }
        }
    }

    private void saveViaMediaStore(byte[] imageBytes, String album, String fileName, PluginCall call) throws Exception {
        ContentValues values = new ContentValues();
        values.put(MediaStore.Images.Media.DISPLAY_NAME, fileName);
        values.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
        values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/" + album);
        values.put(MediaStore.Images.Media.IS_PENDING, 1);

        ContentResolver resolver = getContext().getContentResolver();
        Uri uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);

        if (uri == null) {
            throw new Exception("MediaStore insert returned null");
        }

        OutputStream out = resolver.openOutputStream(uri);
        if (out == null) {
            throw new Exception("Failed to open output stream");
        }

        out.write(imageBytes);
        out.flush();
        out.close();

        // Mark as complete — MediaStore will scan automatically on most devices
        values.clear();
        values.put(MediaStore.Images.Media.IS_PENDING, 0);
        resolver.update(uri, values, null, null);

        // Explicitly trigger media scan to ensure gallery picks up the new file
        MediaScannerConnection.scanFile(
            getContext(),
            new String[] { Environment.getExternalStoragePublicDirectory(
                Environment.DIRECTORY_PICTURES + "/" + album + "/" + fileName).getAbsolutePath() },
            new String[] { "image/jpeg" },
            null
        );

        JSObject ret = new JSObject();
        ret.put("uri", uri.toString());
        ret.put("path", Environment.DIRECTORY_PICTURES + "/" + album + "/" + fileName);
        call.resolve(ret);
    }

    private void saveViaExternalStorage(byte[] imageBytes, String album, String fileName, PluginCall call) throws Exception {
        File dir = new File(
            Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES),
            album
        );
        if (!dir.exists()) dir.mkdirs();

        File file = new File(dir, fileName);
        FileOutputStream fos = new FileOutputStream(file);
        fos.write(imageBytes);
        fos.flush();
        fos.close();

        // Trigger media scan for older Android
        MediaScannerConnection.scanFile(
            getContext(),
            new String[] { file.getAbsolutePath() },
            new String[] { "image/jpeg" },
            null
        );

        JSObject ret = new JSObject();
        ret.put("path", file.getAbsolutePath());
        call.resolve(ret);
    }

    private void fallbackSave(byte[] imageBytes, String album, String fileName, PluginCall call, Exception originalError) {
        try {
            File dir = new File(getContext().getExternalFilesDir(null), album);
            if (!dir.exists()) dir.mkdirs();
            File file = new File(dir, fileName);
            FileOutputStream fos = new FileOutputStream(file);
            fos.write(imageBytes);
            fos.flush();
            fos.close();

            JSObject ret = new JSObject();
            ret.put("path", file.getAbsolutePath());
            ret.put("fallback", true);
            call.resolve(ret);
        } catch (Exception e2) {
            call.reject("Save failed: " + originalError.getMessage());
        }
    }
}
