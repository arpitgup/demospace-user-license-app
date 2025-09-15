import pytest
from shared_lib.db.models import AppConfig
from shared_lib.dependencies import refresh_app_config


@pytest.fixture(scope="function", autouse=True)
def seed_app_config(db_session):
    """Seeds the database with initial AppConfig data."""
    config1 = AppConfig(key="key1", value="value1", description="desc1")
    config2 = AppConfig(key="key2", value="12345", description="desc2")
    db_session.add_all([config1, config2])
    db_session.commit()
    return [config1, config2]


def test_get_app_config(test_client):
    """Test retrieving the application configuration."""
    response = test_client.get("/config")

    assert response.status_code == 200
    expected_data = {
        "key1": "value1",
        "key2": 12345,
    }
    assert response.json() == expected_data


def test_set_app_config(test_client, db_session, mock_background_tasks_add_task):
    """Test updating the application configuration."""
    update_request = {
        "configs": [
            {"key": "key1", "value": "new_value1", "description": "new_desc1"},
            {"key": "key2", "value": "new_value2"},
        ]
    }

    response = test_client.post("/config", json=update_request)

    assert response.status_code == 200
    # Verify response data
    data = response.json()
    response_map = {item["key"]: item for item in data}
    assert response_map["key1"]["value"] == "new_value1"
    assert response_map["key1"]["description"] == "new_desc1"
    assert response_map["key2"]["value"] == "new_value2"
    assert response_map["key2"]["description"] is None

    # Verify database changes
    db_session.expire_all()
    config1 = db_session.query(AppConfig).filter(AppConfig.key == "key1").one()
    config2 = db_session.query(AppConfig).filter(AppConfig.key == "key2").one()
    assert config1.value == "new_value1"
    assert config1.description == "new_desc1"
    assert config2.value == "new_value2"
    assert config2.description is None

    # Verify background task was called
    mock_background_tasks_add_task.assert_called_once_with(refresh_app_config)


def test_set_app_config_partial_update(test_client, db_session):
    """Test updating only one configuration value."""
    update_request = {
        "configs": [
            {"key": "key1", "value": "new_value1", "description": "new_desc1"},
        ]
    }
    response = test_client.post("/config", json=update_request)
    assert response.status_code == 200
    assert len(response.json()) == 1

    # Verify database changes
    db_session.expire_all()
    config1 = db_session.query(AppConfig).filter(AppConfig.key == "key1").one()
    config2 = db_session.query(AppConfig).filter(AppConfig.key == "key2").one()
    assert config1.value == "new_value1"
    assert config2.value == "12345"


def test_set_app_config_nonexistent_key(test_client):
    """Test updating a configuration key that does not exist."""
    update_request = {
        "configs": [
            {"key": "nonexistent_key", "value": "some_value"},
        ]
    }
    response = test_client.post("/config", json=update_request)

    assert response.status_code == 200
    assert response.json() == []
