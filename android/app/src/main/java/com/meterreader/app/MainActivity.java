package com.meterreader.app;

import android.os.Bundle;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 蹇呴』鍦?super.onCreate() 涔嬪墠娉ㄥ唽鑷畾涔夋彃浠讹紝
        // 鍥犱负 BridgeActivity.onCreate() 浼氬垵濮嬪寲妗ュ苟鍔犺浇鎻掍欢鍒楄〃
        registerPlugin(GalleryPlugin.class);

        super.onCreate(savedInstanceState);

        // Configure WebView for getUserMedia compatibility
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
                webView.getSettings().setDomStorageEnabled(true);
                webView.getSettings().setJavaScriptEnabled(true);
                webView.getSettings().setAllowFileAccess(true);
                webView.getSettings().setGeolocationEnabled(true);
            }
        } catch (Exception ignored) {}
    }
}