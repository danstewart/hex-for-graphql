use std::collections::HashMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
struct GraphQLRequest {
    query: String,
    variables: Option<serde_json::Value>,
    #[serde(rename = "operationName", skip_serializing_if = "Option::is_none")]
    operation_name: Option<String>,
}

#[tauri::command]
async fn execute_graphql(
    url: String,
    headers: HashMap<String, String>,
    query: String,
    variables: Option<serde_json::Value>,
    operation_name: Option<String>,
) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder()
        .user_agent(concat!("hex-graphql/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| e.to_string())?;
    let body = GraphQLRequest { query, variables, operation_name };

    let mut request = client.post(&url).json(&body);
    for (key, value) in &headers {
        request = request.header(key, value);
    }

    let response = request.send().await.map_err(|e| {
        if e.is_builder() {
            format!("Invalid URL: {}", url)
        } else {
            e.to_string()
        }
    })?;
    let status = response.status();
    let text = response.text().await.map_err(|e| e.to_string())?;
    let json: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| format!("HTTP {} — {}\n\nRESPONSE_BODY\n{}", status.as_u16(), e, text))?;
    Ok(json)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::new().build())
        .invoke_handler(tauri::generate_handler![execute_graphql])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
