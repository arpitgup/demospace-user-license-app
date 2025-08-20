# License Management API

This directory contains the FastAPI app for allocation and revocation of licenses. This API will be invoked via Cloud Tasks at a schedule.

This app uses Python **3.12** version.


## Endpoints
1. `/licenses/provision`
   - This API is triggered at the reservation start time (UTC)
   - Use this API to test the license allocation
   - For subscription based apps, this will add a custom `SAML_APPNAME` attributes to the user's account
   - For environment based apps, this will add the user to a predefined group (Check `applications.license_group` column in DB)

1. `/licenses/deprovision`
   - This API is triggered at the reservation end time (UTC)
   - Use this API to test the license revocation
   - For subscription based apps, this will clear the custom `SAML_APPNAME` attributes from the user's account
   - For environment based apps, this will remove the user from the app license group


## Local Development

### Prerequisites
You need to have the below things setup before running the app locally:
- A **Cloud SQL Instance** to connect to
- [Cloud SQL Auth Proxy](https://cloud.google.com/sql/docs/mysql/connect-instance-auth-proxy#install-proxy) installed
- Google Admin credentials for working with the directory APIs. Refer these environment variables:
  - `DELEGATED_ADMIN`: Admin email which will be used for delegation and API authentication
  - `ADMIN_SERVICE_ACCOUNT_KEY_SECRET_NAME`: Admin credentials downloaded and stored in Secret Manager

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
export DB_USER=
export DB_HOST=127.0.0.1    # Connects to Cloud SQL Auth Proxy
export DB_PORT=
export DB_NAME=
export DB_PASSWORD_SECRET_NAME=
export DELEGATED_ADMIN=
export ADMIN_SERVICE_ACCOUNT_KEY_SECRET_NAME=

# Start the Cloud SQL Auth Proxy
./cloud-sql-proxy <YOUR_PROJECT_ID>:<LOCATION>:<CLOUD_SQL_INSTANCE_ID>

# Run the app
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Once started, navigate to `http://localhost:8000/docs` to view and try out the APIs.
