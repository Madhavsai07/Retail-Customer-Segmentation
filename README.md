# 🛍️ RetailIQ – Customer Segmentation Platform

A full-stack Machine Learning application that segments retail customers using **RFM Analysis** and **K-Means Clustering**, built with **FastAPI (Python)** and **React (TailwindCSS + Recharts)**.

---

## 🚀 Overview

RetailIQ helps businesses understand customer behavior by grouping customers into meaningful segments based on:

* **Recency** → How recently a customer purchased
* **Frequency** → How often they purchase
* **Monetary** → How much they spend

The system automatically:

* Processes raw transaction data
* Generates customer segments
* Assigns personas
* Provides actionable insights

---

## 🧩 Key Features

* 🔐 Authentication using Supabase
* 📊 Interactive dashboard with KPIs & charts
* 🤖 Automated ML pipeline (RFM + K-Means)
* 🧠 Persona generation with recommendations
* ⚡ FastAPI backend with REST APIs
* 🎯 Smart startup: loads precomputed artifacts if available

---

## 🏗️ Project Structure

```
retail-segmentation/
├── backend/
│   ├── main.py                    # FastAPI entry point
│   ├── api_layer.py               # REST API routes
│   ├── auth.py                    # Supabase JWT verification
│   ├── requirements.txt
│   ├── pipelines/
│   │   ├── __init__.py
│   │   ├── data_ingestion.py
│   │   ├── data_cleaning.py
│   │   ├── feature_engineering.py
│   │   ├── clustering_engine.py
│   │   ├── evaluation.py
│   │   └── persona_generator.py
│   ├── artifacts/                 # Precomputed ML outputs (included in repo)
│   │   └── admin@retail.com/
│   │       ├── rfm_features.parquet
│   │       ├── rfm_scaled.parquet
│   │       ├── cleaned_data.parquet
│   │       ├── personas.json
│   │       └── kmeans_model.pkl
│   └── data/
│       └── online_retail.xlsx     # (NOT included — download separately)
│
└── frontend/
    ├── src/
    │   ├── App.jsx
    │   ├── api/api.js
    │   ├── components/
    │   └── pages/
```

---

## ⚙️ How It Works

```
Dataset → Cleaning → RFM Features → Scaling → K-Means → Evaluation → Personas → Dashboard
```

### Smart Startup Behavior

The backend uses an **artifact-first** approach:

```
On startup:
  ┌─ Artifacts exist? ──YES──► Load from disk (fast, ~2s)
  └── NO ──► Dataset exists? ──YES──► Run full pipeline (~2–5 min), save artifacts
                              └── NO ──► Warn & start with empty state (APIs return 503)
```

---

## 🖥️ Quick Start

### 1️⃣ Backend Setup

```bash
cd backend

python -m venv venv
venv\Scripts\activate

pip install -r requirements.txt

uvicorn main:app --reload --port 8000
```

> **First run (without dataset):** Artifacts are pre-included in the repo — backend loads instantly in ~2 seconds.
>
> **With dataset:** Place `online_retail.xlsx` in `backend/data/` and delete the `artifacts/` folder to trigger a fresh pipeline run.

---

### 2️⃣ Frontend Setup

```bash
cd frontend

npm install
npm run dev
```

👉 Open: http://localhost:5173

---

## 🔐 Authentication

Authentication is handled using **Supabase**:

* Email/Password login
* Session management
* Secure JWT token-based access

---

## 🌐 API Endpoints

| Method | Endpoint                      | Description                    |
| ------ | ----------------------------- | ------------------------------ |
| GET    | `/health`                     | Health check                   |
| GET    | `/metrics`                    | KPI summary                    |
| GET    | `/segment?k=`                 | Cluster data + scatter         |
| GET    | `/personas?k=`                | Personas + recommendations     |
| GET    | `/customer/{id}`              | Customer profile & RFM metrics |
| GET    | `/cluster/{id}/customers`     | All customers in a cluster     |
| GET    | `/customer/{id}/transactions` | Full purchase history          |

---

## ⚙️ Model Artifacts

This project includes precomputed ML artifacts (models and processed data) inside the `backend/artifacts/` directory.

These are included **for demonstration and deployment purposes only**.

| File                   | Description                           |
| ---------------------- | ------------------------------------- |
| `rfm_features.parquet` | Raw RFM metrics per customer          |
| `rfm_scaled.parquet`   | Log-scaled + MinMax normalized RFM    |
| `cleaned_data.parquet` | Cleaned transaction-level data        |
| `personas.json`        | Named persona definitions for k=3,4,5 |
| `kmeans_model.pkl`     | Best K-Means model (highest silhouette score) |

In a production system:
- Artifacts would be stored in external storage (e.g., S3, database, or model registry)
- The pipeline would run separately as part of a scheduled training workflow
- The backend would pull the latest artifacts on each deployment

---

## 📊 Dashboard Features

* 📈 KPI Metrics (Revenue, Customers, Frequency)
* 📊 Cluster Distribution Chart
* 🗂️ Scatter Plot (RFM space)
* 👤 Persona Cards with Actionable Insights
* 🔍 Customer Search with Purchase History
* 🪟 Cluster Drilldown Modal

---

## 🧠 ML Pipeline

1. Data Ingestion (UCI Online Retail Dataset)
2. Data Cleaning (nulls, cancellations, outliers)
3. Feature Engineering (RFM computation)
4. Scaling (log1p transform + MinMax)
5. K-Means Clustering (k = 3, 4, 5)
6. Silhouette Score Evaluation (best k selection)
7. Persona Generation (named segments + recommendations)

---

## 📎 Dataset

UCI Online Retail Dataset
👉 https://www.kaggle.com/datasets/vijayuv/onlineretail

Place the downloaded file at: `backend/data/online_retail.xlsx`

---

## 🛠️ Tech Stack

| Layer    | Technology                        |
| -------- | --------------------------------- |
| Frontend | React + Vite + TailwindCSS        |
| Backend  | FastAPI + Uvicorn                 |
| Auth     | Supabase (JWT / ES256)            |
| ML       | Scikit-learn, Pandas, NumPy       |
| Storage  | Parquet (PyArrow), Joblib         |
| Charts   | Recharts                          |

---

## 🎯 Future Improvements

* Deploy backend on cloud (Render / Railway / AWS)
* Move artifacts to S3 or a model registry
* Add real-time analytics
* Improve clustering using advanced models (DBSCAN, GMM)
* Add role-based access control

---

## 👨‍💻 Author

**Madhav Sai Kiran**
GitHub: https://github.com/Madhavsai07

---

## ⭐ If you like this project

Give it a ⭐ on GitHub — it helps a lot!