"""
Outlier Detector — Identifies outliers using IQR method.
"""

import pandas as pd
import numpy as np


class OutlierDetector:
    def __init__(self, df: pd.DataFrame):
        self.df = df
        self.numeric_df = df.select_dtypes(include=np.number)

    def analyze(self) -> dict:
        if self.numeric_df.empty:
            return {"columns": [], "total_outliers": 0, "message": "No numeric columns."}

        column_results = []
        total_outliers = 0
        for col in self.numeric_df.columns:
            result = self._iqr_outliers(col)
            column_results.append(result)
            total_outliers += result["outlier_count"]

        most = max(column_results, key=lambda x: x["outlier_count"])["column"] if column_results else None
        affected = [r for r in column_results if r["outlier_count"] > 0]
        high_sev = [r["column"] for r in column_results if r.get("severity") == "high"]
        rec = ("Several columns have significant outliers." if high_sev
               else "Outlier levels are within acceptable ranges.")

        return {
            "columns": column_results,
            "total_outliers": total_outliers,
            "most_outliers_column": most,
            "summary": {
                "columns_with_outliers": len(affected),
                "columns_without_outliers": len(column_results) - len(affected),
                "high_severity_columns": high_sev,
                "recommendation": rec,
            },
        }

    def _iqr_outliers(self, column: str) -> dict:
        series = self.numeric_df[column].dropna()
        if len(series) == 0:
            return {"column": column, "method": "IQR", "outlier_count": 0,
                    "outlier_percentage": 0, "bounds": {"lower": None, "upper": None}, "sample_outliers": []}

        q1, q3 = series.quantile(0.25), series.quantile(0.75)
        iqr = q3 - q1
        lower, upper = q1 - 1.5 * iqr, q3 + 1.5 * iqr
        outliers = series[(series < lower) | (series > upper)]
        pct = round(outliers.count() / len(series) * 100, 2)
        sev = "high" if pct > 10 else "medium" if pct > 5 else "low"

        return {
            "column": column, "method": "IQR",
            "outlier_count": int(outliers.count()), "outlier_percentage": pct,
            "bounds": {"lower": self._s(lower), "upper": self._s(upper)},
            "q1": self._s(q1), "q3": self._s(q3), "iqr": self._s(iqr),
            "sample_outliers": [self._s(v) for v in outliers.head(10).tolist()],
            "severity": sev,
        }

    @staticmethod
    def _s(val):
        if val is None or (isinstance(val, float) and (np.isnan(val) or np.isinf(val))):
            return None
        if isinstance(val, (np.integer,)): return int(val)
        if isinstance(val, (np.floating,)): return round(float(val), 4)
        return val
