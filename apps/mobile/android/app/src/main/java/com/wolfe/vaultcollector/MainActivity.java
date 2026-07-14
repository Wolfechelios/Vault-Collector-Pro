package com.wolfe.vaultcollector;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(VaultVisionPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
