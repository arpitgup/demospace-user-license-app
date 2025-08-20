# License Reservation Backend

This directory contains the FastAPI app for license reservation management and admin functionalities. This app uses Python **3.12** version.

## Local Development

### Prerequisites
You need to have the below things setup before running the app locally:
- A **Cloud SQL Instance** to connect to
- [Cloud SQL Auth Proxy](https://cloud.google.com/sql/docs/mysql/connect-instance-auth-proxy#install-proxy) installed
- Two [Cloud Tasks queues](https://cloud.google.com/tasks/docs/creating-queues) created - one for license allocation and another for license revocation tasks
- `license-management-api` app deployed to Cloud Run, and its URL ready
- A service account with **Cloud Run Invoker** role which will be used by Cloud Tasks to invoke the `license-management-api` service deployed to Cloud Run
- Google Admin credentials for working with the directory APIs. Refer these environment variables:
  - `DELEGATED_ADMIN`: Admin email which will be used for delegation and API authentication
  - `ADMIN_SERVICE_ACCOUNT_KEY_SECRET_NAME`: Admin credentials downloaded and stored in Secret Manager
  - `PORTAL_ADMIN_GROUP_EMAIL`: Group email used for authorizing with `/admin` endpoints

### Run app locally

Use below commands to start the application

```bash
# Install dependencies
pip install -r requirements.txt

# Install the shared package in editable mode
pip install -e ../shared

# Set the required environment variables
export GCP_PROJECT_ID=
export GCP_LOCATION=
export LICENSE_ALLOCATION_QUEUE=
export LICENSE_REVOCATION_QUEUE=
export LICENSE_MANAGEMENT_API_ENDPOINT=
export LICENSE_ENDPOINTS_INVOKER_SERVICE_ACCOUNT=
export DB_USER=
export DB_HOST=127.0.0.1    # Connects to Cloud SQL Auth Proxy
export DB_PORT=
export DB_NAME=
export DB_PASSWORD_SECRET_NAME=
export DELEGATED_ADMIN=
export ADMIN_SERVICE_ACCOUNT_KEY_SECRET_NAME=
export PORTAL_ADMIN_GROUP_EMAIL=

# Start the Cloud SQL Auth Proxy
./cloud-sql-proxy <YOUR_PROJECT_ID>:<LOCATION>:<CLOUD_SQL_INSTANCE_ID>

# Run the app
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Once started, navigate to `http://localhost:8000/docs` to view and try out the APIs

## Unit Tests

The `tests/` directory contains the unit tests (`pytest`) for all the API endpoints.

The tests are divided into different files (`test_*`), with each file testing a single `router` in FastAPI app.

To run the tests, use the below command
```bash
cd tests

pytest
```

If you want to run tests only for a specific `router`, use the below command
```bash
# Example for testing admin endpoints
pytest tests/test_admin.py
```

For more verbose information about tests, you can use the `-v` parameter
```bash
pytest -v
```