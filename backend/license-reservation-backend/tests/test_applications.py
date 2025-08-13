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
