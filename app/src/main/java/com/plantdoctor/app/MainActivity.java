package com.plantdoctor.app;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.ImageDecoder;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private static final int REQUEST_CAMERA = 1001;
    private static final int REQUEST_GALLERY = 1002;

    private WebView webView;
    private Uri cameraImageUri;
    private final ExecutorService imageExecutor = Executors.newSingleThreadExecutor();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(android.graphics.Color.rgb(245, 248, 245));
        getWindow().setNavigationBarColor(android.graphics.Color.rgb(245, 248, 245));
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient());
        webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");
        webView.loadUrl("file:///android_asset/index.html");
    }

    public final class AndroidBridge {
        @JavascriptInterface
        public void takePhoto() {
            runOnUiThread(MainActivity.this::openCamera);
        }

        @JavascriptInterface
        public void choosePhoto() {
            runOnUiThread(MainActivity.this::openGallery);
        }

        @JavascriptInterface
        public void shareReport(String report) {
            runOnUiThread(() -> {
                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType("text/plain");
                send.putExtra(Intent.EXTRA_TEXT, report);
                startActivity(Intent.createChooser(send, "Share plant report"));
            });
        }
    }

    private void openCamera() {
        ContentValues values = new ContentValues();
        values.put(MediaStore.Images.Media.DISPLAY_NAME, "plant_leaf_" + System.currentTimeMillis() + ".jpg");
        values.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
        values.put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/PlantDoctor");
        cameraImageUri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);

        if (cameraImageUri == null) {
            Toast.makeText(this, "Could not create camera image", Toast.LENGTH_SHORT).show();
            return;
        }

        Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        intent.putExtra(MediaStore.EXTRA_OUTPUT, cameraImageUri);
        intent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
        if (intent.resolveActivity(getPackageManager()) != null) {
            startActivityForResult(intent, REQUEST_CAMERA);
        } else {
            Toast.makeText(this, "No camera app is available", Toast.LENGTH_SHORT).show();
        }
    }

    private void openGallery() {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("image/*");
        startActivityForResult(intent, REQUEST_GALLERY);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (resultCode != RESULT_OK) {
            if (requestCode == REQUEST_CAMERA && cameraImageUri != null) {
                getContentResolver().delete(cameraImageUri, null, null);
                cameraImageUri = null;
            }
            return;
        }

        Uri imageUri = requestCode == REQUEST_CAMERA
                ? cameraImageUri
                : (data != null ? data.getData() : null);
        if (imageUri != null) deliverImageToWebView(imageUri);
    }

    private void deliverImageToWebView(Uri uri) {
        webView.evaluateJavascript("window.showImageLoading && window.showImageLoading()", null);
        imageExecutor.execute(() -> {
            try {
                ImageDecoder.Source source = ImageDecoder.createSource(getContentResolver(), uri);
                Bitmap bitmap = ImageDecoder.decodeBitmap(source, (decoder, info, src) -> {
                    int width = info.getSize().getWidth();
                    int height = info.getSize().getHeight();
                    int max = Math.max(width, height);
                    if (max > 1600) {
                        float scale = 1600f / max;
                        decoder.setTargetSize(Math.round(width * scale), Math.round(height * scale));
                    }
                    decoder.setAllocator(ImageDecoder.ALLOCATOR_SOFTWARE);
                });

                ByteArrayOutputStream output = new ByteArrayOutputStream();
                bitmap.compress(Bitmap.CompressFormat.JPEG, 90, output);
                bitmap.recycle();
                String encoded = Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP);
                String script = "window.receiveNativeImage('data:image/jpeg;base64," + encoded + "')";
                runOnUiThread(() -> webView.evaluateJavascript(script, null));
            } catch (IOException | RuntimeException error) {
                runOnUiThread(() -> {
                    Toast.makeText(this, "Could not open that image", Toast.LENGTH_SHORT).show();
                    webView.evaluateJavascript("window.hideImageLoading && window.hideImageLoading()", null);
                });
            }
        });
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        imageExecutor.shutdownNow();
        if (webView != null) webView.destroy();
        super.onDestroy();
    }
}
