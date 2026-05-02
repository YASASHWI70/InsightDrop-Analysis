# InsightDrop - Automated Data Analysis

![Python](https://img.shields.io/badge/Python-3.13+-blue)
![License](https://img.shields.io/badge/License-MIT-green)
![GitHub stars](https://img.shields.io/github/stars/YASASHWI70/InsightDrop-Analysis?style=social)
![GitHub forks](https://img.shields.io/github/forks/YASASHWI70/InsightDrop-Analysis?style=social)
![License](https://img.shields.io/github/license/YASASHWI70/InsightDrop-Analysis)

InsightDrop is a fast, intelligent web application that automatically performs Exploratory Data Analysis (EDA) on any dataset you provide. Simply drag and drop a CSV or Excel file, and get instant, comprehensive insights without writing a single line of code.

##  Features

-  **Drag-and-Drop Upload**: Easily upload any `.csv`, `.xls`, or `.xlsx` file.
-  **Comprehensive Profiling**: Get an immediate overview of your data's shape, data types, missing values, duplicates, and an overall Data Quality Score.
-  **Statistical Summaries**: Automatically computes detailed descriptive statistics (mean, median, standard deviation, skewness, quartiles, and more) for all numeric columns.
-  **Correlation Analysis**: Discovers relationships between variables with correlation heatmaps and identifies the strongest positive and negative correlations.
-  **Outlier Detection**: Automatically flags potential anomalies using the IQR (Interquartile Range) method and assesses severity.
-  **Interactive Visualizations**: Generates dynamic, interactive charts (histograms, box plots, scatter plots, and pie charts) using Plotly.js.

##  Technology Stack

- **Backend**: FastAPI, Python 3.13+
- **Data Processing**: Pandas, NumPy, SciPy, Scikit-learn
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Charting**: Plotly.js

##  Getting Started

### Prerequisites

- Python 3.13 or higher installed on your system.

### Installation

1. **Clone the repository** (or download the source code):
   ```bash
   git clone <repository-url>
   cd auto-data
   ```

2. **Create a virtual environment**:
   ```bash
   python -m venv venv
   ```

3. **Activate the virtual environment**:
   - On Windows:
     ```bash
     .\venv\Scripts\activate
     ```
   - On macOS/Linux:
     ```bash
     source venv/bin/activate
     ```

4. **Install the dependencies**:
   ```bash
   pip install -r backend/requirements.txt
   ```

### Running the Application

1. Ensure your virtual environment is activated.
2. Start the FastAPI server from the `backend` directory:
   ```bash
   cd backend
   python -m uvicorn main:app 
   ```
3. Open your web browser and navigate to: [http://localhost:8000](http://localhost:8000)

##  Project Structure

```
auto-data/
├── backend/
│   ├── main.py                # FastAPI application and endpoints
│   ├── requirements.txt       # Python dependencies
│   └── analyzers/             # Core analysis modules
│       ├── __init__.py
│       ├── profiler.py        # Data profiling logic
│       ├── statistics.py      # Statistical computations
│       ├── correlations.py    # Correlation matrix generation
│       ├── outliers.py        # IQR outlier detection
│       └── visualizations.py  # Chart data preparation for Plotly
├── frontend/
│   ├── index.html             # Main dashboard UI
│   ├── css/
│   │   └── style.css          # Premium dark theme styling
│   └── js/
│       └── app.js             # Client-side logic and API integration
└── sample_employees.csv       # Sample dataset for testing
```

##  Testing with Sample Data

A `sample_employees.csv` file is included in the project root. You can drag and drop this file into the web interface to instantly see the analyzer in action!

## License
This project is licensed under the MIT License.
