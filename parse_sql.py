import json

with open('/Users/arpitgup/Downloads/studio_results_20260522_1541.json') as f:
    data = json.load(f)

sql = []
for item in data:
    demo_id = item['demo_id']
    ge_link = item.get('gemini_enterprise_app_link', '')
    drive_link = item.get('drive_folder_link', '')
    
    artifacts = []
    if ge_link:
        artifacts.append({"title": "GE App", "url": ge_link})
    if drive_link:
        artifacts.append({"title": "Drive URL", "url": drive_link})
        
    json_str = json.dumps(artifacts).replace("'", "''")
    sql.append(f"UPDATE demo_details SET artifact_links = '{json_str}'::jsonb WHERE demo_id = '{demo_id}';")

print("\n".join(sql))
