# Agentspace License Reservation Backend


## Folder Structure 📂

```
backend/
│
├── license-management-api/ 
│   ├── app/
│   │   └── ...
│   ├── Dockerfile
│   ├── cloudbuild.yaml
│   └── requirements.txt
│
├── license-reservation-backend/
│   ├── app/
│   │   └── ...
│   ├── tests/
│   │   └── ...
│   ├── Dockerfile
│   ├── cloudbuild.yaml
│   └── requirements.txt
│
├── shared/
│   ├── shared_lib/
│   │   └── ...
│   ├── pyproject.toml
│   └── README.md
│
└── sql/
    └── create_tables.sql
```

- `sql`: Contains  the SQL schema to create tables required for app backend.

- `shared`: The installable shared python package which contains DB + utility code.

- `license-reservation-backend`: FastAPI app for license reservation. Contains the code to create and manage the user reservations and admin functionalities.

- `license-management-api`: FastAPI app for license management which is invoked via Cloud Tasks to do the actual allocation/revocation of licenses.


## Local Development 🛠

When you're developing locally, you can install the `shared` package into each service in **editable mode**:

```bash
cd license-reservation-backend
pip install -e ../shared
```

This way changes in `shared/` immediately reflect in services without reinstalling


## Cloud Run Deployment 🚀

We are using Cloud Run as the deployment platform for our FastAPI apps. Our setup contains two independent FastAPI apps (`license-reservation-backend` and `license-management-api`) which depend on the common `shared` package.

To handle this common package dependency, we will do the deployment for our services from the `backend/` directory so that the `shared/` package is **visible in build context**. This is necessary for copying `shared/` directory properly in Dockerfile.

The deployment is handled using a `cloudbuild.yaml` file, which is present in each service directory.

1. First we deploy `license-management-api` service. The URL of the deployed service is needed as an environment variable for `license-reservation-backend` service. All the necessary substitutions are present in `llicense-management-api/cloudbuild.yaml` file. Change it as needed for different environments.

```bash
gcloud builds submit --config license-management-api/cloudbuild.yaml .
```


2. Then we deploy `license-reservation-backend` service. Ensure that `_LICENSE_MANAGEMENT_API_ENDPOINT` substitution (and other substitutions) are updated as needed.
```bash
gcloud builds submit --config license-reservation-backend/cloudbuild.yaml .
```

## Debugging Locally 🪲

If you're using Visual Studio Code for local development, you can debug the services by creating a launch configuration and setting breakpoints.

Below launch configuration can be re-used:
```json
{
    "version": "0.2.0",
    "configurations": [
    {
        // Debug config for license-reservation-backend
        "name": "Python: Main Backend",
        "type": "debugpy",
        "request": "launch",
        "module": "uvicorn",
        "args": [
        "app.main:app",
        "--host",
        "0.0.0.0",
        "--port",
        "8000",
        "--reload"
        ],
        "cwd": "${workspaceFolder}/backend/license-reservation-backend",
        "jinja": true,
        "justMyCode": true,
        "env": {
        "PYTHONPATH": "${workspaceFolder}/backend"
        }
    },
    {
        // Debug config for license-management-api
        "name": "Python: License Management",
        "type": "debugpy",
        "request": "launch",
        "module": "uvicorn",
        "args": [
        "app.main:app",
        "--host",
        "0.0.0.0",
        "--port",
        "8000",
        "--reload"
        ],
        "cwd": "${workspaceFolder}/backend/license-management-api",
        "jinja": true,
        "justMyCode": true,
        "env": {
        "PYTHONPATH": "${workspaceFolder}/backend"
        }
    },
    {
        // Debug config for unit tests in license-reservation-backend 
        "name": "Pytest Debug",
        "type": "debugpy",
        "request": "launch",
        "module": "pytest",
        "args": [
        "${workspaceFolder}/backend/license-reservation-backend/tests"
        ],
        "console": "integratedTerminal",
        "justMyCode": false
    }
    ]
}
```