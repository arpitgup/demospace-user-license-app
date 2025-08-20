from shared_lib.db.models import Application


def test_get_all_applications(test_client, seed_data):
    """
    Test fetching all applications.
    """
    response = test_client.get("/applications")

    data = response.json()
    assert response.status_code == 200
    assert len(data) == 4
    for i, app in enumerate(seed_data["apps"]):
        assert app.id == data[i]["id"]
        assert app.name == data[i]["name"]


def test_get_all_applications_only_active(test_client, db_session, seed_data):
    """
    Test fetching only active applications.
    """
    # Deactivate one application
    app_to_deactivate = (
        db_session.query(Application).filter(Application.name == "Jira").one()
    )
    app_to_deactivate.is_active = False
    db_session.commit()

    response = test_client.get("/applications")
    data = response.json()

    assert response.status_code == 200
    assert len(data) == 3
    active_app_names = [app["name"] for app in data]
    assert "Jira" not in active_app_names
    assert "Slack" in active_app_names
    assert "Salesforce" in active_app_names
    assert "Box" in active_app_names
