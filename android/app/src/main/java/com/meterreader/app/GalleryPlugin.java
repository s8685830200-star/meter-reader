package com.meterreader.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
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

        try {
            byte[] imageBytes = Base64.decode(base64, Base64.DEFAULT);

            ContentValues values = new ContentValues();
            values.put(MediaStore.Images.Media.DISPLAY_NAME, fileName);
            values.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // Android 10+: use RELATIVE_PATH to create custom album
                values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/" + album);
                values.put(MediaStore.Images.Media.IS_PENDING, 1);
            }

            ContentResolver resolver = getContext().getContentResolver();
            Uri uri = resolver.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);

            if (uri == null) {
                call.reject("Failed to create MediaStore entry");
                return;
            }

            OutputStream out = resolver.openOutputStream(uri);
            if (out == null) {
                call.reject("Failed to open output stream");
                return;
            }

            out.write(imageBytes);
            out.flush();
            out.close();

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                // Mark as complete
                values.clear();
                values.put(MediaStore.Images.Media.IS_PENDING, 0);
                resolver.update(uri, values, null, null);
            }

            JSObject ret = new JSObject();
            ret.put("uri", uri.toString());
            ret.put("path", Environment.DIRECTORY_PICTURES + "/" + album + "/" + fileName);
            call.resolve(ret);

        } catch (Exception e) {
            call.reject("Failed to save image: " + e.getMessage(), e);
        }
    }
}
