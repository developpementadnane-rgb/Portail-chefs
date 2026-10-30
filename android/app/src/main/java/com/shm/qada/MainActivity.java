package com.shm.qada;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

/**
 * The attendance scan and emergency-access screens use qr-scanner
 * (plain web getUserMedia()) rather than a Capacitor camera plugin,
 * so Capacitor's own permission plumbing (for @capacitor/camera etc.)
 * never kicks in here -- it has to be wired up by hand for the raw
 * WebView, or the camera silently fails to start even though
 * AndroidManifest.xml already declares android.permission.CAMERA.
 *
 * Two things are needed, both handled here:
 *   1. Request the Android runtime permission (the system "Allow
 *      camera access?" dialog) -- declaring it in the manifest alone
 *      is not enough on API 23+.
 *   2. Override WebChromeClient.onPermissionRequest so the WebView's
 *      own getUserMedia() permission prompt is answered: grant it
 *      when the underlying Android permission is already held,
 *      otherwise the page's camera.getUserMedia() call rejects with
 *      NotAllowedError before the video element ever gets a stream.
 */
public class MainActivity extends BridgeActivity {

  private final ActivityResultLauncher<String> requestCameraPermission =
      registerForActivityResult(new ActivityResultContracts.RequestPermission(), granted -> {
        // No extra action needed either way: if granted, the next
        // getUserMedia() call from the WebView succeeds via
        // onPermissionRequest below; if denied, qr-scanner surfaces
        // its own error state in the UI (see AttendanceScan.tsx /
        // EmergencyAccess.tsx "Impossible d'accéder à la caméra...").
      });

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
        != PackageManager.PERMISSION_GRANTED) {
      requestCameraPermission.launch(Manifest.permission.CAMERA);
    }

    this.bridge.getWebView().setWebChromeClient(new WebChromeClient() {
      @Override
      public void onPermissionRequest(final PermissionRequest request) {
        runOnUiThread(() -> {
          boolean camGranted =
              ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA)
                  == PackageManager.PERMISSION_GRANTED;
          if (camGranted) {
            request.grant(request.getResources());
          } else {
            request.deny();
          }
        });
      }
    });
  }
}
