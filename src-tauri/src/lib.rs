#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|_app| {
      #[cfg(not(debug_assertions))]
      {
        if let Ok(updater) = tauri_plugin_updater::UpdaterExt::updater(_app) {
          tauri::async_runtime::spawn(async move {
            if let Ok(Some(update)) = updater.check().await {
              let _ = update.download_and_install(|_, _| {}, || {}).await;
            }
          });
        }
      }
      Ok(())
    })
    .plugin(tauri_plugin_updater::Builder::new().build())
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}