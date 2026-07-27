package com.meterreader.app;

import android.os.Bundle;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Register custom plugin as instance (annotation processor only runs
        // for library modules, not the app module)
        getBridge().registerPluginInstance(new GalleryPlugin());

        // Configure WebView for getUserMedia compatibility
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
                webView.getSettings().setDomStorageEnabled(true);
                webView.getSettings().setJavaScriptEnabled(true);
            }
        } catch (Exception ignored) {}
    }
}
