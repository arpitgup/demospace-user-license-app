FROM python:3.12-slim

# Set the working directory in the container
WORKDIR /app

# Copy the dependencies file to the working directory
COPY license-reservation-backend/requirements.txt /app/requirements.txt
COPY shared /app/shared

# Installs any needed package specified in requirements.txt.
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir /app/shared

# Create a non-root user to run the  application
RUN adduser --disabled-password --gecos "" myuser && \
    chown -R myuser:myuser /app

# Copy the rest of the application's code to the working directory
COPY license-reservation-backend/app /app/app

# Switch to the non-root user
USER myuser

# Expose port 8080 to the outside world
EXPOSE 8080

# Command to run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
