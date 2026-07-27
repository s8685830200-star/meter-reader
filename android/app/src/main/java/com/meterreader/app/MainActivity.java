package com.meterreader.app;

import android.os.Bundle;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Configure WebView for better getUserMedia compatibility (fallback for live scanning)
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                // Allow video playback without user gesture — needed for getUserMedia camera stream
                webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
                // Enable DOM storage for html5-qrcode
                webView.getSettings().setDomStorageEnabled(true);
                // Ensure JavaScript is enabled (should be default)
                webView.getSettings().setJavaScriptEnabled(true);
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onResume() {
        super.onResume();
        // Capacitor's BridgeWebChromeClient handles both:
        // - onPermissionRequest (getUserMedia for html5-qrcode)
        // - onShowFileChooser (<input capture> for our photo-based scanner)
        // Our AndroidManifest declares CAMERA / ACCESS_FINE_LOCATION / ACCESS_COARSE_LOCATION.
        // Capacitor will prompt the user for these permissions when needed.
        // No additional native permission handling needed here.
    }
}
