package com.odhavram.generalstore;

import android.Manifest;
import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.os.Build;
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
import java.io.IOException;
import java.io.OutputStream;
import java.lang.reflect.Method;
import java.util.Set;
import java.util.UUID;

@CapacitorPlugin(
    name = "ThermalPrinter",
    permissions = {
        @Permission(
            alias = "bluetooth",
            strings = {
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.BLUETOOTH_SCAN
            }
        )
    }
)
public class ThermalPrinterPlugin extends Plugin {
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    private BluetoothSocket socket;
    private OutputStream output;
    private final Object lock = new Object();

    @PluginMethod
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", getAdapter() != null);
        call.resolve(ret);
    }

    @PluginMethod
    public void isConnected(PluginCall call) {
        JSObject ret = new JSObject();
        synchronized (lock) {
            ret.put("connected", socket != null && socket.isConnected());
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void listBondedDevices(PluginCall call) {
        if (!ensureBluetoothPermission(call)) {
            return;
        }
        listBondedDevicesAfterPermission(call);
    }

    @PluginMethod
    public void connect(PluginCall call) {
        if (!ensureBluetoothPermission(call)) {
            return;
        }
        connectAfterPermission(call);
    }

    @PluginMethod
    public void write(PluginCall call) {
        String data = call.getString("data");
        if (data == null || data.isEmpty()) {
            call.reject("No data to print");
            return;
        }
        byte[] bytes;
        try {
            bytes = Base64.decode(data, Base64.DEFAULT);
        } catch (IllegalArgumentException e) {
            call.reject("Invalid print data");
            return;
        }

        getBridge()
            .executeOnBackgroundThread(
                () -> {
                    try {
                        synchronized (lock) {
                            if (output == null || socket == null || !socket.isConnected()) {
                                call.reject("Printer is not connected");
                                return;
                            }
                            int offset = 0;
                            while (offset < bytes.length) {
                                int len = Math.min(1024, bytes.length - offset);
                                output.write(bytes, offset, len);
                                offset += len;
                            }
                            output.flush();
                        }
                        call.resolve();
                    } catch (IOException e) {
                        closeQuietly();
                        call.reject("Print failed: " + e.getMessage());
                    }
                }
            );
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        closeQuietly();
        call.resolve();
    }

    @PermissionCallback
    private void bluetoothPerms(PluginCall call) {
        if (getPermissionState("bluetooth") != PermissionState.GRANTED) {
            call.reject("Bluetooth permission denied. Allow nearby devices to connect the printer.");
            return;
        }
        String method = call.getMethodName();
        if ("listBondedDevices".equals(method)) {
            listBondedDevicesAfterPermission(call);
        } else if ("connect".equals(method)) {
            connectAfterPermission(call);
        } else {
            call.reject("Bluetooth permission granted. Try again.");
        }
    }

    private boolean ensureBluetoothPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            return true;
        }
        if (getPermissionState("bluetooth") == PermissionState.GRANTED) {
            return true;
        }
        requestPermissionForAlias("bluetooth", call, "bluetoothPerms");
        return false;
    }

    @SuppressLint("MissingPermission")
    private void listBondedDevicesAfterPermission(PluginCall call) {
        BluetoothAdapter adapter = getAdapter();
        if (adapter == null) {
            call.reject("This phone has no Bluetooth");
            return;
        }
        JSArray devices = new JSArray();
        Set<BluetoothDevice> bonded = adapter.getBondedDevices();
        if (bonded != null) {
            for (BluetoothDevice device : bonded) {
                JSObject item = new JSObject();
                String name = device.getName();
                item.put("name", name == null || name.isEmpty() ? device.getAddress() : name);
                item.put("address", device.getAddress());
                devices.put(item);
            }
        }
        JSObject ret = new JSObject();
        ret.put("devices", devices);
        call.resolve(ret);
    }

    @SuppressLint("MissingPermission")
    private void connectAfterPermission(PluginCall call) {
        String address = call.getString("address");
        if (address == null || address.isEmpty()) {
            call.reject("Missing printer address");
            return;
        }
        BluetoothAdapter adapter = getAdapter();
        if (adapter == null) {
            call.reject("This phone has no Bluetooth");
            return;
        }
        if (!adapter.isEnabled()) {
            call.reject("Turn on Bluetooth, then try again");
            return;
        }

        getBridge()
            .executeOnBackgroundThread(
                () -> {
                    try {
                        adapter.cancelDiscovery();
                        BluetoothDevice device = adapter.getRemoteDevice(address);
                        BluetoothSocket next = openSocket(device);
                        OutputStream stream = next.getOutputStream();
                        synchronized (lock) {
                            closeQuietlyLocked();
                            socket = next;
                            output = stream;
                        }
                        JSObject ret = new JSObject();
                        String name = device.getName();
                        ret.put("name", name == null || name.isEmpty() ? address : name);
                        ret.put("address", address);
                        call.resolve(ret);
                    } catch (Exception e) {
                        closeQuietly();
                        call.reject(
                            "Could not connect. Pair the printer in Android Bluetooth settings, then try again. "
                                + e.getMessage()
                        );
                    }
                }
            );
    }

    @SuppressLint("MissingPermission")
    private BluetoothSocket openSocket(BluetoothDevice device) throws Exception {
        IOException last = null;
        BluetoothSocket insecure = device.createInsecureRfcommSocketToServiceRecord(SPP_UUID);
        try {
            insecure.connect();
            return insecure;
        } catch (IOException e) {
            last = e;
            closeSocketQuietly(insecure);
        }
        BluetoothSocket secure = device.createRfcommSocketToServiceRecord(SPP_UUID);
        try {
            secure.connect();
            return secure;
        } catch (IOException e) {
            last = e;
            closeSocketQuietly(secure);
        }
        try {
            Method method = device.getClass().getMethod("createRfcommSocket", int.class);
            BluetoothSocket fallback = (BluetoothSocket) method.invoke(device, 1);
            if (fallback == null) {
                throw last != null ? last : new IOException("No Bluetooth socket");
            }
            fallback.connect();
            return fallback;
        } catch (Exception e) {
            if (last != null) {
                throw last;
            }
            throw e;
        }
    }

    private BluetoothAdapter getAdapter() {
        Context context = getContext();
        if (context == null) {
            return BluetoothAdapter.getDefaultAdapter();
        }
        BluetoothManager manager = (BluetoothManager) context.getSystemService(Context.BLUETOOTH_SERVICE);
        if (manager != null) {
            return manager.getAdapter();
        }
        return BluetoothAdapter.getDefaultAdapter();
    }

    private void closeQuietly() {
        synchronized (lock) {
            closeQuietlyLocked();
        }
    }

    private void closeQuietlyLocked() {
        if (output != null) {
            try {
                output.close();
            } catch (IOException ignored) {
            }
            output = null;
        }
        closeSocketQuietly(socket);
        socket = null;
    }

    private void closeSocketQuietly(BluetoothSocket target) {
        if (target == null) {
            return;
        }
        try {
            target.close();
        } catch (IOException ignored) {
        }
    }
}
