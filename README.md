# InsightDrop - Automated Data Analysis

![Python](https://img.shields.io/badge/Python-3.13+-blue)
![License](https://img.shields.io/badge/License-MIT-green)

InsightDrop is a FastAPI web app for quick exploratory data analysis. Upload a CSV or Excel file and review profiling, statistics, correlations, outliers, visualizations, and a data preview from one browser-based dashboard.

## Features

- Drag-and-drop upload for `.csv`, `.xls`, and `.xlsx` files.
- Dataset overview with rows, columns, missing values, duplicates, and quality scoring.
- Descriptive statistics for numeric columns.
- Correlation analysis with heatmaps and ranked relationships.
- IQR-based outlier detection.
- Plotly-powered charts for distributions, categories, missing values, and data types.
- Redesigned frontend workbench served directly by FastAPI.

## Technology Stack

- Backend: FastAPI, Uvicorn, Python
- Data processing: Pandas, NumPy, SciPy, Scikit-learn
- Frontend: Vanilla HTML, CSS, JavaScript
- Charting: Plotly.js

## Getting Started

### Prerequisites

- Python 3.13 or higher

### Install

From the project root:

```bash
python -m venv .venv
```

Activate the virtual environment.

Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

macOS/Linux:

```bash
source .venv/bin/activate
```

Install dependencies from the root:

```bash
python -m pip install -r backend/requirements.txt
```

## Run From The Project Root

Start the full app from the project root. You do not need to `cd backend`.

```bash
python main.py
```

Then open:

```text
http://localhost:8000
```

You can also run the FastAPI app directly from the root:

```bash
python -m uvicorn backend.main:app --reload
```

## Sample Data

A `sample_employees.csv` file is included in the project root. Upload it through the web interface to verify the analysis flow.

## Project Structure

```text
auto-data/
|-- main.py                    # Root launcher for the FastAPI app
|-- README.md
|-- sample_employees.csv
|-- uploads/                   # Uploaded datasets created at runtime
|-- backend/
|   |-- __init__.py
|   |-- main.py                # FastAPI application and endpoints
|   |-- requirements.txt
|   `-- analyzers/
|       |-- __init__.py
|       |-- profiler.py
|       |-- statistics.py
|       |-- correlations.py
|       |-- outliers.py
|       `-- visualizations.py
`-- frontend/
    |-- index.html
    |-- css/
    |   `-- style.css
    `-- js/
        `-- app.js
```

## API Routes

- `POST /api/upload`
- `GET /api/analyze/{dataset_id}`
- `GET /api/profile/{dataset_id}`
- `GET /api/statistics/{dataset_id}`
- `GET /api/correlations/{dataset_id}`
- `GET /api/outliers/{dataset_id}`
- `GET /api/visualizations/{dataset_id}`

## License

This project is licensed under the MIT License.
