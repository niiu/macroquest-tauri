#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use rusqlite::{Connection, OptionalExtension, params};
use std::sync::Mutex;
use tauri::{Manager, State};

struct Database(Mutex<Connection>);

#[tauri::command]
fn toggle_devtools(window: tauri::WebviewWindow) {
    if window.is_devtools_open() { window.close_devtools(); } else { window.open_devtools(); }
}

#[tauri::command]
fn read_record(db: State<Database>, key: String) -> Result<Option<String>, String> {
    db.0.lock().map_err(|e| e.to_string())?
        .query_row("SELECT value FROM records WHERE key=?1", [key], |row| row.get(0))
        .optional().map_err(|e| e.to_string())
}

#[tauri::command]
fn write_records(db: State<Database>, entries: Vec<(String, String)>) -> Result<(), String> {
    let mut conn = db.0.lock().map_err(|e| e.to_string())?;
    put_records(&mut conn, entries)
}

fn put_records(conn: &mut Connection, entries: Vec<(String, String)>) -> Result<(), String> {
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    for (key, value) in entries {
        serde_json::from_str::<serde_json::Value>(&value).map_err(|e| e.to_string())?;
        tx.execute("INSERT INTO records(key,value) VALUES(?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value", params![key,value]).map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn database() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch("CREATE TABLE records(key TEXT PRIMARY KEY, value TEXT NOT NULL);").unwrap();
        conn
    }
    #[test]
    fn failed_batch_rolls_back_quest_and_catalog() {
        let mut conn = database();
        put_records(&mut conn, vec![("quest:a".into(), "{\"title\":\"original\"}".into())]).unwrap();
        assert!(put_records(&mut conn, vec![("quest:a".into(), "{}".into()), ("catalog".into(), "invalid json".into())]).is_err());
        let value: String = conn.query_row("SELECT value FROM records WHERE key='quest:a'", [], |r| r.get(0)).unwrap();
        assert_eq!(value, "{\"title\":\"original\"}");
        assert_eq!(conn.query_row("SELECT COUNT(*) FROM records", [], |r| r.get::<_, i64>(0)).unwrap(), 1);
    }
    #[test]
    fn quests_and_atlas_are_independent_records() {
        let mut conn = database();
        put_records(&mut conn, vec![("quest:a".into(), "1".into()), ("quest:b".into(), "2".into()), ("atlas-v1".into(), "3".into())]).unwrap();
        put_records(&mut conn, vec![("quest:a".into(), "4".into())]).unwrap();
        let values: Vec<String> = conn.prepare("SELECT value FROM records ORDER BY key").unwrap().query_map([], |r| r.get(0)).unwrap().map(Result::unwrap).collect();
        assert_eq!(values, vec!["3", "4", "2"]);
    }
}

// Paths originate in native dialogs, never in untrusted article content.
#[tauri::command]
async fn export_file(name: String, content: String) -> Result<bool, String> {
    let Some(file) = rfd::AsyncFileDialog::new().set_file_name(&name).save_file().await else { return Ok(false) };
    file.write(content.as_bytes()).await.map_err(|e| e.to_string())?;
    Ok(true)
}

fn main() {
    tauri::Builder::default().setup(|app| {
        let folder = app.path().app_data_dir()?;
        std::fs::create_dir_all(&folder)?;
        let conn = Connection::open(folder.join("macroquest.sqlite3"))?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS records(key TEXT PRIMARY KEY, value TEXT NOT NULL);")?;
        app.manage(Database(Mutex::new(conn)));
        Ok(())
    }).invoke_handler(tauri::generate_handler![read_record, write_records, export_file, toggle_devtools])
        .run(tauri::generate_context!()).expect("Не удалось запустить Макроквест");
}
