package in.kapedutech.erp;

import android.Manifest;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.CallLog;
import android.util.Base64;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;

/**
 * Telecalling from the ERP app on the telecaller's own SIM.
 *  dial        places the call (ACTION_CALL; falls back to the dialer)
 *  lastCall    reads the phone's call log for the real talk time
 *  findRecording looks for the file the phone's own call recorder saved
 *  readFile    returns a recording as base64 so the web layer can upload it
 * Android does not let apps record calls themselves (Android 10+), so the
 * recording is the one the phone's built-in recorder makes.
 */
@CapacitorPlugin(
    name = "KapPhone",
    permissions = {
        @Permission(alias = "call", strings = { Manifest.permission.CALL_PHONE }),
        @Permission(alias = "callLog", strings = { Manifest.permission.READ_CALL_LOG }),
        @Permission(alias = "audio", strings = { Manifest.permission.READ_MEDIA_AUDIO }),
        @Permission(alias = "storage", strings = { Manifest.permission.READ_EXTERNAL_STORAGE })
    }
)
public class KapPhonePlugin extends Plugin {

    private static final long MAX_UPLOAD = 25L * 1024 * 1024;

    private static final String[] RECORDER_DIRS = {
        "Recordings/Call", "Recordings/Call recordings", "Recordings", "Call", "CallRecordings",
        "MIUI/sound_recorder/call_rec", "Music/Recordings/Call Recordings", "Record/Call",
        "Sounds/CallRecord", "PhoneRecord", "Android/media/com.google.android.dialer/CallRecordings",
        "Download/Call Recordings"
    };

    private String audioAlias() {
        return Build.VERSION.SDK_INT >= 33 ? "audio" : "storage";
    }

    @PluginMethod
    public void permissions(PluginCall call) {
        JSObject r = new JSObject();
        r.put("call", getPermissionState("call") == PermissionState.GRANTED);
        r.put("callLog", getPermissionState("callLog") == PermissionState.GRANTED);
        r.put("audio", getPermissionState(audioAlias()) == PermissionState.GRANTED);
        call.resolve(r);
    }

    @PluginMethod
    public void requestAll(PluginCall call) {
        requestPermissionForAliases(new String[] { "call", "callLog", audioAlias() }, call, "afterRequestAll");
    }

    @PermissionCallback
    private void afterRequestAll(PluginCall call) {
        permissions(call);
    }

    @PluginMethod
    public void dial(PluginCall call) {
        String number = call.getString("number", "");
        if (number == null || number.replaceAll("[^0-9+]", "").length() < 10) {
            call.reject("Invalid number");
            return;
        }
        String clean = number.replaceAll("[^0-9+]", "");
        boolean direct = getPermissionState("call") == PermissionState.GRANTED;
        Intent i = new Intent(direct ? Intent.ACTION_CALL : Intent.ACTION_DIAL, Uri.parse("tel:" + clean));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        JSObject r = new JSObject();
        r.put("direct", direct);
        r.put("startedAt", System.currentTimeMillis());
        call.resolve(r);
    }

    private static String last10(String n) {
        String d = n == null ? "" : n.replaceAll("[^0-9]", "");
        return d.length() > 10 ? d.substring(d.length() - 10) : d;
    }

    /** Newest call-log entry for this number since `since` (ms). */
    @PluginMethod
    public void lastCall(PluginCall call) {
        if (getPermissionState("callLog") != PermissionState.GRANTED) {
            call.reject("Call log permission not granted");
            return;
        }
        String want = last10(call.getString("number", ""));
        long since = call.getLong("since", 0L);
        String[] cols = { CallLog.Calls.NUMBER, CallLog.Calls.DURATION, CallLog.Calls.DATE, CallLog.Calls.TYPE };
        JSObject r = new JSObject();
        r.put("found", false);
        try (Cursor c = getContext().getContentResolver().query(CallLog.Calls.CONTENT_URI, cols,
                CallLog.Calls.DATE + " >= ?", new String[] { String.valueOf(since - 60000) }, CallLog.Calls.DATE + " DESC")) {
            if (c != null) {
                while (c.moveToNext()) {
                    if (!last10(c.getString(0)).equals(want)) continue;
                    r.put("found", true);
                    r.put("talkSeconds", c.getLong(1));
                    r.put("at", c.getLong(2));
                    int type = c.getInt(3);
                    r.put("type", type == CallLog.Calls.OUTGOING_TYPE ? "OUTGOING" : type == CallLog.Calls.INCOMING_TYPE ? "INCOMING" : type == CallLog.Calls.MISSED_TYPE ? "MISSED" : "OTHER");
                    break;
                }
            }
        } catch (SecurityException e) {
            call.reject("Call log blocked: " + e.getMessage());
            return;
        }
        call.resolve(r);
    }

    /** Newest audio file in the usual recorder folders, changed since `since` (ms). */
    @PluginMethod
    public void findRecording(PluginCall call) {
        long since = call.getLong("since", 0L);
        String want = last10(call.getString("number", ""));
        File root = Environment.getExternalStorageDirectory();
        File best = null;
        JSArray looked = new JSArray();
        for (String rel : RECORDER_DIRS) {
            File dir = new File(root, rel);
            File[] files = dir.listFiles();
            if (files == null) continue;
            looked.put(rel);
            for (File f : files) {
                if (!f.isFile() || f.lastModified() < since - 30000) continue;
                String n = f.getName().toLowerCase();
                if (!(n.endsWith(".m4a") || n.endsWith(".mp3") || n.endsWith(".amr") || n.endsWith(".aac") || n.endsWith(".wav") || n.endsWith(".ogg") || n.endsWith(".3gp") || n.endsWith(".opus"))) continue;
                boolean nameHasNumber = want.length() == 10 && n.replaceAll("[^0-9]", "").contains(want);
                if (best == null || nameHasNumber || f.lastModified() > best.lastModified()) best = f;
                if (nameHasNumber) break;
            }
        }
        JSObject r = new JSObject();
        r.put("looked", looked);
        if (best == null) {
            r.put("found", false);
        } else {
            r.put("found", true);
            r.put("path", best.getAbsolutePath());
            r.put("size", best.length());
            r.put("name", best.getName());
        }
        call.resolve(r);
    }

    @PluginMethod
    public void readFile(PluginCall call) {
        String path = call.getString("path", "");
        File f = new File(path == null ? "" : path);
        if (!f.isFile()) { call.reject("File not found"); return; }
        if (f.length() > MAX_UPLOAD) { call.reject("Recording is too large"); return; }
        byte[] buf = new byte[(int) f.length()];
        try (FileInputStream in = new FileInputStream(f)) {
            int off = 0;
            while (off < buf.length) {
                int n = in.read(buf, off, buf.length - off);
                if (n < 0) break;
                off += n;
            }
        } catch (IOException e) {
            call.reject("Could not read: " + e.getMessage());
            return;
        }
        JSObject r = new JSObject();
        r.put("base64", Base64.encodeToString(buf, Base64.NO_WRAP));
        r.put("name", f.getName());
        call.resolve(r);
    }
}
