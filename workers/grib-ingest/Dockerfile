FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY grid_common.py ingest_gfs.py ingest_ecmwf.py ingest_icon.py icon_east_asia_source_indices.json ./

CMD ["python", "ingest_gfs.py", "--steps", "0,3,6,9,12,15,18,21,24,27,30,33,36,39,42,45,48,51,54,57,60,63,66,69,72,75,78,81,84,87,90,93,96,99,102,105,108,111,114,117,120"]
