package in.kapedutech.erp;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(KapPhonePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
