# Dependencies are preinstalled in the local build image and transferred to
# the deployment host because the server does not have outbound package access.
FROM byte-firmware-checker-fullstack-backend:latest

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt ./

COPY app ./app

RUN mkdir -p /app/data/uploads /app/data/reports

EXPOSE 9001

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "9001"]
