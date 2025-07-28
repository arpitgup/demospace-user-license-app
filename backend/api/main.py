from fastapi import FastAPI
from src.api import api_router
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Define the list of origins allowed to connect.
# origins = []

# Add the CORSMiddleware to the application
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # List of allowed origins
    allow_credentials=True, # Allow cookies/authorization headers
    allow_methods=["*"],    # Allow all standard methods (GET, POST, etc.)
    allow_headers=["*"],    # Allow all headers
)
