from google.cloud.secretmanager_v1 import SecretManagerServiceClient
from loguru import logger


def get_secret_value(project_id: str, secret_name: str, version_id="latest"):
    """Retrieves the value of a secret from Google Cloud Secret Manager."""
    secret_version_name = (
        f"projects/{project_id}/secrets/{secret_name}/versions/{version_id}"
    )
    try:
        client = SecretManagerServiceClient()
        response = client.access_secret_version(name=secret_version_name)
        return response.payload.data.decode("UTF-8")
    except Exception as e:
        logger.error(
            f"Error occurred while accessing secret {secret_version_name}: {e}"
        )
        return None