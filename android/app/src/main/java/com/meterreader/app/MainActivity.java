package com.meterreader.app;

import android.os.Bundle;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 必须在 super.onCreate() 之前注册自定义插件，
        // 因为 BridgeActivity.onCreate() 会初始化桥并加载插件列表
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
            }
        } catch (Exception ignored) {}
    }
}