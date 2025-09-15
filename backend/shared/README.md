# Shared Python Package for License Reservation

This directory contains the shared python package which is used by other services in backend.

## Folder Structure 📂
```
shared/
├── shared_lib/
│   ├── db/
│   │   ├── __init__.py
│   │   ├── models.py
│   │   └── session.py
│   ├── __init__.py
│   ├── admin_service.py
│   ├── dependencies.py  
│   ├── enums.py  
│   └── utils.py
└── pyproject.toml
```

`pyproject.toml` file tells Python's packaging tools (like `pip`) that the `shared_lib` directory is a package that can be installed.

`shared_lib` is the actual installable package which contains the code for different utilities:
- `db`: DB models and session management

- `admin_service`: Service to interact with Google Workspace directory

- `dependencies`: Dependencies required in FastAPI app endpoints

- `enums`: Enum types used across different apps

## Using the shared package 📦

To make the apps recognize the shared code during development, we install the package in **editable mode**.

For example, from the (service) root directory run this command:
```bash
cd license-reservation-backend

pip install -e ../shared
```
This creates a link to your shared code in your Python environment. Now, your API apps can import from it just like any other installed library (e.g., `fastapi`), and any changes you make to the shared code are immediately available without reinstalling.