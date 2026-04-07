# FROM nvidia/cuda:12.1.1-runtime-ubuntu22.04

# ENV DEBIAN_FRONTEND=noninteractive

# RUN apt-get update && apt-get install -y --no-install-recommends \
#     python3.10 python3.10-dev python3-pip python3.10-venv \
#     pkg-config default-libmysqlclient-dev gcc g++ \
#     libgl1 libglib2.0-0 curl && \
#     rm -rf /var/lib/apt/lists/* && \
#     ln -sf /usr/bin/python3.10 /usr/bin/python3

# WORKDIR /app
# COPY requirements.txt .
# RUN pip install --upgrade pip setuptools wheel && \
#     pip install --no-cache-dir -r requirements.txt

# COPY . .
# EXPOSE 8232

# CMD ["python3", "manage.py", "runserver", "0.0.0.0:8232"]


FROM nvidia/cuda:12.1.1-runtime-ubuntu22.04
ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.10 python3.10-dev python3-pip python3.10-venv \
    pkg-config default-libmysqlclient-dev gcc g++ \
    libgl1 libglib2.0-0 curl \
    tzdata && \
    ln -sf /usr/share/zoneinfo/Asia/Kolkata /etc/localtime && \
    echo "Asia/Kolkata" > /etc/timezone && \
    rm -rf /var/lib/apt/lists/* && \
    ln -sf /usr/bin/python3.10 /usr/bin/python3

WORKDIR /app
COPY requirements.txt .
RUN pip install --upgrade pip setuptools wheel && \
    pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8232
CMD ["python3", "manage.py", "runserver", "0.0.0.0:8232"]