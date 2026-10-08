FROM python:3.12-slim

# Set the working directory in the container
WORKDIR /app

# Copy the dependency files to working directory
COPY deprovisioning-job-scripts/hubspot-user-deprovisioning-job/requirements.txt /app/requirements.txt
COPY backend/shared /app/shared

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir /app/shared

# Create a non-root user to run the application
RUN adduser --disabled-password --gecos "" myuser && \
    chown -R myuser:myuser /app

# Copy the application code
COPY deprovisioning-job-scripts/hubspot-user-deprovisioning-job/ /app/

# Switch to the non-root user
USER myuser

# Run the deprovisioning script
CMD ["python", "main.py"]
