"""
InsightDrop — FastAPI Backend
Provides automatic data analysis for any uploaded CSV/Excel dataset.
"""

import os
import uuid
import shutil
from pathlib import Path

import pandas as pd
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from analyzers import (
    DataProfiler,
    StatisticsAnalyzer,
    CorrelationAnalyzer,
    OutlierDetector,
    VisualizationGenerator,
)

app = FastAPI(title="InsightDrop", version="1.0.0")

# CORS — allow frontend to call API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Storage for uploaded datasets (in-memory for MVP)
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
datasets: dict[str, dict] = {}

# Serve frontend
FRONTEND_DIR = Path(__file__).parent.parent / "frontend"
if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")


@app.get("/")
async def serve_frontend():
    """Serve the frontend index.html."""
    index = FRONTEND_DIR / "index.html"
    if index.exists():
        return FileResponse(str(index))
    return {"message": "InsightDrop API is running. Frontend not found."}


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload a CSV or Excel file and get a dataset ID + quick preview."""
    # Validate file type
    ext = Path(file.filename).suffix.lower()
    if ext not in [".csv", ".xlsx", ".xls"]:
        raise HTTPException(400, "Only CSV and Excel files are supported.")

    # Save file
    dataset_id = str(uuid.uuid4())[:8]
    file_path = UPLOAD_DIR / f"{dataset_id}{ext}"

    with open(file_path, "wb") as f:
        shutil.copyfileobj(file.file, f)

    # Read into DataFrame
    try:
        if ext == ".csv":
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path)
    except Exception as e:
        file_path.unlink(missing_ok=True)
        raise HTTPException(400, f"Failed to parse file: {str(e)}")

    # Store reference
    datasets[dataset_id] = {
        "filename": file.filename,
        "path": str(file_path),
        "rows": df.shape[0],
        "columns": df.shape[1],
    }

    return {
        "dataset_id": dataset_id,
        "filename": file.filename,
        "rows": df.shape[0],
        "columns": df.shape[1],
        "column_names": list(df.columns),
        "preview": df.head(5).fillna("null").to_dict(orient="records"),
    }


@app.get("/api/analyze/{dataset_id}")
async def full_analysis(dataset_id: str):
    """Run the complete analysis pipeline on a previously uploaded dataset."""
    df = _load_dataset(dataset_id)

    profiler = DataProfiler(df)
    stats = StatisticsAnalyzer(df)
    corr = CorrelationAnalyzer(df)
    outliers = OutlierDetector(df)
    viz = VisualizationGenerator(df)

    return {
        "dataset_id": dataset_id,
        "filename": datasets[dataset_id]["filename"],
        "profile": profiler.profile(),
        "statistics": stats.analyze(),
        "correlations": corr.analyze(),
        "outliers": outliers.analyze(),
        "visualizations": viz.generate(),
    }


@app.get("/api/profile/{dataset_id}")
async def profile_only(dataset_id: str):
    df = _load_dataset(dataset_id)
    return DataProfiler(df).profile()


@app.get("/api/statistics/{dataset_id}")
async def statistics_only(dataset_id: str):
    df = _load_dataset(dataset_id)
    return StatisticsAnalyzer(df).analyze()


@app.get("/api/correlations/{dataset_id}")
async def correlations_only(dataset_id: str):
    df = _load_dataset(dataset_id)
    return CorrelationAnalyzer(df).analyze()


@app.get("/api/outliers/{dataset_id}")
async def outliers_only(dataset_id: str):
    df = _load_dataset(dataset_id)
    return OutlierDetector(df).analyze()


@app.get("/api/visualizations/{dataset_id}")
async def visualizations_only(dataset_id: str):
    df = _load_dataset(dataset_id)
    return VisualizationGenerator(df).generate()


def _load_dataset(dataset_id: str) -> pd.DataFrame:
    """Load a previously uploaded dataset by ID."""
    if dataset_id not in datasets:
        raise HTTPException(404, f"Dataset '{dataset_id}' not found. Upload first.")

    path = datasets[dataset_id]["path"]
    ext = Path(path).suffix.lower()

    try:
        if ext == ".csv":
            return pd.read_csv(path)
        else:
            return pd.read_excel(path)
    except Exception as e:
        raise HTTPException(500, f"Failed to read dataset: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
