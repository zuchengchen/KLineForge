fn main() {
    if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
        #[cfg(target_os = "linux")]
        // WebKitGTK's DMABUF renderer can fail to allocate GBM buffers on some
        // Linux GPU/Wayland combinations, preventing the Tauri window from
        // rendering even though the backend started successfully.
        unsafe {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
    }

    klineforge_lib::run();
}
