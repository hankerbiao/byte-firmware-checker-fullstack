FROM quality-monitoring-backend:local

USER root

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir \
    "pdfplumber>=0.11.9,<1.0.0" \
    "pypdf2>=3.0.1,<4.0.0" \
    "reportlab>=4.0.0,<5.0.0"

COPY app ./app

RUN mkdir -p /app/data/uploads /app/data/reports

EXPOSE 9001

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "9001"]
